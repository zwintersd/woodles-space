import type { Category, ChildLevel } from './types';
import type { SectionKey } from '../types';

const CAT_AUTHOR: Category = {
	id: 'author',
	label: 'Author',
	group: 'person',
	glyph: '✎',
	rootKind: 'author',
	rootFields: [
		{ key: 'bio', label: 'Biography', example: 'Short biographical summary' },
		{ key: 'born', label: 'Born', example: 'YYYY-MM-DD or YYYY' },
		{ key: 'origin', label: 'Origin', example: 'City, Country' },
		{ key: 'activeYears', label: 'Active years', example: 'YYYY–present' },
		{ key: 'genres', label: 'Genres', example: '["fiction", "poetry"]' }
	],
	children: {
		kind: 'book',
		label: 'Books',
		arrayKey: 'books',
		fields: [
			{ key: 'title', label: 'Title', example: 'Book Title' },
			{ key: 'year', label: 'Year', example: 'YYYY' },
			{ key: 'description', label: 'Description', example: 'One-line summary' }
		]
	}
};

const CAT_MUSICIAN: Category = {
	id: 'musician',
	label: 'Singer / Musician',
	group: 'person',
	glyph: '♪',
	rootKind: 'artist-discography',
	rootFields: [
		{ key: 'bio', label: 'Biography', example: 'Short biographical summary' },
		{ key: 'origin', label: 'Origin', example: 'City, Country' },
		{ key: 'activeYears', label: 'Active years', example: 'YYYY–present' },
		{ key: 'genres', label: 'Genres', example: '["pop", "folk"]' }
	],
	children: {
		kind: 'album',
		label: 'Albums',
		arrayKey: 'albums',
		fields: [
			{ key: 'title', label: 'Title' },
			{ key: 'releaseDate', label: 'Release date', example: 'YYYY-MM-DD' }
		],
		children: {
			kind: 'track',
			label: 'Tracks',
			arrayKey: 'tracks',
			fields: [
				{ key: 'trackNumber', label: 'Track #', example: '1' },
				{ key: 'title', label: 'Title' },
				{ key: 'duration', label: 'Duration', example: 'MM:SS' }
			]
		}
	}
};

const CAT_FILMMAKER: Category = {
	id: 'filmmaker',
	label: 'Director / Filmmaker',
	group: 'person',
	glyph: '⏿',
	rootKind: 'filmography',
	rootFields: [
		{ key: 'bio', label: 'Biography', example: 'Short biographical summary' },
		{ key: 'born', label: 'Born', example: 'YYYY or YYYY-MM-DD' },
		{ key: 'origin', label: 'Origin', example: 'City, Country' },
		{ key: 'activeYears', label: 'Active years', example: 'YYYY–present' }
	],
	children: {
		kind: 'film',
		label: 'Films',
		arrayKey: 'films',
		fields: [
			{ key: 'title', label: 'Title' },
			{ key: 'year', label: 'Year', example: 'YYYY' },
			{ key: 'role', label: 'Role', example: 'Director, Writer' }
		]
	}
};

const CAT_ACTOR: Category = {
	id: 'actor',
	label: 'Actor',
	group: 'person',
	glyph: '◎',
	rootKind: 'actor',
	rootFields: [
		{ key: 'bio', label: 'Biography', example: 'Short biographical summary' },
		{ key: 'born', label: 'Born', example: 'YYYY or YYYY-MM-DD' },
		{ key: 'origin', label: 'Origin', example: 'City, Country' }
	],
	children: {
		kind: 'role',
		label: 'Notable roles',
		arrayKey: 'roles',
		fields: [
			{ key: 'title', label: 'Film / Show title' },
			{ key: 'character', label: 'Character name' },
			{ key: 'year', label: 'Year', example: 'YYYY' }
		]
	}
};

const CAT_PERSON: Category = {
	id: 'person',
	label: 'Generic Person',
	group: 'person',
	glyph: '◯',
	rootKind: 'person',
	rootFields: [
		{ key: 'bio', label: 'Biography', example: 'Short biographical summary' },
		{ key: 'born', label: 'Born', example: 'YYYY or YYYY-MM-DD' },
		{ key: 'origin', label: 'Origin', example: 'City, Country' },
		{ key: 'notableFor', label: 'Notable for', example: 'Short summary of why they matter' }
	]
};

const CAT_TV_SERIES: Category = {
	id: 'tv-series',
	label: 'TV Series',
	group: 'media',
	glyph: '▣',
	rootKind: 'tv-series',
	rootFields: [
		{ key: 'description', label: 'Description', example: 'Series premise' },
		{ key: 'network', label: 'Network / Streaming', example: 'HBO' },
		{ key: 'firstAired', label: 'First aired', example: 'YYYY' },
		{ key: 'lastAired', label: 'Last aired', example: 'YYYY or ongoing' },
		{ key: 'genres', label: 'Genres', example: '["drama", "sci-fi"]' }
	],
	children: {
		kind: 'season',
		label: 'Seasons',
		arrayKey: 'seasons',
		fields: [
			{ key: 'title', label: 'Season title/number', example: 'Season 1' },
			{ key: 'year', label: 'Year', example: 'YYYY' },
			{ key: 'episodeCount', label: 'Episode count', example: '10' }
		],
		children: {
			kind: 'episode',
			label: 'Episodes',
			arrayKey: 'episodes',
			fields: [
				{ key: 'title', label: 'Episode title' },
				{ key: 'episodeNumber', label: 'Episode #', example: '1' }
			]
		}
	}
};

