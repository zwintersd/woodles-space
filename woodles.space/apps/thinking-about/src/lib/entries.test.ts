import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOR, defaultSectionForColumn } from './constants';
import {
	addEntry,
	archiveEntry,
	archivedEntries,
	blankEntry,
	deleteEntry,
	entriesForSection,
	isUntouched,
	latestEntryTimestamp,
	latestSessionDate,
	logSession,
	normalizeEntry,
	removeSession,
	reopenEntry,
	today,
	updateEntry,
	updateSession
} from './entries';
import type { Session, ThinkingAboutEntry } from './types';

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
		expect(e.sessions).toEqual([]);
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

describe('logSession', () => {
	it('prepends a session dated today with an empty note by default, and returns it as created', () => {
		const a = make({ id: 'a' });
		const { entries, created } = logSession([a], 'a');
		expect(entries[0].sessions).toHaveLength(1);
		expect(entries[0].sessions[0]).toMatchObject({ date: today(), note: '' });
		expect(created).toMatchObject({ date: today(), note: '' });
		expect(entries[0].sessions[0]).toEqual(created);
	});

	it('accepts a note and keeps prior sessions, newest first', () => {
		const a = make({ id: 'a', sessions: [{ id: 'old', date: '2026-01-01', note: 'ep 1' }] });
		const { entries } = logSession([a], 'a', 'ep 2');
		expect(entries[0].sessions.map((s) => s.note)).toEqual(['ep 2', 'ep 1']);
	});

	it('works the same regardless of the entry column — reading, playing, or watching', () => {
		for (const columnKey of ['reading', 'playing', 'watching'] as const) {
			const a = blankEntry(columnKey, defaultSectionForColumn(columnKey));
			const { created } = logSession([a], a.id, 'a note');
			expect(created).toMatchObject({ date: today(), note: 'a note' });
		}
	});

	it('is a no-op for an unknown id', () => {
		const a = make({ id: 'a' });
		const { entries, created } = logSession([a], 'nope');
		expect(entries).toEqual([a]);
		expect(created).toBeNull();
	});

	it('does not mutate the input entry', () => {
		const a = make({ id: 'a' });
		logSession([a], 'a');
		expect(a.sessions).toEqual([]);
	});
});

describe('latestSessionDate', () => {
	it('returns the latest date across sessions regardless of array order', () => {
		const sessions: Session[] = [
			{ id: 's1', date: '2026-01-05', note: '' },
			{ id: 's2', date: '2026-02-01', note: '' },
			{ id: 's3', date: '2026-01-20', note: '' }
		];
		expect(latestSessionDate(sessions)).toBe('2026-02-01');
	});

	it('falls back to null for no sessions', () => {
		expect(latestSessionDate([])).toBeNull();
	});
});

describe('updateSession', () => {
	it('patches only the matching session on the matching entry', () => {
		const a = make({
			id: 'a',
			sessions: [
				{ id: 's1', date: '2026-01-01', note: 'one' },
				{ id: 's2', date: '2026-01-02', note: 'two' }
			]
		});
		const [result] = updateSession([a], 'a', 's1', { note: 'edited' });
		expect(result.sessions).toEqual([
			{ id: 's1', date: '2026-01-01', note: 'edited' },
			{ id: 's2', date: '2026-01-02', note: 'two' }
		]);
	});

	it('is a no-op for an unknown entry or session id', () => {
		const a = make({ id: 'a', sessions: [{ id: 's1', date: '2026-01-01', note: 'one' }] });
		expect(updateSession([a], 'nope', 's1', { note: 'x' })[0].sessions).toEqual(a.sessions);
		expect(updateSession([a], 'a', 'nope', { note: 'x' })[0].sessions).toEqual(a.sessions);
	});
});

describe('removeSession', () => {
	it('removes only the matching session', () => {
		const a = make({
			id: 'a',
			sessions: [
				{ id: 's1', date: '2026-01-01', note: 'one' },
				{ id: 's2', date: '2026-01-02', note: 'two' }
			]
		});
		const [result] = removeSession([a], 'a', 's1');
		expect(result.sessions).toEqual([{ id: 's2', date: '2026-01-02', note: 'two' }]);
	});

	it('is a no-op for an unknown entry or session id', () => {
		const a = make({ id: 'a', sessions: [{ id: 's1', date: '2026-01-01', note: 'one' }] });
		expect(removeSession([a], 'nope', 's1')[0].sessions).toEqual(a.sessions);
		expect(removeSession([a], 'a', 'nope')[0].sessions).toEqual(a.sessions);
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
		// @ts-expect-error — simulating a pre-sessions stored record
		delete raw.sessions;
		const normalized = normalizeEntry(raw);
		expect(normalized.notes).toBe('');
		expect(normalized.status).toBe('active');
		expect(normalized.color).toBe(DEFAULT_COLOR);
		expect(normalized.sessions).toEqual([]);
	});

	it('fills missing id/date on a hand-edited session', () => {
		const raw = { ...blankEntry('watching', 'film') } as ThinkingAboutEntry;
		const partialSession = { note: 'ep 3' } as Partial<Session>;
		// @ts-expect-error — simulating a hand-edited/corrupt session record
		raw.sessions = [partialSession];
		const normalized = normalizeEntry(raw);
		expect(normalized.sessions).toHaveLength(1);
		expect(normalized.sessions[0]).toMatchObject({ note: 'ep 3', date: today() });
		expect(typeof normalized.sessions[0].id).toBe('string');
		expect(normalized.sessions[0].id.length).toBeGreaterThan(0);
	});

	it('treats a non-array sessions value as empty', () => {
		const normalized = normalizeEntry({
			...blankEntry('watching', 'film'),
			sessions: 'nope' as never
		});
		expect(normalized.sessions).toEqual([]);
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
