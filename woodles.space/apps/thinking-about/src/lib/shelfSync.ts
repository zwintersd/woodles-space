// Publishing the shelf to the sync server, so the reader on another device
// sees it without Thinking About ever having been opened there.
//
// Deliberately not a `createAppSync` adapter. That helper is built for a
// bidirectional store — it hydrates the server's copy back into the app — and
// hydrating here would be backwards: the shelf is derived from `entries`, so
// the server's copy is never newer than what this device can rebuild. This is
// push-only, and the ledger is write-once-per-save rather than merged.
//
// Conflict policy follows from the same fact. Two devices publishing a
// derived, idempotent projection do not need "ask before clobber" — whoever
// pushed last is simply whoever saved last, and the entries underneath
// converge through Thinking About's own sync. So a compare-and-swap rejection
// is answered by adopting the server's version and pushing our derivation
// once more, rather than by merging two shelves that were never in conflict
// about anything a person typed.

import {
	push,
	hasPassphrase,
	SyncError,
	THINKING_ABOUT_SHELF_APP,
	type ThinkingAboutShelfBlob
} from '@woodles/sync';
import { shelvesMatch } from './shelf';

/** Matches @woodles/sync's own per-app version cache convention. */
const VERSION_KEY = `woodles_sync_version_${THINKING_ABOUT_SHELF_APP}`;

function readVersion(): number {
	if (typeof localStorage === 'undefined') return 0;
	try {
		return Number(localStorage.getItem(VERSION_KEY) ?? '0') || 0;
	} catch {
		return 0;
	}
}

function writeVersion(version: number): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(VERSION_KEY, String(version));
	} catch {
		// ignore quota
	}
}

export type ShelfPublishResult =
	| { status: 'published'; version: number }
	| { status: 'unchanged' }
	| { status: 'skipped'; reason: 'no-passphrase' }
	| { status: 'failed'; reason: string };

/**
 * The last shelf this session actually got onto the server. Every sync
 * operation republishes, but most of them follow a save that changed a note or
 * a session date — nothing the shelf carries — so without this the ledger
 * would cost a network round trip per flush to write bytes identical to the
 * ones already there. Session-scoped on purpose: after a reload we don't know
 * what the server holds, and one redundant publish is the cheap way to find out.
 */
let lastPublished: ThinkingAboutShelfBlob | null = null;

/** Test seam — a module-level cache would otherwise leak between cases. */
export function resetPublishedShelfCache(): void {
	lastPublished = null;
}

/**
 * Publish one shelf snapshot. Never throws — a failed publish costs another
 * app a stale picker, which must not surface as an error in the app that was
 * only saving its own board. The local mirror (`saveShelfLocally`) has already
 * happened by the time this runs, so same-origin readers are unaffected either
 * way.
 */
export async function publishShelf(blob: ThinkingAboutShelfBlob): Promise<ShelfPublishResult> {
	if (!hasPassphrase()) return { status: 'skipped', reason: 'no-passphrase' };
	if (lastPublished && shelvesMatch(lastPublished, blob)) return { status: 'unchanged' };

	try {
		const first = await push(THINKING_ABOUT_SHELF_APP, blob, readVersion());
		if ('ok' in first) {
			writeVersion(first.version);
			lastPublished = blob;
			return { status: 'published', version: first.version };
		}

		// The server moved under us. Our shelf is a fresh derivation of this
		// device's entries, so re-push it against the version we just learned.
		const retry = await push(THINKING_ABOUT_SHELF_APP, blob, first.server.version);
		if ('ok' in retry) {
			writeVersion(retry.version);
			lastPublished = blob;
			return { status: 'published', version: retry.version };
		}
		// Still contended: leave the cached version where the server says it is
		// so the next save starts from the truth rather than re-losing the race.
		writeVersion(retry.server.version);
		return { status: 'failed', reason: 'contended' };
	} catch (error) {
		return {
			status: 'failed',
			reason: error instanceof SyncError ? error.kind : 'unknown'
		};
	}
}
