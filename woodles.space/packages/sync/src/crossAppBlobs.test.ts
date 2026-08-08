import { describe, expect, it } from 'vitest';
import {
	readSessionsBlob,
	CARILLON_SESSIONS_APP,
	CARILLON_SESSIONS_VERSION,
	readCommitmentsBlob,
	readShelfBlob,
	CARILLON_COMMITMENTS_APP,
	CARILLON_COMMITMENTS_VERSION,
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

describe('readCommitmentsBlob', () => {
	const commitment = {
		entryId: 'piranesi',
		taskId: 't1',
		title: 'read a chapter',
		date: '2026-08-13',
		time: '20:00',
		blockTitle: 'evening',
		status: 'open'
	};
	const blob = (commitments: unknown[] = [commitment]) => ({
		version: CARILLON_COMMITMENTS_VERSION,
		commitments,
		publishedAt: '2026-08-09T00:00:00.000Z'
	});

	it('accepts a well-formed ledger, nulls and all', () => {
		const parsed = readCommitmentsBlob(
			blob([{ ...commitment, date: null, time: null, blockTitle: null }])
		);
		expect(parsed?.commitments).toHaveLength(1);
	});

	it('refuses anything that is not a ledger', () => {
		expect(readCommitmentsBlob(null)).toBeNull();
		expect(readCommitmentsBlob({})).toBeNull();
		expect(readCommitmentsBlob({ ...blob(), commitments: 'no' })).toBeNull();
	});

	it('refuses a future version rather than guessing at its shape', () => {
		expect(readCommitmentsBlob({ ...blob(), version: 2 })).toBeNull();
	});

	it('drops malformed entries but keeps the sound ones', () => {
		const parsed = readCommitmentsBlob(
			blob([
				commitment,
				{ ...commitment, taskId: 't2', status: 'dropped' },
				{ ...commitment, taskId: 't3' }
			])
		);
		// `dropped` is filtered out at publish time and is not a value this
		// ledger carries — a blob claiming one is malformed, not a third state.
		expect(parsed?.commitments.map((c) => c.taskId)).toEqual(['t1', 't3']);
	});

	it('does not collide with the shelf key', () => {
		expect(CARILLON_COMMITMENTS_APP).toMatch(APP_PATTERN);
		expect(CARILLON_COMMITMENTS_APP).not.toBe(THINKING_ABOUT_SHELF_APP);
		expect(CARILLON_COMMITMENTS_APP).not.toBe('planner');
	});
});

describe('readSessionsBlob', () => {
	const sitting = { id: 'session-piranesi-2026-08-04', entryId: 'piranesi', date: '2026-08-04' };
	const blob = (sittings: unknown[] = [sitting]) => ({
		version: CARILLON_SESSIONS_VERSION,
		sittings,
		publishedAt: '2026-08-09T00:00:00.000Z'
	});

	it('accepts a well-formed ledger', () => {
		expect(readSessionsBlob(blob())?.sittings).toEqual([sitting]);
	});

	it('refuses anything that is not a ledger, or a future version', () => {
		expect(readSessionsBlob(null)).toBeNull();
		expect(readSessionsBlob({})).toBeNull();
		expect(readSessionsBlob({ ...blob(), sittings: 'no' })).toBeNull();
		expect(readSessionsBlob({ ...blob(), version: 2 })).toBeNull();
	});

	it('drops malformed sittings but keeps the sound ones', () => {
		const parsed = readSessionsBlob(blob([sitting, { id: 'partial' }]));
		expect(parsed?.sittings.map((s) => s.id)).toEqual([sitting.id]);
	});

	it('has a key of its own, distinct from the other two ledgers', () => {
		expect(CARILLON_SESSIONS_APP).toMatch(APP_PATTERN);
		expect(new Set([CARILLON_SESSIONS_APP, CARILLON_COMMITMENTS_APP, THINKING_ABOUT_SHELF_APP]).size).toBe(3);
		expect(CARILLON_SESSIONS_APP).not.toBe('planner');
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
