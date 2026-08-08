// The mechanics of publishing and reading a cross-app ledger.
//
// The shapes live in crossAppBlobs.ts; this is how they travel. Extracted when
// the second ledger arrived and turned out to need the identical machinery —
// the workspace's habit is to duplicate until two copies have converged and
// then extract, and there was nothing left to learn from writing the version
// cache, the deduplication and the retry a second time.
//
// Deliberately not `createAppSync`. That helper is built for a bidirectional
// store: it hydrates the server's copy back into the app. Hydrating a ledger
// would be backwards — a ledger is derived from the publisher's own store, so
// the server's copy is never newer than what the device can rebuild. This is
// push-only.
//
// Conflict policy follows from the same fact. Two devices publishing a derived,
// idempotent projection are not in conflict about anything a person typed, so
// there is no "ask before clobber" to run: a compare-and-swap rejection is
// answered by re-pushing the same derivation against the version the server
// just reported, and the data underneath converges through the publishing
// app's own sync.

import { hasPassphrase, pull, push, SyncError } from './index';

export type LedgerPublishResult =
	| { status: 'published'; version: number }
	| { status: 'unchanged' }
	| { status: 'skipped'; reason: 'no-passphrase' }
	| { status: 'failed'; reason: string };

/** Matches createSyncedStore's own per-app version cache convention. */
function versionKey(app: string): string {
	return `woodles_sync_version_${app}`;
}

function readVersion(app: string): number {
	if (typeof localStorage === 'undefined') return 0;
	try {
		return Number(localStorage.getItem(versionKey(app)) ?? '0') || 0;
	} catch {
		return 0;
	}
}

function writeVersion(app: string, version: number): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(versionKey(app), String(version));
	} catch {
		// ignore quota
	}
}

/**
 * Mirror a ledger into localStorage for same-origin readers. Never throws: a
 * full or disabled quota costs another app a stale view, which is not worth
 * failing the publishing app's own save over.
 */
export function mirrorLedgerLocally<T>(storageKey: string, blob: T): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(storageKey, JSON.stringify(blob));
	} catch {
		// ignore quota / disabled storage
	}
}

/**
 * Read a ledger a same-origin publisher left on this device. Returns null for
 * absent, corrupt, or unrecognised — all of which a reader treats as "nothing
 * published yet".
 */
export function readLocalLedger<T>(
	storageKey: string,
	parse: (value: unknown) => T | null
): T | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(storageKey);
		return raw === null ? null : parse(JSON.parse(raw));
	} catch {
		return null;
	}
}

/**
 * Fetch a ledger from the sync server. Returns null when nothing is published
 * or the blob doesn't validate; throws `SyncError` for network and auth
 * problems, which a caller distinguishes from "nothing there".
 */
export async function pullLedger<T>(
	app: string,
	parse: (value: unknown) => T | null
): Promise<T | null> {
	const snapshot = await pull<unknown>(app);
	return parse(snapshot.blob);
}

/**
 * A push-only publisher for one ledger.
 *
 * `matches` decides when a push would be redundant. It matters more than it
 * looks: a ledger is republished on every sync operation, but most saves
 * change something the ledger doesn't carry, and without the check each one
 * would spend a round trip writing bytes identical to those already there.
 */
export function createLedgerPublisher<T>({
	app,
	matches
}: {
	app: string;
	matches: (a: T, b: T) => boolean;
}) {
	/**
	 * The last snapshot this session actually got onto the server. Session-scoped
	 * on purpose: after a reload we don't know what the server holds, and one
	 * redundant publish is the cheap way to find out.
	 */
	let lastPublished: T | null = null;

	return {
		/**
		 * Publish one snapshot. Never throws — a failed publish costs another app
		 * a stale view, which must not surface as an error in the app that was
		 * only saving its own data. The local mirror has already happened by the
		 * time this runs, so same-origin readers are unaffected either way.
		 */
		async publish(blob: T): Promise<LedgerPublishResult> {
			if (!hasPassphrase()) return { status: 'skipped', reason: 'no-passphrase' };
			if (lastPublished && matches(lastPublished, blob)) return { status: 'unchanged' };

			try {
				const first = await push(app, blob, readVersion(app));
				if ('ok' in first) {
					writeVersion(app, first.version);
					lastPublished = blob;
					return { status: 'published', version: first.version };
				}

				// The server moved under us. Ours is a fresh derivation of this
				// device's data, so re-push it against the version we just learned.
				const retry = await push(app, blob, first.server.version);
				if ('ok' in retry) {
					writeVersion(app, retry.version);
					lastPublished = blob;
					return { status: 'published', version: retry.version };
				}
				// Still contended: leave the cached version where the server says it
				// is, so the next save starts from the truth rather than re-losing
				// the same race.
				writeVersion(app, retry.server.version);
				return { status: 'failed', reason: 'contended' };
			} catch (error) {
				return {
					status: 'failed',
					reason: error instanceof SyncError ? error.kind : 'unknown'
				};
			}
		},

		/** Test seam — the cache would otherwise leak between cases. */
		reset(): void {
			lastPublished = null;
		}
	};
}
