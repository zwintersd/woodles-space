import { describe, it, expect } from 'vitest';
import { parseImport } from './parser';

// Helper: assert success and narrow the union
function expectOk(result: ReturnType<typeof parseImport>) {
	if (!result.ok) {
		throw new Error(`expected ok, got errors: ${result.errors.join(' | ')}`);
	}
	return result;
}

function expectFail(result: ReturnType<typeof parseImport>) {
	if (result.ok) {
		throw new Error('expected failure, got ok');
	}
	return result;
}

const CLEAN = JSON.stringify({
	woodles: 'garden-import-v1',
	kind: 'artist-discography',
	title: 'Grouper',
	bio: 'Ambient project of Liz Harris.',
	albums: [
		{ kind: 'album', title: 'Ruins', releaseDate: '2014-10-31' },
		{ kind: 'album', title: 'A I A', releaseDate: '2011' }
	]
});

describe('parseImport — happy path', () => {
	it('parses clean garden-import-v1 JSON into one Spore', () => {
		const r = expectOk(parseImport(CLEAN));
		expect(r.spore.title).toBe('Grouper');
		expect(r.spore.data.kind).toBe('artist-discography');
		expect(r.warnings).toHaveLength(0);
		// hierarchy preserved in data
		expect(Array.isArray(r.spore.data.albums)).toBe(true);
		expect((r.spore.data.albums as unknown[]).length).toBe(2);
	});

	it('extracts the body from a bio field', () => {
		const r = expectOk(parseImport(CLEAN));
		expect(r.spore.body).toBe('Ambient project of Liz Harris.');
	});

	it('preserves child order as given (does not re-sort)', () => {
		const r = expectOk(parseImport(CLEAN));
		const albums = r.spore.data.albums as Array<Record<string, unknown>>;
		expect(albums[0].title).toBe('Ruins');
		expect(albums[1].title).toBe('A I A');
	});
});

describe('parseImport — forgiving intake', () => {
	it('strips ```json fences', () => {
		const fenced = '```json\n' + CLEAN + '\n```';
		const r = expectOk(parseImport(fenced));
		expect(r.spore.title).toBe('Grouper');
	});

	it('strips bare ``` fences', () => {
		const fenced = '```\n' + CLEAN + '\n```';
		const r = expectOk(parseImport(fenced));
		expect(r.spore.title).toBe('Grouper');
	});

	it('trims prose before and after the JSON', () => {
		const messy = `Sure! Here is the data you asked for:\n\n${CLEAN}\n\nLet me know if you need anything else.`;
		const r = expectOk(parseImport(messy));
		expect(r.spore.title).toBe('Grouper');
	});

	it('accepts a plausible object missing the woodles envelope, with a warning', () => {
		const noEnvelope = JSON.stringify({ kind: 'book', title: 'Dune', author: 'Frank Herbert' });
		const r = expectOk(parseImport(noEnvelope));
		expect(r.spore.title).toBe('Dune');
		expect(r.warnings.some((w) => /envelope/i.test(w))).toBe(true);
	});
});

describe('parseImport — normalization', () => {
	it('coerces unknown synonyms to the literal "unknown" sentinel', () => {
		const raw = JSON.stringify({
			woodles: 'garden-import-v1',
			kind: 'person',
			title: 'Someone',
			died: 'N/A',
			origin: 'not known',
			notableFor: '—'
		});
		const r = expectOk(parseImport(raw));
		expect(r.spore.data.died).toBe('unknown');
		expect(r.spore.data.origin).toBe('unknown');
		expect(r.spore.data.notableFor).toBe('unknown');
	});

	it('trims whitespace from string values', () => {
		const raw = JSON.stringify({
			woodles: 'garden-import-v1',
			kind: 'person',
			title: '  Spacey Name  ',
			bio: '  padded  '
		});
		const r = expectOk(parseImport(raw));
		expect(r.spore.title).toBe('Spacey Name');
		expect(r.spore.data.bio).toBe('padded');
	});

	it('does not treat the literal "unknown" as a body', () => {
		const raw = JSON.stringify({
			woodles: 'garden-import-v1',
			kind: 'person',
			title: 'Someone',
			bio: 'unknown',
			description: 'A real description.'
		});
		const r = expectOk(parseImport(raw));
		expect(r.spore.body).toBe('A real description.');
	});
});

