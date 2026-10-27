// The format menu's edits, as transforms on a detached copy of a layer.
//
// Bold, italic, underline and strikethrough go through the browser's own
// commands. Everything the browser gets wrong or has no command for — lists
// (which Chrome nests inside the paragraph they came from), block changes out
// of a list, highlight, and clearing formatting — is done here instead: copy
// the layer, change the copy, and hand the page the new HTML to swap in with
// one `insertHTML`, which keeps it a single step of the browser's undo.
//
// A selection is carried as a Position per end — which line, and how many
// characters into it — rather than as a DOM Range, because the same Position
// has to mean the same place in the live layer, in its copy, and in whatever
// the swap leaves behind. A line is a block (a paragraph, a heading, one item
// of a top-level list) or, since Chrome leaves the first line you type as bare
// text, a run of loose inline nodes at the top of the layer.

export type BlockKind = 'p' | 'h1' | 'h2' | 'blockquote' | 'ul' | 'ol';
export type Position = { line: number; offset: number };
export type Line = {
	/** The block that is this line, or null for a run of loose inline nodes. */
	el: HTMLElement | null;
	/** The run's nodes, or just `el`. */
	nodes: Node[];
};

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
const FOLLOWING = 4;

const BLOCK_TAGS = new Set([
	'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE',
	'DIV', 'SECTION', 'ARTICLE', 'UL', 'OL', 'LI'
]);
const LIST_TAGS = new Set(['UL', 'OL']);
/** Everything "clear formatting" takes off; links and references stay. */
const CLEAR_TAGS = new Set([
	'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'MARK', 'CODE',
	'SPAN', 'FONT', 'SUB', 'SUP', 'SMALL', 'BIG'
]);
const MERGEABLE_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'MARK', 'CODE']);

function isElement(node: Node | null | undefined): node is HTMLElement {
	return !!node && node.nodeType === ELEMENT_NODE;
}

function isText(node: Node | null | undefined): node is Text {
	return !!node && node.nodeType === TEXT_NODE;
}

function isBlank(node: Node): boolean {
	return isText(node) && !node.data.trim();
}

export function readLines(root: HTMLElement): Line[] {
	const lines: Line[] = [];
	let run: Node[] = [];
	const flush = () => {
		// Whitespace between blocks is not a line; a lone <br> is an empty one.
		if (run.some((node) => !isBlank(node))) lines.push({ el: null, nodes: run });
		run = [];
	};
	for (const child of Array.from(root.childNodes)) {
		if (isElement(child) && LIST_TAGS.has(child.tagName)) {
			flush();
			for (const item of Array.from(child.children)) {
				if (item.tagName === 'LI') lines.push({ el: item as HTMLElement, nodes: [item] });
			}
		} else if (isElement(child) && BLOCK_TAGS.has(child.tagName)) {
			flush();
			lines.push({ el: child, nodes: [child] });
		} else if (isText(child) || isElement(child)) {
			run.push(child);
		}
	}
	flush();
	return lines;
}

function textsUnder(node: Node, out: Text[]): Text[] {
	if (isText(node)) out.push(node);
	else for (const child of Array.from(node.childNodes)) textsUnder(child, out);
	return out;
}

export function lineTexts(line: Line): Text[] {
	const out: Text[] = [];
	for (const node of line.nodes) textsUnder(node, out);
	return out;
}

function lineLength(line: Line): number {
	return lineTexts(line).reduce((sum, text) => sum + text.data.length, 0);
}

/** Does the boundary point (container, offset) come before `node` starts? */
function boundaryPrecedes(container: Node, offset: number, node: Node): boolean {
	if (isText(container)) {
		return node !== container && !!(container.compareDocumentPosition(node) & FOLLOWING);
	}
	const ref = container.childNodes[offset];
	if (ref) return ref === node || ref.contains(node) || !!(ref.compareDocumentPosition(node) & FOLLOWING);
	return !container.contains(node) && !!(container.compareDocumentPosition(node) & FOLLOWING);
}

