import { describe, expect, it } from 'vitest';
import { advanceLadder } from './thresholdLadder.js';

const thresholds = [0, 30, 210, 1100];

describe('advanceLadder', () => {
	it('does nothing below the next threshold', () => {
		const result = advanceLadder(0, 10, thresholds, 3);
		expect(result).toEqual({ stage: 0, banked: 10, crossed: 0 });
	});

	it('crosses one step and carries the remainder', () => {
		const result = advanceLadder(0, 35, thresholds, 3);
		expect(result.stage).toBe(1);
		expect(result.banked).toBe(5);
		expect(result.crossed).toBe(1);
	});

	it('crosses more than one step in a single call when the deposit is big enough', () => {
		const result = advanceLadder(0, 250, thresholds, 3);
		expect(result.stage).toBe(2);
		expect(result.banked).toBe(10); // 250 - 30 - 210
		expect(result.crossed).toBe(2);
	});

	it('stops at maxStage and drops any remainder', () => {
		const result = advanceLadder(2, 5000, thresholds, 3);
		expect(result.stage).toBe(3);
		expect(result.banked).toBe(0);
		expect(result.crossed).toBe(1);
	});

	it('runs a side effect once per crossing, in order', () => {
		const seen: number[] = [];
		advanceLadder(0, 250, thresholds, 3, (stage) => seen.push(stage));
		expect(seen).toEqual([1, 2]);
	});
});
