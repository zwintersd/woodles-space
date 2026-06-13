import { describe, it, expect } from 'vitest';
import { buildSpell } from './assembler';
import { getCategory } from './registry';
import type { SpellDraft } from './types';

const musician = getCategory('musician')!;
const person = getCategory('person')!;

function draft(over: Partial<SpellDraft> = {}): SpellDraft {
	return {
		categoryId: 'musician',
		subject: 'Taylor Swift',
		disambiguation: '',
		selectedFields: ['root.bio', 'root.genres', 'album.releaseDate'],
		includedLevels: ['album'],
		modifiers: [],
		...over
	};
}

describe('buildSpell — envelope & subject', () => {
	it('always emits the garden-import-v1 envelope, kind, and subject title', () => {
		const spell = buildSpell(draft(), musician);
		expect(spell).toContain('"woodles": "garden-import-v1"');
		expect(spell).toContain('"kind": "artist-discography"');
		expect(spell).toContain('"title": "Taylor Swift"');
	});

	it('folds disambiguation into the subject line', () => {
		const spell = buildSpell(
			draft({ disambiguation: 'the American singer-songwriter, not the band' }),
			musician
		);
		expect(spell).toContain('the American singer-songwriter, not the band');
	});
});

describe('buildSpell — field selection', () => {
	it('includes selected root fields and omits unselected ones', () => {
		const spell = buildSpell(draft({ selectedFields: ['root.bio'] }), musician);
		expect(spell).toContain('"bio"');
		expect(spell).not.toContain('"activeYears"');
		expect(spell).not.toContain('"genres"');
	});
});

describe('buildSpell — level pruning', () => {
	it('includes a child level array when the level is kept', () => {
		const spell = buildSpell(draft({ includedLevels: ['album'] }), musician);
		expect(spell).toContain('"albums"');
	});

	it('prunes a child level (and descendants) when excluded', () => {
		// no levels included → "just top-level info"
		const spell = buildSpell(draft({ includedLevels: [] }), musician);
		expect(spell).not.toContain('"albums"');
		expect(spell).not.toContain('"tracks"');
	});

	it('prunes only the descendant level when the parent is kept', () => {
		const spell = buildSpell(draft({ includedLevels: ['album'] }), musician);
		expect(spell).toContain('"albums"');
		expect(spell).not.toContain('"tracks"');
	});

	it('nests grandchildren when every level is kept', () => {
		const spell = buildSpell(
			draft({
				includedLevels: ['album', 'track'],
				selectedFields: ['root.bio', 'album.releaseDate', 'track.title']
			}),
			musician
		);
		expect(spell).toContain('"albums"');
		expect(spell).toContain('"tracks"');
	});
});

describe('buildSpell — base rules', () => {
	it('always states the non-negotiable rules', () => {
		const spell = buildSpell(draft(), musician);
		expect(spell).toMatch(/RULES:/);
		expect(spell).toMatch(/"unknown"/);
		expect(spell).toMatch(/YYYY-MM-DD/);
		expect(spell).toMatch(/order/i);
		expect(spell).toMatch(/titles/i);
	});
});

describe('buildSpell — modifiers', () => {
	it('injects modifier rules when the modifier is active', () => {
		const spell = buildSpell(draft({ modifiers: ['timeline'] }), musician);
		expect(spell).toMatch(/re-recording/i);
	});

	it('does not inject modifier rules when no modifier is selected', () => {
		const spell = buildSpell(draft({ modifiers: [] }), musician);
		expect(spell).not.toMatch(/re-recording/i);
	});
});

describe('buildSpell — flat categories', () => {
	it('emits no child arrays for a flat category', () => {
		const flat = draft({
			categoryId: 'person',
			subject: 'Ada Lovelace',
			selectedFields: ['root.bio', 'root.notableFor'],
			includedLevels: []
		});
		const spell = buildSpell(flat, person);
		expect(spell).toContain('"title": "Ada Lovelace"');
		expect(spell).toContain('"bio"');
		expect(spell).not.toContain('"albums"');
	});
});
