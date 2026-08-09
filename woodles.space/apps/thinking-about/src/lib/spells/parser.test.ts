import { describe, expect, it } from 'vitest';
import { parseSpell } from './parser';

function envelope(overrides: Record<string, unknown> = {}) {
	return JSON.stringify({
		woodles: 'thinking-about-spell-v1',
		kind: 'book',
		title: 'Piranesi',
		author: 'Susanna Clarke',
		year: '2020',
		...overrides
	});
}

describe('parseSpell', () => {
	it('parses a clean response', () => {
		const result = parseSpell(envelope());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.title).toBe('Piranesi');
			expect(result.data.author).toBe('Susanna Clarke');
			expect(result.warnings).toEqual([]);
		}
	});

	it('strips code fences', () => {
		const result = parseSpell('```json\n' + envelope() + '\n```');
		expect(result.ok).toBe(true);
	});

	it('accepts a response missing the envelope marker, with a warning', () => {
		const result = parseSpell(JSON.stringify({ kind: 'book', title: 'Piranesi' }));
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.warnings[0]).toMatch(/envelope marker/);
	});

	it('rejects something that is not JSON at all', () => {
		const result = parseSpell('Sure! Piranesi is a 2020 novel by Susanna Clarke.');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors[0]).toMatch(/valid JSON|spell response/);
	});

	it('rejects a JSON array at the top level', () => {
		const result = parseSpell('[1, 2, 3]');
		expect(result.ok).toBe(false);
	});

	it('rejects a response missing a title', () => {
		const result = parseSpell(JSON.stringify({ woodles: 'thinking-about-spell-v1', kind: 'book' }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors[0]).toMatch(/title/);
	});

	it('repairs a truncated response by closing open braces', () => {
		const truncated = '{"woodles":"thinking-about-spell-v1","kind":"book","title":"Piranesi","author":"Susanna Clarke"';
		const result = parseSpell(truncated);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.title).toBe('Piranesi');
			expect(result.warnings[0]).toMatch(/truncated/);
		}
	});

	it('unwraps an array a model emitted with stray quotes around it', () => {
		// A sloppy but common LLM slip: the array is wrapped in an extra pair of
		// quotes with its inner quotes left unescaped, which breaks JSON.parse
		// on the whole document, not just this field.
		const raw =
			'{"woodles":"thinking-about-spell-v1","kind":"book","title":"Piranesi",' +
			'"genres":"["fantasy","literary fiction"]"}';
		const result = parseSpell(raw);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data.genres).toEqual(['fantasy', 'literary fiction']);
	});

	it('normalizes "n/a"-style values to "unknown"', () => {
		const result = parseSpell(envelope({ year: 'N/A' }));
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data.year).toBe('unknown');
	});
});
