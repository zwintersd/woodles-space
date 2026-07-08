import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOR } from './constants';
import {
	addEntry,
	archiveEntry,
	archivedEntries,
	blankEntry,
	deleteEntry,
	entriesForSection,
	isUntouched,
	latestEntryTimestamp,
	normalizeEntry,
	reopenEntry,
	today,
	updateEntry
} from './entries';
import type { ThinkingAboutEntry } from './types';

function make(over: Partial<ThinkingAboutEntry>): ThinkingAboutEntry {
	return { ...blankEntry('reading', 'book'), ...over };
}

describe('blankEntry', () => {
	it('starts active, undated-close, default color, dateStarted today', () => {
		const e = blankEntry('watching', 'film');
		expect(e.status).toBe('active');
		expect(e.dateClosed).toBeNull();
		expect(e.color).toBe(DEFAULT_COLOR);
		expect(e.dateStarted).toBe(today());
		expect(e.columnKey).toBe('watching');
		expect(e.sectionKey).toBe('film');
		expect(e.title).toBe('');
		expect(e.createdAt).toBe(e.updatedAt);
	});

	it('mints a unique id each time', () => {
		expect(blankEntry('reading', 'book').id).not.toBe(blankEntry('reading', 'book').id);
	});

	it('accepts an initial title', () => {
		expect(blankEntry('reading', 'book', 'Piranesi').title).toBe('Piranesi');
	});
});

describe('isUntouched', () => {
	it('is true for a fresh blank', () => {
		expect(isUntouched(blankEntry('reading', 'book'))).toBe(true);
	});
	it('is true for a whitespace-only title', () => {
		expect(isUntouched(make({ title: '   ' }))).toBe(true);
	});
	it('is false once a title is written', () => {
		expect(isUntouched(make({ title: 'Piranesi' }))).toBe(false);
	});
});

describe('addEntry', () => {
	it('prepends the new entry and returns it', () => {
		const existing = [make({ title: 'old' })];
		const { entries, created } = addEntry(existing, 'playing', 'switch', 'Tears of the Kingdom');
		expect(entries[0]).toBe(created);
		expect(entries).toHaveLength(2);
		expect(created.columnKey).toBe('playing');
		expect(created.sectionKey).toBe('switch');
		expect(created.title).toBe('Tears of the Kingdom');
	});

	it('does not mutate the input array', () => {
		const existing = [make({ title: 'old' })];
		addEntry(existing, 'reading', 'article');
		expect(existing).toHaveLength(1);
	});
});

describe('updateEntry', () => {
	it('patches only the matching entry and bumps updatedAt', () => {
		const a = make({ id: 'a', title: 'A' });
		const b = make({ id: 'b', title: 'B' });
		const result = updateEntry([a, b], 'a', { title: 'A2', notes: 'hi' });
		expect(result.find((e) => e.id === 'a')).toMatchObject({ title: 'A2', notes: 'hi' });
		expect(result.find((e) => e.id === 'b')).toEqual(b);
	});

	it('is a no-op for an unknown id', () => {
		const a = make({ id: 'a' });
		const result = updateEntry([a], 'nope', { title: 'changed' });
		expect(result).toEqual([a]);
	});

	it('does not mutate the input array', () => {
		const a = make({ id: 'a', title: 'A' });
		updateEntry([a], 'a', { title: 'changed' });
		expect(a.title).toBe('A');
	});
});

describe('archiveEntry / reopenEntry', () => {
	it('archiveEntry sets status archived and stamps dateClosed today', () => {
		const a = make({ id: 'a' });
		const [result] = archiveEntry([a], 'a');
		expect(result.status).toBe('archived');
		expect(result.dateClosed).toBe(today());
	});

	it('reopenEntry clears status back to active and dateClosed to null', () => {
		const a = make({ id: 'a', status: 'archived', dateClosed: '2026-01-01' });
		const [result] = reopenEntry([a], 'a');
		expect(result.status).toBe('active');
		expect(result.dateClosed).toBeNull();
	});
});

describe('deleteEntry', () => {
	it('removes the matching entry', () => {
		const a = make({ id: 'a' });
		const b = make({ id: 'b' });
		expect(deleteEntry([a, b], 'a')).toEqual([b]);
	});

	it('is a no-op for an unknown id', () => {
		const a = make({ id: 'a' });
		expect(deleteEntry([a], 'nope')).toEqual([a]);
	});
});

describe('entriesForSection', () => {
	it('filters by column, section, and active status', () => {
		const list = [
			make({ id: 'a', columnKey: 'reading', sectionKey: 'book', status: 'active' }),
			make({ id: 'b', columnKey: 'reading', sectionKey: 'article', status: 'active' }),
			make({ id: 'c', columnKey: 'playing', sectionKey: 'book' as never, status: 'active' }),
			make({ id: 'd', columnKey: 'reading', sectionKey: 'book', status: 'archived' })
		];
		expect(entriesForSection(list, 'reading', 'book').map((e) => e.id)).toEqual(['a']);
	});
});

describe('archivedEntries', () => {
	it('returns only archived entries, newest dateClosed first', () => {
		const list = [
			make({ id: 'a', status: 'archived', dateClosed: '2026-01-05' }),
			make({ id: 'b', status: 'active' }),
			make({ id: 'c', status: 'archived', dateClosed: '2026-02-01' })
		];
		expect(archivedEntries(list).map((e) => e.id)).toEqual(['c', 'a']);
	});
});

describe('latestEntryTimestamp', () => {
	it('returns the newest updatedAt from entries', () => {
		expect(
			latestEntryTimestamp([
				make({ id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' }),
				make({ id: 'b', updatedAt: '2026-02-01T00:00:00.000Z' })
			])
		).toBe('2026-02-01T00:00:00.000Z');
	});

	it('falls back to null for an empty list', () => {
		expect(latestEntryTimestamp([])).toBeNull();
	});
});

describe('normalizeEntry', () => {
	it('fills missing optional fields with safe defaults', () => {
		const raw = { ...blankEntry('reading', 'book') } as ThinkingAboutEntry;
		// @ts-expect-error — simulating an older/partial stored record
		delete raw.notes;
		// @ts-expect-error — simulating an older/partial stored record
		delete raw.status;
		// @ts-expect-error — simulating an older/partial stored record
		delete raw.color;
		const normalized = normalizeEntry(raw);
		expect(normalized.notes).toBe('');
		expect(normalized.status).toBe('active');
		expect(normalized.color).toBe(DEFAULT_COLOR);
	});

	it('repairs invalid or mismatched buckets', () => {
		const normalized = normalizeEntry({
			...blankEntry('reading', 'book'),
			columnKey: 'reading',
			sectionKey: 'film'
		});
		expect(normalized.columnKey).toBe('watching');
		expect(normalized.sectionKey).toBe('film');

		const fallback = normalizeEntry({
			...blankEntry('reading', 'book'),
			columnKey: 'playing',
			sectionKey: 'podcast' as never
		});
		expect(fallback.columnKey).toBe('playing');
		expect(fallback.sectionKey).toBe('pc_social');
	});

	it('falls back from an invalid status to active', () => {
		const normalized = normalizeEntry({
			...blankEntry('reading', 'book'),
			status: 'paused' as never
		});
		expect(normalized.status).toBe('active');
	});

	it('leaves a well-formed entry unchanged', () => {
		const e = make({ notes: 'hello', sharedWith: 'friend' });
		expect(normalizeEntry(e)).toEqual(e);
	});
});
