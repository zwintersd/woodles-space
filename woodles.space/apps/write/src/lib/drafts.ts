import {
	ACTIVE_DRAFT_ID_KEY,
	DRAFTS_INDEX_KEY,
	DRAFT_PREFIX,
	LEGACY_DRAFT_KEY
} from './storage';
import { createHandoffQueue, type Handoff } from '@woodles/handoff';
import { sanitizeHtml } from './htmlTools';
import type { LayerId, PocketNote, MarginNote } from './types';

export type DraftIndexItem = { id: string; title: string; updatedAt: string };

export interface DraftBody {
	title?: string;
	theme?: string;
	motif?: string;
	font?: string;
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
export function upsertIndex(
	list: DraftIndexItem[],
	id: string,
	title: string,
	updatedAt: string
): DraftIndexItem[] {
	const next = [...list];
	const idx = next.findIndex((d) => d.id === id);
	if (idx >= 0) {
		next[idx] = { ...next[idx], title, updatedAt };
	} else {
		next.push({ id, title, updatedAt });
	}
	return next;
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

function escapeHtml(text: string): string {
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
		drafts = upsertIndex(drafts, id, body.title ?? '', body.savedAt ?? new Date().toISOString());
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

	// Anything sent here from another app becomes its own draft and wins the
	// opening slot — it's the thing you came to write.
	const caught = ingestHandoffs(drafts);
	drafts = caught.drafts;
	if (caught.activeId) {
		activeId = caught.activeId;
		setActiveDraftId(activeId);
	}

	const body = loadDraft(activeId);
	return { drafts, activeId, body, handoffs: caught.count };
}
