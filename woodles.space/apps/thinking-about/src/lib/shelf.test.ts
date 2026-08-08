import { describe, expect, it } from 'vitest';
import { readShelfBlob, THINKING_ABOUT_SHELF_VERSION } from '@woodles/sync';
import { buildShelf, shelvesMatch } from './shelf';
import { blankEntry } from './entries';
import type { ThinkingAboutEntry } from './types';

function entry(overrides: Partial<ThinkingAboutEntry> = {}): ThinkingAboutEntry {
	return { ...blankEntry('reading', 'book', 'a title'), ...overrides };
}

describe('buildShelf', () => {
	it('publishes only what another app can act on', () => {
		const shelf = buildShelf([
			entry({ id: 'e1', title: 'Piranesi', color: '#3f51b5', notes: 'private thoughts' })
		]);

		expect(shelf.version).toBe(THINKING_ABOUT_SHELF_VERSION);
		expect(shelf.entries).toEqual([
			{
				id: 'e1',
				title: 'Piranesi',
				columnKey: 'reading',
				sectionKey: 'book',
				color: '#3f51b5',
				lastSessionDate: null
			}
		]);
		// The private half of an entry must not ride along.
		expect(JSON.stringify(shelf)).not.toContain('private thoughts');
	});

	it('leaves archived entries off the shelf', () => {
		const shelf = buildShelf([
			entry({ id: 'open', title: 'still reading' }),
			entry({ id: 'done', title: 'finished', status: 'archived', dateClosed: '2026-08-01' })
		]);

		expect(shelf.entries.map((e) => e.id)).toEqual(['open']);
	});

	it('skips an untitled entry rather than publishing a blank chip', () => {
		// The board sweeps these on close, but one exists while a freshly
		// created entry's detail panel is still open.
		const shelf = buildShelf([entry({ id: 'blank', title: '   ' })]);
		expect(shelf.entries).toEqual([]);
	});

	it('carries the newest sitting, scanning rather than trusting order', () => {
		const shelf = buildShelf([
			entry({
				id: 'e1',
				sessions: [
					{ id: 's1', date: '2026-08-02', note: '' },
					{ id: 's2', date: '2026-08-09', note: '' },
					{ id: 's3', date: '2026-08-05', note: '' }
				]
			})
		]);

		expect(shelf.entries[0].lastSessionDate).toBe('2026-08-09');
	});

	it('trims a title so the reference and the label agree', () => {
		const shelf = buildShelf([entry({ title: '  Piranesi  ' })]);
		expect(shelf.entries[0].title).toBe('Piranesi');
	});

	it('round-trips through the contract validator', () => {
		const shelf = buildShelf([entry({ id: 'e1' })]);
		const parsed = readShelfBlob(JSON.parse(JSON.stringify(shelf)));
		expect(parsed).toEqual(shelf);
	});
});

describe('shelvesMatch', () => {
	it('ignores publishedAt, which changes on every save', () => {
		const a = buildShelf([entry({ id: 'e1' })], '2026-08-01T00:00:00.000Z');
		const b = buildShelf([entry({ id: 'e1' })], '2026-08-09T00:00:00.000Z');
		expect(shelvesMatch(a, b)).toBe(true);
	});

	it('notices a retitled entry', () => {
		const a = buildShelf([entry({ id: 'e1', title: 'before' })]);
		const b = buildShelf([entry({ id: 'e1', title: 'after' })]);
		expect(shelvesMatch(a, b)).toBe(false);
	});
});
