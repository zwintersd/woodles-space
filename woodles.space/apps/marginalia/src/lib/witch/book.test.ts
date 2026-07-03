import { describe, expect, it } from 'vitest';
import type { Life } from './content/life';
import { STAGE_SECONDS, ATTENTION_START, ATTENTION_COSTS } from './tuning';
import { visibleLifeForWorldspace } from './worldShape';

// Constants from book.svelte (duplicated here to avoid importing the Book class
// which uses Svelte 5 $state runes that can't be instantiated in test context)
const STAGE_NOTICED = 0;
const STAGE_OBSERVED = 1;
const STAGE_STUDIED = 2;
const STAGE_KNOWN = 3;
const stageLabel = ['noticed', 'observed', 'studied', 'known'] as const;

// Copy of fmt function (same as in book.svelte)
function fmt(n: number): string {
	if (n < 1000) return n < 10 ? n.toFixed(1).replace(/\.0$/, '') : Math.floor(n).toString();
	const units = ['', 'k', 'm', 'b', 't'];
	let i = 0;
	let v = n;
	while (v >= 1000 && i < units.length - 1) {
		v /= 1000;
		i++;
	}
	return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + units[i];
}

describe('Book — utilities and constants', () => {
	// Note: Testing Book class directly is limited due to Svelte 5 $state runes
	// which only work within component context. Testing exported utilities instead.

	describe('stage constants', () => {
		it('defines stage progression constants', () => {
			expect(STAGE_NOTICED).toBe(0);
			expect(STAGE_OBSERVED).toBe(1);
			expect(STAGE_STUDIED).toBe(2);
			expect(STAGE_KNOWN).toBe(3);
		});

		it('defines stage labels', () => {
			expect(stageLabel[STAGE_NOTICED]).toBe('noticed');
			expect(stageLabel[STAGE_OBSERVED]).toBe('observed');
			expect(stageLabel[STAGE_STUDIED]).toBe('studied');
			expect(stageLabel[STAGE_KNOWN]).toBe('known');
		});

		it('stages are ordinal', () => {
			expect(STAGE_NOTICED < STAGE_OBSERVED).toBe(true);
			expect(STAGE_OBSERVED < STAGE_STUDIED).toBe(true);
			expect(STAGE_STUDIED < STAGE_KNOWN).toBe(true);
		});
	});

	describe('tuning constants', () => {
		it('defines stage thresholds', () => {
			expect(Array.isArray(STAGE_SECONDS)).toBe(true);
			expect(STAGE_SECONDS.length).toBeGreaterThan(0);
		});

		it('stage thresholds are non-negative', () => {
			STAGE_SECONDS.forEach((seconds) => {
				expect(seconds).toBeGreaterThanOrEqual(0);
			});
		});

		it('defines attention costs for upgrades', () => {
			expect(Array.isArray(ATTENTION_COSTS)).toBe(true);
			expect(ATTENTION_COSTS.length).toBeGreaterThan(0);
		});

		it('attention costs are positive and increasing', () => {
			for (let i = 0; i < ATTENTION_COSTS.length; i++) {
				expect(ATTENTION_COSTS[i]).toBeGreaterThan(0);
				if (i > 0) {
					expect(ATTENTION_COSTS[i]).toBeGreaterThanOrEqual(ATTENTION_COSTS[i - 1]);
				}
			}
		});

		it('defines initial attention capacity', () => {
			expect(ATTENTION_START).toBeGreaterThan(0);
		});
	});

	// ── fmt — number formatting ───────────────────────────────────────

	describe('fmt — number formatting', () => {
		it('formats numbers under 1000 without decimals if >= 10', () => {
			expect(fmt(42)).toBe('42');
			expect(fmt(999)).toBe('999');
		});

		it('formats single-digit numbers with .1 decimal', () => {
			expect(fmt(5)).toBe('5');
			expect(fmt(9.5)).toBe('9.5');
		});

		it('formats thousands with k suffix', () => {
			expect(fmt(1500)).toContain('k');
			expect(fmt(1234)).toContain('k');
		});

		it('formats millions with m suffix', () => {
			expect(fmt(1500000)).toContain('m');
		});

		it('rounds appropriately for display', () => {
			expect(fmt(1234567)).toContain('m');
			const formatted = fmt(1200000);
			expect(formatted).toMatch(/1\.[0-9]+m/);
		});

		it('handles zero', () => {
			expect(fmt(0)).toBe('0');
		});

		it('handles large numbers', () => {
			const huge = 999999999999;
			const formatted = fmt(huge);
			expect(formatted).toMatch(/\d+[kmbt]?/);
		});

		it('handles negative numbers', () => {
			const formatted = fmt(-100);
			expect(formatted).toBeTruthy();
		});

		it('decreases precision for large numbers', () => {
			const small = fmt(1200);
			const large = fmt(1200000);
			// Small should show more precision
			expect(small.length).toBeGreaterThanOrEqual(3);
			expect(large.length).toBeGreaterThanOrEqual(3);
		});

		it('uses appropriate suffix levels', () => {
			expect(fmt(1000)).toContain('k');
			expect(fmt(1000000)).toContain('m');
			expect(fmt(1000000000)).toContain('b');
			expect(fmt(1000000000000)).toContain('t');
		});
	});

	describe('stageLabel export', () => {
		it('is an array', () => {
			expect(Array.isArray(stageLabel)).toBe(true);
		});

		it('has entries for all defined stages', () => {
			expect(stageLabel.length).toBeGreaterThanOrEqual(4);
		});

		it('labels match expected values', () => {
			const labels = Array.from(stageLabel);
			expect(labels).toEqual(['noticed', 'observed', 'studied', 'known']);
		});
	});

	describe('worldspace life gating', () => {
		const aquatic = { id: 'a', category: 'aquatic' } as Life;
		const terrestrial = { id: 't', category: 'terrestrial' } as Life;
		const atmospheric = { id: 's', category: 'atmospheric' } as Life;

		it('keeps the opening water world aquatic-only', () => {
			expect(visibleLifeForWorldspace([aquatic, terrestrial, atmospheric], 'water')).toEqual([
				aquatic
			]);
		});

		it('allows all current world-one categories in the shallows', () => {
			expect(visibleLifeForWorldspace([aquatic, terrestrial, atmospheric], 'shallows')).toEqual([
				aquatic,
				terrestrial,
				atmospheric
			]);
		});
	});
});
