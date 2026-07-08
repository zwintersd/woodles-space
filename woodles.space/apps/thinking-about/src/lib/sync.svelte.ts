import { createAppSync } from '@woodles/sync';
import { thinkingAbout } from './thinkingAbout.svelte';
import { isThinkingAboutBlobNewer } from './syncLogic';
import type { ThinkingAboutBlob } from './types';

class SyncState {
	connected = $state(false);
	syncing = $state(false);
	status = $state<'idle' | 'ok' | 'error'>('idle');
	lastSyncedAt = $state<Date | null>(null);
	errorMessage = $state<string | null>(null);
}

export const syncState = new SyncState();

export const { connectAndHydrate, initSync, flushSync, disconnect } =
	createAppSync<ThinkingAboutBlob>({
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
