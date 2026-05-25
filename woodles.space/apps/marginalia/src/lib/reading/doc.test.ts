import { beforeEach, describe, expect, it } from 'vitest';
import { loadDoc, persistDoc, wipeDoc } from './doc';
import type { MarginNote, Paragraph } from './text';

beforeEach(() => {
	sessionStorage.clear();
});

const KEY_V3 = 'marginalia.reading.doc.v3';
const KEY_V2 = 'marginalia.reading.doc.v2';
const KEY_V1 = 'marginalia.reading.paste.v1';

const note: MarginNote = {
	id: 'n1',
	anchorId: 'a-001',
	html: '<p>note</p>',
	createdAt: '2024-01-01T00:00:00.000Z',
	updatedAt: '2024-01-01T00:00:00.000Z'
};

describe('persistDoc + loadDoc (v3)', () => {
	it('roundtrips a doc with paragraphs and notes', () => {
		const paragraphs: Paragraph[] = [{ id: 'p1', html: '<p data-anchor="a-001">hello world</p>' }];
		persistDoc({ text: 'hello world', paragraphs, notes: [note] });
		const back = loadDoc();
		expect(back).not.toBeNull();
		expect(back?.text).toBe('hello world');
		expect(back?.paragraphs).toEqual(paragraphs);
		expect(back?.notes).toEqual([note]);
		expect(back?.wordCount).toBe(2);
	});

	it('returns null when nothing is stored', () => {
		expect(loadDoc()).toBeNull();
	});

	it('returns null on malformed JSON', () => {
		sessionStorage.setItem(KEY_V3, '{not json');
		expect(loadDoc()).toBeNull();
	});

	it('returns null on a v3 payload missing paragraphs', () => {
		sessionStorage.setItem(KEY_V3, JSON.stringify({ text: 'x', paragraphs: 'oops' }));
		expect(loadDoc()).toBeNull();
	});

	it('coerces missing notes to []', () => {
		sessionStorage.setItem(
			KEY_V3,
			JSON.stringify({ text: 'x', paragraphs: [{ id: 'p1', html: '<p>x</p>' }] })
		);
		const back = loadDoc();
		expect(back?.notes).toEqual([]);
	});
});

describe('wipeDoc', () => {
	it('removes the v3 store', () => {
		persistDoc({ text: 'x', paragraphs: [{ id: 'p1', html: '<p>x</p>' }], notes: [] });
		wipeDoc();
		expect(loadDoc()).toBeNull();
	});
});

describe('migration: v2 → v3', () => {
	it('promotes a v2 doc with HTML paragraphs and removes the v2 key', () => {
		sessionStorage.setItem(
			KEY_V2,
			JSON.stringify({
				text: 'a b c',
				paragraphs: [{ id: 'p1', html: '<p>a b c</p>' }],
				notes: [note]
			})
		);
		const back = loadDoc();
		expect(back?.text).toBe('a b c');
		expect(back?.paragraphs).toEqual([{ id: 'p1', html: '<p>a b c</p>' }]);
		expect(back?.notes).toEqual([note]);
		expect(back?.wordCount).toBe(3);
		expect(sessionStorage.getItem(KEY_V2)).toBeNull();
		// migration write-through to v3
		expect(sessionStorage.getItem(KEY_V3)).not.toBeNull();
	});

	it('promotes a v2 doc with plain-text content (escapes HTML)', () => {
		sessionStorage.setItem(
			KEY_V2,
			JSON.stringify({
				text: '<oops>',
				paragraphs: [{ id: 'p1', content: '<oops>' }]
			})
		);
		const back = loadDoc();
		expect(back?.paragraphs[0].html).toContain('&lt;oops&gt;');
		expect(back?.paragraphs[0].html).toContain('data-anchor="placeholder"');
	});

	it('converts newlines in plain text to <br>', () => {
		sessionStorage.setItem(
			KEY_V2,
			JSON.stringify({ text: 'a\nb', paragraphs: [{ id: 'p1', content: 'a\nb' }] })
		);
		const back = loadDoc();
		expect(back?.paragraphs[0].html).toContain('a<br>b');
	});
});

describe('migration: v1 → v3', () => {
	it('builds paragraphs from a raw v1 string and removes the v1 key', () => {
		sessionStorage.setItem(KEY_V1, 'first para\n\nsecond para');
		const back = loadDoc();
		expect(back?.text).toBe('first para\n\nsecond para');
		expect(back?.paragraphs.length).toBeGreaterThan(0);
		expect(back?.notes).toEqual([]);
		expect(sessionStorage.getItem(KEY_V1)).toBeNull();
		expect(sessionStorage.getItem(KEY_V3)).not.toBeNull();
	});
});

describe('precedence', () => {
	it('v3 wins over v2 and v1', () => {
		sessionStorage.setItem(
			KEY_V3,
			JSON.stringify({ text: 'v3-text', paragraphs: [{ id: 'p1', html: '<p>v3</p>' }] })
		);
		sessionStorage.setItem(KEY_V2, JSON.stringify({ text: 'v2-text' }));
		sessionStorage.setItem(KEY_V1, 'v1-text');
		const back = loadDoc();
		expect(back?.text).toBe('v3-text');
		// v2 / v1 keys are untouched if v3 was the source
		expect(sessionStorage.getItem(KEY_V2)).not.toBeNull();
		expect(sessionStorage.getItem(KEY_V1)).not.toBeNull();
	});
});
