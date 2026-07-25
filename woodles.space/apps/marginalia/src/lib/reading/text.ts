import {
	ANCHOR_BLOCK_SELECTOR,
	ensureAnchorsOn as stampAnchors,
	sanitizeHtml,
	stripPresentation
} from '@woodles/text';

// Text utilities for the reading room editor. The HTML mechanics live in
// `@woodles/text` now; what stays here is the reading room's own shape —
// paragraphs, the text cap, and the two sanitizer policies it needs.
//
// Paragraph storage is now HTML, not plain text — the passage is a live
// contenteditable surface, and we serialize blocks back to `{id, html}` records
// on each edit. The HTML sanitizer is more permissive than the margin-note
// sanitizer (it allows headings, lists, blockquote, basic emphasis, links,
// <mark> highlights). Anything else is stripped.

// Shared ceiling for how much text the room will hold before setting the
// rest aside — applied to pasted text and to anything extracted from a file
// (PDF, epub), regardless of source.
export const READING_TEXT_CAP = 500_000;

export { ANCHOR_BLOCK_SELECTOR, countWordsInText, stripTags } from '@woodles/text';

// The reading room stamps `p-`, not the shared default `a-`. Both prefixes are
// already in stored documents, so this is a fact to preserve rather than a
// preference to reconcile.
const ANCHOR_PREFIX = 'p-';

export function ensureAnchorsOn(blocks: ArrayLike<Element>): void {
	stampAnchors(blocks, ANCHOR_PREFIX);
}

export interface Paragraph {
	id: string;
	html: string;
}

// Split a paste-time text into HTML paragraphs. Each blank-line-separated
// chunk becomes a <p>; internal single newlines become <br>. Stable ids.
export function paragraphsFromText(text: string): Paragraph[] {
	const parts = text.split(/\n[ \t]*\n+/);
	const out: Paragraph[] = [];
	let n = 1;
	for (const raw of parts) {
		const trimmed = raw.replace(/^\s+|\s+$/g, '');
		if (!trimmed) continue;
		const html = escapeHtml(trimmed).replace(/\n/g, '<br>');
		out.push({ id: 'p-' + String(n).padStart(3, '0'), html });
		n++;
	}
	return out;
}

// Turn a published echoes letter's foreground HTML into reading-room
// paragraphs (ROADMAP.md week 7) — the same shape paste/PDF intake produces,
// so the rest of the room (annotation, anchors, persistence) doesn't need to
// know where the text came from. Sanitizes first regardless of what write's
// own pipeline already did — a defensive second pass, same reasoning as
// echoes' own reader re-sanitizing on render. Anchors are stamped
// defensively too: today's letters already carry data-anchor from write's
// publish-time stamping, but nothing here should break on one that doesn't.
export function paragraphsFromLetterHtml(html: string): Paragraph[] {
	if (typeof document === 'undefined') return [];
	const clean = sanitizePassageHtml(html);
	const container = document.createElement('div');
	container.innerHTML = clean;
	ensureAnchorsOn(Array.from(container.querySelectorAll(ANCHOR_BLOCK_SELECTOR)));
	return paragraphsFromDom(container);
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// ── anchor stamping ────────────────────────────────────────────────────────

export function stampLiveAnchors(root: HTMLElement) {
	ensureAnchorsOn(Array.from(root.querySelectorAll(ANCHOR_BLOCK_SELECTOR)));
}

// Walk live DOM and turn it into a Paragraph[]. Each top-level allowed block
// becomes a paragraph entry; nested allowed blocks (e.g. <li> inside <ul>)
// stay inside their parent and aren't stamped individually here.
export function paragraphsFromDom(root: HTMLElement): Paragraph[] {
	const out: Paragraph[] = [];
	const blocks = root.querySelectorAll<HTMLElement>(
		':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > blockquote, :scope > ul, :scope > ol, :scope > pre'
	);
	for (const b of Array.from(blocks)) {
		const id = b.getAttribute('data-anchor');
		if (!id) continue;
		out.push({ id, html: b.outerHTML });
	}
	return out;
}

export function passageHtml(paragraphs: Paragraph[]): string {
	return paragraphs.map((p) => p.html).join('');
}

// ── sanitization ───────────────────────────────────────────────────────────

const SAFE_PROTOCOL = /^(https?:|mailto:|#)/i;

// For the passage: allow a curated tag set, strip unsafe attrs, unwrap noisy
// wrappers, sanitize href, and re-stamp data-anchor only on top-level blocks.
// The passage sanitizer keeps `data-anchor` — margin notes point at those
// blocks, so stripping them would orphan every note in the room. Write does the
// opposite and re-stamps instead; the shared sanitizer takes options rather
// than picking a side.
export function sanitizePassageHtml(html: string): string {
	return sanitizeHtml(html, { keepAttributes: ['data-anchor'] });
}

// A margin note is short and already trusted: keep its structure, drop the
// styling that would fight the room's own fonts.
export function sanitizeNoteHtml(html: string): string {
	return stripPresentation(html);
}

// ── margin notes ───────────────────────────────────────────────────────────

export interface MarginNote {
	id: string;
	anchorId: string;
	html: string;
	createdAt: string;
	updatedAt: string;
}

let noteCounter = 0;
export function newNoteId(): string {
	noteCounter += 1;
	return 'n-' + Date.now().toString(36) + '-' + noteCounter.toString(36);
}

// ── back-compat shim ───────────────────────────────────────────────────────
// The v1 annotation work referenced `splitParagraphs`; keep the export as an
// alias so we don't have to chase down every import site.
export const splitParagraphs = paragraphsFromText;
