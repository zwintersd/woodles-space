// Passphrase connection for write — ROADMAP.md week 7. write has no private
// cross-device blob (it never has, per ARCHITECTURE.md), so this exists only
// to get passphrase connect/disconnect/persistence for the public echoes
// publish. Reusing createAppSync (with a no-op adapter — there's nothing to
// pull or push privately) gets that machinery, and the same localStorage
// passphrase key every other app's sync panel uses, for free: connecting
// once in any app connects them all, same origin, same key.

import { createAppSync } from '@woodles/sync';

class SyncState {
	connected = $state(false);
	syncing = $state(false);
	status = $state<'idle' | 'ok' | 'error'>('idle');
	lastSyncedAt = $state<Date | null>(null);
	errorMessage = $state<string | null>(null);
}

export const syncState = new SyncState();

export const { connectAndHydrate, initSync, disconnect } = createAppSync<null>({
	adapter: {
		app: 'write',
		read: () => null,
		write: () => {}
	},
	state: syncState
});
