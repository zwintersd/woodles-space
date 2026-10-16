// Sync for HomeSuite — the whole suite, as one blob under sync key `homesuite`.
// The merge and the store reads live in suiteSync.ts; this is the glue onto
// `createAppSync`, plus the one thing it doesn't do: remember what this device
// and the server last agreed on, so a delete on one device stays deleted.

import { createAppSync, SyncError } from '@woodles/sync';
import {
	HOMESUITE_SYNC_APP,
	SuiteSyncRefused,
	clearBase,
	differsFromBase,
	fingerprints,
	isSuiteBlob,
	loadBase,
	mergeSuite,
	readSuite,
	saveBase,
	writeSuite,
	type HomeSuiteSyncBlob
} from './suiteSync';

class SyncState {
	connected = $state(false);
	syncing = $state(false);
	status = $state<'idle' | 'ok' | 'error'>('idle');
	lastSyncedAt = $state<Date | null>(null);
	errorMessage = $state<string | null>(null);
}

export const syncState = new SyncState();

// The last blob read or written in an operation: what the server holds once it succeeds.
let settled: HomeSuiteSyncBlob | null = null;

function refusal(error: unknown): never {
	if (error instanceof SuiteSyncRefused) throw new SyncError('server', error.message);
	throw error;
}

const appSync = createAppSync<HomeSuiteSyncBlob>({
	adapter: {
		app: HOMESUITE_SYNC_APP,
		read: () => {
			try { return (settled = readSuite()); } catch (error) { refusal(error); }
		},
		write: (blob) => {
			try { writeSuite(blob); } catch (error) { refusal(error); }
			settled = blob;
		},
		merge: (local, remote) => (isSuiteBlob(remote) ? mergeSuite(local, remote, loadBase()) : local)
	},
	state: syncState
});

let running: Promise<void> | null = null;

/** One operation at a time; the base moves only when the server took it. */
function run(operation: () => Promise<void>): Promise<void> {
	if (running) return running;
	const before = syncState.lastSyncedAt;
	settled = null;
	running = operation()
		.then(() => {
			if (syncState.status === 'ok' && syncState.lastSyncedAt !== before && settled) saveBase(fingerprints(settled));
		})
		.finally(() => { running = null; });
	return running;
}

export async function connect(pass: string): Promise<void> {
	// Not folded into a background sync already under way: this one carries a passphrase.
	if (running) await running;
	return run(() => appSync.connectAndHydrate(pass));
}

/** Pull, merge, and push what the server is missing. Quiet without a passphrase. */
export function syncNow(): Promise<void> {
	return run(() => appSync.initSync());
}

/** For moments with no time to pull first — leaving the page — and only when something changed. */
export function pushIfChanged(): Promise<void> {
	if (!syncState.connected || running) return running ?? Promise.resolve();
	try {
		if (!differsFromBase(readSuite(), loadBase())) return Promise.resolve();
	} catch {
		return Promise.resolve();
	}
	return run(() => appSync.flushSync());
}

export function disconnect(): void {
	appSync.disconnect();
	// Reconnecting later starts from a union, never from a stale idea of what was deleted.
	clearBase();
}
