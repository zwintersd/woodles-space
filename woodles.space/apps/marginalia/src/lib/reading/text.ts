// Plain-text → paragraph utilities for the reading room.
// Margin notes anchor to paragraph blocks (data-anchor="p-NNN"), so we need a
// deterministic split that survives storage round-trips.

export interface Paragraph {
	id: string;
	content: string;
}

// Split a pasted string on blank lines. Each non-empty run becomes a paragraph
// with a stable, padded id. Single newlines within a paragraph are preserved
// in the `content` string — the renderer keeps them via white-space: pre-wrap.
export function splitParagraphs(text: string): Paragraph[] {
	const parts = text.split(/\n[ \t]*\n+/);
	const out: Paragraph[] = [];
	let n = 1;
	for (const raw of parts) {
		const trimmed = raw.replace(/^\s+|\s+$/g, '');
		if (!trimmed) continue;
		out.push({ id: 'p-' + String(n).padStart(3, '0'), content: trimmed });
		n++;
	}
	return out;
}

// Strip dangerous attrs and meaningless wrappers from contenteditable HTML.
// Ported from /apps/write — same shape, slightly tighter (we don't keep <font>
// at all in marginalia, since notes are styled by the room's CSS).
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
