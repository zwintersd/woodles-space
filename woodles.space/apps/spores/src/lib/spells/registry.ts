import type { Category, Modifier } from './types';

// ── shared modifiers ──────────────────────────────────────────────

const MOD_CITATIONS: Modifier = {
	id: 'citations',
	label: 'Include sources (if certain)',
	hint: 'Requests a sources[] field — only use when the LLM is confident. Off by default.',
	injectFields: [{ path: 'root', field: { key: 'sources', label: 'Sources', example: '["https://..."]' } }],
	injectRules: [
		'Include a "sources" array only for facts you are certain of and can cite directly.',
		'Omit the "sources" field entirely rather than fabricating URLs.'
	]
};

const MOD_TIMELINE: Modifier = {
	id: 'timeline',
	label: 'Timeline focus (per-album dates, distinguish re-recordings)',
	hint: 'Adds releaseDate to every album entry; re-recordings are identified by date, never by title edits.',
	injectFields: [
		{ path: 'album', field: { key: 'releaseDate', label: 'Release date', example: 'YYYY-MM-DD', default: true } }
	],
	injectRules: [
		'Include a "releaseDate" field on every album entry (YYYY-MM-DD, YYYY-MM, or YYYY as known).',
		'Re-recordings and alternate versions must appear as separate entries with their own releaseDate.',
		'Never edit album titles to encode version info — use releaseDate to distinguish instead.'
	]
};

const MOD_AIRDATE: Modifier = {
	id: 'airdate',
	label: 'Air-date detail (per-episode airDate + runtime)',
	hint: 'Adds airDate and runtime to every episode.',
	injectFields: [
		{ path: 'episode', field: { key: 'airDate', label: 'Air date', example: 'YYYY-MM-DD', default: true } },
		{ path: 'episode', field: { key: 'runtime', label: 'Runtime (minutes)', example: '45', default: true } }
	],
	injectRules: [
		'Include "airDate" (YYYY-MM-DD) and "runtime" (integer minutes, or "unknown") on every episode.'
	]
};

// ── person categories ─────────────────────────────────────────────

const CAT_AUTHOR: Category = {
	id: 'author',
	label: 'Author',
	group: 'person',
	glyph: '✎',
	rootKind: 'author',
	rootFields: [
		{ key: 'bio', label: 'Biography', example: 'Short biographical summary', default: true },
		{ key: 'born', label: 'Born', example: 'YYYY-MM-DD or YYYY', default: true },
		{ key: 'died', label: 'Died', example: 'YYYY-MM-DD, YYYY, or unknown', default: false },
		{ key: 'origin', label: 'Origin', example: 'City, Country', default: true },
		{ key: 'activeYears', label: 'Active years', example: 'YYYY–present', default: true },
		{ key: 'genres', label: 'Genres', example: '["fiction", "poetry"]', default: true },
		{ key: 'disambiguation', label: 'Disambiguation', example: 'the British novelist, not…', default: true }
	],
	children: {
		kind: 'book',
		label: 'Books',
		arrayKey: 'books',
		fields: [
			{ key: 'title', label: 'Title', example: 'Book Title', default: true },
			{ key: 'year', label: 'Year', example: 'YYYY', default: true },
			{ key: 'publisher', label: 'Publisher', example: 'Publisher Name', default: false },
			{ key: 'isbn', label: 'ISBN', example: '978-...', default: false },
			{ key: 'description', label: 'Description', example: 'One-line summary', default: true }
		]
	},
	modifiers: [MOD_CITATIONS]
};

