import { describe, expect, it } from 'vitest';
import type { Spore } from './types';
import {
	backlinksOf,
	brokenTargets,
	linkTargets,
	parseWikilinks,
	plantLink,
	stripWikilinks,
	toSegments,
	wikilinkFor
} from './wikilinks';

function spore(id: string, title: string, body = ''): Spore {
	return {
		id,
		title,
		body,
		data: {},
		spellbookIds: [],
		tags: [],
		created: '2026-07-01T00:00:00.000Z',
		updated: '2026-07-01T00:00:00.000Z'
	};
}

describe('parsing', () => {
	it('reads a plain link and an aliased one', () => {
		const links = parseWikilinks('see [[Photosynthesis]] and [[Chlorophyll|the pigment]]');
		expect(links.map((l) => [l.target, l.display])).toEqual([
			['Photosynthesis', 'Photosynthesis'],
			['Chlorophyll', 'the pigment']
		]);
	});

	it('trims the slack a person leaves while typing', () => {
		expect(parseWikilinks('[[  Spaced Out  |  shown  ]]')[0]).toMatchObject({
			target: 'Spaced Out',
			display: 'shown'
		});
	});

	it('ignores an empty target and unclosed brackets', () => {
		expect(parseWikilinks('[[]] and [[ | x ]] and [[unclosed')).toEqual([]);
	});

	it('falls back to the target when the alias is blank', () => {
		expect(parseWikilinks('[[Thing|]]')[0].display).toBe('Thing');
	});

	it('collects distinct targets, ignoring case and spacing', () => {
		expect(linkTargets('[[Moss]] [[moss]] [[  MOSS  ]] [[Fern]]')).toEqual(['Moss', 'Fern']);
	});

	it('flattens links to their display text', () => {
		expect(stripWikilinks('the [[Chlorophyll|pigment]] in [[Moss]]')).toBe(
			'the pigment in Moss'
		);
	});

	it('builds a link, using an alias only when it differs from the target', () => {
		expect(wikilinkFor('Moss')).toBe('[[Moss]]');
		expect(wikilinkFor('Moss', 'moss')).toBe('[[Moss]]');
		expect(wikilinkFor('Moss', 'the green stuff')).toBe('[[Moss|the green stuff]]');
	});
});

describe('segments', () => {
	const all = [spore('s1', 'Moss'), spore('s2', 'Fern')];

	it('splits text around resolved links', () => {
		const segments = toSegments('a [[Moss]] b', all);
		expect(segments).toEqual([
			{ kind: 'text', text: 'a ' },
			{ kind: 'link', link: expect.objectContaining({ target: 'Moss' }), sporeId: 's1' },
			{ kind: 'text', text: ' b' }
		]);
	});

	it('marks a link with no spore behind it, rather than dropping it', () => {
		const segments = toSegments('[[Lichen]]', all);
		expect(segments).toHaveLength(1);
		expect(segments[0]).toMatchObject({ kind: 'link', sporeId: null });
	});

	it('resolves regardless of case and spacing', () => {
		expect(toSegments('[[  moss  ]]', all)[0]).toMatchObject({ sporeId: 's1' });
	});

	it('returns one text run when there are no links, and nothing when empty', () => {
		expect(toSegments('just words', all)).toEqual([{ kind: 'text', text: 'just words' }]);
		expect(toSegments('', all)).toEqual([]);
	});

	it('handles adjacent links with no text between them', () => {
		const segments = toSegments('[[Moss]][[Fern]]', all);
		expect(segments.map((s) => s.kind)).toEqual(['link', 'link']);
	});

	it('lists targets nothing answers to yet', () => {
		expect(brokenTargets('[[Moss]] [[Lichen]] [[Fern]]', all)).toEqual(['Lichen']);
	});
});

describe('backlinks', () => {
	it('finds every spore whose body links here, and not the spore itself', () => {
		const moss = spore('s1', 'Moss', 'I mention [[Moss]] in my own body');
		const all = [
			moss,
			spore('s2', 'Fern', 'grows near [[Moss]]'),
			spore('s3', 'Stone', 'nothing here'),
			spore('s4', 'Bog', 'the [[moss|green]] again')
		];

		expect(backlinksOf(moss, all).map((s) => s.id)).toEqual(['s2', 's4']);
	});

	it('is empty for a spore nothing points at', () => {
		expect(backlinksOf(spore('s1', 'Alone'), [spore('s1', 'Alone')])).toEqual([]);
	});
});

describe('planting a link', () => {
	it('wraps the phrase where it sits, linking it to a new title', () => {
		expect(plantLink('the green stuff on rocks', 'green stuff', 'Moss')).toBe(
			'the [[Moss|green stuff]] on rocks'
		);
	});

	it('uses a bare link when the phrase is the title', () => {
		expect(plantLink('I saw Moss today', 'Moss')).toBe('I saw [[Moss]] today');
	});

	it('replaces only the first occurrence', () => {
		expect(plantLink('Moss and Moss', 'Moss')).toBe('[[Moss]] and Moss');
	});

	it('leaves the body alone when the phrase is not in it', () => {
		const body = 'nothing to see';
		expect(plantLink(body, 'absent')).toBe(body);
		expect(plantLink(body, '  ')).toBe(body);
	});
});
