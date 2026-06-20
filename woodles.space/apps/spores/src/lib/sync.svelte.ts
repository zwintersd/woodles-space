import { createAppSync } from '@woodles/sync';
import { garden } from './garden.svelte';
import type { GardenBlob } from './types';

class SyncState {
	connected = $state(false);
	syncing = $state(false);
	status = $state<'idle' | 'ok' | 'error'>('idle');
	lastSyncedAt = $state<Date | null>(null);
	errorMessage = $state<string | null>(null);
}

export const syncState = new SyncState();

export const { connectAndHydrate, initSync, flushSync, disconnect } =
	createAppSync<GardenBlob>({
		adapter: {
			app: 'spores',
			read(): GardenBlob {
				return {
					spores: garden.spores,
					spellbooks: garden.spellbooks,
					flights: garden.flights,
					settings: garden.settings,
				};
			},
			write(blob: GardenBlob): void {
				garden.rehydrate(blob);
			},
		},
		state: syncState,
	});
