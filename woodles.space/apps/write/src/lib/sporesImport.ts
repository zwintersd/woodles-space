import { referenceHtml } from '@woodles/text';
import { escapeHtml, saveDraft, upsertIndex, type DraftBody, type DraftIndexItem } from './drafts';
import type { DraftStatus } from './status';
import { DRAFT_STATUSES } from './status';

/**
 * One-way import of Spores into Write.
 *
 * Spores absorbed the Ologypedia Textbook and the retired Dev Log
 * (CONVERGENCE.md steps 2 and 4) and became the workspace's knowledge base:
 * `Spore` (title, body, typed `data`, tags, status, `[[wikilinks]]`),
 * `Spellbook` (a named collection) and `Flight` (an explicit edge between two
 * spores). Write now does the two jobs that made Spores worth keeping —
 * writing prose and linking between pieces of it — so rather than build a
 * second interlinked knowledge base, this moves the data across, same
 * retirement pattern as `notebookImport.ts`: run once, flagged, and
 * **non-destructive** — the `spores.*.v1` keys are read and left in place.
 *
 * Three things are deliberately lossy, each a choice rather than an oversight:
 *
 * - **`[[wikilinks]]` become `data-ref-*` anchors**, Write's own reference
 *   format (see `references.svelte.ts`'s draft source), resolved against the
 *   titles in this same export. A link to a title outside the export — a
 *   spore that was itself dropped, or a typo nothing ever answered to —
 *   flattens to its display text rather than becoming a dead reference,
 *   because there is no live "sow a seed" gesture to offer during a batch
 *   import the way Spores' own reader had while you were reading.
 * - **`Flight`s are dropped.** An explicit edge with no prose around it has
 *   no natural home in a body that's read as text and references — the same
 *   call CONVERGENCE.md §0 made about the Dev Log's chronological view: not
 *   worth a special case for one field.
 * - **Covers are dropped** (`accent`, `glyph`, `blurb`). Write has no shelf of
 *   cards to put them on; `status` is the one piece of the Textbook's
 *   lifecycle worth carrying, and it survives (see `status.ts`).
 *
 * A spore with no body (a worldbuilding record migrated from the Dev Log,
 * whose fields lived entirely in `data`) gets a body synthesized from its
 * fields, so the words in it aren't stranded on an app that no longer exists.
 */

export const SPORES_SPORES_KEY = 'spores.spores.v1';
export const SPORES_SPELLBOOKS_KEY = 'spores.spellbooks.v1';
export const SPORES_IMPORT_FLAG_KEY = 'woodles_spores_import_done';

type RawSpore = {
	id?: unknown;
	title?: unknown;
	body?: unknown;
	data?: unknown;
	spellbookIds?: unknown;
	tags?: unknown;
	created?: unknown;
	updated?: unknown;
	status?: unknown;
};

type RawSpellbook = { id?: unknown; title?: unknown };

type SporeLike = {
	id: string;
	title: string;
	body: string;
	data: Record<string, unknown>;
	spellbookIds: string[];
	tags: string[];
	updated: string;
	status: DraftStatus | undefined;
};

