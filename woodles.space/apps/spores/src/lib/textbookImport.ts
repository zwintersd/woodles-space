import type { GardenStore } from './garden.svelte';
import type { Spore, SporeAccent, SporeStatus } from './types';
import { SPORE_ACCENTS, SPORE_STATUSES } from './types';
import { wikilinkFor } from './wikilinks';

/**
 * One-way import of the Ologypedia Textbook into the Garden.
 *
 * The two were the same product built twice (CONVERGENCE.md §2B). This moves
 * the Textbook's side over: entries become spores, its `<a data-entry>` links
 * become `[[wikilinks]]`, its status and covers survive as spore fields.
 *
 * The one lossy step is deliberate. A Textbook entry body was sanitized HTML;
 * a spore body is plain text. Rather than teach spores to store HTML, headings
 * and lists are flattened into text with their structure kept as blank lines
 * and `— ` bullets. What survives is what a person wrote; what goes is markup
 * they never typed directly.
 */

export const TEXTBOOK_KEY = 'ologypedia-textbook-v1';

type RawEntry = {
	id?: unknown;
	title?: unknown;
	subject?: unknown;
	body?: unknown;
	status?: unknown;
	accent?: unknown;
	glyph?: unknown;
	blurb?: unknown;
	created?: unknown;
};

type RawTextbook = { entries: Record<string, RawEntry>; order: string[] };

export type TextbookImportSummary = {
	entries: number;
	/** Links that pointed at an entry id the export didn't contain. */
	danglingLinks: number;
	spellbookId: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

/** Parse the stored blob. Returns null when there's nothing usable. */
export function readTextbook(raw: string | null): RawTextbook | null {
	if (!raw) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!isRecord(parsed) || !isRecord(parsed.entries) || !Array.isArray(parsed.order)) return null;

	const entries: Record<string, RawEntry> = {};
	for (const [id, entry] of Object.entries(parsed.entries)) {
		if (isRecord(entry)) entries[id] = entry as RawEntry;
	}
	// `order` is the reading order and the source of truth for what to import;
	// anything in `entries` but not in `order` is appended so nothing is lost.
	const order = parsed.order.filter((id): id is string => typeof id === 'string' && id in entries);
	for (const id of Object.keys(entries)) if (!order.includes(id)) order.push(id);

	return order.length > 0 ? { entries, order } : null;
}

const BLOCK_TAGS = /<\/(?:p|div|h[1-6]|blockquote|tr|figcaption|caption)>/gi;

function decodeEntities(text: string): string {
	return text
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

/**
 * Turn one entry's HTML body into plain text, rewriting internal links to
 * `[[Title]]` on the way. Titles are looked up in the export, so a link keeps
 * pointing at the same entry even though spores match on title rather than id.
 *
 * Runs on a regex rather than `DOMParser` so the import is testable under Node
 * and can't be tripped by a missing DOM.
 */
export function bodyToText(
	html: string,
	titleById: Map<string, string>
): { text: string; dangling: number } {
	let dangling = 0;

	// Internal links first, before tags are stripped out from under them.
	let out = html.replace(
		/<a\b[^>]*\bdata-entry\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
		(_whole, id: string, inner: string) => {
			const display = decodeEntities(inner.replace(/<[^>]*>/g, '')).trim();
			const title = titleById.get(id);
			if (!title) {
				// The entry it pointed at isn't in the export. Keep it as a link
				// anyway — a red link is the Textbook's own answer to this, and it
				// stays clickable-to-create rather than silently becoming prose.
				dangling += 1;
				return wikilinkFor(display || id, display || undefined);
			}
			return wikilinkFor(title, display || undefined);
		}
	);

	out = out
		// A list is a list, not a run of paragraphs: single-spaced, so the
		// items stay visibly grouped in the plain-text body.
		.replace(/<li\b[^>]*>/gi, '— ')
		.replace(/<\/li>/gi, '\n')
		.replace(/<\/(?:ul|ol)>/gi, '\n\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(BLOCK_TAGS, '\n\n')
		.replace(/<[^>]*>/g, '');

	return {
		text: decodeEntities(out).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(),
		dangling
	};
}

function status(value: unknown): SporeStatus {
	const found = SPORE_STATUSES.find((candidate) => candidate === value);
	return found ?? 'seed';
}

function accent(value: unknown): SporeAccent | undefined {
	return SPORE_ACCENTS.find((candidate) => candidate === value);
}

/** Import a parsed Textbook into the Garden, via the store's own mutators. */
export function importTextbook(
	garden: GardenStore,
	textbook: RawTextbook
): TextbookImportSummary {
	const { entries, order } = textbook;

	const titleById = new Map<string, string>();
	for (const id of order) {
		titleById.set(id, str(entries[id].title).trim() || id);
	}

	const book = garden.addSpellbook('Textbook', 'plain');
	const summary: TextbookImportSummary = {
		entries: 0,
		danglingLinks: 0,
		spellbookId: book.id
	};

	for (const id of order) {
		const entry = entries[id];
		const { text, dangling } = bodyToText(str(entry.body), titleById);
		summary.danglingLinks += dangling;

		const subject = str(entry.subject).trim();
		const created: Partial<Spore> = {};
		const chosenAccent = accent(entry.accent);
		if (chosenAccent) created.accent = chosenAccent;
		const glyph = str(entry.glyph).trim();
		if (glyph) created.glyph = glyph;
		const blurb = str(entry.blurb).trim();
		if (blurb) created.blurb = blurb;

		garden.addSpore({
			title: titleById.get(id) ?? id,
			body: text,
			data: { kind: 'textbook-entry', textbookId: id },
			tags: subject ? ['textbook', subject] : ['textbook'],
			spellbookIds: [book.id],
			status: status(entry.status),
			...created
		});
		summary.entries += 1;
	}

	return summary;
}

/** Run the import once, from localStorage. Flagged so it can't run twice. */
export function importTextbookOnce(garden: GardenStore): TextbookImportSummary | null {
	if (garden.settings.textbookImported === true) return null;
	if (typeof localStorage === 'undefined') return null;

	const textbook = readTextbook(localStorage.getItem(TEXTBOOK_KEY));
	if (!textbook) return null;

	const summary = importTextbook(garden, textbook);
	garden.markTextbookImported();
	return summary;
}
