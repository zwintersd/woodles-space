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
	sessions: Session[]; // logged sittings with the thing, newest first by date
	createdAt: string; // ISO timestamp
	updatedAt: string; // ISO timestamp
};

export type ThinkingAboutBlob = {
	entries: ThinkingAboutEntry[];
	updatedAt?: string;
};

export type SectionSize = 'minimized' | 'compact' | 'full';

export type BoardView = 'board' | 'archive';
