import { describe, expect, it } from 'vitest';
import {
	ANCHOR_BLOCK_SELECTOR,
	sanitizeHtml,
	sanitizeStoredHtml,
	ensureAnchorsOn,
	stampAnchorsHtml,
	isEmptyHtml,
	stripTags,
	countWords,
	previewText
} from './htmlTools';

describe('sanitizeHtml', () => {
	it('strips style/color/face/size/bgcolor attributes', () => {
		const dirty =
			'<p style="color: red" color="red" face="Arial" size="3" bgcolor="#fff">x</p>';
		const out = sanitizeHtml(dirty);
		expect(out).toBe('<p>x</p>');
	});
	it('unwraps <font> and <span> while keeping their children', () => {
		expect(sanitizeHtml('<p><font>a</font> <span>b</span></p>')).toBe('<p>a b</p>');
	});
	it('preserves semantic markup', () => {
		const html = '<h1>t</h1><p><strong>x</strong> <em>y</em></p><blockquote>q</blockquote>';
		expect(sanitizeHtml(html)).toBe(html);
	});
	it('strips data-anchor, so paste cannot carry a foreign anchor in', () => {
		expect(sanitizeHtml('<p data-anchor="a-001">x</p>')).toBe('<p>x</p>');
	});
	it('passes through empty input', () => {
		expect(sanitizeHtml('')).toBe('');
	});

	// A published letter's HTML can end up rendered in a stranger's browser
	// (ROADMAP.md week 7) — these guard the actual security boundary, not
	// just font/style normalization.
	it('removes a script tag entirely, including its text content', () => {
		const out = sanitizeHtml('<p>safe</p><script>alert(1)</script>');
		expect(out).not.toContain('script');
		expect(out).not.toContain('alert');
		expect(out).toBe('<p>safe</p>');
	});
	it('removes an img tag outright, taking an onerror payload with it', () => {
		const out = sanitizeHtml('<p>before</p><img src="x" onerror="alert(1)">after');
		expect(out).not.toContain('onerror');
		expect(out).not.toContain('img');
	});
	it('strips an inline event-handler attribute from an otherwise-allowed tag', () => {
		const out = sanitizeHtml('<p onclick="alert(1)">x</p>');
		expect(out).toBe('<p>x</p>');
	});
	it('strips a javascript: href but keeps the link text', () => {
		const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
		expect(out).not.toContain('javascript:');
		expect(out).toContain('click');
	});
	it('keeps a safe https:// href', () => {
		expect(sanitizeHtml('<a href="https://example.com">x</a>')).toBe(
			'<a href="https://example.com">x</a>'
		);
	});
});

describe('sanitizeStoredHtml', () => {
	it('keeps data-anchor and references on a draft\'s own layers', () => {
		const html =
			'<p data-anchor="a-002">see <a data-ref-app="thinking-about" data-ref-kind="entry" data-ref-id="e1">Piranesi</a></p>';
		expect(sanitizeStoredHtml(html)).toBe(html);
	});
	it('is still the security boundary', () => {
		const out = sanitizeStoredHtml(
			'<p data-anchor="a-001" onclick="alert(1)" style="color:red">x</p><script>alert(1)</script><img src=x onerror="alert(1)">'
		);
		expect(out).toBe('<p data-anchor="a-001">x</p>');
	});
});

// What loadIntoLayers does to a stored foreground: sanitize, then stamp.
describe('loading a stored foreground', () => {
	function load(stored: string): HTMLElement {
		const root = document.createElement('div');
		root.innerHTML = sanitizeStoredHtml(stored);
		ensureAnchorsOn(root.querySelectorAll(ANCHOR_BLOCK_SELECTOR));
		return root;
	}
	const textAt = (root: HTMLElement, id: string) =>
		root.querySelector('[data-anchor="' + id + '"]')?.textContent;

	it('keeps a note on its paragraph after one is inserted above it', () => {
		// "Inserted later." took the next free id mid-session; a-002 is still "Third".
		const root = load(
			'<p data-anchor="a-001">Second paragraph.</p>' +
				'<p data-anchor="a-003">Inserted later.</p>' +
				'<p data-anchor="a-002">Third paragraph.</p>'
		);
		expect(textAt(root, 'a-002')).toBe('Third paragraph.');
		expect(textAt(root, 'a-003')).toBe('Inserted later.');
	});

	it('keeps ids through a deleted and a reordered paragraph', () => {
		const root = load(
			'<p data-anchor="a-004">Moved up.</p><p data-anchor="a-001">One.</p><p data-anchor="a-003">Three.</p>'
		);
		expect(textAt(root, 'a-001')).toBe('One.');
		expect(textAt(root, 'a-003')).toBe('Three.');
		expect(textAt(root, 'a-004')).toBe('Moved up.');
		expect(root.querySelector('[data-anchor="a-002"]')).toBeNull();
	});

	it('gives a draft stored without ids its ids by order', () => {
		const root = load('<p>One.</p><p>Two.</p>');
		expect(textAt(root, 'a-001')).toBe('One.');
		expect(textAt(root, 'a-002')).toBe('Two.');
	});

	it('numbers a block missing an id past the ones kept', () => {
		const root = load('<p data-anchor="a-005">Kept.</p><p>New.</p>');
		expect(textAt(root, 'a-006')).toBe('New.');
	});

	it('drops a repeated id rather than letting two blocks claim one note', () => {
		const root = load('<p data-anchor="a-001">First.</p><p data-anchor="a-001">Copy.</p>');
		expect(textAt(root, 'a-001')).toBe('First.');
		expect(textAt(root, 'a-002')).toBe('Copy.');
	});
});

