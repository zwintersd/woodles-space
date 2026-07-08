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
import type {
	BoardView,
	ColumnKey,
	SectionKey,
	ThinkingAboutBlob,
	ThinkingAboutEntry,
	WatchSession
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

export class ThinkingAbout {
	entries = $state<ThinkingAboutEntry[]>(
		load<ThinkingAboutEntry[]>(ENTRIES_KEY, []).map(normalizeEntry)
	);
	updatedAt = $state<string>(
		load<string | null>(UPDATED_KEY, null) ?? latestEntryTimestamp(this.entries) ?? nowIso()
	);

	// Transient navigation — never persisted, always starts on the board.
	view = $state<BoardView>('board');
	activeEntryId = $state<string | null>(null);

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
	// marking an entry done.
	logSession(id: string, note = ''): void {
		if (!this.entries.some((e) => e.id === id)) return;
		this.entries = logSession(this.entries, id, note);
		this.#touch();
	}

	updateSession(entryId: string, sessionId: string, patch: Partial<Omit<WatchSession, 'id'>>): void {
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

	#persist(): void {
		save(ENTRIES_KEY, this.entries);
		save(UPDATED_KEY, this.updatedAt);
	}

	#touch(stamp = nowIso()): void {
		this.updatedAt = stamp;
		this.#persist();
	}

	// ── rehydrate from sync ─────────────────────────────────────────
	rehydrate(blob: ThinkingAboutBlob): void {
		this.entries = (blob.entries ?? []).map(normalizeEntry);
		this.updatedAt = blob.updatedAt ?? latestEntryTimestamp(this.entries) ?? nowIso();
		this.#persist();
	}
}

export const thinkingAbout = new ThinkingAbout();
