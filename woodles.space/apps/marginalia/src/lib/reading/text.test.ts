import { describe, expect, it } from 'vitest';
import { paragraphsFromLetterHtml, sanitizePassageHtml } from './text';

describe('sanitizePassageHtml', () => {
	it('does not empty its own output — regression guard for the root-unwrap bug', () => {
		// the internal `clean()` walk must never run on the synthetic #__r
		// wrapper itself: DIV is one of UNWRAP_TAGS, so calling clean(root)
		// directly used to unwrap root out from under itself (move every
		// child up to root's own parent, then remove root), leaving
		// root.innerHTML permanently "" for any input at all.
		expect(sanitizePassageHtml('<p data-anchor="p-001">content survives</p>')).not.toBe('');
	});

	it('keeps a plain paragraph unchanged', () => {
		const html = '<p data-anchor="p-001">plain text</p>';
		expect(sanitizePassageHtml(html)).toBe(html);
	});
});

describe('paragraphsFromLetterHtml', () => {
	it('is empty for empty input', () => {
		expect(paragraphsFromLetterHtml('')).toEqual([]);
	});

	it('extracts a paragraph from an already-anchored block, matching write\'s own stamping', () => {
		const out = paragraphsFromLetterHtml('<p data-anchor="p-001">hello there</p>');
		expect(out).toHaveLength(1);
		expect(out[0].id).toBe('p-001');
		expect(out[0].html).toContain('hello there');
	});

	it('stamps an anchor defensively when the source has none (an older or hand-built letter)', () => {
		const out = paragraphsFromLetterHtml('<p>one</p><p>two</p>');
		expect(out).toHaveLength(2);
		expect(out[0].id).toMatch(/^p-\d+$/);
		expect(out[1].id).toMatch(/^p-\d+$/);
		expect(out[0].id).not.toBe(out[1].id);
	});

	it('preserves multiple top-level blocks in source order', () => {
		const out = paragraphsFromLetterHtml('<h2 data-anchor="a">a title</h2><p data-anchor="b">body text</p>');
		expect(out.map((p) => p.id)).toEqual(['a', 'b']);
		expect(out[0].html).toContain('a title');
		expect(out[1].html).toContain('body text');
	});

	it('strips a script tag entirely — this is untrusted content from a public fetch', () => {
		const out = paragraphsFromLetterHtml('<p data-anchor="p-001">safe<script>alert(1)</script></p>');
		expect(out).toHaveLength(1);
		expect(out[0].html).not.toContain('script');
		expect(out[0].html).not.toContain('alert');
		expect(out[0].html).toContain('safe');
	});

	it('strips a dangerous href protocol but keeps the link text', () => {
		const out = paragraphsFromLetterHtml(
			'<p data-anchor="p-001"><a href="javascript:alert(1)">click</a></p>'
		);
		expect(out[0].html).not.toContain('javascript:');
		expect(out[0].html).toContain('click');
	});

	it('unwraps a noisy span/div wrapper but keeps its inner text', () => {
		const out = paragraphsFromLetterHtml('<p data-anchor="p-001"><span style="color:red">styled</span></p>');
		expect(out[0].html).not.toContain('span');
		expect(out[0].html).toContain('styled');
	});

	it('keeps allowed formatting tags (strong/em/mark)', () => {
		const out = paragraphsFromLetterHtml(
			'<p data-anchor="p-001"><strong>bold</strong> <em>italic</em> <mark>marked</mark></p>'
		);
		expect(out[0].html).toContain('<strong>bold</strong>');
		expect(out[0].html).toContain('<em>italic</em>');
		expect(out[0].html).toContain('<mark>marked</mark>');
	});
});