const CAT_MUSICIAN: Category = {
	id: 'musician',
	label: 'Singer / Musician',
	group: 'person',
	glyph: '♪',
	rootKind: 'artist-discography',
	rootFields: [
		{ key: 'bio', label: 'Biography', example: 'Short biographical summary', default: true },
		{ key: 'origin', label: 'Origin', example: 'City, Country', default: true },
		{ key: 'activeYears', label: 'Active years', example: 'YYYY–present', default: true },
		{ key: 'genres', label: 'Genres', example: '["pop", "folk"]', default: true },
		{ key: 'disambiguation', label: 'Disambiguation', example: 'the Canadian singer-songwriter, not…', default: true }
	],
	children: {
		kind: 'album',
		label: 'Albums',
		arrayKey: 'albums',
		fields: [
			{ key: 'title', label: 'Title', default: true },
			{ key: 'releaseDate', label: 'Release date', example: 'YYYY-MM-DD', default: true },
			{ key: 'label', label: 'Record label', example: 'Label Name', default: false }
		],
		children: {
			kind: 'track',
			label: 'Tracks',
			arrayKey: 'tracks',
			fields: [
				{ key: 'trackNumber', label: 'Track #', example: '1', default: true },
				{ key: 'title', label: 'Title', default: true },
				{ key: 'duration', label: 'Duration', example: 'MM:SS', default: true }
			]
		}
	},
	modifiers: [MOD_TIMELINE, MOD_CITATIONS]
};

const CAT_FILMMAKER: Category = {
	id: 'filmmaker',
	label: 'Director / Filmmaker',
	group: 'person',
	glyph: '⏿',
	rootKind: 'filmography',
	rootFields: [
		{ key: 'bio', label: 'Biography', example: 'Short biographical summary', default: true },
		{ key: 'born', label: 'Born', example: 'YYYY or YYYY-MM-DD', default: true },
		{ key: 'origin', label: 'Origin', example: 'City, Country', default: true },
		{ key: 'activeYears', label: 'Active years', example: 'YYYY–present', default: true },
		{ key: 'genres', label: 'Genres', example: '["horror", "drama"]', default: true },
		{ key: 'disambiguation', label: 'Disambiguation', example: 'the French director, not…', default: true }
	],
	children: {
		kind: 'film',
		label: 'Films',
		arrayKey: 'films',
		fields: [
			{ key: 'title', label: 'Title', default: true },
			{ key: 'year', label: 'Year', example: 'YYYY', default: true },
			{ key: 'role', label: 'Role', example: 'Director, Writer', default: true },
			{ key: 'description', label: 'Description', example: 'One-line summary', default: false }
		]
	},
	modifiers: [MOD_CITATIONS]
};

const CAT_ACTOR: Category = {
	id: 'actor',
	label: 'Actor',
	group: 'person',
	glyph: '◎',
	rootKind: 'actor',
	rootFields: [
		{ key: 'bio', label: 'Biography', example: 'Short biographical summary', default: true },
		{ key: 'born', label: 'Born', example: 'YYYY or YYYY-MM-DD', default: true },
		{ key: 'origin', label: 'Origin', example: 'City, Country', default: true },
		{ key: 'activeYears', label: 'Active years', example: 'YYYY–present', default: true },
		{ key: 'disambiguation', label: 'Disambiguation', example: 'the British actress known for…', default: true }
	],
	children: {
		kind: 'role',
		label: 'Notable roles',
		arrayKey: 'roles',
		fields: [
			{ key: 'title', label: 'Film / Show title', default: true },
			{ key: 'character', label: 'Character name', default: true },
			{ key: 'year', label: 'Year', example: 'YYYY', default: true },
			{ key: 'type', label: 'Type', example: 'film or series', default: false }
		]
	},
	modifiers: [MOD_CITATIONS]
};

const CAT_PERSON: Category = {
	id: 'person',
	label: 'Generic Person',
	group: 'person',
	glyph: '◯',
	rootKind: 'person',
	rootFields: [
		{ key: 'bio', label: 'Biography', example: 'Short biographical summary', default: true },
		{ key: 'born', label: 'Born', example: 'YYYY or YYYY-MM-DD', default: true },
		{ key: 'died', label: 'Died', example: 'YYYY or unknown', default: false },
		{ key: 'origin', label: 'Origin', example: 'City, Country', default: true },
		{ key: 'activeYears', label: 'Active years', example: 'YYYY–present', default: true },
		{ key: 'notableFor', label: 'Notable for', example: 'Short summary of why they matter', default: true },
		{ key: 'disambiguation', label: 'Disambiguation', example: 'the physicist, not…', default: true }
	],
	modifiers: [MOD_CITATIONS]
};

