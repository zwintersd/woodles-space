import { describe, expect, it } from 'vitest';
import {
	COLUMNS,
	columnForSection,
	columnLabel,
	defaultSectionForColumn,
	isColumnKey,
	isSectionKey,
	normalizeColumnSection,
	sectionLabel,
	sectionSize,
	showsSchedule,
	showsSessions,
	showsSharedWith
} from './constants';
import type { SectionKey } from './types';

describe('COLUMNS', () => {
	it('has exactly reading, playing, watching, in that order', () => {
		expect(COLUMNS.map((c) => c.key)).toEqual(['reading', 'playing', 'watching']);
	});

	it('gives reading its four sections', () => {
		expect(COLUMNS.find((c) => c.key === 'reading')?.sections).toEqual([
			'book',
			'article',
			'topic',
			'manga'
		]);
	});

	it('gives playing its four sections', () => {
		expect(COLUMNS.find((c) => c.key === 'playing')?.sections).toEqual([
			'pc_social',
			'pc_solo',
			'switch',
			'android'
		]);
	});

	it('gives watching its six sections', () => {
		expect(COLUMNS.find((c) => c.key === 'watching')?.sections).toEqual([
			'anime_social',
			'anime_solo',
			'tv_social',
			'tv_solo',
			'film',
			'cartoon'
		]);
	});

	it('never lists the same section under two columns', () => {
		const all = COLUMNS.flatMap((c) => c.sections);
		expect(new Set(all).size).toBe(all.length);
	});
});

describe('sectionLabel', () => {
	it('labels every section referenced by COLUMNS', () => {
		const all = COLUMNS.flatMap((c) => c.sections);
		for (const key of all) {
			expect(sectionLabel(key).length).toBeGreaterThan(0);
		}
	});
});

describe('columnLabel', () => {
	it('labels every column', () => {
		expect(columnLabel('reading')).toBe('Reading');
		expect(columnLabel('playing')).toBe('Playing');
		expect(columnLabel('watching')).toBe('Watching');
	});
});

describe('columnForSection', () => {
	it('resolves a section back to its owning column', () => {
		expect(columnForSection('manga')).toBe('reading');
		expect(columnForSection('switch')).toBe('playing');
		expect(columnForSection('cartoon')).toBe('watching');
	});
});

describe('defaultSectionForColumn', () => {
	it('returns the first section for a column', () => {
		expect(defaultSectionForColumn('reading')).toBe('book');
		expect(defaultSectionForColumn('playing')).toBe('pc_social');
		expect(defaultSectionForColumn('watching')).toBe('anime_social');
	});
});

describe('isColumnKey / isSectionKey', () => {
	it('recognizes known keys only', () => {
		expect(isColumnKey('reading')).toBe(true);
		expect(isColumnKey('listening')).toBe(false);
		expect(isSectionKey('film')).toBe(true);
		expect(isSectionKey('podcast')).toBe(false);
	});
});

describe('normalizeColumnSection', () => {
	it('uses a valid section as the source of truth', () => {
		expect(normalizeColumnSection('reading', 'film')).toEqual({
			columnKey: 'watching',
			sectionKey: 'film'
		});
	});

	it('falls back to the first section of a valid column', () => {
		expect(normalizeColumnSection('playing', 'podcast')).toEqual({
			columnKey: 'playing',
			sectionKey: 'pc_social'
		});
	});

	it('falls all the way back to reading books', () => {
		expect(normalizeColumnSection('listening', 'podcast')).toEqual({
			columnKey: 'reading',
			sectionKey: 'book'
		});
	});
});

describe('sectionSize', () => {
	it('is minimized at zero entries', () => {
		expect(sectionSize(0)).toBe('minimized');
	});
	it('is compact at one or two entries', () => {
		expect(sectionSize(1)).toBe('compact');
		expect(sectionSize(2)).toBe('compact');
	});
	it('is full at three or more entries', () => {
		expect(sectionSize(3)).toBe('full');
		expect(sectionSize(11)).toBe('full');
	});
});

describe('showsSharedWith', () => {
	it('is true only for _social sections', () => {
		expect(showsSharedWith('pc_social')).toBe(true);
		expect(showsSharedWith('anime_social')).toBe(true);
		expect(showsSharedWith('tv_social')).toBe(true);
	});
	it('is false for the _solo sibling of a _social section', () => {
		expect(showsSharedWith('pc_solo')).toBe(false);
		expect(showsSharedWith('anime_solo')).toBe(false);
		expect(showsSharedWith('tv_solo')).toBe(false);
	});
	it('is false for sections with no social/solo split', () => {
		const noSplit: SectionKey[] = ['book', 'article', 'topic', 'manga', 'switch', 'android', 'film', 'cartoon'];
		for (const key of noSplit) expect(showsSharedWith(key)).toBe(false);
	});
});

describe('showsSchedule', () => {
	it('is false for reading', () => {
		expect(showsSchedule('reading')).toBe(false);
	});
	it('is true for playing and watching', () => {
		expect(showsSchedule('playing')).toBe(true);
		expect(showsSchedule('watching')).toBe(true);
	});
});

describe('showsSessions', () => {
	it('is true only for watching', () => {
		expect(showsSessions('watching')).toBe(true);
	});
	it('is false for reading and playing', () => {
		expect(showsSessions('reading')).toBe(false);
		expect(showsSessions('playing')).toBe(false);
	});
});
