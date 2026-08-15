import { createVersionedStorage, type SaveResult, type StorageLike } from '@woodles/persistence';
import {
	BOARD_SCHEMA_VERSION,
	createEmptyBoard,
	isWhiteboardDocument,
	makeId,
	now,
	snapshotDocument,
	upgradeDocument,
	type WhiteboardDocument
} from './model';
import { repairDocument } from './geometry';
import type { TrailStep } from './portals';
import { createWhiteboardStorage, WHITEBOARD_STORAGE_KEY } from './persistence';

export const BOARD_INDEX_KEY = 'woodles.whiteboard.index.v1';
/**
 * Deliberately not `…board.` — that prefix would read the single-board era's
 * `…board.v1` key as a board whose id is `v1`.
 */
export const BOARD_KEY_PREFIX = 'woodles.whiteboard.boards.';
export const ACTIVE_BOARD_KEY = 'woodles.whiteboard.active.v1';
/** How deep you were, not what any board holds — see portals.ts. */
export const TRAIL_KEY = 'woodles.whiteboard.trail.v1';
/** Where the single-board era kept its one and only board. */
export const LEGACY_BOARD_KEY = WHITEBOARD_STORAGE_KEY;

export type BoardSummary = {
	id: string;
	title: string;
	updatedAt: string;
	items: number;
	frames: number;
};

export type OpenedBoard = {
	document: WhiteboardDocument;
	source: 'primary' | 'backup' | 'fallback';
	issue: string | null;
};

function isSummary(value: unknown): value is BoardSummary {
	if (typeof value !== 'object' || value === null) return false;
	const record = value as Record<string, unknown>;
	return typeof record.id === 'string' && typeof record.title === 'string' && typeof record.updatedAt === 'string' &&
		typeof record.items === 'number' && typeof record.frames === 'number';
}

function isSummaryList(value: unknown): value is BoardSummary[] {
	return Array.isArray(value) && value.every(isSummary);
}

function isTrailStep(value: unknown): value is TrailStep {
	if (typeof value !== 'object' || value === null) return false;
	const step = value as Record<string, unknown>;
	const camera = step.camera as Record<string, unknown> | undefined;
	return typeof step.boardId === 'string' && typeof step.title === 'string' &&
		(step.portalId === null || typeof step.portalId === 'string') &&
		typeof camera === 'object' && camera !== null &&
		[camera.x, camera.y, camera.zoom].every((n) => typeof n === 'number' && Number.isFinite(n));
}

export function summarize(document: WhiteboardDocument): BoardSummary {
	const material = document.items.filter((item) => item.type !== 'connector');
	return {
		id: document.board.id,
		title: document.board.title,
		updatedAt: document.updatedAt,
		items: material.length,
		frames: material.filter((item) => item.type === 'frame').length
	};
}

export function boardTitleFallback(title: string): string {
	return title.trim() || 'Untitled whiteboard';
}

