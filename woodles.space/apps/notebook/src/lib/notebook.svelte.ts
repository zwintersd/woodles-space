import type { Capture, Lane } from './types';
import { LANES } from './types';
import { createVersionedStorage, type PersistenceIssue } from '@woodles/persistence';
import { htmlToText } from '@woodles/text';
import {
	createHandoffQueue,
	type Handoff,
	type HandoffTarget,
	type SendResult
} from '@woodles/handoff';

function uid(): string {
	return Math.random().toString(36).slice(2, 10);
}

function nowIso(): string {
	return new Date().toISOString();
}

const WORKSPACE_KEY = 'notebook.workspace.v3';

/**
 * The v2 document is read for its notes and ideas and then **left alone**.
 * Carillon reads the same key for the tasks it took over, so leaving it makes
 * the two migrations order-independent — whichever app you open first, nothing
 * is read out from under the other and nothing is stranded.
 */
const WORKSPACE_V2_KEY = 'notebook.workspace.v2';

const LEGACY_V1_KEYS = {
	selectedNoteId: 'notebook.selectedNote.v1',
	notes: 'notebook.notes.v1',
	tasks: 'notebook.tasks.v1',
	ideas: 'notebook.ideas.v1'
} as const;

const STARTER_ID = 'capture-home';

type NotebookDocument = {
	selectedId: string | null;
	captures: Capture[];
};

export type NotebookPersistenceHealth = {
	status: 'idle' | 'saved' | 'recovered' | 'error';
	message: string;
	bytes: number;
	savedAt: string | null;
};

function starterDocument(): NotebookDocument {
	const stamp = nowIso();
	return {
		selectedId: STARTER_ID,
		captures: [
			{
				id: STARTER_ID,
				title: 'Home',
				body: '',
				tags: ['inbox'],
				lane: 'spark',
				createdAt: stamp,
				updatedAt: stamp
			}
		]
	};
}

const persistence = createVersionedStorage<NotebookDocument>({
	key: WORKSPACE_KEY,
	version: 3,
	fallback: starterDocument,
	validate: isNotebookDocument
});

const handoffQueue = createHandoffQueue('notebook');

function firstLine(text: string): string {
	return text.split('\n').find((line) => line.trim())?.trim().slice(0, 60) ?? '';
}

