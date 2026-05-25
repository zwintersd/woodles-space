export const ANCHOR_BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,blockquote,li,ul,ol,pre';

// Strip inline font/style attributes from HTML so the document's font
// system always wins. Preserves structural and semantic markup
// (headings, lists, links, bold/italic) and data-* attributes (anchors).
export function sanitizeHtml(html: string): string {
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
		el.removeAttribute('data-anchor');
		if (el.tagName === 'FONT' || el.tagName === 'SPAN') {
			const parent = el.parentNode;
			if (!parent) return;
			while (el.firstChild) parent.insertBefore(el.firstChild, el);
			parent.removeChild(el);
		}
	});
	return root.innerHTML;
}

// Assign stable data-anchor IDs to every block-level element. Existing
// IDs are preserved; duplicates are dropped; new blocks get max+1.
// Idempotent and additive, so margin notes survive editing as long as
// their anchor block isn't deleted.
export function ensureAnchorsOn(blocks: NodeListOf<Element> | Element[]): void {
	const list = Array.from(blocks);
	let max = 0;
	const seen = new Set<string>();
	for (const b of list) {
		const id = b.getAttribute('data-anchor');
		if (id) {
			if (seen.has(id)) {
				b.removeAttribute('data-anchor');
			} else {
				seen.add(id);
				const m = /^a-(\d+)$/.exec(id);
				if (m) {
					const n = parseInt(m[1], 10);
					if (!isNaN(n) && n > max) max = n;
				}
			}
		}
	}
	let next = max + 1;
	for (const b of list) {
		if (!b.getAttribute('data-anchor')) {
			b.setAttribute('data-anchor', 'a-' + String(next++).padStart(3, '0'));
		}
	}
}

export function stampAnchorsHtml(html: string): string {
	if (typeof DOMParser === 'undefined') return html;
	const doc = new DOMParser().parseFromString('<div id="__r">' + html + '</div>', 'text/html');
	const root = doc.getElementById('__r');
	if (!root) return html;
	ensureAnchorsOn(root.querySelectorAll(ANCHOR_BLOCK_SELECTOR));
	return root.innerHTML;
}

export function isEmptyHtml(html: string): boolean {
	const stripped = html.replace(/<br\s*\/?>(\s*)/gi, '').replace(/<[^>]+>/g, '').trim();
	return stripped.length === 0;
}

export function stripTags(html: string): string {
	return String(html ?? '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function countWords(html: string): number {
	const t = stripTags(html);
	return t ? t.split(/\s+/).filter((w) => w.length > 0).length : 0;
}

export function previewText(html: string, max = 90): string {
	const t = stripTags(html);
	if (!t) return '';
	if (t.length <= max) return t;
	return t.slice(0, max).replace(/\s+\S*$/, '') + '…';
}
