import { createAppSync } from '@woodles/sync';
import { bestiary } from './bestiary.svelte';
import type { BestiaryBlob } from './types';

class SyncState {
	connected = $state(false);
	syncing = $state(false);
	status = $state<'idle' | 'ok' | 'error'>('idle');
	lastSyncedAt = $state<Date | null>(null);
	errorMessage = $state<string | null>(null);
}

export const syncState = new SyncState();

export const { connectAndHydrate, initSync, flushSync, disconnect } =
	createAppSync<BestiaryBlob>({
		adapter: {
			app: 'bestiary',
			read(): BestiaryBlob {
				return {
					creatures: bestiary.creatures,
					settings: bestiary.settings,
				};
			},
			write(blob: BestiaryBlob): void {
				bestiary.rehydrate(blob);
			},
			isNewer(local: BestiaryBlob, remote: BestiaryBlob): boolean {
				return (local.creatures?.length ?? 0) > (remote.creatures?.length ?? 0);
			},
		},
		state: syncState,
	});