function dedupeTags(tags: string[]): string[] {
	const seen = new Set<string>();
	return tags.filter((tag) => {
		const key = tag.toLowerCase();
		if (!tag || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export class NotebookStore {
	query = $state('');
	/** null means "everything" — the default, because filtering is a choice. */
	laneFilter = $state<Lane | null>(null);
	selectedId = $state<string | null>(STARTER_ID);
	captures = $state<Capture[]>([]);
	persistenceHealth = $state<NotebookPersistenceHealth>({
		status: 'idle',
		message: 'stored on this device',
		bytes: 0,
		savedAt: null
	});
	private ingestedHandoffIds = new Set<string>();

	constructor() {
		let result = persistence.load();
		if (result.source === 'fallback' && !result.issue) {
			const carried = readEarlierDocument();
			if (carried.issue) {
				result = { ...result, issue: carried.issue };
			} else if (carried.value) {
				const saved = persistence.save(carried.value);
				if (saved.ok) {
					result = {
						value: carried.value,
						source: 'primary',
						migrated: true,
						issue: null,
						savedAt: saved.savedAt,
						bytes: saved.bytes
					};
				}
			}
		}

		this.applyDocument(result.value);
		if (result.source === 'backup') {
			this.persistenceHealth = {
				status: 'recovered',
				message: 'restored the last-known-good notebook backup',
				bytes: result.bytes,
				savedAt: result.savedAt
			};
		} else if (result.issue) {
			this.setPersistenceError(result.issue);
		} else if (result.source === 'primary') {
			this.persistenceHealth = {
				status: 'saved',
				message: result.migrated ? 'notebook upgraded and saved' : 'saved on this device',
				bytes: result.bytes,
				savedAt: result.savedAt
			};
		}
	}

	get selected(): Capture | null {
		return this.captures.find((c) => c.id === this.selectedId) ?? this.captures[0] ?? null;
	}

	get filtered(): Capture[] {
		const q = this.query.trim().toLowerCase();
		let list = [...this.captures].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
		if (this.laneFilter) list = list.filter((c) => c.lane === this.laneFilter);
		if (!q) return list;
		return list.filter((c) =>
			[c.title, c.body, c.tags.join(' ')].join(' ').toLowerCase().includes(q)
		);
	}

	laneCount(lane: Lane): number {
		return this.captures.filter((c) => c.lane === lane).length;
	}

	setLaneFilter(lane: Lane | null): void {
		this.laneFilter = this.laneFilter === lane ? null : lane;
	}

	select(id: string): void {
		this.selectedId = id;
		this.persist();
	}

	/** The whole point of the front door: this never asks anything first. */
	add(partial: Partial<Pick<Capture, 'title' | 'body' | 'tags' | 'lane'>> = {}): Capture {
		const stamp = nowIso();
		const capture: Capture = {
			id: uid(),
			title: partial.title ?? '',
			body: partial.body ?? '',
			tags: partial.tags ?? [],
			lane: partial.lane ?? 'spark',
			createdAt: stamp,
			updatedAt: stamp
		};
		this.captures = [capture, ...this.captures];
		this.selectedId = capture.id;
		this.persist();
		return capture;
	}

	update(id: string, patch: Partial<Pick<Capture, 'title' | 'body' | 'tags' | 'lane'>>): void {
		const stamp = nowIso();
		this.captures = this.captures.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: stamp } : c));
		this.persist();
	}

	move(id: string, lane: Lane): void {
		this.update(id, { lane });
	}

	remove(id: string): void {
		if (this.captures.length <= 1) return;
		this.captures = this.captures.filter((c) => c.id !== id);
		if (this.selectedId === id) this.selectedId = this.captures[0]?.id ?? null;
		this.persist();
	}

	// ── handoffs ────────────────────────────────────────────────────

	/** Take everything waiting and turn each into a capture. Safe to repeat. */
	ingestHandoffs(): number {
		const drained = handoffQueue.drain();
		const fresh = drained.items.filter((item) => !this.ingestedHandoffIds.has(item.id));
		for (const item of fresh) this.ingestedHandoffIds.add(item.id);
		if (fresh.length === 0) return 0;

		const arrivals = fresh.map((item) => this.handoffToCapture(item));
		this.captures = [...arrivals, ...this.captures];
		this.selectedId = arrivals[0].id;
		this.persist();
		return arrivals.length;
	}

	pendingHandoffs(): number {
		return handoffQueue.count();
	}

	/** Hand a capture on to an app that can do more with it than this can. */
	promote(id: string, target: HandoffTarget): SendResult | null {
		const capture = this.captures.find((c) => c.id === id);
		if (!capture) return null;
		return createHandoffQueue(target).send({
			title: capture.title,
			body: capture.body,
			format: 'text',
			tags: capture.tags,
			source: { app: 'notebook', label: capture.title || 'a capture', href: '/notebook' }
		});
	}

	private handoffToCapture(item: Handoff): Capture {
		const stamp = nowIso();
		const body = item.format === 'html' ? htmlToText(item.body) : item.body;
		return {
			id: uid(),
			title: item.title.trim() || firstLine(body),
			body,
			tags: dedupeTags([...item.tags, `from:${item.source.app}`]),
			lane: 'spark',
			createdAt: item.createdAt,
			updatedAt: stamp
		};
	}

	// ── persistence ─────────────────────────────────────────────────

	exportJSON(): string {
		return persistence.exportText(this.document);
	}

	importJSON(text: string): { ok: boolean; message: string } {
		const result = persistence.importText(text);
		if (!result.ok || !result.value) {
			this.setPersistenceError(result.issue);
			return { ok: false, message: result.issue?.message ?? 'Could not import that notebook.' };
		}
		this.applyDocument(result.value);
		this.persistenceHealth = {
			status: 'saved',
			message: result.migrated ? 'imported and upgraded notebook' : 'imported notebook',
			bytes: result.bytes,
			savedAt: result.savedAt
		};
		return { ok: true, message: this.persistenceHealth.message };
	}

	private get document(): NotebookDocument {
		return { selectedId: this.selectedId, captures: this.captures };
	}

	private applyDocument(document: NotebookDocument): void {
		this.captures = document.captures;
		this.selectedId =
			document.selectedId && document.captures.some((c) => c.id === document.selectedId)
				? document.selectedId
				: document.captures[0]?.id ?? null;
	}

	private persist(): void {
		const result = persistence.save(this.document);
		if (!result.ok) {
			this.setPersistenceError(result.issue);
			return;
		}
		this.persistenceHealth = {
			status: 'saved',
			message: 'saved on this device',
			bytes: result.bytes,
			savedAt: result.savedAt
		};
	}

	private setPersistenceError(issue: PersistenceIssue | null): void {
		this.persistenceHealth = {
			status: 'error',
			message: issue?.message ?? 'The notebook could not be saved.',
			bytes: this.persistenceHealth.bytes,
			savedAt: this.persistenceHealth.savedAt
		};
	}
}

// ── carrying earlier versions forward ─────────────────────────────

/** Notes and ideas become captures. Tasks are Carillon's now, so they are
 *  read past rather than converted — see notebookTasks.ts over there. */
export function toCaptures(notes: unknown, ideas: unknown): Capture[] {
	const captures: Capture[] = [];

	if (Array.isArray(notes)) {
		for (const note of notes) {
			if (!isRecord(note)) continue;
			const stamp = typeof note.updatedAt === 'string' ? note.updatedAt : nowIso();
			captures.push({
				id: typeof note.id === 'string' ? note.id : uid(),
				title: typeof note.title === 'string' ? note.title : '',
				body: typeof note.body === 'string' ? note.body : '',
				tags: Array.isArray(note.tags) ? note.tags.filter((t) => typeof t === 'string') : [],
				// A note was something being worked on rather than a passing
				// spark, so it lands mid-stream rather than at the front.
				lane: 'shape',
				createdAt: typeof note.createdAt === 'string' ? note.createdAt : stamp,
				updatedAt: stamp
			});
		}
	}

	if (Array.isArray(ideas)) {
		for (const idea of ideas) {
			if (!isRecord(idea) || typeof idea.text !== 'string') continue;
			const stamp = typeof idea.createdAt === 'string' ? idea.createdAt : nowIso();
			captures.push({
				id: typeof idea.id === 'string' ? idea.id : uid(),
				// An idea was one line with no title. Keeping the title empty is
				// truer than inventing one from its own body.
				title: '',
				body: idea.text,
				tags: [],
				lane: LANES.find((lane) => lane === idea.lane) ?? 'spark',
				createdAt: stamp,
				updatedAt: stamp
			});
		}
	}

	return captures.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function readEarlierDocument(): {
	value: NotebookDocument | null;
	issue: PersistenceIssue | null;
} {
	if (typeof localStorage === 'undefined') return { value: null, issue: null };

	const v2 = localStorage.getItem(WORKSPACE_V2_KEY);
	if (v2) {
		try {
			const parsed = JSON.parse(v2);
			const document = isRecord(parsed) && isRecord(parsed.data) ? parsed.data : parsed;
			if (!isRecord(document)) throw new Error('shape');
			const captures = toCaptures(document.notes, document.ideas);
			return captures.length > 0
				? { value: { selectedId: captures[0].id, captures }, issue: null }
				: { value: null, issue: null };
		} catch {
			return {
				value: null,
				issue: { kind: 'parse', message: 'The previous notebook data is not valid JSON.' }
			};
		}
	}

	const values = Object.values(LEGACY_V1_KEYS).map((key) => localStorage.getItem(key));
	if (values.every((value) => value === null)) return { value: null, issue: null };
	try {
		const captures = toCaptures(
			values[1] === null ? [] : JSON.parse(values[1]),
			values[3] === null ? [] : JSON.parse(values[3])
		);
		return captures.length > 0
			? { value: { selectedId: captures[0].id, captures }, issue: null }
			: { value: null, issue: null };
	} catch {
		return {
			value: null,
			issue: { kind: 'parse', message: 'The legacy notebook data is not valid JSON.' }
		};
	}
}

function isNotebookDocument(value: unknown): value is NotebookDocument {
	if (!isRecord(value)) return false;
	return (
		(value.selectedId === null || typeof value.selectedId === 'string') &&
		Array.isArray(value.captures) &&
		value.captures.length > 0 &&
		value.captures.every(isCapture)
	);
}

function isCapture(value: unknown): value is Capture {
	return (
		isRecord(value) &&
		['id', 'title', 'body', 'createdAt', 'updatedAt'].every(
			(key) => typeof value[key] === 'string'
		) &&
		LANES.some((lane) => lane === value.lane) &&
		Array.isArray(value.tags) &&
		value.tags.every((tag) => typeof tag === 'string')
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const notebook = new NotebookStore();
