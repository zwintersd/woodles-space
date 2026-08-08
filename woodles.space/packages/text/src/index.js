// @ts-check

/**
 * Shared text and HTML utilities.
 *
 * These lived in three places — `write/htmlTools.ts`, `marginalia/reading/text.ts`,
 * and a third copy reimplemented inline in `letter/index.html` — and
 * REFACTORING.md has tracked them as the workspace's strongest extraction
 * candidate for a while: same contract, drifting details, only two of the three
 * tested. Two more copies of `htmlToText` appeared with the handoff spine, which
 * made five.
 *
 * Shipped as browser-ready `.js` with a `.d.ts` sidecar, the same shape as
 * `@woodles/app-manifest`, because `letter` is a static page with no build step
 * and has to be able to `import` this directly.
 */

/** Blocks that carry a stable `data-anchor`, so margin notes can point at them. */
export const ANCHOR_BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,blockquote,li,ul,ol,pre';

/**
 * The on-voice subset. Anything outside both sets is removed entirely — that
 * is what actually stops `<script>` / `<img onerror>` / `<svg onload>` payloads
 * — and everything that survives has every attribute stripped except a
 * protocol-checked `href` and whatever the caller explicitly keeps.
 */
export const ALLOWED_TAGS = Object.freeze([
	'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
	'BLOCKQUOTE', 'UL', 'OL', 'LI',
	'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'MARK',
	'A', 'BR', 'PRE', 'CODE'
]);

/** Kept for their children, dropped themselves — the usual paste wrappers. */
export const UNWRAP_TAGS = Object.freeze(['SPAN', 'FONT', 'DIV', 'SECTION', 'ARTICLE']);

