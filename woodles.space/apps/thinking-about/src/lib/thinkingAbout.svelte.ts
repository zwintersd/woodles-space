import {
	addEntry,
	archiveEntry,
	archivedEntries as archivedEntriesOf,
	deleteEntry,
	entriesForSection as entriesForSectionOf,
	isUntouched,
	latestEntryTimestamp,
	logSession,
	normalizeEntry,
	nowIso,
	removeSession,
	reopenEntry,
	updateEntry,
	updateSession
} from './entries';
import { ingestHandoffs } from './handoffs';
import { buildShelf, saveShelfLocally } from './shelf';
import { ingestSittings } from './sittings';
import type { Handoff } from '@woodles/handoff';
import type { LoggedSitting } from '@woodles/sync';
import type {
	BoardView,
	ColumnKey,
	SectionKey,
	Session,
	ThinkingAboutBlob,
	ThinkingAboutEntry
} from './types';

function load<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw !== null ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function save<T>(key: string, value: T): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// ignore quota / disabled storage
	}
}

const ENTRIES_KEY = 'thinking-about.entries.v1';
const UPDATED_KEY = 'thinking-about.updatedAt.v1';
const INGESTED_KEY = 'thinking-about.ingestedSittings.v1';
const HANDOFFS_KEY = 'thinking-about.ingestedHandoffs.v1';

export class ThinkingAbout {
	entries = $state<ThinkingAboutEntry[]>(
		load<ThinkingAboutEntry[]>(ENTRIES_KEY, []).map(normalizeEntry)
	);
	updatedAt = $state<string>(
		load<string | null>(UPDATED_KEY, null) ?? latestEntryTimestamp(this.entries) ?? nowIso()
	);

	ingestedSittings = $state<string[]>(load<string[]>(INGESTED_KEY, []));

	// Handoff ids taken in this browser. Never in the synced blob and never
	// touched by rehydrate: the queues they come from don't sync either.
	ingestedHandoffs = $state<string[]>(load<string[]>(HANDOFFS_KEY, []));

	// Transient navigation — never persisted, always starts on the board.
	view = $state<BoardView>('board');
	activeEntryId = $state<string | null>(null);
	/** Arrivals since the notice was last dismissed. Never saved. */
	handedOver = $state(0);
	/** A linked entry not on the board yet — see openEntryWhenReady. */
	#pendingEntryId: string | null = null;

	get activeEntry(): ThinkingAboutEntry | null {
		if (!this.activeEntryId) return null;
		return this.entries.find((e) => e.id === this.activeEntryId) ?? null;
	}

	// The Completed view's list — same table, filtered to status = 'archived'.
	get archived(): ThinkingAboutEntry[] {
		return archivedEntriesOf(this.entries);
	}

	entriesFor(columnKey: ColumnKey, sectionKey: SectionKey): ThinkingAboutEntry[] {
		return entriesForSectionOf(this.entries, columnKey, sectionKey);
	}

	openBoard(): void {
		this.view = 'board';
	}

	openArchive(): void {
		this.view = 'archive';
	}

	// Create a blank entry scoped to one section and open it straight into
	// EntryDetail — there's no separate "new entry" form, just the same
	// full-edit view any entry opens into.
	createEntry(columnKey: ColumnKey, sectionKey: SectionKey): void {
		const { entries, created } = addEntry(this.entries, columnKey, sectionKey);
		this.entries = entries;
		this.#touch(created.updatedAt);
		this.activeEntryId = created.id;
	}

	openEntry(id: string): void {
		this.activeEntryId = id;
	}

	/**
	 * Open a linked entry — now if it's here, otherwise once the first sync's
	 * take has run. Something handed over from the companion only exists after
	 * that, and so does an entry another device added; an id that still isn't
	 * here then (deleted, or a stale link) leaves you on the board.
	 */
	openEntryWhenReady(id: string): void {
		if (this.entries.some((e) => e.id === id)) this.openEntry(id);
		else this.#pendingEntryId = id;
	}

	/** The held link, once. It never takes over an entry someone opened meanwhile. */
	openPendingEntry(): void {
		const id = this.#pendingEntryId;
		this.#pendingEntryId = null;
		if (id && this.activeEntryId === null && this.entries.some((e) => e.id === id)) this.openEntry(id);
	}

	dismissHandedOver(): void {
		this.handedOver = 0;
	}

	// Sweep an abandoned blank before leaving the detail view, so tapping
	// into a section and backing out without typing a title doesn't litter
	// the board with an empty chip.
	closeEntry(): void {
		if (this.activeEntryId) this.discardIfUntouched(this.activeEntryId);
		this.activeEntryId = null;
	}

	updateEntry(id: string, patch: Partial<Omit<ThinkingAboutEntry, 'id' | 'createdAt'>>): void {
		if (!this.entries.some((e) => e.id === id)) return;
		this.entries = updateEntry(this.entries, id, patch);
		this.#touch();
	}

