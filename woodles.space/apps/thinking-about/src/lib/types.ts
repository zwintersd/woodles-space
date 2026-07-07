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
	createdAt: string; // ISO timestamp
	updatedAt: string; // ISO timestamp
};

export type ThinkingAboutBlob = {
	entries: ThinkingAboutEntry[];
};

export type SectionSize = 'minimized' | 'compact' | 'full';

export type BoardView = 'board' | 'archive';
