import { describe, expect, it } from 'vitest';
import { comboMultiplier, nextComboLevel } from './comboMeter.js';

const opts = { windowSeconds: 2.2, stepBonus: 0.09, maxLevel: 6 };

describe('nextComboLevel', () => {
	it('starts a streak at 1 on the first click', () => {
		expect(nextComboLevel(0, 0, 1000, opts)).toBe(1);
	});

	it('continues the streak for a click inside the window', () => {
		expect(nextComboLevel(1, 1000, 2000, opts)).toBe(2); // 1s gap
	});

	it('resets to 1 for a click outside the window', () => {
		expect(nextComboLevel(4, 1000, 5000, opts)).toBe(1); // 4s gap
	});

	it('caps at maxLevel', () => {
		expect(nextComboLevel(6, 1000, 1500, opts)).toBe(6);
	});
});

describe('comboMultiplier', () => {
	it('is 1 at level 1', () => {
		expect(comboMultiplier(1, opts)).toBe(1);
	});

	it('rises by stepBonus per level beyond the first', () => {
		expect(comboMultiplier(3, opts)).toBeCloseTo(1.18, 10);
	});

	it('caps at maxLevel even if handed a higher level', () => {
		expect(comboMultiplier(99, opts)).toBeCloseTo(comboMultiplier(6, opts), 10);
	});
});
