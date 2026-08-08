import { createAppSync } from '@woodles/sync';
import { thinkingAbout } from './thinkingAbout.svelte';
import { isThinkingAboutBlobNewer } from './syncLogic';
import { buildShelf } from './shelf';
import { publishShelf } from './shelfSync';
import type { ThinkingAboutBlob } from './types';

class SyncState {
	connected = $state(false);
	syncing = $state(false);
	status = $state<'idle' | 'ok' | 'error'>('idle');
	lastSyncedAt = $state<Date | null>(null);
	errorMessage = $state<string | null>(null);
}

export const syncState = new SyncState();

const appSync = createAppSync<ThinkingAboutBlob>({
	adapter: {
		app: 'thinking-about',
		read(): ThinkingAboutBlob {
			return { entries: thinkingAbout.entries, updatedAt: thinkingAbout.updatedAt };
		},
		write(blob: ThinkingAboutBlob): void {
			thinkingAbout.rehydrate(blob);
		},
		isNewer(local: ThinkingAboutBlob, remote: ThinkingAboutBlob): boolean {
			return isThinkingAboutBlobNewer(local, remote);
		}
	},
	state: syncState
});

export const { disconnect } = appSync;

/**
 * The shelf rides every operation that could have changed what's on the board
 * — including hydrate, where the change came from another device rather than
 * from this one. Publishing is awaited but never allowed to fail the caller:
 * `publishShelf` resolves a result rather than throwing, so a stale shelf
 * elsewhere can't turn into a sync error here (REFERENCES.md §7's "degrade to
 * no ledger yet" rule, applied on the writing side).
 */
async function withShelf<T>(operation: () => Promise<T>): Promise<T> {
	const result = await operation();
	await publishShelf(buildShelf(thinkingAbout.entries, thinkingAbout.updatedAt));
	return result;
}

export async function connectAndHydrate(pass: string): Promise<void> {
	await withShelf(() => appSync.connectAndHydrate(pass));
}

export async function initSync(): Promise<void> {
	await withShelf(() => appSync.initSync());
}

export async function flushSync(): Promise<void> {
	await withShelf(() => appSync.flushSync());
}
