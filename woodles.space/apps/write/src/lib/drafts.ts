import {
	ACTIVE_DRAFT_ID_KEY,
	DRAFTS_INDEX_KEY,
	DRAFT_PREFIX,
	LEGACY_DRAFT_KEY
} from './storage';
import { createHandoffQueue, type Handoff } from '@woodles/handoff';
import { sanitizeHtml } from './htmlTools';
import { coerceKind, WRITING_KINDS, type WritingKind } from './kinds';
import { importNotebookCaptures } from './notebookImport';
import { importSporesEntries } from './sporesImport';
import { draftStatus, nextDraftStatus, type DraftStatus } from './status';
import type { LayerId, PocketNote, MarginNote } from './types';

export type DraftIndexItem = {
	id: string;
	title: string;
	updatedAt: string;
	/** Absent on pre-kinds entries; read as `letter`. */
	kind?: WritingKind;
	/** Carried from captures that arrived with tags; searchable, not editable here yet. */
	tags?: string[];
	/** Absent means inferred from content — see `draftStatus()` in status.ts. */
	status?: DraftStatus;
};

export interface DraftBody {
	title?: string;
	theme?: string;
	motif?: string;
	font?: string;
	kind?: WritingKind;
	tags?: string[];
	/** Optional word goal for the foreground — see kinds.ts. */
	goal?: number;
	/** Absent means inferred from content — see `draftStatus()` in status.ts. */
	status?: DraftStatus;
	layers?: Partial<Record<LayerId, { html?: string; updatedAt?: string }>>;
	annotations?: { pocketNotes?: PocketNote[]; marginNotes?: MarginNote[] };
	content?: string;
	savedAt?: string;
}

function safeParse<T>(raw: string | null): T | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export function createDraftId(): string {
	return 'd-' + Date.now().toString(36);
}

export function listDrafts(): DraftIndexItem[] {
	if (typeof localStorage === 'undefined') return [];
	const parsed = safeParse<DraftIndexItem[]>(localStorage.getItem(DRAFTS_INDEX_KEY));
	return Array.isArray(parsed) ? parsed : [];
}

export function writeIndex(list: DraftIndexItem[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(DRAFTS_INDEX_KEY, JSON.stringify(list));
	} catch {
		// ignore quota
	}
}

export function getActiveDraftId(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(ACTIVE_DRAFT_ID_KEY);
}

export function setActiveDraftId(id: string): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(ACTIVE_DRAFT_ID_KEY, id);
	} catch {
		// ignore
	}
}

export function clearActiveDraftId(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(ACTIVE_DRAFT_ID_KEY);
}

export function loadDraft(id: string): DraftBody | null {
	if (typeof localStorage === 'undefined') return null;
	return safeParse<DraftBody>(localStorage.getItem(DRAFT_PREFIX + id));
}

export function saveDraft(id: string, body: DraftBody): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(body));
	} catch {
		// ignore quota
	}
}

export function removeDraftBody(id: string): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(DRAFT_PREFIX + id);
}

// Updates the index entry for `id` to reflect the latest title / timestamp.
// If the id isn't in the index yet, appends it. Returns the new list.
// `extras` (kind, tags) are merged when given and left alone when not, so
// callers that only know about titles can't erase what another caller wrote.
export function upsertIndex(
	list: DraftIndexItem[],
	id: string,
	title: string,
	updatedAt: string,
	extras: Pick<DraftIndexItem, 'kind' | 'tags' | 'status'> = {}
): DraftIndexItem[] {
	const next = [...list];
	const idx = next.findIndex((d) => d.id === id);
	if (idx >= 0) {
		next[idx] = { ...next[idx], title, updatedAt, ...extras };
	} else {
		next.push({ id, title, updatedAt, ...extras });
	}
	return next;
}

/**
 * The drafts list, searchable and filterable — what keeps a flat list livable
 * once letters, essays, stories, and migrated captures all share it.
 * Matches title and tags; a null kind means everything.
 */
