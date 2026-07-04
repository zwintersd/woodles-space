// Text utilities for the reading room editor.
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

const ANCHOR_BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,blockquote,ul,ol,li,pre';

const PASSAGE_ALLOWED_TAGS = new Set([
	'P',
	'H1',
	'H2',
	'H3',
	'H4',
	'H5',
	'H6',
	'BLOCKQUOTE',
	'UL',
	'OL',
	'LI',
	'B',
	'STRONG',
	'I',
	'EM',
	'U',
	'S',
	'STRIKE',
	'MARK',
	'A',
	'BR',
	'PRE',
	'CODE'
]);
const UNWRAP_TAGS = new Set(['SPAN', 'FONT', 'DIV', 'SECTION', 'ARTICLE']);

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

export function ensureAnchorsOn(blocks: Element[]) {
	let max = 0;
	const seen = new Set<string>();
	for (const b of blocks) {
		const id = b.getAttribute('data-anchor');
		if (id) {
			if (seen.has(id)) {
				// duplicate after a copy-paste — strip and re-stamp below
				b.removeAttribute('data-anchor');
			} else {
				seen.add(id);
				const m = /^p-(\d+)$/.exec(id);
				if (m) {
					const n = parseInt(m[1], 10);
					if (!isNaN(n) && n > max) max = n;
				}
			}
		}
	}
	let next = max + 1;
	for (const b of blocks) {
		if (!b.getAttribute('data-anchor')) {
			b.setAttribute('data-anchor', 'p-' + String(next++).padStart(3, '0'));
		}
	}
}

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
export function sanitizePassageHtml(html: string): string {
	if (typeof DOMParser === 'undefined' || !html) return html;
	const doc = new DOMParser().parseFromString('<div id="__r">' + html + '</div>', 'text/html');
	const root = doc.getElementById('__r');
	if (!root) return html;

	function clean(node: Element) {
		// process children first (snapshot, since we mutate)
		const kids = Array.from(node.children);
		for (const k of kids) clean(k);

		const tag = node.tagName;
		if (!PASSAGE_ALLOWED_TAGS.has(tag) && !UNWRAP_TAGS.has(tag)) {
			node.remove();
			return;
		}
		// Strip dangerous / noisy attributes.
		for (const attr of Array.from(node.attributes)) {
			const name = attr.name.toLowerCase();
			if (name === 'data-anchor') continue;
			if (name === 'href' && tag === 'A') {
				const v = attr.value.trim();
				if (!SAFE_PROTOCOL.test(v)) node.removeAttribute('href');
				continue;
			}
			node.removeAttribute(attr.name);
		}
		if (UNWRAP_TAGS.has(tag)) {
			const parent = node.parentNode;
			if (parent) {
				while (node.firstChild) parent.insertBefore(node.firstChild, node);
				parent.removeChild(node);
			}
		}
	}

	// clean() itself decides whether a node gets removed or unwrapped — never
	// call it on `root`: root is the synthetic #__r wrapper, not real content,
	// and DIV is one of the UNWRAP_TAGS, so clean(root) unwraps root right out
	// from under itself (moves every child up to root's own parent, then
	// removes root), leaving root permanently empty. Only its children are
	// real content to walk.
	for (const child of Array.from(root.children)) clean(child);
	return root.innerHTML;
}

// Margin note sanitizer (unchanged shape, retained for back-compat).
export function sanitizeNoteHtml(html: string): string {
	if (typeof DOMParser === 'undefined' || !html) return html;
	const doc = new DOMParser().parseFromString('<div id="__r">' + html + '</div>', 'text/html');
	const root = doc.getElementById('__r');
	if (!root) return html;
	root.querySelectorAll('*').forEach((el) => {
		el.removeAttribute('style');
		el.removeAttribute('color');
		el.removeAttribute('face');
		el.removeAttribute('size');
		el.removeAttribute('bgcolor');
		el.removeAttribute('class');
		if (el.tagName === 'FONT' || el.tagName === 'SPAN') {
			const parent = el.parentNode;
			if (!parent) return;
			while (el.firstChild) parent.insertBefore(el.firstChild, el);
			parent.removeChild(el);
		}
	});
	return root.innerHTML;
}

// ── word counting ──────────────────────────────────────────────────────────

export function countWordsInText(s: string): number {
	const trimmed = s.trim();
	if (!trimmed) return 0;
	return trimmed.split(/\s+/).length;
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
