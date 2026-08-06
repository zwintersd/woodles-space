import { textToHtml, saveDraft, upsertIndex, type DraftBody, type DraftIndexItem } from './drafts';

/**
 * One-way import of Notebook's captures into Write.
 *
 * Notebook was the front door — one stream a thought could land in without
 * deciding where it belonged. That job moved here when the app retired:
 * Write's drafts always accept, and a capture that grows up can become an
 * essay or a story without leaving the room. Same retirement pattern as the
 * Dev Log → Spores import (CONVERGENCE.md step 2): run once, flagged, and
 * **non-destructive** — the notebook keys are read and left in place, so
 * nothing is stranded if this ever needs to be re-examined.
 *
 * The stranded handoff queue is the one exception: `woodles.handoff.notebook.v1`
 * may still hold thoughts sent toward an app that no longer exists to drain
 * them. Those become drafts too, and that key alone is removed — a queue is a
 * hallway, not a home.
 */

export const NOTEBOOK_V3_KEY = 'notebook.workspace.v3';
export const NOTEBOOK_V3_BACKUP_KEY = 'notebook.workspace.v3.backup';
export const NOTEBOOK_HANDOFF_KEY = 'woodles.handoff.notebook.v1';
export const NOTEBOOK_IMPORT_FLAG_KEY = 'woodles_notebook_import_done';

/** Notebook's untouched starter capture — an empty "Home" nobody wrote. */
const STARTER_ID = 'capture-home';

type CaptureLike = {
	id: string;
	title: string;
	body: string;
	tags: string[];
	updatedAt: string;
};

export type NotebookImportResult = {
	drafts: DraftIndexItem[];
	count: number;
};

function safeParse(raw: string | null): unknown {
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Both notebook stores wrap their document in a @woodles/persistence envelope. */
function unwrapEnvelope(parsed: unknown): unknown {
	if (isRecord(parsed) && parsed.woodles === 'woodles-persistence') return parsed.data;
	return parsed;
}

// Defensive per-field reads, the same stance toCaptures took in the app this
// replaces: a malformed entry is skipped, never fatal to its neighbors.
function toCaptureLike(value: unknown): CaptureLike | null {
	if (!isRecord(value)) return null;
	if (typeof value.body !== 'string' && typeof value.title !== 'string') return null;
	return {
		id: typeof value.id === 'string' ? value.id : Math.random().toString(36).slice(2, 10),
		title: typeof value.title === 'string' ? value.title : '',
		body: typeof value.body === 'string' ? value.body : '',
		tags: Array.isArray(value.tags) ? value.tags.filter((t) => typeof t === 'string') : [],
		updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString()
	};
}

function readCaptures(storage: Storage): CaptureLike[] {
	const primary = unwrapEnvelope(safeParse(storage.getItem(NOTEBOOK_V3_KEY)));
	const backup = unwrapEnvelope(safeParse(storage.getItem(NOTEBOOK_V3_BACKUP_KEY)));
	const document = isRecord(primary) && Array.isArray(primary.captures) ? primary : backup;
	if (!isRecord(document) || !Array.isArray(document.captures)) return [];
	return document.captures
		.map(toCaptureLike)
		.filter((c): c is CaptureLike => c !== null)
		.filter((c) => !(c.id === STARTER_ID && !c.body.trim()));
}

function readStrandedHandoffs(storage: Storage): CaptureLike[] {
	const parsed = unwrapEnvelope(safeParse(storage.getItem(NOTEBOOK_HANDOFF_KEY)));
	if (!isRecord(parsed) || !Array.isArray(parsed.items)) return [];
	return parsed.items.map(toCaptureLike).filter((c): c is CaptureLike => c !== null);
}

function captureToDraft(capture: CaptureLike): DraftBody {
	return {
		title: capture.title,
		kind: 'note',
		...(capture.tags.length > 0 ? { tags: capture.tags } : {}),
		layers: { foreground: { html: textToHtml(capture.body), updatedAt: capture.updatedAt } },
		savedAt: capture.updatedAt
	};
}

/**
 * Turn every notebook capture into its own draft. Runs once — flagged, like
 * Carillon's task takeover — and dedupes by deterministic id (`d-nb-<capture id>`)
 * so even a lost flag cannot double a draft. Unlike a live handoff, an
 * arriving archive does not steal the opening slot: these land in the drafts
 * list, announced, while whatever you were writing stays open.
 */
export function importNotebookCaptures(index: DraftIndexItem[]): NotebookImportResult {
	if (typeof localStorage === 'undefined') return { drafts: index, count: 0 };
	if (localStorage.getItem(NOTEBOOK_IMPORT_FLAG_KEY)) return { drafts: index, count: 0 };

	const arrivals = [...readCaptures(localStorage), ...readStrandedHandoffs(localStorage)];

	let drafts = index;
	let count = 0;
	for (const capture of arrivals) {
		const id = 'd-nb-' + capture.id;
		if (drafts.some((d) => d.id === id)) continue;
		const body = captureToDraft(capture);
		saveDraft(id, body);
		drafts = upsertIndex(drafts, id, capture.title, capture.updatedAt, {
			kind: 'note',
			...(capture.tags.length > 0 ? { tags: capture.tags } : {})
		});
		count += 1;
	}

	try {
		localStorage.setItem(NOTEBOOK_IMPORT_FLAG_KEY, new Date().toISOString());
		localStorage.removeItem(NOTEBOOK_HANDOFF_KEY);
	} catch {
		// A full store can't take the flag — the deterministic ids above are
		// what keeps a re-run from doubling anything.
	}

	return { drafts, count };
}
