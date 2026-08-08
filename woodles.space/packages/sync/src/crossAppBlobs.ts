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
	/**
	 * A slot this happens in most weeks, when one has been set. Weekdays are
	 * `Date.getDay()` (0=Sun). Optional rather than nullable so a shelf written
	 * before standing slots existed still validates.
	 */
	standing?: { weekdays: number[]; startTime: string; endTime: string } | null;
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

// ── write → echoes, marginalia: the archive ─────────────────────────────
//
// Echoes was a public reading room and is now a private one: an archive of
// finished writing that gets re-read, annotated and edited by the person who
// wrote it. Nobody was reading the public version, and self-annotation is the
// part that worked, so the letters moved off `/api/public` and onto the
// ordinary passphrase-gated sync every other app here uses.
//
// This is the one shape below that is *not* a projection. It is Write's own
// blob, published under its own app key, with the shape written down here so
// readers depend on a contract rather than on Write's internals — the same
// relationship bloomforge-player has to the studio's project data. Write is
// still the only writer.

export const WRITE_ARCHIVE_APP = 'write';

/**
 * Where Write keeps the archive locally. Also hardcoded in
 * `apps/letter/index.html`, which is a static page with no build step and so
 * cannot import this package — a test pins the two together.
 */
export const WRITE_LETTERS_STORAGE_KEY = 'woodles_letters';

export type ArchiveNote = {
	id: string;
	html: string;
	layer: string;
	createdAt: string;
	updatedAt: string;
};

export type ArchiveMarginNote = {
	id: string;
	anchorId: string;
	html: string;
	createdAt: string;
	updatedAt: string;
};

/** One finished letter, as Echoes and Marginalia's reading room read it. */
export type ArchiveLetter = {
	id: string;
	title: string;
	theme: string;
	motif: string;
	font: string;
	issue: number;
	publishedAt: string;
	layers: Record<string, { html: string; updatedAt: string }>;
	annotations: { pocketNotes: ArchiveNote[]; marginNotes: ArchiveMarginNote[] };
	content: string;
	replyTo: string | null;
};

export type WriteArchiveBlob = {
	letters: ArchiveLetter[];
	updatedAt?: string;
};

/**
 * Structural check for an archive arriving from storage or the server.
 * Deliberately shallow on the note arrays — a letter with a malformed
 * annotation should still be readable, since the prose is the point.
 */
export function readArchiveBlob(value: unknown): WriteArchiveBlob | null {
	if (typeof value !== 'object' || value === null) return null;
	const blob = value as Partial<WriteArchiveBlob>;
	if (!Array.isArray(blob.letters)) return null;
	return {
		letters: blob.letters.filter(isArchiveLetter),
		...(typeof blob.updatedAt === 'string' ? { updatedAt: blob.updatedAt } : {})
	};
}

function isArchiveLetter(value: unknown): value is ArchiveLetter {
	if (typeof value !== 'object' || value === null) return false;
	const letter = value as Partial<ArchiveLetter>;
	return (
		typeof letter.id === 'string' &&
		typeof letter.title === 'string' &&
		typeof letter.content === 'string' &&
		typeof letter.publishedAt === 'string'
	);
}

// ── write → everyone: what the writing was about ────────────────────────
//
// The loop the spine had left open. Every other ledger points *at* writing's
// subjects; this one points back, so Carillon's Edition Review can say "you
// wrote about this day" beside the observations for it, and Thinking About can
// say "you wrote about this" beside the sittings.
//
// Derived from the archive on every save: a letter's references are read out
// of its own prose (`readReferences`), never maintained alongside it.

export const WRITE_MENTIONS_APP = 'write-mentions';

export const WRITE_MENTIONS_STORAGE_KEY = 'write.mentions.v1';

export const WRITE_MENTIONS_VERSION = 1;

/** One piece of writing, and what it named. */
export type Mention = {
	/** The letter's id, so a reader can link back to it in Echoes. */
	letterId: string;
	title: string;
	/** `YYYY-MM-DD` the letter was kept. */
	date: string;
	/** `<app>:<kind>:<id>` for each reference in the prose, deduplicated. */
	refs: string[];
};

export type WriteMentionsBlob = {
	version: 1;
	mentions: Mention[];
	publishedAt: string;
};

/** The key a reader looks up — same shape `entityHref` addresses. */
export function mentionKey(app: string, kind: string, id: string): string {
	return `${app}:${kind}:${id}`;
}

export function readMentionsBlob(value: unknown): WriteMentionsBlob | null {
	if (typeof value !== 'object' || value === null) return null;
	const blob = value as Partial<WriteMentionsBlob>;
	if (blob.version !== WRITE_MENTIONS_VERSION) return null;
	if (!Array.isArray(blob.mentions)) return null;
	return {
		version: WRITE_MENTIONS_VERSION,
		mentions: blob.mentions.filter(isMention),
		publishedAt: typeof blob.publishedAt === 'string' ? blob.publishedAt : ''
	};
}

function isMention(value: unknown): value is Mention {
	if (typeof value !== 'object' || value === null) return false;
	const item = value as Partial<Mention>;
	return (
		typeof item.letterId === 'string' &&
		typeof item.title === 'string' &&
		typeof item.date === 'string' &&
		Array.isArray(item.refs) &&
		item.refs.every((ref) => typeof ref === 'string')
	);
}