export function createBoardLibrary(storage?: StorageLike | null) {
	const injected = storage !== undefined ? { storage } : {};

	function resolveStorage(): StorageLike | null {
		if (storage !== undefined) return storage;
		return typeof localStorage === 'undefined' ? null : localStorage;
	}

	const index = createVersionedStorage<BoardSummary[]>({
		key: BOARD_INDEX_KEY,
		version: 1,
		fallback: () => [],
		validate: isSummaryList,
		migrate: () => [],
		...injected
	});

	function boardStore(id: string) {
		return createVersionedStorage<WhiteboardDocument>({
			key: BOARD_KEY_PREFIX + id,
			version: BOARD_SCHEMA_VERSION,
			fallback: createEmptyBoard,
			validate: isWhiteboardDocument,
			migrate: upgradeDocument,
			...injected
		});
	}

	/** Newest first — a shelf reads better with the board you just left on top. */
	function list(): BoardSummary[] {
		return [...index.load().value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	}

	function writeIndex(entries: BoardSummary[]): void {
		index.save(entries);
	}

	function record(document: WhiteboardDocument): void {
		const summary = summarize(document);
		const entries = index.load().value.filter((entry) => entry.id !== summary.id);
		writeIndex([...entries, summary]);
	}

	function save(document: WhiteboardDocument): SaveResult {
		const result = boardStore(document.board.id).save(snapshotDocument(document));
		if (result.ok) record(document);
		return result;
	}

	function open(id: string): OpenedBoard | null {
		if (!list().some((entry) => entry.id === id)) return null;
		const result = boardStore(id).load();
		if (result.source === 'fallback') {
			// Nothing readable under this id. Rather than hand back a blank board
			// wearing the old one's name, say the entry is gone.
			return { document: repairDocument(result.value), source: 'fallback', issue: result.issue?.message ?? null };
		}
		return {
			document: repairDocument(result.value),
			source: result.source,
			issue: result.issue?.message ?? null
		};
	}

	function create(title = 'Untitled whiteboard'): WhiteboardDocument {
		const document = { ...createEmptyBoard(), board: { id: makeId('board'), title } };
		save(document);
		setActiveId(document.board.id);
		return document;
	}

	function duplicate(id: string): WhiteboardDocument | null {
		const opened = open(id);
		if (!opened) return null;
		const copy: WhiteboardDocument = {
			...snapshotDocument(opened.document),
			board: { id: makeId('board'), title: `${boardTitleFallback(opened.document.board.title)} copy` },
			updatedAt: now()
		};
		save(copy);
		return copy;
	}

	function remove(id: string): void {
		boardStore(id).clear();
		writeIndex(index.load().value.filter((entry) => entry.id !== id));
		if (activeId() === id) clearActiveId();
	}

	function rename(id: string, title: string): void {
		const opened = open(id);
		if (!opened) return;
		save({ ...opened.document, board: { ...opened.document.board, title }, updatedAt: now() });
	}

	function activeId(): string | null {
		const store = resolveStorage();
		if (!store) return null;
		try {
			return store.getItem(ACTIVE_BOARD_KEY);
		} catch {
			return null;
		}
	}

	function setActiveId(id: string): void {
		const store = resolveStorage();
		if (!store) return;
		try {
			store.setItem(ACTIVE_BOARD_KEY, id);
		} catch {
			// A board that cannot remember it was open still opens from the shelf.
		}
	}

	function clearActiveId(): void {
		const store = resolveStorage();
		if (!store) return;
		try {
			store.removeItem(ACTIVE_BOARD_KEY);
		} catch {
			// as above
		}
	}

	/**
	 * Moves the one board of the single-board era onto the shelf. Runs once: the
	 * legacy key is cleared only after its contents are safely written under the
	 * board's own id, so an interrupted migration retries rather than loses.
	 */
	function adoptLegacyBoard(): WhiteboardDocument | null {
		const store = resolveStorage();
		if (!store) return null;
		let raw: string | null = null;
		try {
			raw = store.getItem(LEGACY_BOARD_KEY);
		} catch {
			return null;
		}
		if (!raw) return null;

		const legacy = createWhiteboardStorage(storage);
		const result = legacy.load();
		if (result.source === 'fallback') {
			legacy.clear();
			return null;
		}
		const document = repairDocument(result.value);
		if (!save(document).ok) return null;
		legacy.clear();
		setActiveId(document.board.id);
		return document;
	}

	/**
	 * The way back up, remembered between sessions so reopening resumes where
	 * you were standing rather than at the top. Steps whose board has since
	 * gone are dropped, and with them everything below — you cannot climb down
	 * through a doorway that is no longer there.
	 */
	function readTrail(): TrailStep[] {
		const store = resolveStorage();
		if (!store) return [];
		let raw: string | null = null;
		try {
			raw = store.getItem(TRAIL_KEY);
		} catch {
			return [];
		}
		if (!raw) return [];
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return [];
		}
		if (!Array.isArray(parsed)) return [];
		const known = new Set(list().map((entry) => entry.id));
		const steps: TrailStep[] = [];
		for (const value of parsed) {
			if (!isTrailStep(value) || !known.has(value.boardId)) break;
			steps.push(value);
		}
		return steps;
	}

	function writeTrail(trail: TrailStep[]): void {
		const store = resolveStorage();
		if (!store) return;
		try {
			if (trail.length) store.setItem(TRAIL_KEY, JSON.stringify(trail));
			else store.removeItem(TRAIL_KEY);
		} catch {
			// A trail that cannot be remembered still works for this session.
		}
	}

	/**
	 * Every image asset still spoken for, so deleting one board never takes the
	 * pictures another board is using.
	 */
	function referencedAssets(exceptBoardId?: string): Set<string> {
		const assets = new Set<string>();
		for (const entry of list()) {
			if (entry.id === exceptBoardId) continue;
			const opened = open(entry.id);
			if (!opened) continue;
			for (const item of opened.document.items) {
				if (item.type === 'image') assets.add(item.assetId);
			}
		}
		return assets;
	}

	return {
		list,
		open,
		save,
		create,
		duplicate,
		remove,
		rename,
		activeId,
		setActiveId,
		clearActiveId,
		adoptLegacyBoard,
		readTrail,
		writeTrail,
		referencedAssets
	};
}

export type BoardLibrary = ReturnType<typeof createBoardLibrary>;

export const boardLibrary = createBoardLibrary();