export const SAFE_HREF_PROTOCOL = /^(https?:|mailto:|#)/i;

/**
 * A reference in prose — `#` a thing you're thinking about, `@` a day.
 *
 * Encoded as data attributes on an ordinary anchor, with the words somebody
 * typed as its own text content. That is the load-bearing part: strip the
 * attributes and a sentence is still a sentence. A reference whose target has
 * been deleted goes cold and reads as plain prose, exactly the way a Carillon
 * task keeps its title when its Thinking About entry is gone (REFERENCES.md §3).
 *
 * The vocabulary lives here rather than in an app because sanitizing is where
 * it has to be understood, and because `apps/letter` — static, no build step —
 * can import this package's browser-ready `.js` directly.
 */
export const REFERENCE_ATTRIBUTES = Object.freeze([
	'data-ref-app',
	'data-ref-kind',
	'data-ref-id'
]);

/**
 * `keepAttributes` for a surface that stores references. Deliberately *not*
 * the default: a sanitize that keeps them everywhere would let pasted markup
 * smuggle a reference into a surface that has no idea what one is.
 *
 * Note what is absent — `class`. References are styled off
 * `a[data-ref-id]` precisely so this allowlist can stay three attributes wide
 * rather than opening `class` on every element.
 */
export const REFERENCE_SANITIZE_OPTIONS = Object.freeze({
	keepAttributes: REFERENCE_ATTRIBUTES
});

/**
 * Build the stored form of a reference.
 *
 * @param {{ app: string, kind: string, id: string, text: string, href?: string }} ref
 * @returns {string}
 */
export function referenceHtml(ref) {
	const attrs = [
		`data-ref-app="${escapeAttribute(ref.app)}"`,
		`data-ref-kind="${escapeAttribute(ref.kind)}"`,
		`data-ref-id="${escapeAttribute(ref.id)}"`
	];
	if (ref.href) attrs.push(`href="${escapeAttribute(ref.href)}"`);
	return `<a ${attrs.join(' ')}>${escapeText(ref.text)}</a>`;
}

/**
 * Every reference in a body, in document order. Used to derive what a piece of
 * writing is *about* without parsing prose.
 *
 * @param {string} html
 * @returns {{ app: string, kind: string, id: string, text: string }[]}
 */
export function readReferences(html) {
	if (typeof DOMParser === 'undefined' || !html) return [];
	const root = parseFragment(html);
	if (!root) return [];
	return Array.from(root.querySelectorAll('a[data-ref-id]')).map((el) => ({
		app: el.getAttribute('data-ref-app') ?? '',
		kind: el.getAttribute('data-ref-kind') ?? '',
		id: el.getAttribute('data-ref-id') ?? '',
		text: el.textContent ?? ''
	}));
}

function escapeAttribute(value) {
	return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeText(value) {
	return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * @typedef {object} SanitizeOptions
 * @property {readonly string[]} [allowedTags] Upper-case tag names to keep.
 * @property {readonly string[]} [unwrapTags] Upper-case tag names to replace with their children.
 * @property {readonly string[]} [keepAttributes] Lower-case attribute names to preserve.
 */

function parseFragment(html) {
	const doc = new DOMParser().parseFromString('<div id="__r">' + html + '</div>', 'text/html');
	return doc.getElementById('__r');
}

/**
 * Strip anything not on the allowlist. Untrusted paste and model output both
 * come through here, and in `write`'s case the result can reach the public
 * publish path, so this is a security boundary rather than a tidying step.
 *
 * @param {string} html
 * @param {SanitizeOptions} [options]
 * @returns {string}
 */
export function sanitizeHtml(html, options = {}) {
	if (typeof DOMParser === 'undefined' || !html) return html;
	const root = parseFragment(html);
	if (!root) return html;

	const allowed = new Set(options.allowedTags ?? ALLOWED_TAGS);
	const unwrap = new Set(options.unwrapTags ?? UNWRAP_TAGS);
	const keep = new Set(options.keepAttributes ?? []);

	/** @param {Element} node */
	function clean(node) {
		// Children first, on a snapshot, because cleaning mutates the tree.
		for (const child of Array.from(node.children)) clean(child);

		const tag = node.tagName;
		if (!allowed.has(tag) && !unwrap.has(tag)) {
			node.remove();
			return;
		}

		for (const attr of Array.from(node.attributes)) {
			const name = attr.name.toLowerCase();
			if (keep.has(name)) continue;
			if (name === 'href' && tag === 'A') {
				if (!SAFE_HREF_PROTOCOL.test(attr.value.trim())) node.removeAttribute('href');
				continue;
			}
			node.removeAttribute(attr.name);
		}

		if (unwrap.has(tag)) {
			const parent = node.parentNode;
			if (!parent) return;
			while (node.firstChild) parent.insertBefore(node.firstChild, node);
			parent.removeChild(node);
		}
	}

	// Never call clean() on root itself: root is the synthetic #__r wrapper, and
	// DIV is an unwrap tag — cleaning it would move every child up to root's own
	// parent and then remove root, leaving it permanently empty. Only its
	// children are real content. (This gotcha cost marginalia a bug once.)
	for (const child of Array.from(root.children)) clean(child);
	return root.innerHTML;
}

/**
 * The laxer pass used for short, already-trusted fragments like margin notes:
 * keeps the structure, removes styling that would fight the page's own fonts.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripPresentation(html) {
	if (typeof DOMParser === 'undefined' || !html) return html;
	const root = parseFragment(html);
	if (!root) return html;

	root.querySelectorAll('*').forEach((el) => {
		for (const name of ['style', 'color', 'face', 'size', 'bgcolor', 'class']) {
			el.removeAttribute(name);
		}
		if (el.tagName === 'FONT' || el.tagName === 'SPAN') {
			const parent = el.parentNode;
			if (!parent) return;
			while (el.firstChild) parent.insertBefore(el.firstChild, el);
			parent.removeChild(el);
		}
	});
	return root.innerHTML;
}

/**
 * Give every block a stable `data-anchor`. Existing ids are kept, duplicates
 * dropped, new blocks numbered from max+1 — idempotent and additive, so margin
 * notes survive editing as long as their block isn't deleted.
 *
 * The prefix is a parameter because the two callers already disagree and both
 * have stored documents: `write` stamps `a-001`, marginalia's reading room
 * stamps `p-001`. Picking a winner would silently orphan one app's margin
 * notes, so neither wins.
 *
 * @param {ArrayLike<Element>} blocks
 * @param {string} [prefix]
 */
export function ensureAnchorsOn(blocks, prefix = 'a-') {
	const list = Array.from(blocks);
	let max = 0;
	const seen = new Set();

	for (const block of list) {
		const id = block.getAttribute('data-anchor');
		if (!id) continue;
		if (seen.has(id)) {
			block.removeAttribute('data-anchor');
			continue;
		}
		seen.add(id);
		const match = new RegExp('^' + prefix + '(\\d+)$').exec(id);
		if (match) {
			const n = parseInt(match[1], 10);
			if (!Number.isNaN(n) && n > max) max = n;
		}
	}

	let next = max + 1;
	for (const block of list) {
		if (!block.getAttribute('data-anchor')) {
			block.setAttribute('data-anchor', prefix + String(next++).padStart(3, '0'));
		}
	}
}

/**
 * @param {string} html
 * @param {string} [selector]
 * @param {string} [prefix]
 * @returns {string}
 */
export function stampAnchorsHtml(html, selector = ANCHOR_BLOCK_SELECTOR, prefix = 'a-') {
	if (typeof DOMParser === 'undefined') return html;
	const root = parseFragment(html);
	if (!root) return html;
	ensureAnchorsOn(root.querySelectorAll(selector), prefix);
	return root.innerHTML;
}

/**
 * True when there is nothing but markup. A contenteditable left alone still
 * contains `<br>` and empty wrappers, so "empty" can't mean `=== ''`.
 *
 * @param {string} html
 * @returns {boolean}
 */
export function isEmptyHtml(html) {
	return (
		String(html ?? '')
			.replace(/<br\s*\/?>(\s*)/gi, '')
			.replace(/<[^>]+>/g, '')
			.trim().length === 0
	);
}

/**
 * Flatten to a single line — for counting, previewing, and searching.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripTags(html) {
	return String(html ?? '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Flatten to readable text, *keeping* paragraph breaks — for moving a rich
 * body into a plain `<textarea>`, which is what a handoff between the rich
 * editor and the plain-bodied apps needs.
 *
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
	return String(html ?? '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, '\n\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/**
 * @param {string} html
 * @returns {number}
 */
export function countWords(html) {
	const text = stripTags(html);
	return text ? text.split(/\s+/).filter((word) => word.length > 0).length : 0;
}

/** Word count for something already known to be plain text. @param {string} text */
export function countWordsInText(text) {
	const trimmed = String(text ?? '').trim();
	return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * A short excerpt, cut on a word boundary so it never ends mid-word.
 *
 * @param {string} html
 * @param {number} [max]
 * @returns {string}
 */
export function previewText(html, max = 90) {
	const text = stripTags(html);
	if (!text) return '';
	if (text.length <= max) return text;
	return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}
