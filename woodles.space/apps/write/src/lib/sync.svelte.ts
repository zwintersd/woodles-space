// Sync for write — the archive of finished letters.
//
// This used to be a no-op adapter that existed only to borrow `createAppSync`'s
// passphrase handling for the public Echoes push. Echoes is private now
// (HANDOFF.md §3), so the letters themselves are what syncs, and this file has
// a real job: Write's blob is the archive, and Echoes and Marginalia's reading
// room read it back under the same passphrase.
//
// Drafts deliberately stay out. They are working state, they are already
// per-device, and an archive is a different thing from a desk.

import {
	createAppSync,
	createLedgerPublisher,
	mirrorLedgerLocally,
	WRITE_MENTIONS_APP,
	WRITE_MENTIONS_STORAGE_KEY,
	type ArchiveLetter,
	type WriteArchiveBlob,
	type WriteMentionsBlob
} from '@woodles/sync';
import { buildMentions, mentionsMatch } from './mentions';
import { loadLettersList, saveLettersList, type StoredLetter } from './letters';
import type { PocketLayer } from './types';

class SyncState {
	connected = $state(false);
	syncing = $state(false);
	status = $state<'idle' | 'ok' | 'error'>('idle');
	lastSyncedAt = $state<Date | null>(null);
	errorMessage = $state<string | null>(null);
}

export const syncState = new SyncState();

/**
 * Newest-archive-wins, by the most recent letter in each. Letters are only
 * ever appended (publishing) or annotated, so the device with more recent
 * activity is the one to keep — the same whole-blob stance Thinking About
 * takes, rather than Carillon's per-collection merge.
 */
function latestPublishedAt(blob: WriteArchiveBlob): string {
	return blob.letters.reduce((latest, letter) => {
		const stamp = letter.publishedAt ?? '';
		return stamp > latest ? stamp : latest;
	}, '');
}

/**
 * The archive carries `layer` as a plain string, because @woodles/sync does not
 * import app-local types. Narrowing happens here, on the way in: an unknown
 * layer becomes `midground`, which is where a pocket note with nowhere to go
 * reads least strangely.
 */
function toStoredLetter(letter: ArchiveLetter): StoredLetter {
	return {
		...letter,
		annotations: {
			...letter.annotations,
			pocketNotes: (letter.annotations?.pocketNotes ?? []).map((note) => ({
				...note,
				layer: (note.layer === 'background' ? 'background' : 'midground') as PocketLayer
			}))
		}
	};
}

const mentionsPublisher = createLedgerPublisher<WriteMentionsBlob>({
	app: WRITE_MENTIONS_APP,
	matches: mentionsMatch
});

/**
 * Rebuild what the writing was about, from the archive. Called on every sync
 * operation *and* on load — a derived ledger written only on save leaves an
 * app nobody has edited publishing nothing, which is the bug step 2 of the
 * spine shipped and step 3 caught.
 */
export function publishMentionsLocally(): void {
	mirrorLedgerLocally(WRITE_MENTIONS_STORAGE_KEY, buildMentions(loadLettersList()));
}

/** Push it, so the other apps see it on a device Write hasn't been opened on. */
export async function publishMentions(): Promise<void> {
	await mentionsPublisher.publish(buildMentions(loadLettersList()));
}

/** Test seam — the publisher's session cache would otherwise leak between cases. */
export function resetMentionsCache(): void {
	mentionsPublisher.reset();
}

const appSync = createAppSync<WriteArchiveBlob>({
		adapter: {
			app: 'write',
			read: (): WriteArchiveBlob => ({ letters: loadLettersList() }),
			write: (blob: WriteArchiveBlob): void => {
				saveLettersList(blob.letters.map(toStoredLetter));
			},
			isNewer: (local, remote) => latestPublishedAt(local) > latestPublishedAt(remote)
		},
		state: syncState
	});

export const { disconnect } = appSync;

async function withMentions<T>(operation: () => Promise<T>): Promise<T> {
	const result = await operation();
	publishMentionsLocally();
	await publishMentions();
	return result;
}

export async function connectAndHydrate(pass: string): Promise<void> {
	await withMentions(() => appSync.connectAndHydrate(pass));
}

export async function initSync(): Promise<void> {
	await withMentions(() => appSync.initSync());
}

export async function flushSync(): Promise<void> {
	await withMentions(() => appSync.flushSync());
}