describe('ensureAnchorsOn', () => {
	function blocksFrom(html: string): { root: HTMLElement; blocks: Element[] } {
		const root = document.createElement('div');
		root.innerHTML = html;
		return { root, blocks: Array.from(root.children) };
	}

	it('stamps a-001, a-002 on fresh paragraphs', () => {
		const { blocks } = blocksFrom('<p>a</p><p>b</p>');
		ensureAnchorsOn(blocks);
		expect(blocks[0].getAttribute('data-anchor')).toBe('a-001');
		expect(blocks[1].getAttribute('data-anchor')).toBe('a-002');
	});

	it('preserves existing IDs and continues from max', () => {
		const { blocks } = blocksFrom('<p data-anchor="a-005">a</p><p>b</p><p>c</p>');
		ensureAnchorsOn(blocks);
		expect(blocks[0].getAttribute('data-anchor')).toBe('a-005');
		expect(blocks[1].getAttribute('data-anchor')).toBe('a-006');
		expect(blocks[2].getAttribute('data-anchor')).toBe('a-007');
	});

	it('drops duplicate IDs (browser copy/paste can create them)', () => {
		const { blocks } = blocksFrom(
			'<p data-anchor="a-001">a</p><p data-anchor="a-001">b</p>'
		);
		ensureAnchorsOn(blocks);
		expect(blocks[0].getAttribute('data-anchor')).toBe('a-001');
		expect(blocks[1].getAttribute('data-anchor')).toBe('a-002');
	});

	it('does not hand a new block an id a margin note still points at', () => {
		// The note's paragraph (a-003, the highest) was deleted; a new one is typed.
		const { blocks } = blocksFrom('<p data-anchor="a-001">a</p><p data-anchor="a-002">b</p><p>new</p>');
		ensureAnchorsOn(blocks, 'a-', ['a-003']);
		expect(blocks[2].getAttribute('data-anchor')).toBe('a-004');
	});

	it('is idempotent', () => {
		const { blocks } = blocksFrom('<p>a</p><p>b</p>');
		ensureAnchorsOn(blocks);
		const before = blocks.map((b) => b.getAttribute('data-anchor'));
		ensureAnchorsOn(blocks);
		const after = blocks.map((b) => b.getAttribute('data-anchor'));
		expect(after).toEqual(before);
	});
});

describe('stampAnchorsHtml', () => {
	it('stamps anchors on block-level elements only', () => {
		const out = stampAnchorsHtml('<p>a</p><strong>b</strong><h2>c</h2>');
		expect(out).toContain('<p data-anchor="a-001">a</p>');
		expect(out).toContain('<strong>b</strong>');
		expect(out).toContain('<h2 data-anchor="a-002">c</h2>');
	});
});

describe('isEmptyHtml', () => {
	it('recognises whitespace and <br> as empty', () => {
		expect(isEmptyHtml('')).toBe(true);
		expect(isEmptyHtml('   ')).toBe(true);
		expect(isEmptyHtml('<br>')).toBe(true);
		expect(isEmptyHtml('<br/><br />')).toBe(true);
		expect(isEmptyHtml('<p></p>')).toBe(true);
	});
	it('treats real content as non-empty', () => {
		expect(isEmptyHtml('<p>x</p>')).toBe(false);
		expect(isEmptyHtml('text')).toBe(false);
	});
});

describe('stripTags', () => {
	it('removes tags and collapses whitespace', () => {
		expect(stripTags('<p>hello <em>world</em></p>')).toBe('hello world');
		expect(stripTags('  <p>a</p>   <p>b</p>  ')).toBe('a b');
	});
	it('coerces nullish input', () => {
		expect(stripTags(null as unknown as string)).toBe('');
	});
});

describe('countWords', () => {
	it('counts words in HTML', () => {
		expect(countWords('<p>one two three</p>')).toBe(3);
		expect(countWords('<p></p>')).toBe(0);
	});
});

describe('previewText', () => {
	it('returns the text unchanged when under the limit', () => {
		expect(previewText('<p>short</p>', 90)).toBe('short');
	});
	it('truncates and adds an ellipsis', () => {
		const long = '<p>' + 'word '.repeat(40) + '</p>';
		const out = previewText(long, 30);
		expect(out.length).toBeLessThanOrEqual(31);
		expect(out.endsWith('…')).toBe(true);
	});
	it('does not split mid-word — drops the trailing partial word', () => {
		// "alpha beta gammaXYZ" with max=12: slice → "alpha beta g",
		// then /\s+\S*$/ drops " g", leaving "alpha beta…"
		expect(previewText('alpha beta gammaXYZ', 12)).toBe('alpha beta…');
	});
});