	// One-tap, no confirmation — closing a loop should be frictionless.
	archiveEntry(id: string): void {
		if (!this.entries.some((e) => e.id === id)) return;
		this.entries = archiveEntry(this.entries, id);
		this.#touch();
		if (this.activeEntryId === id) this.activeEntryId = null;
	}

	reopenEntry(id: string): void {
		if (!this.entries.some((e) => e.id === id)) return;
		this.entries = reopenEntry(this.entries, id);
		this.#touch();
	}

	// One tap, no dialog — logging a sitting should be as frictionless as
	// marking an entry done. Returns the new session's id so a caller (the
	// detail panel's own log button) can focus straight into its note field.
	logSession(id: string, note = ''): string | null {
		if (!this.entries.some((e) => e.id === id)) return null;
		const { entries, created } = logSession(this.entries, id, note);
		this.entries = entries;
		this.#touch();
		return created?.id ?? null;
	}

	updateSession(entryId: string, sessionId: string, patch: Partial<Omit<Session, 'id'>>): void {
		if (!this.entries.some((e) => e.id === entryId)) return;
		this.entries = updateSession(this.entries, entryId, sessionId, patch);
		this.#touch();
	}

	removeSession(entryId: string, sessionId: string): void {
		if (!this.entries.some((e) => e.id === entryId)) return;
		this.entries = removeSession(this.entries, entryId, sessionId);
		this.#touch();
	}

	// Destructive and irreversible — callers confirm before invoking this.
	deleteEntry(id: string): void {
		if (!this.entries.some((e) => e.id === id)) return;
		this.entries = deleteEntry(this.entries, id);
		this.#touch();
		if (this.activeEntryId === id) this.activeEntryId = null;
	}

	discardIfUntouched(id: string): void {
		const e = this.entries.find((x) => x.id === id);
		if (e && isUntouched(e)) {
			this.entries = deleteEntry(this.entries, id);
			this.#touch();
		}
	}

	/**
	 * Take any sittings Carillon has offered and a person accepted there.
	 *
	 * Returns how many landed, so a caller can say so once rather than
	 * silently changing the board underneath someone.
	 */
	ingestSittings(sittings: LoggedSitting[]): number {
		const result = ingestSittings(this.entries, sittings, this.ingestedSittings, nowIso);
		if (result.added === 0 && result.ingested.length === this.ingestedSittings.length) return 0;

		this.entries = result.entries;
		this.ingestedSittings = result.ingested;
		if (result.added > 0) this.#touch();
		else this.#persist();
		return result.added;
	}

	/**
	 * Take what was handed over (see handoffs.ts for when that is safe).
	 * Shaped like ingestSittings: nothing new writes nothing, a ledger-only
	 * change saves without moving `updatedAt`, and only a real arrival does —
	 * so a stuck queue can't make this board win every hydrate.
	 *
	 * Returns how many landed, and counts them for the page to say so once.
	 */
	ingestHandoffs(items: Handoff[]): number {
		const result = ingestHandoffs(this.entries, items, this.ingestedHandoffs, nowIso);
		if (result.accounted === 0) return 0;

		this.entries = result.entries;
		this.ingestedHandoffs = result.ingested;
		if (result.added > 0) {
			this.#touch();
			this.handedOver += result.added;
		} else this.#persist();
		return result.added;
	}

	/**
	 * Rebuild and mirror the shelf from what's on the board right now.
	 *
	 * Called on load as well as on every save. The shelf is derived, so a board
	 * nobody has edited since this shipped would otherwise hold entries and no
	 * shelf at all, and a reader would honestly report an empty picker for a
	 * board plainly full of things. Idempotent, and self-repairing against a
	 * shelf left by an older version.
	 */
	publishShelf(): void {
		saveShelfLocally(buildShelf(this.entries, this.updatedAt));
	}

	#persist(): void {
		save(ENTRIES_KEY, this.entries);
		save(UPDATED_KEY, this.updatedAt);
		save(INGESTED_KEY, this.ingestedSittings);
		save(HANDOFFS_KEY, this.ingestedHandoffs);
		// The shelf is derived, so it is rebuilt here rather than maintained
		// alongside the entries — there is no path that edits one without the
		// other, and no stale shelf can outlive the board it came from.
		saveShelfLocally(buildShelf(this.entries, this.updatedAt));
	}

	#touch(stamp = nowIso()): void {
		this.updatedAt = stamp;
		this.#persist();
	}

	// ── rehydrate from sync ─────────────────────────────────────────
	rehydrate(blob: ThinkingAboutBlob): void {
		this.entries = (blob.entries ?? []).map(normalizeEntry);
		this.updatedAt = blob.updatedAt ?? latestEntryTimestamp(this.entries) ?? nowIso();
		// Union rather than replace: a device that ingested a sitting must not
		// forget it because another device's blob arrived without that id, or
		// the sitting would land again as a duplicate.
		this.ingestedSittings = [
			...new Set([...this.ingestedSittings, ...(blob.ingestedSittings ?? [])])
		];
		// ingestedHandoffs stays as it is — it never travels in the blob.
		this.#persist();
	}
}

export const thinkingAbout = new ThinkingAbout();
