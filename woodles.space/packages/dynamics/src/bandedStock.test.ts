import { describe, expect, it } from 'vitest';
import { bandHealth, driftRate, leakRate, stepStock } from './bandedStock.js';

const band = { lo: 40, hi: 80 };

describe('driftRate', () => {
	it('is zero anywhere inside the band', () => {
		expect(driftRate(40, band, 0.5)).toBe(0);
		expect(driftRate(60, band, 0.5)).toBe(0);
		expect(driftRate(80, band, 0.5)).toBe(0);
	});

	it('pulls toward the near edge, proportional to distance, once outside', () => {
		expect(driftRate(30, band, 0.5)).toBe(5); // 10 points under lo, rate 0.5
		expect(driftRate(100, band, 0.5)).toBe(-10); // 20 points over hi
	});
});

describe('leakRate', () => {
	it('is zero at or under the floor', () => {
		expect(leakRate(40, 40, 0.1)).toBe(0);
		expect(leakRate(30, 40, 0.1)).toBe(0);
	});

	it('is negative, proportional to distance above the floor', () => {
		expect(leakRate(60, 40, 0.1)).toBeCloseTo(-2, 10);
	});
});

describe('stepStock', () => {
	it('holds exactly still at the band floor with no input — leak is zero there too', () => {
		expect(stepStock(40, band, 0, 10, { driftPerSec: 0.005, leakPerSec: 0.006 })).toBe(40);
	});

	it('still leaks toward the floor from inside the band — the band only silences drift, not leak', () => {
		const next = stepStock(60, band, 0, 10, { driftPerSec: 0.005, leakPerSec: 0.006 });
		expect(next).toBeLessThan(60);
		expect(next).toBeGreaterThan(40);
	});

	it('settles at the floor — leak keeps pulling until it reaches it, then stops', () => {
		let value = 60;
		for (let i = 0; i < 1000; i += 1) {
			value = stepStock(value, band, 0, 1, { driftPerSec: 0.005, leakPerSec: 0.006, min: 0, max: 100 });
		}
		expect(value).toBeGreaterThan(40);
		expect(value).toBeLessThan(40.1);
	});

	it('clamps to the hard min/max', () => {
		expect(stepStock(99, band, 50, 1, { driftPerSec: 0.005, leakPerSec: 0.006, max: 100 })).toBe(100);
		expect(stepStock(1, band, -50, 1, { driftPerSec: 0.005, leakPerSec: 0.006, min: 0 })).toBe(0);
	});
});

describe('bandHealth', () => {
	it('is 100 anywhere inside the band', () => {
		expect(bandHealth(55, band, 25)).toBe(100);
	});

	it('falls linearly to 0 at the falloff distance outside the band', () => {
		expect(bandHealth(80 + 25, band, 25)).toBe(0);
		expect(bandHealth(80 + 12.5, band, 25)).toBeCloseTo(50, 6);
	});
});
