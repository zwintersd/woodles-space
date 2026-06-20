import { createAppSync } from '@woodles/sync';
import { devlog } from './devlog.svelte';
import type { DevlogBlob } from './types';

class SyncState {
	connected = $state(false);
	syncing = $state(false);
	status = $state<'idle' | 'ok' | 'error'>('idle');
	lastSyncedAt = $state<Date | null>(null);
	errorMessage = $state<string | null>(null);
}

export const syncState = new SyncState();

export const { connectAndHydrate, initSync, flushSync, disconnect } =
	createAppSync<DevlogBlob>({
		adapter: {
			app: 'marginalia-devlog',
			read(): DevlogBlob {
				return devlog.toBlob();
			},
			write(blob: DevlogBlob): void {
				devlog.rehydrate(blob);
			},
			isNewer(local: DevlogBlob, remote: DevlogBlob): boolean {
				return (local.entries?.length ?? 0) > (remote.entries?.length ?? 0);
			},
		},
		state: syncState,
		passKey: 'woodles_sync_passphrase_devlog',
	});