export type SporesImportResult = {
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

function str(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function toStatus(value: unknown): DraftStatus | undefined {
	return typeof value === 'string' && DRAFT_STATUSES.includes(value as DraftStatus)
		? (value as DraftStatus)
		: undefined;
}

function toSpore(value: RawSpore): SporeLike | null {
	if (typeof value.id !== 'string' || typeof value.title !== 'string') return null;
	return {
		id: value.id,
		title: value.title,
		body: str(value.body),
		data: isRecord(value.data) ? value.data : {},
		spellbookIds: Array.isArray(value.spellbookIds)
			? value.spellbookIds.filter((s): s is string => typeof s === 'string')
			: [],
		tags: Array.isArray(value.tags) ? value.tags.filter((t): t is string => typeof t === 'string') : [],
		updated: str(value.updated) || str(value.created) || new Date().toISOString(),
		status: toStatus(value.status)
	};
}

function readSpores(storage: Storage): SporeLike[] {
	const parsed = safeParse(storage.getItem(SPORES_SPORES_KEY));
	if (!Array.isArray(parsed)) return [];
	return parsed.map((s) => toSpore(s as RawSpore)).filter((s): s is SporeLike => s !== null);
}

function readSpellbookTitles(storage: Storage): Map<string, string> {
	const parsed = safeParse(storage.getItem(SPORES_SPELLBOOKS_KEY));
	const titles = new Map<string, string>();
	if (!Array.isArray(parsed)) return titles;
	for (const entry of parsed as RawSpellbook[]) {
		if (typeof entry?.id === 'string' && typeof entry?.title === 'string' && entry.title.trim()) {
			titles.set(entry.id, entry.title.trim());
		}
	}
	return titles;
}

function normalizeTitle(title: string): string {
	return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

const WIKILINK = /\[\[([^\]|[]+)(?:\|([^\][]*))?\]\]/g;

/** A spore's body, with `[[wikilinks]]` resolved into draft references where possible. */
function renderInline(text: string, draftIdByTitle: Map<string, string>): string {
	let out = '';
	let cursor = 0;
	WIKILINK.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = WIKILINK.exec(text)) !== null) {
		out += escapeHtml(text.slice(cursor, match.index));
		const target = match[1].trim();
		const display = (match[2]?.trim() || target) || target;
		const draftId = draftIdByTitle.get(normalizeTitle(target));
		out += draftId
			? referenceHtml({ app: 'write', kind: 'draft', id: draftId, text: display })
			: escapeHtml(display);
		cursor = match.index + match[0].length;
	}
	out += escapeHtml(text.slice(cursor));
	return out;
}

function fieldLabel(key: string): string {
	const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A worldbuilding spore's typed `data` fields, read as plain lines — the
 *  closest thing to prose a structured record without a body has. */
function dataAsBody(data: Record<string, unknown>): string {
	return Object.entries(data)
		.filter(([, value]) => value !== undefined && value !== null && value !== '')
		.map(([key, value]) => `${fieldLabel(key)}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
		.join('\n\n');
}

function sporeBodyToHtml(spore: SporeLike, draftIdByTitle: Map<string, string>): string {
	const source = spore.body.trim() ? spore.body : dataAsBody(spore.data);
	const blocks = source
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter(Boolean);
	if (blocks.length === 0) return '';
	return blocks.map((block) => '<p>' + renderInline(block, draftIdByTitle).replace(/\n/g, '<br>') + '</p>').join('');
}

function sporeTags(spore: SporeLike, spellbookTitles: Map<string, string>): string[] {
	const tags = [...spore.tags, 'from:spores'];
	for (const spellbookId of spore.spellbookIds) {
		const title = spellbookTitles.get(spellbookId);
		if (title) tags.push(`spellbook:${title}`);
	}
	return tags;
}

/**
 * Turn every spore into its own draft. Runs once — flagged, like the notebook
 * import — and dedupes by deterministic id (`d-sp-<spore id>`) so even a lost
 * flag cannot double a draft. Links resolve against titles in this same
 * export; a title index is built before any body is rendered so a link can
 * point forward to a spore defined later in the array.
 */
export function importSporesEntries(index: DraftIndexItem[]): SporesImportResult {
	if (typeof localStorage === 'undefined') return { drafts: index, count: 0 };
	if (localStorage.getItem(SPORES_IMPORT_FLAG_KEY)) return { drafts: index, count: 0 };

	const spores = readSpores(localStorage);
	const spellbookTitles = readSpellbookTitles(localStorage);

	const draftIdByTitle = new Map<string, string>();
	for (const spore of spores) {
		draftIdByTitle.set(normalizeTitle(spore.title), 'd-sp-' + spore.id);
	}

	let drafts = index;
	let count = 0;
	for (const spore of spores) {
		const id = 'd-sp-' + spore.id;
		if (drafts.some((d) => d.id === id)) continue;
		const tags = sporeTags(spore, spellbookTitles);
		const body: DraftBody = {
			title: spore.title,
			kind: 'note',
			tags,
			...(spore.status ? { status: spore.status } : {}),
			layers: { foreground: { html: sporeBodyToHtml(spore, draftIdByTitle), updatedAt: spore.updated } },
			savedAt: spore.updated
		};
		saveDraft(id, body);
		drafts = upsertIndex(drafts, id, spore.title, spore.updated, {
			kind: 'note',
			tags,
			...(spore.status ? { status: spore.status } : {})
		});
		count += 1;
	}

	try {
		localStorage.setItem(SPORES_IMPORT_FLAG_KEY, new Date().toISOString());
	} catch {
		// The deterministic ids above are what keeps a re-run from doubling
		// anything, even if the flag itself never made it to storage.
	}

	return { drafts, count };
}
