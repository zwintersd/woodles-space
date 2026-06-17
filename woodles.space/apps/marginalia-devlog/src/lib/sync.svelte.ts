import { setPassphrase, hasPassphrase, createSyncedStore, SyncError } from '@woodles/sync';
import { devlog } from './devlog.svelte';
import type { DevlogBlob } from './types';

const PASS_KEY = 'woodles_sync_passphrase_devlog';

function loadStoredPassphrase(): string | null {
	try { return localStorage.getItem(PASS_KEY); } catch { return null; }
}

function persistPassphrase(pass: string | null): void {
	try {
		if (pass) localStorage.setItem(PASS_KEY, pass);
		else localStorage.removeItem(PASS_KEY);
	} catch { /* ignore */ }
}

class SyncState {
	connected = $state(false);
	syncing = $state(false);
	status = $state<'idle' | 'ok' | 'error'>('idle');
	lastSyncedAt = $state<Date | null>(null);
	errorMessage = $state<string | null>(null);
}

export const syncState = new SyncState();

const synced = createSyncedStore<DevlogBlob>({
	app: 'marginalia-devlog',
	read(): DevlogBlob {
		return devlog.toBlob();
	},
	write(blob: DevlogBlob): void {
		devlog.rehydrate(blob);
	},
	isNewer(local: DevlogBlob, remote: DevlogBlob): boolean {
		return (local.entries?.length ?? 0) > (remote.entries?.length ?? 0);
	}
});

function connect(pass: string): void {
	setPassphrase(pass);
	persistPassphrase(pass);
	syncState.connected = true;
	syncState.errorMessage = null;
}

export function disconnect(): void {
	setPassphrase('');
	persistPassphrase(null);
	syncState.connected = false;
	syncState.status = 'idle';
	syncState.lastSyncedAt = null;
	syncState.errorMessage = null;
}

async function runWithStatus(fn: () => Promise<void>): Promise<void> {
	syncState.syncing = true;
	syncState.errorMessage = null;
	try {
		await fn();
		syncState.status = 'ok';
		syncState.lastSyncedAt = new Date();
	} catch (err) {
		syncState.status = 'error';
		syncState.errorMessage = err instanceof SyncError ? err.message : 'sync failed';
		if (err instanceof SyncError && err.kind === 'unauthorized') disconnect();
	} finally {
		syncState.syncing = false;
	}
}

export async function connectAndHydrate(pass: string): Promise<void> {
	connect(pass);
	await runWithStatus(() =>
		synced.hydrate(async (): Promise<import('@woodles/sync').ConflictChoice> => 'theirs')
	);
}

export async function initSync(): Promise<void> {
	const stored = loadStoredPassphrase();
	if (!stored) return;
	connect(stored);
	await runWithStatus(() =>
		synced.hydrate(async (): Promise<import('@woodles/sync').ConflictChoice> => 'theirs')
	);
}

export async function flushSync(): Promise<void> {
	if (!hasPassphrase()) return;
	await runWithStatus(async () => {
		const result = await synced.flush();
		if ('conflict' in result && result.server.blob) {
			devlog.rehydrate(result.server.blob as DevlogBlob);
		}
	});
}
