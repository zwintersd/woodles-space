import { describe, it, expect } from 'vitest';
import {
	normalizeTag,
	sameTag,
	hasTag,
	addTag,
	removeTag,
	cleanTags,
	parseTags,
	tagCounts
} from './tags';

describe('normalizeTag', () => {
	it('trims and collapses internal whitespace', () => {
		expect(normalizeTag('  sci   fi  ')).toBe('sci fi');
	});
	it('caps length at 50 characters', () => {
		expect(normalizeTag('x'.repeat(80))).toHaveLength(50);
	});
	it('returns empty for whitespace-only input', () => {
		expect(normalizeTag('   ')).toBe('');
	});
});

describe('sameTag / hasTag', () => {
	it('compares case-insensitively', () => {
		expect(sameTag('Sci-Fi', 'sci-fi')).toBe(true);
		expect(hasTag(['Rock', 'Pop'], 'rock')).toBe(true);
		expect(hasTag(['Rock'], 'jazz')).toBe(false);
	});
});

describe('addTag', () => {
	it('appends a normalized tag', () => {
		expect(addTag(['a'], '  b ')).toEqual(['a', 'b']);
	});
	it('dedupes case-insensitively, preserving existing casing', () => {
		expect(addTag(['Rock'], 'rock')).toEqual(['Rock']);
	});
	it('ignores empty tags', () => {
		expect(addTag(['a'], '   ')).toEqual(['a']);
	});
});

describe('removeTag', () => {
	it('removes case-insensitively', () => {
		expect(removeTag(['Rock', 'Pop'], 'rock')).toEqual(['Pop']);
	});
});

describe('cleanTags', () => {
	it('normalizes and dedupes a list', () => {
		expect(cleanTags([' Rock ', 'rock', 'Pop', ''])).toEqual(['Rock', 'Pop']);
	});
});

describe('parseTags', () => {
	it('splits on commas and dedupes', () => {
		expect(parseTags('sci-fi, 90s ,  sci-fi, rewatch')).toEqual(['sci-fi', '90s', 'rewatch']);
	});
	it('returns an empty array for blank input', () => {
		expect(parseTags('  ,  ')).toEqual([]);
	});
});

describe('tagCounts', () => {
	it('aggregates case-insensitively and sorts by count then name', () => {
		const spores = [
			{ tags: ['Sci-Fi', 'rewatch'] },
			{ tags: ['sci-fi'] },
			{ tags: ['comfort', 'rewatch'] },
			{ tags: undefined }
		];
		const counts = tagCounts(spores);
		expect(counts).toEqual([
			{ tag: 'rewatch', count: 2 },
			{ tag: 'Sci-Fi', count: 2 },
			{ tag: 'comfort', count: 1 }
		]);
	});

	it('keeps the most frequent display casing', () => {
		const spores = [{ tags: ['rock'] }, { tags: ['rock'] }, { tags: ['Rock'] }];
		expect(tagCounts(spores)).toEqual([{ tag: 'rock', count: 3 }]);
	});
});
