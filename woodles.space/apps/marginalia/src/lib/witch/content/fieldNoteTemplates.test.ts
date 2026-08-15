import { describe, expect, it } from 'vitest';
import { fieldNotesByDomain, equilibriumFieldNotes, quietFieldNotes, categoryMasteryFieldNotes } from './fieldNoteTemplates';
import type { LifeDomain, LifeCategory } from './life';

const domains: LifeDomain[] = ['plant', 'animal', 'ecosystem', 'geology', 'weather'];
const categories: LifeCategory[] = ['aquatic', 'terrestrial', 'atmospheric'];

describe('fieldNotesByDomain', () => {
	it('has at least one line for observed/studied/known, for every domain', () => {
		for (const domain of domains) {
			for (const stage of [1, 2, 3]) {
				const options = fieldNotesByDomain[domain]?.[stage] ?? [];
				expect(options.length).toBeGreaterThan(0);
			}
		}
	});

	it('has nothing for an unhandled stage', () => {
		expect(fieldNotesByDomain.plant[0]).toBeUndefined();
	});

	it('every template contains the {name} placeholder', () => {
		for (const domain of domains) {
			for (const stage of [1, 2, 3]) {
				for (const line of fieldNotesByDomain[domain]?.[stage] ?? []) {
					expect(line).toContain('{name}');
				}
			}
		}
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
