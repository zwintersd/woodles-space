import { beforeEach, describe, expect, it } from 'vitest';
import {
	findLetter,
	incrementIssue,
	loadLettersList,
	newLetterId,
	saveLettersList,
	writePublishedLegacy,
	type StoredLetter
} from './letters';

const LETTERS = 'woodles_letters';
const ISSUE = 'woodles_issue_count';
const LEGACY = 'woodles_published';

beforeEach(() => {
	localStorage.clear();
});

function letter(overrides: Partial<StoredLetter> = {}): StoredLetter {
	return {
		id: 'l-1',
		title: 't',
		theme: 'cream',
		motif: 'blobs',
		font: 'classic',
		issue: 1,
		publishedAt: '2024-01-01T00:00:00.000Z',
		layers: {},
		annotations: { pocketNotes: [], marginNotes: [] },
		content: '',
		replyTo: null,
		...overrides
	};
}

describe('newLetterId', () => {
	it('always begins with "l-"', () => {
		expect(newLetterId().startsWith('l-')).toBe(true);
	});
	it('is unique across calls', () => {
		const ids = new Set(Array.from({ length: 50 }, () => newLetterId()));
		expect(ids.size).toBe(50);
	});
});

describe('loadLettersList', () => {
	it('returns [] when nothing is stored', () => {
		expect(loadLettersList()).toEqual([]);
	});
	it('parses an existing list', () => {
		saveLettersList([letter()]);
		expect(loadLettersList()).toEqual([letter()]);
	});
	it('returns [] on a malformed list', () => {
		localStorage.setItem(LETTERS, '{nope');
		expect(loadLettersList()).toEqual([]);
	});
	it('returns [] when the stored payload is not an array', () => {
		localStorage.setItem(LETTERS, JSON.stringify({ id: 'x' }));
		expect(loadLettersList()).toEqual([]);
	});

	it('migrates a legacy single-letter into a list', () => {
		const legacy = { ...letter(), id: '' };
		localStorage.setItem(LEGACY, JSON.stringify(legacy));
		const list = loadLettersList();
		expect(list).toHaveLength(1);
		expect(list[0].id).toMatch(/^l-/);
		// idempotent — second call reads the newly-written LETTERS key
		const again = loadLettersList();
		expect(again).toEqual(list);
	});

	it('defaults replyTo to null when migrating', () => {
		const legacy = { ...letter(), replyTo: undefined as unknown as null };
		localStorage.setItem(LEGACY, JSON.stringify(legacy));
		const list = loadLettersList();
		expect(list[0].replyTo).toBeNull();
	});
});

describe('findLetter', () => {
	it('returns the matching letter', () => {
		const list = [letter({ id: 'l-1' }), letter({ id: 'l-2', title: 'two' })];
		expect(findLetter(list, 'l-2')?.title).toBe('two');
	});
	it('returns undefined when no match', () => {
		expect(findLetter([letter()], 'l-nope')).toBeUndefined();
	});
});

describe('incrementIssue', () => {
	it('starts at 1', () => {
		expect(incrementIssue()).toBe(1);
		expect(localStorage.getItem(ISSUE)).toBe('1');
	});
	it('bumps on each call', () => {
		incrementIssue();
		expect(incrementIssue()).toBe(2);
		expect(incrementIssue()).toBe(3);
	});
	it('handles a corrupt counter as 0', () => {
		localStorage.setItem(ISSUE, 'not-a-number');
		expect(incrementIssue()).toBe(1);
	});
});

describe('writePublishedLegacy', () => {
	it('writes the payload to the legacy slot', () => {
		writePublishedLegacy({ title: 'x', issue: 42 });
		const back = JSON.parse(localStorage.getItem(LEGACY) ?? '{}');
		expect(back.title).toBe('x');
		expect(back.issue).toBe(42);
	});
});
