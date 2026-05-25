import { describe, expect, it } from 'vitest';
import {
	sanitizeHtml,
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
	it('strips data-anchor (anchors are re-stamped, not preserved across paste)', () => {
		expect(sanitizeHtml('<p data-anchor="a-001">x</p>')).toBe('<p>x</p>');
	});
	it('passes through empty input', () => {
		expect(sanitizeHtml('')).toBe('');
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
