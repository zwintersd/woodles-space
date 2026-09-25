import { describe, expect, it } from 'vitest';
import { accrue, factorFor } from './tallyFactorAccrual.js';

describe('factorFor', () => {
	it('is 1 at zero tally and 0 once the tally reaches the cap', () => {
		expect(factorFor(0, { cap: 1.2 })).toBe(1);
		expect(factorFor(1.2, { cap: 1.2 })).toBe(0);
		expect(factorFor(2.4, { cap: 1.2 })).toBe(0); // never negative past the cap
	});

	it('falls linearly with the tally', () => {
		expect(factorFor(0.6, { cap: 1.2 })).toBeCloseTo(0.5, 10);
	});

	it('is zeroed by an independent gate regardless of the tally', () => {
		expect(factorFor(0, { cap: 1.2, gate: false })).toBe(0);
	});
});

describe('accrue', () => {
	it('does not bank at or below the minimum factor', () => {
		expect(accrue(10, 0.5, 5, 0.5)).toBe(10);
		expect(accrue(10, 0.3, 5, 0.5)).toBe(10);
	});

	it('banks factor times dt once the factor clears the minimum', () => {
		expect(accrue(10, 0.8, 5, 0.5)).toBeCloseTo(14, 10);
	});
});
