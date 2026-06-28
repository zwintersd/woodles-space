import { describe, expect, it } from 'vitest';
import {
	ARCADE_CORE_STATS,
	coreStatPerks,
	coreStatValue,
	statTier,
	type ArcadeStatCreature
} from './arcadeStats';

describe('arcade stat tiers', () => {
	it('uses the shared 5, 7, and 9 thresholds', () => {
		expect(statTier(0)).toBe(0);
		expect(statTier(4)).toBe(0);
		expect(statTier(5)).toBe(1);
		expect(statTier(6)).toBe(1);
		expect(statTier(7)).toBe(2);
		expect(statTier(8)).toBe(2);
		expect(statTier(9)).toBe(3);
		expect(statTier(10)).toBe(3);
	});

	it('treats missing or non-finite values as tier 0', () => {
		expect(statTier(null)).toBe(0);
		expect(statTier(undefined)).toBe(0);
		expect(statTier(Number.NaN)).toBe(0);
		expect(statTier(Number.POSITIVE_INFINITY)).toBe(0);
	});
});

describe('arcade core stat helpers', () => {
	const creature: NonNullable<ArcadeStatCreature> = {
		stats: {
			body: 5,
			mind: 7,
			grace: 9,
			heart: 4,
			will: 10,
			spark: 10,
			substats: {}
		}
	};

	it('reads only the four core arcade stats', () => {
		expect(ARCADE_CORE_STATS).toEqual(['body', 'mind', 'grace', 'heart']);
		expect(coreStatValue(creature, 'body')).toBe(5);
		expect(coreStatValue(creature, 'mind')).toBe(7);
		expect(coreStatValue(creature, 'grace')).toBe(9);
		expect(coreStatValue(creature, 'heart')).toBe(4);
	});

	it('returns baseline values when there is no active creature', () => {
		expect(coreStatValue(null, 'body')).toBe(0);
		expect(coreStatValue(undefined, 'heart')).toBe(0);

		expect(coreStatPerks(null)).toEqual([
			{ stat: 'body', value: 0, tier: 0, effect: 'baseline' },
			{ stat: 'mind', value: 0, tier: 0, effect: 'baseline' },
			{ stat: 'grace', value: 0, tier: 0, effect: 'baseline' },
			{ stat: 'heart', value: 0, tier: 0, effect: 'baseline' }
		]);
	});

	it('builds display-ready perks with per-game effect copy', () => {
		expect(
			coreStatPerks(creature, {
				body: (_value, tier) => `body tier ${tier}`,
				mind: 'one preview'
			})
		).toEqual([
			{ stat: 'body', value: 5, tier: 1, effect: 'body tier 1' },
			{ stat: 'mind', value: 7, tier: 2, effect: 'one preview' },
			{ stat: 'grace', value: 9, tier: 3, effect: 'tier 3' },
			{ stat: 'heart', value: 4, tier: 0, effect: 'baseline' }
		]);
	});
});