export function filterDrafts(
	list: DraftIndexItem[],
	query: string,
	kind: WritingKind | null
): DraftIndexItem[] {
	const q = query.trim().toLowerCase();
	return list.filter((d) => {
		if (kind !== null && coerceKind(d.kind) !== kind) return false;
		if (!q) return true;
		return [d.title, ...(d.tags ?? [])].join(' ').toLowerCase().includes(q);
	});
}

/** Which kinds actually appear in the list, in canonical order — for filter chips. */
export function kindsPresent(list: DraftIndexItem[]): WritingKind[] {
	const present = new Set(list.map((d) => coerceKind(d.kind)));
	return WRITING_KINDS.filter((kind) => present.has(kind));
}

export type TagCount = { tag: string; count: number };

/**
 * Tags across the drafts list, aggregated case-insensitively and sorted by
 * frequency then name — Spores' `tagCounts`, ported for the same job: a
 * browse-by-tag row, now that links between drafts are Write's own job too
 * (see `references.svelte.ts`'s draft source and `backlinks.ts`).
 */
export function tagCounts(list: DraftIndexItem[]): TagCount[] {
	const groups = new Map<string, { display: Map<string, number>; count: number }>();
	for (const d of list) {
		for (const raw of d.tags ?? []) {
			const tag = raw.trim();
			if (!tag) continue;
			const key = tag.toLowerCase();
			const group = groups.get(key) ?? { display: new Map(), count: 0 };
			group.count += 1;
			group.display.set(tag, (group.display.get(tag) ?? 0) + 1);
			groups.set(key, group);
		}
	}
	const result: TagCount[] = [];
	for (const group of groups.values()) {
		let best = '';
		let bestCount = -1;
		for (const [display, count] of group.display) {
			if (count > bestCount) {
				best = display;
				bestCount = count;
			}
		}
		result.push({ tag: best, count: group.count });
	}
	return result.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

function hasWordsIn(id: string): boolean {
	return Boolean(loadDraft(id)?.layers?.foreground?.html?.trim());
}

/** Advance a draft's status one step and persist it to the index. Forward-only. */
export function cycleDraftStatus(list: DraftIndexItem[], id: string): DraftIndexItem[] {
	const current = list.find((d) => d.id === id);
	if (!current) return list;
	const next = nextDraftStatus(draftStatus(current.status, hasWordsIn(id)));
	const updated = list.map((d) => (d.id === id ? { ...d, status: next } : d));
	writeIndex(updated);
	return updated;
}

/** Each draft's effective status — explicit, or inferred from its foreground. */
export function statusesFor(list: DraftIndexItem[]): Map<string, DraftStatus> {
	const map = new Map<string, DraftStatus>();
	for (const item of list) map.set(item.id, draftStatus(item.status, hasWordsIn(item.id)));
	return map;
}

// One-time migration: if there's an old single-draft key and no
// indexed drafts yet, promote it to the new format. Returns the seeded
// index entry, or null if nothing to migrate.
export function migrateLegacyDraft(): { id: string; entry: DraftIndexItem } | null {
	if (typeof localStorage === 'undefined') return null;
	const oldRaw = localStorage.getItem(LEGACY_DRAFT_KEY);
	if (!oldRaw) return null;
	const id = createDraftId();
	try {
		localStorage.setItem(DRAFT_PREFIX + id, oldRaw);
		localStorage.removeItem(LEGACY_DRAFT_KEY);
	} catch {
		return null;
	}
	const parsed = safeParse<DraftBody>(oldRaw);
	const entry: DraftIndexItem = {
		id,
		title: parsed?.title || 'untitled',
		updatedAt: parsed?.savedAt || new Date().toISOString()
	};
	return { id, entry };
}

// ── handoffs ────────────────────────────────────────────────────────
// A thought that started somewhere else — a note, a spore — and turned out
// to want real prose. It arrives as its own draft rather than being pasted
// into whatever happened to be open. See CONVERGENCE.md §3.

const handoffQueue = createHandoffQueue('write');

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// Plain text arrives from apps whose bodies are bare textareas. Blank lines
// separate paragraphs; single newlines stay soft breaks within one.
export function textToHtml(text: string): string {
	const blocks = text
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter(Boolean);
	if (blocks.length === 0) return '';
	return blocks
		.map((block) => '<p>' + escapeHtml(block).replace(/\n/g, '<br>') + '</p>')
		.join('');
}

export function handoffToDraftBody(item: Handoff): DraftBody {
	const stamp = new Date().toISOString();
	// An HTML body is untrusted the same way pasted content is — it may have
	// come from a model's output two apps ago — so it goes through the same
	// sanitizer before it can ever reach the publish path.
	const html = item.format === 'html' ? sanitizeHtml(item.body) : textToHtml(item.body);
	return {
		title: item.title,
		...(item.tags.length > 0 ? { tags: item.tags } : {}),
		layers: { foreground: { html, updatedAt: stamp } },
		savedAt: stamp
	};
}

export interface HandoffIngestResult {
	drafts: DraftIndexItem[];
	/** The newest arrival, to open on load. Null when nothing was waiting. */
	activeId: string | null;
	count: number;
}

/**
 * Turn everything waiting into drafts, newest last so it lands on top of the
 * index and becomes the one that opens.
 */
export function ingestHandoffs(index: DraftIndexItem[]): HandoffIngestResult {
	const { items } = handoffQueue.drain();
	if (items.length === 0) return { drafts: index, activeId: null, count: 0 };

	let drafts = index;
	let activeId: string | null = null;
	for (const item of items) {
		const id = createDraftId() + '-' + item.id.slice(-4);
		const body = handoffToDraftBody(item);
		saveDraft(id, body);
		drafts = upsertIndex(
			drafts,
			id,
			body.title ?? '',
			body.savedAt ?? new Date().toISOString(),
			body.tags ? { tags: body.tags } : {}
		);
		activeId = id;
	}
	writeIndex(drafts);
	return { drafts, activeId, count: items.length };
}

/** How many are waiting, for a badge. Does not consume them. */
export function pendingHandoffs(): number {
	return handoffQueue.count();
}

export interface BootstrapResult {
	drafts: DraftIndexItem[];
	activeId: string;
	body: DraftBody | null;
	/** How many arrived from another app on this load. */
	handoffs: number;
	/** How many notebook captures moved in when that app retired. */
	notebookImports: number;
	/** How many spores moved in when that app retired. */
	sporesImports: number;
}

// Returns the initial draft state for the app on first paint. Performs
// the legacy migration, seeds an empty index when needed, and loads the
// active draft body.
export function bootstrap(): BootstrapResult {
	let drafts = listDrafts();
	let activeId = getActiveDraftId();

	if (!activeId) {
		const migrated = migrateLegacyDraft();
		if (migrated) {
			activeId = migrated.id;
			drafts = [migrated.entry];
		} else {
			activeId = createDraftId();
			drafts = [{ id: activeId, title: '', updatedAt: new Date().toISOString() }];
		}
		writeIndex(drafts);
		setActiveDraftId(activeId);
	}

	// Notebook's captures, carried in once after that app retired. An archive
	// arrives quietly — it fills the drafts list without stealing the opening
	// slot the way a live handoff (below) deliberately does.
	const imported = importNotebookCaptures(drafts);
	if (imported.count > 0) {
		drafts = imported.drafts;
		writeIndex(drafts);
	}

	// Spores, carried in once after that app retired — same quiet-archive
	// stance as the notebook import above. See sporesImport.ts.
	const sporesImported = importSporesEntries(drafts);
	if (sporesImported.count > 0) {
		drafts = sporesImported.drafts;
		writeIndex(drafts);
	}

	// Anything sent here from another app becomes its own draft and wins the
	// opening slot — it's the thing you came to write.
	const caught = ingestHandoffs(drafts);
	drafts = caught.drafts;
	if (caught.activeId) {
		activeId = caught.activeId;
		setActiveDraftId(activeId);
	}

	const body = loadDraft(activeId);
	return {
		drafts,
		activeId,
		body,
		handoffs: caught.count,
		notebookImports: imported.count,
		sporesImports: sporesImported.count
	};
}
