// Cross-app ledgers — the narrow surface one app publishes for *another app*
// to read. The sibling of publicBlobs.ts, and deliberately shaped like it:
// each is smaller than the private store behind it, and defined here rather
// than in either app so the writer and the reader cannot drift apart. Same
// reason the bloomforge project keys live in @woodles/incremental-core rather
// than in the studio or the player.
//
// The distinction from publicBlobs.ts is *who is reading*, and it decides the
// transport. Those ride /api/public: curated, unauthenticated, for a stranger's
// browser. These ride /api/sync: private data following one person between
// their own devices, behind the same passphrase everything else here uses.
//
// Two rules hold for every ledger below.
//
//   • One writer. The app that owns the data publishes it; nobody else pushes
//     to that key. A reader that needs to send something back gets its own
//     ledger in the other direction rather than writing to this one.
//   • Derived, never authoritative. A ledger is computed from the writer's
//     own store on every save, so it is always safe to throw away and rebuild,
//     and it is never hydrated back into the app that produced it.
//
// See REFERENCES.md for why this exists at all.

/**
 * Sync app keys are matched by `/^[a-z0-9-]{1,40}$/` in api/_lib.ts, and share
 * a namespace with each app's own private blob — so a ledger key is the
 * publishing app's key plus what it publishes, never a bare app name.
 */
export const THINKING_ABOUT_SHELF_APP = 'thinking-about-shelf';

/**
 * Where the writer keeps its own copy, and where a same-origin reader looks
 * first. Local-first is not weakened by these riding sync: localStorage stays
 * the fast path on one device, and the server is what carries the ledger to
 * the next one.
 */
export const THINKING_ABOUT_SHELF_STORAGE_KEY = 'thinking-about.shelf.v1';

/**
 * One thing currently being read, played, or watched — enough for another app
 * to name it, colour it, and point back at it. Deliberately not the whole
 * entry: no notes, no session log, no archive state, because a reader that
 * only needs to offer "what are you in the middle of?" should not couple to
 * Thinking About's private schema.
 *
 * `columnKey` and `sectionKey` are plain strings rather than Thinking About's
 * own unions, the same way PublicCreature carries `domain` as a string — this
 * package does not import app-local types.
 */
export type ShelfEntry = {
	id: string;
	title: string;
	columnKey: string;
	sectionKey: string;
	color: string;
	/** The most recent logged sitting, `YYYY-MM-DD`, or null if never opened. */
	lastSessionDate: string | null;
};

export type ThinkingAboutShelfBlob = {
	/** Bumped only on a breaking shape change; readers ignore anything higher. */
	version: 1;
	/** Active entries only — archiving something is how it leaves the shelf. */
	entries: ShelfEntry[];
	publishedAt: string;
};

export const THINKING_ABOUT_SHELF_VERSION = 1;

/**
 * Structural check for a blob arriving from storage or the server. Returns a
 * usable blob or null — a reader treats null exactly like "nothing published
 * yet", which is the same fallback every reader in this workspace already has
 * for an empty or unreachable source.
 */
export function readShelfBlob(value: unknown): ThinkingAboutShelfBlob | null {
	if (typeof value !== 'object' || value === null) return null;
	const blob = value as Partial<ThinkingAboutShelfBlob>;
	if (blob.version !== THINKING_ABOUT_SHELF_VERSION) return null;
	if (!Array.isArray(blob.entries)) return null;
	const entries = blob.entries.filter(isShelfEntry);
	return {
		version: THINKING_ABOUT_SHELF_VERSION,
		entries,
		publishedAt: typeof blob.publishedAt === 'string' ? blob.publishedAt : ''
	};
}

function isShelfEntry(value: unknown): value is ShelfEntry {
	if (typeof value !== 'object' || value === null) return false;
	const entry = value as Partial<ShelfEntry>;
	return (
		typeof entry.id === 'string' &&
		typeof entry.title === 'string' &&
		typeof entry.columnKey === 'string' &&
		typeof entry.sectionKey === 'string' &&
		typeof entry.color === 'string' &&
		(entry.lastSessionDate === null || typeof entry.lastSessionDate === 'string')
	);
}