export function positionOf(root: HTMLElement, lines: Line[], container: Node, offset: number): Position {
	if (!lines.length) return { line: 0, offset: 0 };
	const index = lines.findIndex((line) => line.nodes.some((node) => node === container || node.contains(container)));
	if (index >= 0) {
		let count = 0;
		for (const text of lineTexts(lines[index])) {
			if (text === container) return { line: index, offset: count + offset };
			if (boundaryPrecedes(container, offset, text)) break;
			count += text.data.length;
		}
		return { line: index, offset: count };
	}
	// Between two nodes of the same loose run — the layer itself is the container.
	if (container === root) {
		const ref = root.childNodes[offset];
		const run = lines.findIndex((line) => !line.el && !!ref && line.nodes.includes(ref) && line.nodes[0] !== ref);
		if (run >= 0) {
			const before = lines[run].nodes.slice(0, lines[run].nodes.indexOf(ref));
			const count = before.reduce((sum, node) => sum + textsUnder(node, []).reduce((s, t) => s + t.data.length, 0), 0);
			return { line: run, offset: count };
		}
	}
	// Between lines: the layer, a list, or whitespace between blocks.
	const next = lines.findIndex((line) => boundaryPrecedes(container, offset, line.nodes[0]));
	if (next >= 0) return { line: next, offset: 0 };
	const last = lines.length - 1;
	return { line: last, offset: lineLength(lines[last]) };
}

/**
 * Where a Position is in the DOM. Where two text nodes meet, a range's start
 * leans forward and its end leans back, so a selection of exactly the words
 * in a link starts inside the link rather than at the end of the text before it.
 */
export function pointAt(
	root: HTMLElement,
	lines: Line[],
	position: Position,
	lean: 'forward' | 'back' = 'back'
): { node: Node; offset: number } {
	if (!lines.length) return { node: root, offset: 0 };
	const line = lines[Math.max(0, Math.min(position.line, lines.length - 1))];
	const texts = lineTexts(line);
	let count = 0;
	for (const text of texts) {
		const end = count + text.data.length;
		if (lean === 'forward' ? position.offset < end : position.offset <= end) {
			return { node: text, offset: Math.max(0, position.offset - count) };
		}
		count = end;
	}
	const lastText = texts[texts.length - 1];
	if (lastText) return { node: lastText, offset: lastText.data.length };
	if (line.el) return { node: line.el, offset: 0 };
	return { node: root, offset: Array.prototype.indexOf.call(root.childNodes, line.nodes[0]) };
}

/** The lines a selection touches; a selection that ends at the very start of a line leaves it out. */
function touchedRange(lines: Line[], start: Position, end: Position): [number, number] {
	const from = Math.max(0, Math.min(start.line, lines.length - 1));
	let to = Math.max(from, Math.min(end.line, lines.length - 1));
	if (to > from && end.offset === 0) to -= 1;
	return [from, to];
}

export function lineKind(line: Line): string {
	if (!line.el) return 'p';
	const tag = line.el.tagName;
	if (tag === 'LI') return (line.el.parentElement?.tagName ?? 'UL').toLowerCase();
	if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') return 'p';
	return tag.toLowerCase();
}

const BLOCK_KINDS: readonly string[] = ['p', 'h1', 'h2', 'blockquote', 'ul', 'ol'];

/** The block kind every touched line shares, or null when they differ (or it's one the menu doesn't offer). */
export function blockKindAt(root: HTMLElement, start: Position, end: Position): BlockKind | null {
	const lines = readLines(root);
	if (!lines.length) return 'p';
	const [from, to] = touchedRange(lines, start, end);
	const kinds = new Set(lines.slice(from, to + 1).map(lineKind));
	const [only] = kinds;
	return kinds.size === 1 && BLOCK_KINDS.includes(only) ? (only as BlockKind) : null;
}

type Segment = { node: Text; from: number; to: number };

function selectedSegments(lines: Line[], start: Position, end: Position): Segment[] {
	const segments: Segment[] = [];
	if (!lines.length) return segments;
	const last = Math.min(end.line, lines.length - 1);
	for (let index = start.line; index <= last; index += 1) {
		const a = index === start.line ? start.offset : 0;
		const b = index === end.line ? end.offset : Infinity;
		let count = 0;
		for (const text of lineTexts(lines[index])) {
			const s = count;
			const e = count + text.data.length;
			const from = Math.max(a, s);
			const to = Math.min(b, e);
			if (to > from) segments.push({ node: text, from: from - s, to: to - s });
			count = e;
		}
	}
	return segments;
}

