// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Handoff } from '@woodles/handoff';
import { THINKING_ABOUT_SHELF_STORAGE_KEY } from '@woodles/sync';
import { ThinkingAbout } from './thinkingAbout.svelte';

const ENTRIES_KEY = 'thinking-about.entries.v1';
const LEDGER_KEY = 'thinking-about.ingestedHandoffs.v1';
const UPDATED_KEY = 'thinking-about.updatedAt.v1';
const OPENED = '2026-10-04T12:00:00.000Z';
const LATER = '2026-10-04T12:05:00.000Z';

function handoff(id = 'c-1'): Handoff {
	return {
		id,
		target: 'thinking-about',
		title: 'A good essay',
		body: '',
		format: 'text',
		tags: [],
		source: { app: 'companion', href: 'https://example.com/essay' },
		createdAt: '2026-10-03T09:30:00.000Z'
	};
}

// A fixed clock, so "moved" and "kept" are told apart rather than landing in
// the same millisecond and passing either way.
beforeEach(() => {
	localStorage.clear();
	vi.useFakeTimers({ now: new Date(OPENED), toFake: ['Date'] });
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('taking what was handed over', () => {
	it('lands it, moves the board’s clock, remembers it in this browser, and counts it', () => {
		const board = new ThinkingAbout();
		expect(board.updatedAt).toBe(OPENED);
		vi.setSystemTime(new Date(LATER));
		expect(board.ingestHandoffs([handoff()])).toBe(1);
		expect(board.entries.map((e) => e.id)).toEqual(['c-1']);
		expect(JSON.parse(localStorage.getItem(LEDGER_KEY) ?? '[]')).toEqual(['c-1']);
		// What hydrate compares: an arrival is an edit, made now.
		expect(board.updatedAt).toBe(LATER);
		expect(localStorage.getItem(UPDATED_KEY)).toBe(JSON.stringify(LATER));
		expect(board.handedOver).toBe(1);
	});

	it('writes nothing, and keeps its clock, when there is nothing new', () => {
		const board = new ThinkingAbout();
		board.ingestHandoffs([handoff()]);
		// Anything the store writes would replace these.
		const keys = [ENTRIES_KEY, UPDATED_KEY, LEDGER_KEY, THINKING_ABOUT_SHELF_STORAGE_KEY];
		for (const key of keys) localStorage.setItem(key, 'untouched');
		vi.setSystemTime(new Date(LATER));
		expect(board.ingestHandoffs([handoff()])).toBe(0);
		for (const key of keys) expect(localStorage.getItem(key)).toBe('untouched');
		expect(board.updatedAt).toBe(OPENED);
	});

	it('saves the ledger without moving the clock when only the ledger changed', () => {
		const board = new ThinkingAbout();
		board.ingestHandoffs([handoff()]);
		localStorage.removeItem(LEDGER_KEY);
		const fresh = new ThinkingAbout();
		vi.setSystemTime(new Date(LATER));
		expect(fresh.ingestHandoffs([handoff()])).toBe(0);
		expect(fresh.updatedAt).toBe(OPENED);
		expect(localStorage.getItem(UPDATED_KEY)).toBe(JSON.stringify(OPENED));
		expect(JSON.parse(localStorage.getItem(LEDGER_KEY) ?? '[]')).toEqual(['c-1']);
	});

	it('keeps a deleted arrival deleted, even after a board arrives from sync', () => {
		const board = new ThinkingAbout();
		board.ingestHandoffs([handoff()]);
		board.deleteEntry('c-1');
		board.rehydrate({ entries: [], updatedAt: '2026-10-04T16:00:00.000Z' });
		expect(board.ingestedHandoffs).toEqual(['c-1']);
		expect(board.ingestHandoffs([handoff()])).toBe(0);
		expect(board.entries).toEqual([]);
	});

	it('clears the notice when dismissed', () => {
		const board = new ThinkingAbout();
		board.ingestHandoffs([handoff('a'), handoff('b')]);
		expect(board.handedOver).toBe(2);
		board.dismissHandedOver();
		expect(board.handedOver).toBe(0);
	});
});

describe('a link to something not here yet', () => {
	it('opens straight away when the entry is already on the board', () => {
		const board = new ThinkingAbout();
		board.ingestHandoffs([handoff()]);
		board.openEntryWhenReady('c-1');
		expect(board.activeEntryId).toBe('c-1');
	});

	it('is held until the take, then opened and forgotten', () => {
		const board = new ThinkingAbout();
		board.openEntryWhenReady('c-1');
		expect(board.activeEntryId).toBeNull();
		board.ingestHandoffs([handoff()]);
		board.openPendingEntry();
		expect(board.activeEntryId).toBe('c-1');
		board.closeEntry();
		board.openPendingEntry();
		expect(board.activeEntryId).toBeNull();
	});

	it('never takes over an entry someone opened meanwhile', () => {
		const board = new ThinkingAbout();
		board.ingestHandoffs([handoff('mine')]);
		board.openEntryWhenReady('c-1');
		board.openEntry('mine');
		board.ingestHandoffs([handoff('c-1')]);
		board.openPendingEntry();
		expect(board.activeEntryId).toBe('mine');
	});

	it('is forgotten when the entry never arrives', () => {
		const board = new ThinkingAbout();
		board.openEntryWhenReady('gone');
		board.openPendingEntry();
		board.ingestHandoffs([handoff('gone')]);
		board.openPendingEntry();
		expect(board.activeEntryId).toBeNull();
	});
});
