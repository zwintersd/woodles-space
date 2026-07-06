import {
	addEntry,
	archiveEntry,
	archivedEntries as archivedEntriesOf,
	deleteEntry,
	entriesForSection as entriesForSectionOf,
	isUntouched,
	normalizeEntry,
	reopenEntry,
	updateEntry
} from './entries';
import type {
	BoardView,
	ColumnKey,
	SectionKey,
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

export class ThinkingAbout {
	entries = $state<ThinkingAboutEntry[]>(
		load<ThinkingAboutEntry[]>(ENTRIES_KEY, []).map(normalizeEntry)
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
		this.#persist();
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
		this.entries = updateEntry(this.entries, id, patch);
		this.#persist();
	}

	// One-tap, no confirmation — closing a loop should be frictionless.
	archiveEntry(id: string): void {
		this.entries = archiveEntry(this.entries, id);
		this.#persist();
		if (this.activeEntryId === id) this.activeEntryId = null;
	}

	reopenEntry(id: string): void {
		this.entries = reopenEntry(this.entries, id);
		this.#persist();
	}

	// Destructive and irreversible — callers confirm before invoking this.
	deleteEntry(id: string): void {
		this.entries = deleteEntry(this.entries, id);
		this.#persist();
		if (this.activeEntryId === id) this.activeEntryId = null;
	}

	discardIfUntouched(id: string): void {
		const e = this.entries.find((x) => x.id === id);
		if (e && isUntouched(e)) {
			this.entries = deleteEntry(this.entries, id);
			this.#persist();
		}
	}

	#persist(): void {
		save(ENTRIES_KEY, this.entries);
	}

	// ── rehydrate from sync ─────────────────────────────────────────
	rehydrate(blob: ThinkingAboutBlob): void {
		this.entries = (blob.entries ?? []).map(normalizeEntry);
		this.#persist();
	}
}

export const thinkingAbout = new ThinkingAbout();