/** Split text nodes so each selected stretch is a node of its own, and return those nodes. */
function splitSegments(segments: Segment[]): Text[] {
	return segments.map(({ node, from, to }) => {
		if (to < node.data.length) node.splitText(to);
		return from > 0 ? node.splitText(from) : node;
	});
}

function closestWithin(node: Node, root: Node, tag: string): HTMLElement | null {
	for (let current = node.parentNode; current && current !== root; current = current.parentNode) {
		if (isElement(current) && current.tagName === tag) return current;
	}
	return null;
}

function wrap(node: Node, wrapper: HTMLElement): void {
	node.parentNode?.replaceChild(wrapper, node);
	wrapper.appendChild(node);
}

function unwrap(el: HTMLElement): void {
	const parent = el.parentNode;
	if (!parent) return;
	while (el.firstChild) parent.insertBefore(el.firstChild, el);
	parent.removeChild(el);
}

/**
 * Take `tags` off the selected text only. Each formatting element the selection
 * reaches is unwrapped, and whatever of it was not selected is wrapped back in
 * a copy — so clearing the middle of a bold phrase leaves both ends bold.
 */
function unformat(root: HTMLElement, selected: Text[], tags: Set<string>): void {
	const chosen = new Set(selected);
	const targets: HTMLElement[] = [];
	for (const text of selected) {
		for (let node = text.parentNode; node && node !== root; node = node.parentNode) {
			if (isElement(node) && tags.has(node.tagName) && !targets.includes(node)) targets.push(node);
		}
	}
	for (const el of targets) {
		const keep = textsUnder(el, []).filter((text) => !chosen.has(text));
		const shell = el.cloneNode(false) as HTMLElement;
		unwrap(el);
		for (const text of keep) wrap(text, shell.cloneNode(false) as HTMLElement);
	}
}

function sameAttributes(a: Element, b: Element): boolean {
	if (a.attributes.length !== b.attributes.length) return false;
	for (const attr of Array.from(a.attributes)) {
		if (b.getAttribute(attr.name) !== attr.value) return false;
	}
	return true;
}

/** Join the pieces splitting left behind: adjacent text, and adjacent identical formatting. */
function tidy(root: HTMLElement): void {
	root.normalize();
	for (const el of Array.from(root.querySelectorAll('*'))) {
		// The copy is never in the document, so "already merged away" means "no longer under root".
		if (!MERGEABLE_TAGS.has(el.tagName) || !root.contains(el)) continue;
		if (!el.firstChild) {
			el.remove();
			continue;
		}
		let next = el.nextSibling;
		while (isElement(next) && next.tagName === el.tagName && sameAttributes(el, next)) {
			while (next.firstChild) el.appendChild(next.firstChild);
			next.remove();
			next = el.nextSibling;
		}
	}
	root.normalize();
}

function hasVisibleText(segments: Segment[]): boolean {
	return segments.some(({ node, from, to }) => node.data.slice(from, to).trim().length > 0);
}

/** True when every visible character of the selection is already highlighted. */
export function isHighlighted(root: HTMLElement, start: Position, end: Position): boolean {
	const segments = selectedSegments(readLines(root), start, end).filter(({ node, from, to }) =>
		node.data.slice(from, to).trim()
	);
	return segments.length > 0 && segments.every(({ node }) => !!closestWithin(node, root, 'MARK'));
}

/** Highlight the selection, or — when it is all highlighted already — take the highlight off it. */
export function toggleHighlight(root: HTMLElement, start: Position, end: Position): boolean {
	const segments = selectedSegments(readLines(root), start, end);
	if (!hasVisibleText(segments)) return false;
	const remove = isHighlighted(root, start, end);
	const texts = splitSegments(segments);
	if (remove) unformat(root, texts, new Set(['MARK']));
	else {
		const doc = root.ownerDocument;
		for (const text of texts) {
			if (!closestWithin(text, root, 'MARK')) wrap(text, doc.createElement('mark'));
		}
	}
	tidy(root);
	return true;
}

