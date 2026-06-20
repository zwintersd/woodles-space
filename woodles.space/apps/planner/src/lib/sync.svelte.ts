import { createAppSync } from '@woodles/sync';
import { store } from './store.svelte';
import type { PlannerBlob } from './types';

class SyncState {
	connected = $state(false);
	syncing = $state(false);
	status = $state<'idle' | 'ok' | 'error'>('idle');
	lastSyncedAt = $state<Date | null>(null);
	errorMessage = $state<string | null>(null);
}

export const syncState = new SyncState();

export const { connectAndHydrate, initSync, flushSync, disconnect } =
	createAppSync<PlannerBlob>({
		adapter: {
			app: 'planner',
			read(): PlannerBlob {
				return {
					shapes: store.dayShapes,
					weekPattern: store.weekPattern,
					days: store.dayOverrides,
					obligations: store.obligations,
					rituals: store.rituals,
					tasks: store.tasks,
					settings: store.settings,
					domains: store.domains,
				};
			},
			write(blob: PlannerBlob): void {
				store.rehydrate(blob);
			},
		},
		state: syncState,
	});