// ── media categories ──────────────────────────────────────────────

const CAT_TV_SERIES: Category = {
	id: 'tv-series',
	label: 'TV Series',
	group: 'media',
	glyph: '▣',
	rootKind: 'tv-series',
	rootFields: [
		{ key: 'description', label: 'Description', example: 'Series premise', default: true },
		{ key: 'network', label: 'Network / Streaming', example: 'HBO', default: true },
		{ key: 'firstAired', label: 'First aired', example: 'YYYY', default: true },
		{ key: 'lastAired', label: 'Last aired', example: 'YYYY or ongoing', default: true },
		{ key: 'genres', label: 'Genres', example: '["drama", "sci-fi"]', default: true },
		{ key: 'status', label: 'Status', example: 'ended or ongoing', default: true },
		{ key: 'disambiguation', label: 'Disambiguation', example: 'the 2019 HBO miniseries, not…', default: true }
	],
	children: {
		kind: 'season',
		label: 'Seasons',
		arrayKey: 'seasons',
		fields: [
			{ key: 'title', label: 'Season title/number', example: 'Season 1', default: true },
			{ key: 'year', label: 'Year', example: 'YYYY', default: true },
			{ key: 'episodeCount', label: 'Episode count', example: '10', default: true }
		],
		children: {
			kind: 'episode',
			label: 'Episodes',
			arrayKey: 'episodes',
			fields: [
				{ key: 'title', label: 'Episode title', default: true },
				{ key: 'episodeNumber', label: 'Episode #', example: '1', default: true },
				{ key: 'description', label: 'Description', example: 'One-line summary', default: false }
			]
		}
	},
	modifiers: [MOD_AIRDATE, MOD_CITATIONS]
};

const CAT_FILM: Category = {
	id: 'film',
	label: 'Film',
	group: 'media',
	glyph: '⏿',
	rootKind: 'film',
	rootFields: [
		{ key: 'description', label: 'Description', example: 'Plot summary', default: true },
		{ key: 'director', label: 'Director', example: 'Full Name', default: true },
		{ key: 'year', label: 'Year', example: 'YYYY', default: true },
		{ key: 'runtime', label: 'Runtime', example: '120 min', default: true },
		{ key: 'genres', label: 'Genres', example: '["thriller", "drama"]', default: true },
		{ key: 'studio', label: 'Studio', example: 'Studio Name', default: false },
		{ key: 'disambiguation', label: 'Disambiguation', example: 'the 1968 Kubrick film, not…', default: true }
	],
	modifiers: [MOD_CITATIONS]
};

const CAT_BOOK: Category = {
	id: 'book',
	label: 'Book',
	group: 'media',
	glyph: '☾',
	rootKind: 'book',
	rootFields: [
		{ key: 'description', label: 'Description', example: 'Plot or subject summary', default: true },
		{ key: 'author', label: 'Author', example: 'Full Name', default: true },
		{ key: 'year', label: 'Year published', example: 'YYYY', default: true },
		{ key: 'publisher', label: 'Publisher', example: 'Publisher Name', default: false },
		{ key: 'isbn', label: 'ISBN', example: '978-...', default: false },
		{ key: 'genres', label: 'Genres', example: '["fiction", "literary"]', default: true },
		{ key: 'disambiguation', label: 'Disambiguation', example: 'the 1984 novel, not the film adaptation', default: true }
	],
	modifiers: [MOD_CITATIONS]
};