/** Strip character formatting from the selection. Links and references are left alone. */
export function clearFormatting(root: HTMLElement, start: Position, end: Position): boolean {
	const segments = selectedSegments(readLines(root), start, end);
	if (!segments.length) return false;
	unformat(root, splitSegments(segments), CLEAR_TAGS);
	tidy(root);
	return true;
}

/** A block's content as inline nodes: anything block-shaped inside it is flattened, a <br> between each. */
function inlineContent(el: HTMLElement): Node[] {
	const out: Node[] = [];
	for (const child of Array.from(el.childNodes)) {
		if (isElement(child) && BLOCK_TAGS.has(child.tagName)) {
			const inner = inlineContent(child);
			if (out.some((node) => !isBlank(node)) && inner.some((node) => !isBlank(node))) {
				out.push(el.ownerDocument.createElement('br'));
			}
			out.push(...inner);
		} else {
			out.push(child);
		}
	}
	return out;
}

function fill(el: HTMLElement, content: Node[]): HTMLElement {
	for (const node of content) el.appendChild(node);
	if (!content.some((node) => !isBlank(node))) el.appendChild(el.ownerDocument.createElement('br'));
	return el;
}

function carryAnchor(from: Element | null, to: HTMLElement): void {
	const anchor = from?.getAttribute('data-anchor');
	if (anchor) to.setAttribute('data-anchor', anchor);
}

/**
 * Turn every touched line into `kind`. Lists are rebuilt rather than asked of
 * the browser: a touched item can leave its list (splitting it around the
 * gap), loose text and paragraphs can join one, and a list built this way sits
 * beside its neighbours instead of inside the paragraph it started as.
 */
export function convertLines(root: HTMLElement, start: Position, end: Position, kind: BlockKind): boolean {
	const doc = root.ownerDocument;
	const lines = readLines(root);
	const toList = kind === 'ul' || kind === 'ol';
	if (!lines.length) {
		root.textContent = '';
		const block = fill(doc.createElement(toList ? 'li' : kind), []);
		root.appendChild(toList ? fill(doc.createElement(kind), [block]) : block);
		return true;
	}
	const [from, to] = touchedRange(lines, start, end);
	const touched = new Set(lines.slice(from, to + 1));
	const lineFor = new Map<Node, Line>();
	for (const line of lines) for (const node of line.nodes) lineFor.set(node, line);

	const out: Node[] = [];
	// Lists built in this pass, so neighbours can join them — and only them:
	// two lists that already sat side by side before this edit stay apart.
	const built = new Map<HTMLElement, { origin: Element | null; touched: boolean }>();

	const pushItem = (item: HTMLElement, tag: string, origin: Element | null, isTouched: boolean) => {
		const last = out[out.length - 1];
		const info = isElement(last) ? built.get(last) : undefined;
		if (isElement(last) && info && last.tagName === tag && (info.origin === origin || info.touched || isTouched)) {
			last.appendChild(item);
			info.touched ||= isTouched;
			return;
		}
		const list = doc.createElement(tag);
		// The first stretch of an existing list keeps its attributes (its anchor).
		if (origin && origin.tagName === tag && ![...built.values()].some((entry) => entry.origin === origin)) {
			for (const attr of Array.from(origin.attributes)) list.setAttribute(attr.name, attr.value);
		}
		list.appendChild(item);
		built.set(list, { origin, touched: isTouched });
		out.push(list);
	};

	const convert = (line: Line, origin: Element | null) => {
		const source = line.el;
		if (toList) {
			const tag = kind.toUpperCase();
			if (source?.tagName === 'LI') {
				pushItem(source, tag, origin, true);
				return;
			}
			const item = fill(doc.createElement('li'), source ? inlineContent(source) : line.nodes);
			carryAnchor(source, item);
			pushItem(item, tag, null, true);
			return;
		}
		if (source && source.tagName.toLowerCase() === kind) {
			out.push(source);
			return;
		}
		if (source?.tagName === 'LI') {
			// An item's own nested lists can't live inside a paragraph; they follow it.
			const nested = Array.from(source.childNodes).filter((node) => isElement(node) && LIST_TAGS.has(node.tagName));
			const content = Array.from(source.childNodes).filter((node) => !nested.includes(node));
			const block = fill(doc.createElement(kind), content);
			carryAnchor(source, block);
			out.push(block, ...nested);
			return;
		}
		const block = fill(doc.createElement(kind), source ? inlineContent(source) : line.nodes);
		carryAnchor(source, block);
		out.push(block);
	};

	for (const child of Array.from(root.childNodes)) {
		if (isElement(child) && LIST_TAGS.has(child.tagName)) {
			for (const item of Array.from(child.childNodes)) {
				const line = lineFor.get(item);
				if (line && touched.has(line)) convert(line, child);
				else if (isElement(item) && item.tagName === 'LI') pushItem(item, child.tagName, child, false);
				else {
					// Stray non-item content inside a list stays with its stretch of the list.
					const last = out[out.length - 1];
					if (isElement(last) && built.get(last)?.origin === child) last.appendChild(item);
					else if (!isBlank(item)) pushItem(fill(doc.createElement('li'), [item]), child.tagName, child, false);
				}
			}
			continue;
		}
		const line = lineFor.get(child);
		if (line && touched.has(line)) {
			// A loose run converts once, at its first node.
			if (line.nodes[0] === child) convert(line, null);
		} else {
			out.push(child);
		}
	}

	root.textContent = '';
	for (const node of out) root.appendChild(node);
	return true;
}

