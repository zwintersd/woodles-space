import { describe, expect, it } from 'vitest';
import {
	stageFieldNoteOptions,
	fillTemplate,
	pickLine,
	equilibriumFieldNotes,
	quietFieldNotes,
	categoryMasteryFieldNotes
} from './fieldNoteTemplates';
import type { LifeDomain, LifeCategory } from './life';

const domains: LifeDomain[] = ['plant', 'animal', 'ecosystem', 'geology', 'weather'];
const categories: LifeCategory[] = ['aquatic', 'terrestrial', 'atmospheric'];

describe('stageFieldNoteOptions', () => {
	it('has at least one line for observed/studied/known, for every domain', () => {
		for (const domain of domains) {
			for (const stage of [1, 2, 3]) {
				const options = stageFieldNoteOptions(domain, stage);
				expect(options.length).toBeGreaterThan(0);
			}
		}
	});

	it('returns an empty array for an unhandled stage', () => {
		expect(stageFieldNoteOptions('plant', 0)).toEqual([]);
	});

	it('every template contains the {name} placeholder', () => {
		for (const domain of domains) {
			for (const stage of [1, 2, 3]) {
				for (const line of stageFieldNoteOptions(domain, stage)) {
					expect(line).toContain('{name}');
				}
			}
		}
	});
});

describe('fillTemplate', () => {
	it('substitutes the name placeholder', () => {
		expect(fillTemplate('{name} settles in.', 'the moss carpets')).toBe(
			'the moss carpets settles in.'
		);
	});
});

describe('pickLine', () => {
	const options = ['a', 'b', 'c'];

	it('returns null for an empty list', () => {
		expect(pickLine([], 0.5)).toBeNull();
	});

	it('picks the first entry at r=0', () => {
		expect(pickLine(options, 0)).toBe('a');
	});

	it('never goes out of bounds at r=1', () => {
		expect(pickLine(options, 1)).toBe('c');
	});
});

describe('equilibrium / quiet / category-mastery lines', () => {
	it('has at least one equilibrium line', () => {
		expect(equilibriumFieldNotes.length).toBeGreaterThan(0);
	});

	it('has at least one quiet line', () => {
		expect(quietFieldNotes.length).toBeGreaterThan(0);
	});

	it('has mastery lines for every category', () => {
		for (const cat of categories) {
			expect(categoryMasteryFieldNotes[cat].length).toBeGreaterThan(0);
		}
	});
});