const CAT_FILM: Category = {
	id: 'film',
	label: 'Film',
	group: 'media',
	glyph: '⏿',
	rootKind: 'film',
	rootFields: [
		{ key: 'description', label: 'Description', example: 'Plot summary' },
		{ key: 'director', label: 'Director', example: 'Full Name' },
		{ key: 'year', label: 'Year', example: 'YYYY' },
		{ key: 'runtime', label: 'Runtime', example: '120 min' },
		{ key: 'genres', label: 'Genres', example: '["thriller", "drama"]' }
	]
};

const CAT_BOOK: Category = {
	id: 'book',
	label: 'Book',
	group: 'media',
	glyph: '☾',
	rootKind: 'book',
	rootFields: [
		{ key: 'description', label: 'Description', example: 'Plot or subject summary' },
		{ key: 'author', label: 'Author', example: 'Full Name' },
		{ key: 'year', label: 'Year published', example: 'YYYY' },
		{ key: 'genres', label: 'Genres', example: '["fiction", "literary"]' }
	]
};

const CAT_ALBUM: Category = {
	id: 'album',
	label: 'Album',
	group: 'media',
	glyph: '♫',
	rootKind: 'album',
	rootFields: [
		{ key: 'artist', label: 'Artist', example: 'Artist Name' },
		{ key: 'releaseDate', label: 'Release date', example: 'YYYY-MM-DD' },
		{ key: 'genres', label: 'Genres', example: '["dream pop", "shoegaze"]' },
		{ key: 'description', label: 'Description', example: 'Album notes' }
	],
	children: {
		kind: 'track',
		label: 'Tracks',
		arrayKey: 'tracks',
		fields: [
			{ key: 'trackNumber', label: 'Track #', example: '1' },
			{ key: 'title', label: 'Title' },
			{ key: 'duration', label: 'Duration', example: 'MM:SS' }
		]
	}
};

const CAT_GAME: Category = {
	id: 'game',
	label: 'Video Game',
	group: 'media',
	glyph: '⊞',
	rootKind: 'game',
	rootFields: [
		{ key: 'description', label: 'Description', example: 'Game summary' },
		{ key: 'studio', label: 'Studio / Developer', example: 'Studio Name' },
		{ key: 'releaseDate', label: 'Release date', example: 'YYYY-MM-DD' },
		{ key: 'platforms', label: 'Platforms', example: '["PC", "PS5"]' },
		{ key: 'genres', label: 'Genres', example: '["RPG", "open world"]' }
	]
};

const CAT_ANIME_GRAPH: Category = {
	id: 'anime-graph',
	label: 'Anime — Relationship Graph',
	group: 'anime',
	glyph: '◉',
	rootKind: 'anime-relationship-graph',
	rootFields: [
		{ key: 'description', label: 'Series description', example: 'One-paragraph series premise' },
		{ key: 'studio', label: 'Animation studio', example: 'Studio Name' },
		{ key: 'year', label: 'Premiere year', example: 'YYYY' }
	]
};

const CAT_WORK: Category = {
	id: 'work',
	label: 'Generic Work',
	group: 'media',
	glyph: '◦',
	rootKind: 'work',
	rootFields: [
		{ key: 'description', label: 'Description', example: 'Brief description' },
		{ key: 'creator', label: 'Creator', example: 'Full Name' },
		{ key: 'year', label: 'Year', example: 'YYYY' },
		{ key: 'medium', label: 'Medium', example: 'novel, painting, album, …' }
	]
};

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
	CAT_ANIME_GRAPH,
	CAT_WORK
];

export function getCategory(id: string): Category | undefined {
	return CURATED_CATEGORIES.find((c) => c.id === id);
}

export function getChildLevel(category: Category, kind: string): ChildLevel | undefined {
	function walk(level: ChildLevel | undefined): ChildLevel | undefined {
		if (!level) return undefined;
		if (level.kind === kind) return level;
		return walk(level.children);
	}
	return walk(category.children);
}

/**
 * A starting-point category for the section an entry is filed under —
 * a suggestion, not a restriction. Any category can still be picked by hand.
 */
const SUGGESTED_CATEGORY: Record<SectionKey, string> = {
	book: 'book',
	article: 'book',
	topic: 'book',
	manga: 'book',
	pc_social: 'game',
	pc_solo: 'game',
	switch: 'game',
	android: 'game',
	anime_social: 'anime-graph',
	anime_solo: 'anime-graph',
	tv_social: 'tv-series',
	tv_solo: 'tv-series',
	film: 'film',
	cartoon: 'film'
};

export function suggestedCategoryId(sectionKey: SectionKey): string {
	return SUGGESTED_CATEGORY[sectionKey] ?? 'work';
}