// ── small pieces the page needs ─────────────────────────────────────────

const WORD_CHAR = /[\p{L}\p{N}\p{M}_'’]/u;
const QUOTE_CHAR = /['’]/;

/** The word around `offset`, as [start, end), or null when the caret isn't touching one. */
export function wordBounds(text: string, offset: number): [number, number] | null {
	const before = offset > 0 && WORD_CHAR.test(text[offset - 1]);
	const after = offset < text.length && WORD_CHAR.test(text[offset]);
	if (!before && !after) return null;
	let start = offset;
	while (start > 0 && WORD_CHAR.test(text[start - 1])) start -= 1;
	let end = offset;
	while (end < text.length && WORD_CHAR.test(text[end])) end += 1;
	while (start < end && QUOTE_CHAR.test(text[start])) start += 1;
	while (end > start && QUOTE_CHAR.test(text[end - 1])) end -= 1;
	return start < end ? [start, end] : null;
}

const EMAIL = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/;

/**
 * What someone typed into the link field, as an href the sanitizer will keep
 * (http, https, mailto, or a #fragment) — or null. A bare `example.com` gets
 * `https://`, since that is what it means and a relative href would be
 * stripped the next time the draft loads.
 */
export function normalizeLinkUrl(input: string): string | null {
	const value = input.trim();
	if (!value || /\s/.test(value)) return null;
	if (value.startsWith('#')) return value.length > 1 ? value : null;
	if (/^mailto:/i.test(value)) return EMAIL.test(value.slice(7)) ? value : null;
	if (EMAIL.test(value)) return `mailto:${value}`;
	let candidate: string;
	if (/^https?:\/\//i.test(value)) candidate = value;
	else if (value.startsWith('//')) candidate = `https:${value}`;
	else if (/^[a-z][a-z\d+.-]*:\/\//i.test(value) || /^(javascript|data|vbscript|file|blob):/i.test(value)) return null;
	else candidate = `https://${value}`;
	try {
		const url = new URL(candidate);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
		return candidate;
	} catch {
		return null;
	}
}

/** Child indexes from `root` down to `node`, so the same node can be found in a copy. */
export function pathTo(root: Node, node: Node): number[] | null {
	const path: number[] = [];
	for (let current: Node | null = node; current !== root; current = current.parentNode) {
		if (!current?.parentNode) return null;
		path.unshift(Array.prototype.indexOf.call(current.parentNode.childNodes, current));
	}
	return path;
}

export function nodeAt(root: Node, path: number[]): Node | null {
	let current: Node | undefined = root;
	for (const index of path) {
		current = current?.childNodes[index];
		if (!current) return null;
	}
	return current ?? null;
}

export function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