describe('parseImport — truncation repair', () => {
	it('repairs a response cut off mid-array and warns', () => {
		// drop the trailing braces/brackets to simulate a token cutoff
		const truncated = CLEAN.slice(0, CLEAN.length - 3);
		const r = expectOk(parseImport(truncated));
		expect(r.spore.title).toBe('Grouper');
		expect(r.warnings.some((w) => /truncat|repair/i.test(w))).toBe(true);
	});

	it('repairs a response cut off mid-string', () => {
		const truncated =
			'{"woodles":"garden-import-v1","kind":"book","title":"Dune","description":"A desert pla';
		const r = expectOk(parseImport(truncated));
		expect(r.spore.title).toBe('Dune');
	});
});

describe('parseImport — error surfaces', () => {
	it('fails on non-object top-level JSON', () => {
		const r = expectFail(parseImport('[1, 2, 3]'));
		expect(r.recoverableText).toBe('[1, 2, 3]');
	});

	it('fails when the title is missing', () => {
		const raw = JSON.stringify({ woodles: 'garden-import-v1', kind: 'person', bio: 'x' });
		const r = expectFail(parseImport(raw));
		expect(r.errors.join(' ')).toMatch(/title/i);
	});

	it('fails on prose with no JSON, preserving the pasted text', () => {
		const prose = 'I am not able to help with that request.';
		const r = expectFail(parseImport(prose));
		expect(r.recoverableText).toBe(prose);
	});

	it('never discards the user\'s pasted text on failure', () => {
		const garbage = '{ this is not: valid json ]]]';
		const r = expectFail(parseImport(garbage));
		expect(r.recoverableText).toBe(garbage);
		expect(r.errors.length).toBeGreaterThan(0);
	});
});

describe('parseImport — forgiving repair: stringified containers', () => {
	it('unwraps an array emitted as a quoted string, with a warning', () => {
		// The exact drift a real paste hit: genres wrapped in quotes.
		const raw = `{
  "woodles": "garden-import-v1",
  "kind": "tv-series",
  "title": "Dickinson",
  "genres": "["comedy", "drama", "biographical"]",
  "status": "ended"
}`;
		const r = expectOk(parseImport(raw));
		expect(r.spore.data.genres).toEqual(['comedy', 'drama', 'biographical']);
		expect(r.warnings.some((w) => /quotes|unwrapp/i.test(w))).toBe(true);
	});

	it('unwraps a stringified object value', () => {
		const raw = `{"woodles":"garden-import-v1","kind":"work","title":"X","meta":"{"a":1}"}`;
		const r = expectOk(parseImport(raw));
		expect(r.spore.data.meta).toEqual({ a: 1 });
	});

	it('leaves valid arrays untouched and raises no spurious warning', () => {
		const raw = `{"woodles":"garden-import-v1","kind":"tv-series","title":"Y","genres":["a","b"]}`;
		const r = expectOk(parseImport(raw));
		expect(r.spore.data.genres).toEqual(['a', 'b']);
		expect(r.warnings).toHaveLength(0);
	});
});

describe('parseImport — error coaching', () => {
	it('surfaces the parser reason (with position) on malformed JSON', () => {
		// missing comma between two properties — not truncated, not unwrappable
		const raw = `{"woodles":"garden-import-v1","kind":"tv-series","title":"X" "network":"Y"}`;
		const r = expectFail(parseImport(raw));
		expect(
			r.errors.some((e) => /position|line|column|where it broke/i.test(e))
		).toBe(true);
		expect(r.recoverableText).toBe(raw);
	});
});

