import { describe, expect, it } from 'vitest';
import { assembleSpell } from './assembler';
import { getCategory } from './registry';

describe('assembleSpell', () => {
	it('names the subject and asks for JSON only', () => {
		const category = getCategory('book')!;
		const prompt = assembleSpell(category, 'Piranesi');
		expect(prompt).toContain('Subject: Piranesi.');
		expect(prompt).toContain('"kind": "book"');
		expect(prompt).toContain('"title": "Piranesi"');
		expect(prompt).toContain('Return ONLY');
	});

	it('includes a disambiguation line when given', () => {
		const category = getCategory('film')!;
		const prompt = assembleSpell(category, 'Dune', 'the 2021 Villeneuve film, not the 1984 one');
		expect(prompt).toContain('Subject: Dune (the 2021 Villeneuve film, not the 1984 one).');
		expect(prompt).toContain('"disambiguation": "the 2021 Villeneuve film, not the 1984 one"');
	});

	it('nests child levels recursively', () => {
		const category = getCategory('musician')!;
		const prompt = assembleSpell(category, 'Some Artist');
		expect(prompt).toContain('"albums"');
		expect(prompt).toContain('"tracks"');
	});

	it('builds the anime relationship graph shape, not the generic skeleton', () => {
		const category = getCategory('anime-graph')!;
		const prompt = assembleSpell(category, 'Some Series');
		expect(prompt).toContain('"nodes"');
		expect(prompt).toContain('"edges"');
		expect(prompt).toContain('snake_case_character_id');
	});
});