// ── carillon → thinking about: the commitments ledger ───────────────────
//
// The answer to the shelf, and the reason the "one writer" rule is worth
// keeping: rather than Carillon writing back into Thinking About's store, it
// publishes what it has scheduled and Thinking About reads it. Each app still
// owns everything it writes.

export const CARILLON_COMMITMENTS_APP = 'planner-commitments';

export const CARILLON_COMMITMENTS_STORAGE_KEY = 'planner.commitments.v1';

export const CARILLON_COMMITMENTS_VERSION = 1;

/**
 * One scheduled intention about a Thinking About entry. Carillon's plan is
 * much richer than this — domains, day piles, blocks, observations — and none
 * of that belongs on a board about what you're reading. What survives is the
 * question the board actually asks: when, and is it done.
 */
export type Commitment = {
	/** The Thinking About entry this is about. */
	entryId: string;
	/** Carillon's own task id, so a reader can link back to the exact thing. */
	taskId: string;
	title: string;
	/** `YYYY-MM-DD`, or null for something scheduled in intent but not in time. */
	date: string | null;
	/** `HH:MM` from the block it sits in, when it sits in one. */
	time: string | null;
	blockTitle: string | null;
	status: 'open' | 'done';
};

export type CarillonCommitmentsBlob = {
	version: 1;
	commitments: Commitment[];
	publishedAt: string;
};

export function readCommitmentsBlob(value: unknown): CarillonCommitmentsBlob | null {
	if (typeof value !== 'object' || value === null) return null;
	const blob = value as Partial<CarillonCommitmentsBlob>;
	if (blob.version !== CARILLON_COMMITMENTS_VERSION) return null;
	if (!Array.isArray(blob.commitments)) return null;
	return {
		version: CARILLON_COMMITMENTS_VERSION,
		commitments: blob.commitments.filter(isCommitment),
		publishedAt: typeof blob.publishedAt === 'string' ? blob.publishedAt : ''
	};
}

function isCommitment(value: unknown): value is Commitment {
	if (typeof value !== 'object' || value === null) return false;
	const item = value as Partial<Commitment>;
	return (
		typeof item.entryId === 'string' &&
		typeof item.taskId === 'string' &&
		typeof item.title === 'string' &&
		(item.date === null || typeof item.date === 'string') &&
		(item.time === null || typeof item.time === 'string') &&
		(item.blockTitle === null || typeof item.blockTitle === 'string') &&
		(item.status === 'open' || item.status === 'done')
	);
}

// ── carillon → thinking about: sittings worth logging ───────────────────
//
// The third ledger, and the one that makes the pair better than either alone:
// a Thinking About session carries a date and no clock, so it can only ever be
// logged for *today*. Carillon knows which day an observation was about —
// including a stretch recalled days later — so a sitting backfilled here lands
// on the day it happened.
//
// Still a projection rather than a queue. A queue would have to be emptied by
// its reader, and a reader that writes is exactly what the one-writer rule
// forbids. Instead the ids are deterministic and Thinking About creates its
// session under the same id, so re-reading the ledger can't double-log.

export const CARILLON_SESSIONS_APP = 'planner-sessions';

export const CARILLON_SESSIONS_STORAGE_KEY = 'planner.sessions.v1';

export const CARILLON_SESSIONS_VERSION = 1;

/**
 * One sitting Carillon was told to log. `id` is `session-<entryId>-<date>` and
 * becomes the Thinking About session's own id, which is what makes ingesting
 * idempotent across reloads and across devices.
 */
export type LoggedSitting = {
	id: string;
	entryId: string;
	date: string;
};

export type CarillonSessionsBlob = {
	version: 1;
	sittings: LoggedSitting[];
	publishedAt: string;
};

export function readSessionsBlob(value: unknown): CarillonSessionsBlob | null {
	if (typeof value !== 'object' || value === null) return null;
	const blob = value as Partial<CarillonSessionsBlob>;
	if (blob.version !== CARILLON_SESSIONS_VERSION) return null;
	if (!Array.isArray(blob.sittings)) return null;
	return {
		version: CARILLON_SESSIONS_VERSION,
		sittings: blob.sittings.filter(isLoggedSitting),
		publishedAt: typeof blob.publishedAt === 'string' ? blob.publishedAt : ''
	};
}

function isLoggedSitting(value: unknown): value is LoggedSitting {
	if (typeof value !== 'object' || value === null) return false;
	const item = value as Partial<LoggedSitting>;
	return (
		typeof item.id === 'string' &&
		typeof item.entryId === 'string' &&
		typeof item.date === 'string'
	);
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
		(entry.lastSessionDate === null || typeof entry.lastSessionDate === 'string') &&
		isStanding(entry.standing)
	);
}

function isStanding(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (typeof value !== 'object') return false;
	const slot = value as { weekdays?: unknown; startTime?: unknown; endTime?: unknown };
	return (
		Array.isArray(slot.weekdays) &&
		slot.weekdays.every((day) => typeof day === 'number') &&
		typeof slot.startTime === 'string' &&
		typeof slot.endTime === 'string'
	);
}
