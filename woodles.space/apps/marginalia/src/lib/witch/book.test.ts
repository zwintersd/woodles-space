// Book — the reactive view's own surface.
//
// This file used to open with a note saying the Book couldn't be imported here
// because "$state runes only work within component context", and duplicated
// `fmt` and the stage constants to work around it. That was never true: the
// Book uses `$state` and `$derived` and never `$effect`, and only `$effect`
// needs a component. The cost of believing it was that the entire game loop
// went untested.
//
// It is tested now, in three places: `characterization.test.ts` drives the real
// Book and pins its numbers, `sim.test.ts` covers the harness, and this file
// keeps what it always covered — the formatting helpers and the constants —
// against the *real* exports rather than copies of them.

import { describe, expect, it } from 'vitest';
import type { Life } from './content/life';
import { STAGE_SECONDS, ATTENTION_START, ATTENTION_COSTS } from './tuning';
import { visibleLifeForWorldspace } from './worldShape';
import {
	Book,
	fmt,
	humanizeSeconds,
	stageLabel,
	STAGE_NOTICED,
	STAGE_OBSERVED,
	STAGE_STUDIED,
	STAGE_KNOWN
} from './book.svelte';

describe('Book — utilities and constants', () => {
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
			expect(fmt(1200000)).toMatch(/1\.[0-9]+m/);
		});

		it('handles zero', () => {
			expect(fmt(0)).toBe('0');
		});

		it('handles large numbers', () => {
			expect(fmt(999999999999)).toMatch(/\d+[kmbt]?/);
		});

		it('handles negative numbers', () => {
			expect(fmt(-100)).toBeTruthy();
		});

		it('uses appropriate suffix levels', () => {
			expect(fmt(1000)).toContain('k');
			expect(fmt(1000000)).toContain('m');
			expect(fmt(1000000000)).toContain('b');
			expect(fmt(1000000000000)).toContain('t');
		});
	});

	// ── humanizeSeconds — the ETA readout ─────────────────────────────

	describe('humanizeSeconds', () => {
		it('reads an unreachable or nonsense ETA as a dash', () => {
			expect(humanizeSeconds(null)).toBe('—');
			expect(humanizeSeconds(Infinity)).toBe('—');
			expect(humanizeSeconds(-1)).toBe('—');
		});

		it('scales its unit with the wait', () => {
			expect(humanizeSeconds(0)).toBe('any moment');
			expect(humanizeSeconds(30)).toBe('~30s');
			expect(humanizeSeconds(90)).toBe('~2m');
			expect(humanizeSeconds(7200)).toBe('~2h');
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
			expect(Array.from(stageLabel)).toEqual(['noticed', 'observed', 'studied', 'known']);
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

// The thing the old comment said was impossible.
describe('Book — it instantiates, and it is a view over a plain world', () => {
	it('constructs outside any component', () => {
		const b = new Book();
		expect(b.insight).toBe(0);
		expect(b.world.state.insight).toBe(0);
	});

	it('reads through to the world it wraps', () => {
		const b = new Book();
		b.essence = 100;
		b.writeCondition('holding');
		expect(b.world.state.writtenConditions).toEqual(['holding']);
		expect(b.life).toEqual(b.world.life);
		expect(b.complexity).toBe(b.world.complexity);
	});

	it('a mutation through the Book is a mutation of the world', () => {
		const b = new Book();
		b.insight = 42;
		expect(b.world.state.insight).toBe(42);
	});

	it('the world can be driven without the Book at all', () => {
		const b = new Book();
		b.essence = 100;
		b.writeCondition('holding');
		b.attend('salt_deposit');
		b.world.tick(10);
		// the Book sees it, because there is only one copy of the state
		expect(b.study['salt_deposit']).toBeGreaterThan(0);
	});
});
