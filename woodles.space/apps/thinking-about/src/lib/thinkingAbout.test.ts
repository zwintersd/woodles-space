// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Handoff } from '@woodles/handoff';
import { ThinkingAbout } from './thinkingAbout.svelte';

const LEDGER_KEY = 'thinking-about.ingestedHandoffs.v1';
const UPDATED_KEY = 'thinking-about.updatedAt.v1';

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

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('taking what was handed over', () => {
	it('lands it, remembers it in this browser, and counts it for the notice', () => {
		const board = new ThinkingAbout();
		const before = board.updatedAt;
		expect(board.ingestHandoffs([handoff()])).toBe(1);
		expect(board.entries.map((e) => e.id)).toEqual(['c-1']);
		expect(JSON.parse(localStorage.getItem(LEDGER_KEY) ?? '[]')).toEqual(['c-1']);
		expect(board.updatedAt >= before).toBe(true);
		expect(localStorage.getItem(UPDATED_KEY)).toBe(JSON.stringify(board.updatedAt));
		expect(board.handedOver).toBe(1);
	});

	it('writes nothing, and keeps its clock, when there is nothing new', () => {
		const board = new ThinkingAbout();
		board.ingestHandoffs([handoff()]);
		const stamp = board.updatedAt;
		const writes = vi.spyOn(Storage.prototype, 'setItem');
		expect(board.ingestHandoffs([handoff()])).toBe(0);
		expect(writes).not.toHaveBeenCalled();
		expect(board.updatedAt).toBe(stamp);
	});

	it('saves the ledger without moving the clock when only the ledger changed', () => {
		const board = new ThinkingAbout();
		board.ingestHandoffs([handoff()]);
		localStorage.removeItem(LEDGER_KEY);
		const fresh = new ThinkingAbout();
		const stamp = fresh.updatedAt;
		expect(fresh.ingestHandoffs([handoff()])).toBe(0);
		expect(fresh.updatedAt).toBe(stamp);
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
