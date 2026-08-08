// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import {
	THINKING_ABOUT_SHELF_STORAGE_KEY,
	THINKING_ABOUT_SHELF_VERSION
} from '@woodles/sync';
import * as sync from '@woodles/sync';
import { ThinkingAboutShelf } from './thinkingAboutShelf.svelte';

function shelfBlob(entries: { id: string; title: string; columnKey?: string }[]) {
	return {
		version: THINKING_ABOUT_SHELF_VERSION,
		publishedAt: '2026-08-09T00:00:00.000Z',
		entries: entries.map((e) => ({
			columnKey: 'reading',
			sectionKey: 'book',
			color: '#3f51b5',
			lastSessionDate: null,
			...e
		}))
	};
}

function writeLocal(blob: unknown): void {
	localStorage.setItem(THINKING_ABOUT_SHELF_STORAGE_KEY, JSON.stringify(blob));
}

beforeEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('reading the shelf locally', () => {
	it('reads what Thinking About left on this device', () => {
		writeLocal(shelfBlob([{ id: 'e1', title: 'Piranesi' }]));
		const shelf = new ThinkingAboutShelf();
		shelf.loadLocal();

		expect(shelf.status).toBe('ready');
		expect(shelf.entries.map((e) => e.title)).toEqual(['Piranesi']);
	});

	it('stays idle when Thinking About has never published here', () => {
		const shelf = new ThinkingAboutShelf();
		shelf.loadLocal();
		expect(shelf.status).toBe('idle');
		expect(shelf.entries).toEqual([]);
	});

	it('survives a corrupt or half-written local shelf', () => {
		localStorage.setItem(THINKING_ABOUT_SHELF_STORAGE_KEY, '{not json');
		const shelf = new ThinkingAboutShelf();
		shelf.loadLocal();
		expect(shelf.status).toBe('idle');
		expect(shelf.entries).toEqual([]);
	});

	it('reads an empty published shelf as empty, not as missing', () => {
		writeLocal(shelfBlob([]));
		const shelf = new ThinkingAboutShelf();
		shelf.loadLocal();
		expect(shelf.status).toBe('empty');
	});
});

describe('refreshing from sync', () => {
	it('does not reach the network without a passphrase', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(false);
		const pull = vi.spyOn(sync, 'pull');

		const shelf = new ThinkingAboutShelf();
		await shelf.refresh();

		expect(pull).not.toHaveBeenCalled();
		expect(shelf.checkedRemote).toBe(true);
	});

	it('picks up a shelf published from another device', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		vi.spyOn(sync, 'pull').mockResolvedValue({
			blob: shelfBlob([{ id: 'remote', title: 'Disco Elysium', columnKey: 'playing' }]),
			version: 3
		});

		const shelf = new ThinkingAboutShelf();
		await shelf.refresh();

		expect(shelf.status).toBe('ready');
		expect(shelf.entries.map((e) => e.title)).toEqual(['Disco Elysium']);
	});

	it('keeps the local shelf when the network fails', async () => {
		// A stale shelf from this device beats an error banner over a composer
		// that works perfectly well without one.
		writeLocal(shelfBlob([{ id: 'e1', title: 'Piranesi' }]));
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		vi.spyOn(sync, 'pull').mockRejectedValue(new sync.SyncError('network', 'offline'));

		const shelf = new ThinkingAboutShelf();
		await shelf.refresh();

		expect(shelf.status).toBe('ready');
		expect(shelf.entries.map((e) => e.title)).toEqual(['Piranesi']);
	});

	it('reports an error only when it has nothing at all to show', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		vi.spyOn(sync, 'pull').mockRejectedValue(new sync.SyncError('network', 'offline'));

		const shelf = new ThinkingAboutShelf();
		await shelf.refresh();

		expect(shelf.status).toBe('error');
		expect(shelf.entries).toEqual([]);
	});

	it('keeps the local shelf when the server has nothing published yet', async () => {
		writeLocal(shelfBlob([{ id: 'e1', title: 'Piranesi' }]));
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		vi.spyOn(sync, 'pull').mockResolvedValue({ blob: null, version: 0 });

		const shelf = new ThinkingAboutShelf();
		await shelf.refresh();

		expect(shelf.entries.map((e) => e.title)).toEqual(['Piranesi']);
	});
});

describe('grouping and lookup', () => {
	it('groups by column so a picker reads like the board', () => {
		writeLocal(
			shelfBlob([
				{ id: 'a', title: 'Piranesi', columnKey: 'reading' },
				{ id: 'b', title: 'Disco Elysium', columnKey: 'playing' },
				{ id: 'c', title: 'Solaris', columnKey: 'reading' }
			])
		);
		const shelf = new ThinkingAboutShelf();
		shelf.loadLocal();

		expect(shelf.byColumn).toEqual([
			{ columnKey: 'reading', entries: [expect.anything(), expect.anything()] },
			{ columnKey: 'playing', entries: [expect.anything()] }
		]);
	});

	it('resolves a reference, and returns null once it goes cold', () => {
		writeLocal(shelfBlob([{ id: 'e1', title: 'Piranesi' }]));
		const shelf = new ThinkingAboutShelf();
		shelf.loadLocal();

		expect(shelf.find('e1')?.title).toBe('Piranesi');
		// Archived over in Thinking About: the link no longer resolves, and the
		// task that holds it keeps its own title rather than being deleted.
		expect(shelf.find('gone')).toBeNull();
	});
});
