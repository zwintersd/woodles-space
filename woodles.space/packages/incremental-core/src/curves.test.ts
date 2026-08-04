import { describe, expect, it } from 'vitest';
import { bulkCost, curveAt, defaultCurve, describeCurve, generatorBaseOutput, nextLevelCost } from './curves.js';
import type { Curve } from './types.js';

describe('curve evaluation', () => {
	it('makes every kind evaluate to exactly the base at level 1', () => {
		// This is the invariant the whole schema leans on: swapping a curve kind
		// in the inspector must not move an entity's level-1 behaviour, only its
		// shape past that.
		const kinds: Curve[] = [
			{ kind: 'geometric', growth: 1.14 },
			{ kind: 'linear', slope: 7 },
			{ kind: 'polynomial', exponent: 2.5 },
			{ kind: 'steps', breakpoints: [{ level: 25, multiplier: 2 }] }
		];
		for (const curve of kinds) expect(curveAt(curve, 42, 1), curve.kind).toBe(42);
	});

	it('grows geometrically by the growth factor', () => {
		const curve: Curve = { kind: 'geometric', growth: 2 };
		expect(curveAt(curve, 10, 1)).toBe(10);
		expect(curveAt(curve, 10, 2)).toBe(20);
		expect(curveAt(curve, 10, 5)).toBe(160);
	});

	it('adds the slope once per level beyond the first', () => {
		const curve: Curve = { kind: 'linear', slope: 3 };
		expect(curveAt(curve, 10, 1)).toBe(10);
		expect(curveAt(curve, 10, 2)).toBe(13);
		expect(curveAt(curve, 10, 10)).toBe(37);
	});

	it('raises the level to the exponent', () => {
		expect(curveAt({ kind: 'polynomial', exponent: 1 }, 4.8, 25)).toBeCloseTo(120, 10);
		expect(curveAt({ kind: 'polynomial', exponent: 2 }, 3, 4)).toBe(48);
		expect(curveAt({ kind: 'polynomial', exponent: 0.5 }, 100, 9)).toBe(300);
	});

	it('compounds every step whose breakpoint has been passed', () => {
		const curve: Curve = {
			kind: 'steps',
			breakpoints: [
				{ level: 25, multiplier: 2 },
				{ level: 50, multiplier: 2 },
				{ level: 100, multiplier: 3 }
			]
		};
		expect(curveAt(curve, 10, 24)).toBe(10);
		expect(curveAt(curve, 10, 25)).toBe(20);
		expect(curveAt(curve, 10, 49)).toBe(20);
		expect(curveAt(curve, 10, 50)).toBe(40);
		expect(curveAt(curve, 10, 100)).toBe(120);
	});
});

describe('prices', () => {
	const price = { currencyId: 'p', base: 15, curve: { kind: 'geometric', growth: 2 } as Curve };

	it('charges exactly the base for the first level', () => {
		expect(nextLevelCost(price, 0)).toBe(15);
	});

	it('charges the curve value for the level being bought', () => {
		expect(nextLevelCost(price, 1)).toBe(30);
		expect(nextLevelCost(price, 3)).toBe(120);
	});

	it('sums a bulk buy level by level', () => {
		// 15 + 30 + 60 — a closed form would be wrong for the steps curve, which
		// is exactly why this loops.
		expect(bulkCost(price, 0, 3)).toBe(105);
		expect(bulkCost(price, 0, 0)).toBe(0);
	});
});

describe('generator output', () => {
	it('produces nothing at level zero', () => {
		// An unowned generator is not a slow generator.
		expect(generatorBaseOutput(100, { kind: 'polynomial', exponent: 1 }, 0)).toBe(0);
		expect(generatorBaseOutput(100, { kind: 'polynomial', exponent: 1 }, -3)).toBe(0);
	});

	it('produces the base rate at level one', () => {
		expect(generatorBaseOutput(4.8, { kind: 'polynomial', exponent: 1 }, 1)).toBe(4.8);
	});
});

describe('curve helpers', () => {
	it('offers a sensible default per kind, all valid at level 1', () => {
		for (const kind of ['geometric', 'linear', 'polynomial', 'steps'] as const) {
			expect(curveAt(defaultCurve(kind), 5, 1), kind).toBe(5);
		}
	});

	it('describes each kind in one line', () => {
		expect(describeCurve({ kind: 'geometric', growth: 1.15 })).toBe('× 1.15 per level');
		expect(describeCurve({ kind: 'linear', slope: 2 })).toBe('+ 2 per level');
		expect(describeCurve({ kind: 'polynomial', exponent: 2 })).toBe('× level^2');
		expect(describeCurve({ kind: 'steps', breakpoints: [{ level: 25, multiplier: 2 }] })).toBe('×2 at 25');
		expect(describeCurve({ kind: 'steps', breakpoints: [] })).toBe('no breakpoints');
	});
});
