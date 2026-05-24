import { describe, expect, it } from 'vitest';
import {
	STAGE_SECONDS,
	STAGE_INSIGHT_MULT,
	ATTENTION_COSTS,
	favorMultiplier
} from './tuning';

describe('tuning constants', () => {
	it('STAGE_SECONDS is strictly increasing past index 0', () => {
		expect(STAGE_SECONDS[0]).toBe(0);
		expect(STAGE_SECONDS[1]).toBeLessThan(STAGE_SECONDS[2]);
		expect(STAGE_SECONDS[2]).toBeLessThan(STAGE_SECONDS[3]);
	});
	it('STAGE_INSIGHT_MULT scales with depth', () => {
		expect(STAGE_INSIGHT_MULT[0]).toBe(0);
		expect(STAGE_INSIGHT_MULT[1]).toBeLessThan(STAGE_INSIGHT_MULT[2]);
		expect(STAGE_INSIGHT_MULT[2]).toBeLessThan(STAGE_INSIGHT_MULT[3]);
	});
	it('ATTENTION_COSTS is monotonically increasing', () => {
		for (let i = 1; i < ATTENTION_COSTS.length; i++) {
			expect(ATTENTION_COSTS[i]).toBeGreaterThan(ATTENTION_COSTS[i - 1]);
		}
	});
});

describe('favorMultiplier', () => {
	it('returns 0.5 at favor 0', () => {
		expect(favorMultiplier(0)).toBe(0.5);
	});
	it('returns 1.0 at favor 50', () => {
		expect(favorMultiplier(50)).toBe(1.0);
	});
	it('returns 1.5 at favor 100', () => {
		expect(favorMultiplier(100)).toBe(1.5);
	});
	it('is linear in favor', () => {
		expect(favorMultiplier(25)).toBeCloseTo(0.75);
		expect(favorMultiplier(75)).toBeCloseTo(1.25);
	});
});
