// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import * as sync from '@woodles/sync';
import { THINKING_ABOUT_SHELF_APP, THINKING_ABOUT_SHELF_STORAGE_KEY } from '@woodles/sync';
import { publishShelf, resetPublishedShelfCache } from './shelfSync';
import { buildShelf, saveShelfLocally } from './shelf';
import { blankEntry } from './entries';
import { readShelfBlob } from '@woodles/sync';

const VERSION_KEY = `woodles_sync_version_${THINKING_ABOUT_SHELF_APP}`;

// A stable id per title: `blankEntry` mints a fresh uid on every call, so
// building "the same" shelf twice from scratch would differ by id and defeat
// the very deduplication these tests are checking. In the app the ids come
// from the store and are stable across saves, which is the case being modelled.
function shelfOf(title: string) {
	return buildShelf([{ ...blankEntry('reading', 'book', title), id: `entry-${title}` }]);
}

beforeEach(() => {
	localStorage.clear();
	resetPublishedShelfCache();
	vi.restoreAllMocks();
});

afterEach(() => vi.restoreAllMocks());

describe('publishShelf', () => {
	it('does nothing without a passphrase, and does not reach the network', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(false);
		const push = vi.spyOn(sync, 'push');

		expect(await publishShelf(shelfOf('Piranesi'))).toEqual({
			status: 'skipped',
			reason: 'no-passphrase'
		});
		expect(push).not.toHaveBeenCalled();
	});

	it('pushes under its own key, never the app blob key', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		const push = vi.spyOn(sync, 'push').mockResolvedValue({ ok: true, version: 1 });

		await publishShelf(shelfOf('Piranesi'));

		expect(push).toHaveBeenCalledWith(THINKING_ABOUT_SHELF_APP, expect.anything(), 0);
		// Clobbering Thinking About's own synced blob would be catastrophic.
		expect(push.mock.calls[0][0]).not.toBe('thinking-about');
		expect(localStorage.getItem(VERSION_KEY)).toBe('1');
	});

	it('re-pushes its derivation once when the server moved first', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		const push = vi
			.spyOn(sync, 'push')
			.mockResolvedValueOnce({ conflict: true, server: { blob: null, version: 7 } })
			.mockResolvedValueOnce({ ok: true, version: 8 });

		expect(await publishShelf(shelfOf('Piranesi'))).toEqual({ status: 'published', version: 8 });
		// The retry is based on the version the server just reported, not on ours.
		expect(push.mock.calls[1][2]).toBe(7);
		expect(localStorage.getItem(VERSION_KEY)).toBe('8');
	});

	it('gives up after one retry, leaving the cached version where the server is', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		vi.spyOn(sync, 'push').mockResolvedValue({
			conflict: true,
			server: { blob: null, version: 12 }
		});

		expect(await publishShelf(shelfOf('Piranesi'))).toEqual({
			status: 'failed',
			reason: 'contended'
		});
		// Next save starts from the truth rather than re-losing the same race.
		expect(localStorage.getItem(VERSION_KEY)).toBe('12');
	});

	it('never throws when the network is down — a stale shelf is not this app’s error', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		vi.spyOn(sync, 'push').mockRejectedValue(new sync.SyncError('network', 'offline'));

		expect(await publishShelf(shelfOf('Piranesi'))).toEqual({
			status: 'failed',
			reason: 'network'
		});
	});

	it('skips a redundant push when nothing a reader sees has changed', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		const push = vi.spyOn(sync, 'push').mockResolvedValue({ ok: true, version: 1 });

		await publishShelf(shelfOf('Piranesi'));
		const second = await publishShelf(shelfOf('Piranesi'));

		expect(second).toEqual({ status: 'unchanged' });
		expect(push).toHaveBeenCalledTimes(1);
	});

	it('publishes again once the shelf actually differs', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		const push = vi.spyOn(sync, 'push').mockResolvedValue({ ok: true, version: 1 });

		await publishShelf(shelfOf('Piranesi'));
		await publishShelf(shelfOf('Solaris'));

		expect(push).toHaveBeenCalledTimes(2);
	});

	it('does not cache a shelf it failed to publish', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		const push = vi
			.spyOn(sync, 'push')
			.mockRejectedValueOnce(new sync.SyncError('network', 'offline'))
			.mockResolvedValueOnce({ ok: true, version: 1 });

		await publishShelf(shelfOf('Piranesi'));
		await publishShelf(shelfOf('Piranesi'));

		expect(push).toHaveBeenCalledTimes(2);
	});
});

describe('the local mirror', () => {
	it('writes under the shared key, in the shape the reader validates', () => {
		saveShelfLocally(shelfOf('Piranesi'));

		const raw = localStorage.getItem(THINKING_ABOUT_SHELF_STORAGE_KEY);
		expect(raw).not.toBeNull();
		// The key and the validator both come from @woodles/sync, so writer and
		// reader cannot drift apart on either.
		expect(readShelfBlob(JSON.parse(raw as string))?.entries[0].title).toBe('Piranesi');
	});
});
