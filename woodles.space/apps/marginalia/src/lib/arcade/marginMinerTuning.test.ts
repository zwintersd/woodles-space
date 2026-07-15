import { describe, expect, it } from 'vitest';
import {
	MARGIN_MINER_RIG_UPGRADES,
	marginMinerLootPlan,
	marginMinerSeconds,
	marginMinerTarget,
	marginMinerUnstableCacheValue
} from './marginMinerTuning';

describe('Margin Miner tuning', () => {
	it('starts at fifteen seconds and makes clock upgrades meaningful', () => {
		expect(marginMinerSeconds(0)).toBe(15);
		expect(marginMinerSeconds(1)).toBe(20);
		expect(marginMinerSeconds(3)).toBe(30);
	});

	it('keeps the opening target reachable with one high-value haul', () => {
		expect(marginMinerTarget(1)).toBe(500);
		expect(marginMinerTarget(1)).toBeLessThanOrEqual(600);
		expect(marginMinerTarget(2)).toBeGreaterThan(marginMinerTarget(1));
	});

	it('uses a deterministic loot composition for each level', () => {
		expect(marginMinerLootPlan(1)).toEqual([
			['small-gold', 7],
			['large-gold', 3],
			['small-rock', 5],
			['large-rock', 2],
			['diamond', 1],
			['mystery-bag', 1]
		]);
		expect(marginMinerLootPlan(3)).toContainEqual(['diamond', 2]);
		expect(marginMinerLootPlan(2)).toContainEqual(['unstable-cache', 1]);
		expect(marginMinerLootPlan(2)).toContainEqual(['anchored-ore', 1]);
	});

	it('makes an unstable cache a visible early timing opportunity', () => {
		expect(marginMinerUnstableCacheValue(0)).toBe(800);
		expect(marginMinerUnstableCacheValue(2)).toBe(650);
		expect(marginMinerUnstableCacheValue(30)).toBe(200);
	});

	it('offers a choice between speed, reach, and time', () => {
		expect(MARGIN_MINER_RIG_UPGRADES.map((upgrade) => upgrade.id)).toEqual([
			'motor',
			'grip',
			'clock'
		]);
	});
});
