import { describe, expect, it } from 'vitest';
import {
	readShelfBlob,
	THINKING_ABOUT_SHELF_APP,
	THINKING_ABOUT_SHELF_VERSION
} from './crossAppBlobs';

const APP_PATTERN = /^[a-z0-9-]{1,40}$/;

function shelfEntry(overrides: Record<string, unknown> = {}) {
	return {
		id: 'e1',
		title: 'Piranesi',
		columnKey: 'reading',
		sectionKey: 'book',
		color: '#3f51b5',
		lastSessionDate: null,
		...overrides
	};
}

function shelf(entries: unknown[] = [shelfEntry()]) {
	return { version: THINKING_ABOUT_SHELF_VERSION, entries, publishedAt: '2026-08-09T00:00:00.000Z' };
}

describe('cross-app ledger keys', () => {
	it('is a valid sync app key, and namespaced under its publisher', () => {
		// api/_lib.ts rejects anything else with a 400 before it reaches the table.
		expect(THINKING_ABOUT_SHELF_APP).toMatch(APP_PATTERN);
		expect(THINKING_ABOUT_SHELF_APP.startsWith('thinking-about')).toBe(true);
		// It must not collide with the publishing app's own private blob.
		expect(THINKING_ABOUT_SHELF_APP).not.toBe('thinking-about');
	});
});

describe('readShelfBlob', () => {
	it('accepts a well-formed shelf', () => {
		expect(readShelfBlob(shelf())?.entries).toHaveLength(1);
	});

	it('refuses anything that is not a shelf, rather than half-reading it', () => {
		// Every one of these reads as "nothing published yet" to a consumer,
		// which is a state every reader here already handles.
		expect(readShelfBlob(null)).toBeNull();
		expect(readShelfBlob('a string')).toBeNull();
		expect(readShelfBlob({})).toBeNull();
		expect(readShelfBlob({ ...shelf(), entries: 'not an array' })).toBeNull();
	});

	it('refuses a future version rather than guessing at its shape', () => {
		expect(readShelfBlob({ ...shelf(), version: 2 })).toBeNull();
		expect(readShelfBlob({ ...shelf(), version: undefined })).toBeNull();
	});

	it('drops malformed entries but keeps the sound ones', () => {
		const parsed = readShelfBlob(
			shelf([shelfEntry({ id: 'good' }), { id: 'bad' }, shelfEntry({ id: 'also-good' })])
		);
		expect(parsed?.entries.map((e) => e.id)).toEqual(['good', 'also-good']);
	});

	it('tolerates a missing publishedAt', () => {
		const parsed = readShelfBlob({ version: 1, entries: [shelfEntry()] });
		expect(parsed?.publishedAt).toBe('');
		expect(parsed?.entries).toHaveLength(1);
	});
});
