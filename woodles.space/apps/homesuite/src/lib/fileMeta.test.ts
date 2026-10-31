import { beforeEach, describe, expect, it } from 'vitest';
import {
	FILE_META_KEY, SORT_PREF_KEY, defaultDirection, draftCreatedAt, documentWordCount, describeFiles,
	loadFileMeta, loadSortPref, saveSortPref, sortFiles, syncFileMeta, withOpened, type FileInfo
} from './fileMeta';
import { saveDraft } from '../../../write/src/lib/drafts';
import { refKey } from './folders';

beforeEach(() => localStorage.clear());

const file = (id: string, title: string, extra: Partial<FileInfo> = {}): FileInfo => ({
	ref: { app: 'write', kind: 'draft', id }, kind: 'document', title, updatedAt: '2026-10-01T00:00:00.000Z', ...extra
});

describe('draftCreatedAt', () => {
	it('reads the time out of a Write draft id', () => {
		const stamp = Date.UTC(2026, 5, 1);
		expect(draftCreatedAt('d-' + stamp.toString(36))).toBe(new Date(stamp).toISOString());
	});
	it('ignores ids that are not timestamps', () => {
		expect(draftCreatedAt('d-1')).toBeUndefined();
		expect(draftCreatedAt('board-abc')).toBeUndefined();
		expect(draftCreatedAt('d-' + Date.UTC(2010, 0, 1).toString(36))).toBeUndefined();
	});
});

describe('syncFileMeta', () => {
	const now = '2026-10-31T12:00:00.000Z';
	it('uses a draft id for age, else first sight, and keeps what it already knows', () => {
		const stamp = Date.UTC(2026, 5, 1);
		const doc = file('d-' + stamp.toString(36), 'a');
		const board = { ref: { app: 'whiteboard', kind: 'board', id: 'b1' } };
		const known = { [refKey(board.ref)]: { createdAt: '2026-01-01T00:00:00.000Z', openedAt: '2026-02-01T00:00:00.000Z' } };
		const { map } = syncFileMeta(known, [doc, board], [], now);
		expect(map[refKey(doc.ref)].createdAt).toBe(new Date(stamp).toISOString());
		expect(map[refKey(board.ref)]).toEqual(known[refKey(board.ref)]);
		const fresh = syncFileMeta({}, [{ ref: { app: 'data', kind: 'collection', id: 'c' } }], [], now);
		expect(fresh.map[refKey({ app: 'data', kind: 'collection', id: 'c' })].createdAt).toBe(now);
	});
	it('drops vanished files but keeps trashed ones, and reports whether anything changed', () => {
		const gone = refKey({ app: 'data', kind: 'collection', id: 'gone' });
		const binned = refKey({ app: 'data', kind: 'collection', id: 'binned' });
		const start = { [gone]: { createdAt: now }, [binned]: { createdAt: now } };
		const result = syncFileMeta(start, [], [binned], now);
		expect(Object.keys(result.map)).toEqual([binned]);
		expect(result.changed).toBe(true);
		expect(syncFileMeta(result.map, [], [binned], now).changed).toBe(false);
	});
});

describe('loadFileMeta / withOpened', () => {
	it('round-trips and discards junk', () => {
		const ref = { app: 'write', kind: 'draft', id: 'd-x' };
		const map = withOpened({}, ref, '2026-10-31T00:00:00.000Z');
		localStorage.setItem(FILE_META_KEY, JSON.stringify({ ...map, bad: { openedAt: 'nope' }, worse: 4 }));
		expect(loadFileMeta()).toEqual(map);
		localStorage.setItem(FILE_META_KEY, '{oops');
		expect(loadFileMeta()).toEqual({});
	});
});

describe('documentWordCount', () => {
	it('counts the foreground text and refreshes when the document changes', () => {
		saveDraft('d-w1', { layers: { foreground: { html: '<p>one two <em>three</em></p>' } } });
		expect(documentWordCount('d-w1', 'a')).toBe(3);
		saveDraft('d-w1', { layers: { foreground: { html: '<p>one two three four</p>' } } });
		expect(documentWordCount('d-w1', 'a')).toBe(3);
		expect(documentWordCount('d-w1', 'b')).toBe(4);
	});
	it('has no count for a missing body', () => {
		expect(documentWordCount('d-none', 'a')).toBeUndefined();
		expect(describeFiles([file('d-none', 'x')], {})[0].wordCount).toBeUndefined();
	});
});

describe('sortFiles', () => {
	const items = [
		file('a', 'Beta', { updatedAt: '2026-10-02T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', wordCount: 10 }),
		file('b', 'alpha', { updatedAt: '2026-10-03T00:00:00.000Z', createdAt: '2026-03-01T00:00:00.000Z', openedAt: '2026-10-30T00:00:00.000Z', wordCount: 500 }),
		file('c', 'Gamma', { updatedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-02-01T00:00:00.000Z', openedAt: '2026-10-29T00:00:00.000Z', kind: 'board' })
	];
	const ids = (list: FileInfo[]) => list.map((item) => item.ref.id);
	it('sorts by each key in both directions', () => {
		expect(ids(sortFiles(items, { key: 'edited', direction: 'desc' }))).toEqual(['b', 'a', 'c']);
		expect(ids(sortFiles(items, { key: 'created', direction: 'asc' }))).toEqual(['a', 'c', 'b']);
		expect(ids(sortFiles(items, { key: 'name', direction: 'asc' }))).toEqual(['b', 'a', 'c']);
		expect(ids(sortFiles(items, { key: 'type', direction: 'asc' }))).toEqual(['c', 'b', 'a']);
	});
	it('puts files without a value last either way', () => {
		expect(ids(sortFiles(items, { key: 'opened', direction: 'desc' }))).toEqual(['b', 'c', 'a']);
		expect(ids(sortFiles(items, { key: 'opened', direction: 'asc' }))).toEqual(['c', 'b', 'a']);
		expect(ids(sortFiles(items, { key: 'words', direction: 'desc' }))).toEqual(['b', 'a', 'c']);
		expect(ids(sortFiles(items, { key: 'words', direction: 'asc' }))).toEqual(['a', 'b', 'c']);
	});
	it('does not mutate its input', () => {
		const before = ids(items);
		sortFiles(items, { key: 'name', direction: 'desc' });
		expect(ids(items)).toEqual(before);
	});
});

describe('sort preference', () => {
	it('persists, and falls back on junk', () => {
		expect(loadSortPref()).toEqual({ key: 'edited', direction: 'desc' });
		saveSortPref({ key: 'name', direction: 'desc' });
		expect(loadSortPref()).toEqual({ key: 'name', direction: 'desc' });
		localStorage.setItem(SORT_PREF_KEY, JSON.stringify({ key: 'bogus' }));
		expect(loadSortPref()).toEqual({ key: 'edited', direction: 'desc' });
		localStorage.setItem(SORT_PREF_KEY, JSON.stringify({ key: 'name', direction: 'sideways' }));
		expect(loadSortPref()).toEqual({ key: 'name', direction: defaultDirection('name') });
	});
});