const CAT_ALBUM: Category = {
	id: 'album',
	label: 'Album',
	group: 'media',
	glyph: '♫',
	rootKind: 'album',
	rootFields: [
		{ key: 'artist', label: 'Artist', example: 'Artist Name', default: true },
		{ key: 'releaseDate', label: 'Release date', example: 'YYYY-MM-DD', default: true },
		{ key: 'label', label: 'Record label', example: 'Label Name', default: false },
		{ key: 'genres', label: 'Genres', example: '["dream pop", "shoegaze"]', default: true },
		{ key: 'description', label: 'Description', example: 'Album notes', default: true },
		{ key: 'disambiguation', label: 'Disambiguation', example: 'the 2008 debut, not the 2023 re-recording', default: true }
	],
	children: {
		kind: 'track',
		label: 'Tracks',
		arrayKey: 'tracks',
		fields: [
			{ key: 'trackNumber', label: 'Track #', example: '1', default: true },
			{ key: 'title', label: 'Title', default: true },
			{ key: 'duration', label: 'Duration', example: 'MM:SS', default: true }
		]
	},
	modifiers: [MOD_CITATIONS]
};

const CAT_GAME: Category = {
	id: 'game',
	label: 'Video Game',
	group: 'media',
	glyph: '⊞',
	rootKind: 'game',
	rootFields: [
		{ key: 'description', label: 'Description', example: 'Game summary', default: true },
		{ key: 'studio', label: 'Studio / Developer', example: 'Studio Name', default: true },
		{ key: 'publisher', label: 'Publisher', example: 'Publisher Name', default: false },
		{ key: 'releaseDate', label: 'Release date', example: 'YYYY-MM-DD', default: true },
		{ key: 'platforms', label: 'Platforms', example: '["PC", "PS5"]', default: true },
		{ key: 'genres', label: 'Genres', example: '["RPG", "open world"]', default: true },
		{ key: 'series', label: 'Series', example: 'Series Name or unknown', default: false },
		{ key: 'disambiguation', label: 'Disambiguation', example: 'the 2023 sequel, not…', default: true }
	],
	modifiers: [MOD_CITATIONS]
};

const CAT_WORK: Category = {
	id: 'work',
	label: 'Generic Work',
	group: 'media',
	glyph: '◦',
	rootKind: 'work',
	rootFields: [
		{ key: 'description', label: 'Description', example: 'Brief description', default: true },
		{ key: 'creator', label: 'Creator', example: 'Full Name', default: true },
		{ key: 'year', label: 'Year', example: 'YYYY', default: true },
		{ key: 'medium', label: 'Medium', example: 'novel, painting, album, …', default: true },
		{ key: 'disambiguation', label: 'Disambiguation', example: 'the 1920 edition, not…', default: true }
	],
	modifiers: [MOD_CITATIONS]
};

// ── catalogue ─────────────────────────────────────────────────────

export const CURATED_CATEGORIES: Category[] = [
	CAT_AUTHOR,
	CAT_MUSICIAN,
	CAT_FILMMAKER,
	CAT_ACTOR,
	CAT_PERSON,
	CAT_TV_SERIES,
	CAT_FILM,
	CAT_BOOK,
	CAT_ALBUM,
	CAT_GAME,
	CAT_WORK
];

export function getCategory(id: string, custom: Category[] = []): Category | undefined {
	return [...CURATED_CATEGORIES, ...custom].find((c) => c.id === id);
}

// Walk all ChildLevels to find one by kind
export function getChildLevel(
	category: Category,
	kind: string
): import('./types').ChildLevel | undefined {
	function walk(
		level: import('./types').ChildLevel | undefined
	): import('./types').ChildLevel | undefined {
		if (!level) return undefined;
		if (level.kind === kind) return level;
		return walk(level.children);
	}
	return walk(category.children);
}

// Infer a Spellbook archetype from a root kind
export function inferArchetype(kind: string): string {
	const media = ['album', 'film', 'tv-series', 'game', 'book', 'work'];
	return media.includes(kind) ? 'media' : 'plain';
}
