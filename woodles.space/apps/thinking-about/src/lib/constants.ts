import type { ColumnKey, SectionKey, SectionSize } from './types';

export type ColumnMeta = {
	key: ColumnKey;
	label: string;
	color: string;
	sections: SectionKey[];
};

export const COLUMNS: ColumnMeta[] = [
	{
		key: 'reading',
		label: 'Reading',
		color: '#3f51b5',
		sections: ['book', 'article', 'topic', 'manga']
	},
	{
		key: 'playing',
		label: 'Playing',
		color: '#33b679',
		sections: ['pc_social', 'pc_solo', 'switch', 'android']
	},
	{
		key: 'watching',
		label: 'Watching',
		color: '#f4511e',
		sections: ['anime_social', 'anime_solo', 'tv_social', 'tv_solo', 'film', 'cartoon']
	}
];

const COLUMN_KEYS = new Set<ColumnKey>(COLUMNS.map((column) => column.key));
const SECTION_KEYS = new Set<SectionKey>(COLUMNS.flatMap((column) => column.sections));

const SECTION_LABELS: Record<SectionKey, string> = {
	book: 'Books',
	article: 'Articles',
	topic: 'Topics',
	manga: 'Manga',
	pc_social: 'PC · social',
	pc_solo: 'PC · solo',
	switch: 'Switch',
	android: 'Android',
	anime_social: 'Anime · social',
	anime_solo: 'Anime · solo',
	tv_social: 'TV · social',
	tv_solo: 'TV · solo',
	film: 'Film',
	cartoon: 'Cartoons'
};

export function sectionLabel(key: SectionKey): string {
	return SECTION_LABELS[key];
}

export function columnLabel(key: ColumnKey): string {
	return COLUMNS.find((c) => c.key === key)?.label ?? key;
}

export function columnForSection(key: SectionKey): ColumnKey {
	return COLUMNS.find((c) => c.sections.includes(key))?.key ?? 'reading';
}

export function defaultSectionForColumn(key: ColumnKey): SectionKey {
	return COLUMNS.find((c) => c.key === key)?.sections[0] ?? 'book';
}

export function isColumnKey(value: unknown): value is ColumnKey {
	return typeof value === 'string' && COLUMN_KEYS.has(value as ColumnKey);
}

export function isSectionKey(value: unknown): value is SectionKey {
	return typeof value === 'string' && SECTION_KEYS.has(value as SectionKey);
}

export function normalizeColumnSection(
	columnKey: unknown,
	sectionKey: unknown
): { columnKey: ColumnKey; sectionKey: SectionKey } {
	if (isSectionKey(sectionKey)) {
		return { columnKey: columnForSection(sectionKey), sectionKey };
	}

	const fallbackColumn = isColumnKey(columnKey) ? columnKey : 'reading';
	return {
		columnKey: fallbackColumn,
		sectionKey: defaultSectionForColumn(fallbackColumn)
	};
}

// Section sizing is purely a view concern, no data model impact. Kept as a
// small config object so the thresholds are easy to retune once real data is
// in there. 0 entries -> minimized, 1-2 -> compact, 3+ -> full.
export const SECTION_SIZE_THRESHOLDS = {
	compact: 1,
	full: 3
} as const;

export function sectionSize(count: number): SectionSize {
	if (count >= SECTION_SIZE_THRESHOLDS.full) return 'full';
	if (count >= SECTION_SIZE_THRESHOLDS.compact) return 'compact';
	return 'minimized';
}

// shared_with only means anything on a `_social` section (pc_social,
// anime_social, tv_social) — never on its `_solo` sibling.
export function showsSharedWith(sectionKey: SectionKey): boolean {
	return sectionKey.endsWith('_social');
}

// schedule only means anything for playing/watching entries. Reading never
// shows it.
export function showsSchedule(columnKey: ColumnKey): boolean {
	return columnKey !== 'reading';
}

// Calendar-event-style named swatches — the same visual logic as picking a
// color for a calendar event. Freeform hex entry (ColorPicker's native
// <input type="color">) always stays available alongside these.
export const COLOR_SWATCHES = [
	{ name: 'Tomato', hex: '#d50000' },
	{ name: 'Flamingo', hex: '#e67c73' },
	{ name: 'Tangerine', hex: '#f4511e' },
	{ name: 'Banana', hex: '#f6bf26' },
	{ name: 'Sage', hex: '#33b679' },
	{ name: 'Basil', hex: '#0b8043' },
	{ name: 'Peacock', hex: '#039be5' },
	{ name: 'Blueberry', hex: '#3f51b5' },
	{ name: 'Lavender', hex: '#7986cb' },
	{ name: 'Grape', hex: '#8e24aa' },
	{ name: 'Graphite', hex: '#616161' }
] as const;

export const DEFAULT_COLOR: string = COLOR_SWATCHES[7].hex; // Blueberry
