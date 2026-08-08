export type ColumnKey = 'reading' | 'playing' | 'watching';

export type SectionKey =
	| 'book'
	| 'article'
	| 'topic'
	| 'manga'
	| 'pc_social'
	| 'pc_solo'
	| 'switch'
	| 'android'
	| 'anime_social'
	| 'anime_solo'
	| 'tv_social'
	| 'tv_solo'
	| 'film'
	| 'cartoon';

export type EntryStatus = 'active' | 'archived';

/**
 * A standing slot for something that happens on the same day most weeks — the
 * structured half of `schedule`.
 *
 * Weekday numbering is `Date.getDay()` (0=Sun), matching Carillon's own
 * `Obligation`, because that is what Carillon derives a calendar overlay from.
 * The freeform `schedule` text stays alongside it and is never parsed into
 * this: guessing "Tuesdays after work" wrong is worse than leaving it as the
 * note a person wrote.
 */
export type StandingSlot = {
	weekdays: number[];
	startTime: string; // "HH:MM"
	endTime: string;
};

// One sitting down with a thing being read, played, or watched — a single
// tap logs "today, no note"; the date and note stay editable after the fact.
export type Session = {
	id: string;
	date: string; // YYYY-MM-DD — defaults to today, editable
	note: string; // e.g. a chapter, a boss, an episode range — freeform, optional
};

// One thing being read / played / watched. Mirrors the thinking_about_entries
// table shape from the spec, minus user_id — a synced blob is already scoped
// to one passphrase identity, so there's no per-row owner to track.
export type ThinkingAboutEntry = {
	id: string;
	columnKey: ColumnKey;
	sectionKey: SectionKey;
	title: string;
	color: string;
	dateStarted: string | null; // YYYY-MM-DD — defaults to date added, overridable, clearable
	status: EntryStatus;
	dateClosed: string | null; // YYYY-MM-DD — set when archived
	notes: string;
	sharedWith: string | null; // only meaningful on *_social sections
	schedule: string | null; // only meaningful on playing/watching columns
	/** Structured counterpart to `schedule`; same columns, null when not set. */
	standing: StandingSlot | null;
	sessions: Session[]; // logged sittings with the thing, newest first by date
	createdAt: string; // ISO timestamp
	updatedAt: string; // ISO timestamp
};

export type ThinkingAboutBlob = {
	entries: ThinkingAboutEntry[];
	updatedAt?: string;
	/**
	 * Sittings already taken from Carillon's ledger, by that ledger's id.
	 *
	 * Tracked rather than inferred from the sessions themselves, so deleting an
	 * ingested sitting keeps it deleted instead of having it reappear on the
	 * next load. It rides the synced blob so that holds on every device, which
	 * is the same stance the Ologypedia import took toward its own re-imports.
	 */
	ingestedSittings?: string[];
};

export type SectionSize = 'minimized' | 'compact' | 'full';

export type BoardView = 'board' | 'archive';
