import { describe, expect, it } from 'vitest';
import {
	ANCHOR_BLOCK_SELECTOR,
	countWords,
	countWordsInText,
	ensureAnchorsOn,
	htmlToText,
	isEmptyHtml,
	previewText,
	sanitizeHtml,
	stampAnchorsHtml,
	stripPresentation,
	stripTags
} from './index.js';

describe('sanitizing is a security boundary, not tidying', () => {
	it('removes scripts and event handlers entirely', () => {
		expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
		expect(sanitizeHtml('<p onclick="alert(1)">ok</p>')).toBe('<p>ok</p>');
		expect(sanitizeHtml('<img src=x onerror="alert(1)">')).toBe('');
		expect(sanitizeHtml('<svg onload="alert(1)"></svg>')).toBe('');
	});

	it('drops a link protocol that could execute, keeping the text', () => {
		expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
		expect(sanitizeHtml('<a href="https://example.com">x</a>')).toBe(
			'<a href="https://example.com">x</a>'
		);
		expect(sanitizeHtml('<a href="mailto:a@b.c">x</a>')).toContain('mailto:');
		expect(sanitizeHtml('<a href="#top">x</a>')).toContain('#top');
	});

	it('keeps the on-voice tags and strips their attributes', () => {
		expect(sanitizeHtml('<p class="x" style="color:red">hi</p>')).toBe('<p>hi</p>');
		expect(sanitizeHtml('<blockquote><em>a</em> <strong>b</strong></blockquote>')).toBe(
			'<blockquote><em>a</em> <strong>b</strong></blockquote>'
		);
	});

	it('unwraps paste wrappers, keeping what was inside them', () => {
		expect(sanitizeHtml('<div><p>kept</p></div>')).toBe('<p>kept</p>');
		expect(sanitizeHtml('<p><span><font>words</font></span></p>')).toBe('<p>words</p>');
	});

	it('survives nesting without eating the whole document', () => {
		// The wrapper element is a DIV and DIV is an unwrap tag; cleaning the
		// wrapper itself would empty the result. Guard against that regressing.
		expect(sanitizeHtml('<div><div><p>deep</p></div></div>')).toBe('<p>deep</p>');
		expect(sanitizeHtml('<p>a</p><p>b</p>')).toBe('<p>a</p><p>b</p>');
	});

	it('preserves an attribute the caller asks to keep', () => {
		expect(sanitizeHtml('<p data-anchor="a-001">x</p>', { keepAttributes: ['data-anchor'] })).toBe(
			'<p data-anchor="a-001">x</p>'
		);
		expect(sanitizeHtml('<p data-anchor="a-001">x</p>')).toBe('<p>x</p>');
	});

	it('narrows to a caller-supplied tag set', () => {
		expect(sanitizeHtml('<p>a</p><h1>b</h1>', { allowedTags: ['P'] })).toBe('<p>a</p>');
	});

	it('passes empty input straight through rather than throwing', () => {
		expect(sanitizeHtml('')).toBe('');
	});
});

describe('stripPresentation', () => {
	it('removes styling but keeps the structure', () => {
		expect(stripPresentation('<p style="color:red" class="x"><b>hi</b></p>')).toBe(
			'<p><b>hi</b></p>'
		);
	});

	it('unwraps font and span, which only ever carried styling', () => {
		expect(stripPresentation('<p><font size="4">a</font><span>b</span></p>')).toBe('<p>ab</p>');
	});

	it('leaves tags a full sanitize would drop — it trusts its input', () => {
		expect(stripPresentation('<table><tr><td>x</td></tr></table>')).toContain('<td>x</td>');
	});
});

describe('anchors', () => {
	function blocks(html: string): HTMLElement {
		const host = document.createElement('div');
		host.innerHTML = html;
		return host;
	}

	it('numbers every block from one, zero-padded', () => {
		const host = blocks('<p>a</p><p>b</p>');
		ensureAnchorsOn(host.querySelectorAll('p'));
		expect([...host.querySelectorAll('p')].map((p) => p.getAttribute('data-anchor'))).toEqual([
			'a-001',
			'a-002'
		]);
	});

	it('keeps existing ids and numbers new blocks past the highest', () => {
		const host = blocks('<p data-anchor="a-007">a</p><p>b</p>');
		ensureAnchorsOn(host.querySelectorAll('p'));
		expect([...host.querySelectorAll('p')].map((p) => p.getAttribute('data-anchor'))).toEqual([
			'a-007',
			'a-008'
		]);
	});

	it('re-numbers a duplicate rather than leaving two blocks claiming one note', () => {
		const host = blocks('<p data-anchor="a-001">a</p><p data-anchor="a-001">b</p>');
		ensureAnchorsOn(host.querySelectorAll('p'));
		const ids = [...host.querySelectorAll('p')].map((p) => p.getAttribute('data-anchor'));
		expect(ids[0]).toBe('a-001');
		expect(ids[1]).not.toBe('a-001');
	});

	it('is idempotent, so editing does not reshuffle existing notes', () => {
		const host = blocks('<p>a</p><p>b</p>');
		ensureAnchorsOn(host.querySelectorAll('p'));
		const first = [...host.querySelectorAll('p')].map((p) => p.getAttribute('data-anchor'));
		ensureAnchorsOn(host.querySelectorAll('p'));
		expect([...host.querySelectorAll('p')].map((p) => p.getAttribute('data-anchor'))).toEqual(first);
	});

	it('stamps straight from a string', () => {
		expect(stampAnchorsHtml('<p>a</p>')).toBe('<p data-anchor="a-001">a</p>');
	});

	it('covers the block tags margin notes can attach to', () => {
		for (const tag of ['p', 'h1', 'blockquote', 'li', 'pre']) {
			expect(ANCHOR_BLOCK_SELECTOR.split(',')).toContain(tag);
		}
	});
});

describe('reading html as text', () => {
	it('knows a contenteditable left alone is still empty', () => {
		expect(isEmptyHtml('')).toBe(true);
		expect(isEmptyHtml('<p><br></p>')).toBe(true);
		expect(isEmptyHtml('<p>   </p>')).toBe(true);
		expect(isEmptyHtml('<p>a</p>')).toBe(false);
	});

	it('flattens to one line for counting and searching', () => {
		expect(stripTags('<p>one</p><p>two</p>')).toBe('one two');
		expect(stripTags(null as unknown as string)).toBe('');
	});

	it('keeps paragraph breaks when the destination is a textarea', () => {
		expect(htmlToText('<p>one</p><p>two</p>')).toBe('one\n\ntwo');
		expect(htmlToText('a<br>b')).toBe('a\nb');
	});

	it('decodes entities so text reads as it was written', () => {
		expect(htmlToText('<p>a &amp; b &lt;c&gt;</p>')).toBe('a & b <c>');
	});

	it('counts words in html and in plain text alike', () => {
		expect(countWords('<p>one two</p><p>three</p>')).toBe(3);
		expect(countWords('')).toBe(0);
		expect(countWordsInText('  one   two  ')).toBe(2);
		expect(countWordsInText('')).toBe(0);
	});

	it('previews on a word boundary, never mid-word', () => {
		const preview = previewText('<p>' + 'word '.repeat(40) + '</p>', 20);
		expect(preview.length).toBeLessThanOrEqual(20);
		expect(preview.endsWith('…')).toBe(true);
		expect(preview).not.toMatch(/\s…$/);
		expect(previewText('<p>short</p>')).toBe('short');
		expect(previewText('')).toBe('');
	});
});
