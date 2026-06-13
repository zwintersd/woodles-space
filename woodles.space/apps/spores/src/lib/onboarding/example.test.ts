import { describe, it, expect } from 'vitest';
import { parseImport } from '../spells/parser';
import { ONBOARDING_EXAMPLE } from './example';

describe('onboarding illustrative example', () => {
	it('is valid garden-import-v1 that the parser accepts cleanly', () => {
		const r = parseImport(ONBOARDING_EXAMPLE);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.warnings).toHaveLength(0);
			expect(r.spore.title).toBe('Twin Peaks');
			expect(r.spore.data.kind).toBe('tv-series');
		}
	});

	it('exposes promotable seasons for the Beat 5 promote gesture', () => {
		const r = parseImport(ONBOARDING_EXAMPLE);
		expect(r.ok).toBe(true);
		if (r.ok) {
			const seasons = r.spore.data.seasons;
			expect(Array.isArray(seasons)).toBe(true);
			const arr = seasons as Array<Record<string, unknown>>;
			expect(arr.length).toBeGreaterThan(0);
			// every season needs a title so promote-to-Spore can name the child
			for (const s of arr) expect(typeof s.title).toBe('string');
		}
	});
});
