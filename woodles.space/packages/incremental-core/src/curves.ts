import { num } from './num.js';
import type { Curve, CurveKind, Price } from './types.js';

/**
 * Every curve is normalized so `curveAt(curve, base, 1) === base`. That one
 * rule is what makes the four kinds interchangeable in the inspector: you can
 * switch a generator from geometric to polynomial and its level-1 behaviour
 * doesn't move, only its shape past that.
 */
export function curveAt(curve: Curve, base: number, level: number): number {
	switch (curve.kind) {
		case 'geometric':
			// A growth of 1 is a flat cost, and by far the most common thing an
			// author types before deciding on a real curve.
			return curve.growth === 1 ? base : num.mul(base, num.pow(curve.growth, level - 1));
		case 'linear':
			return num.add(base, num.mul(curve.slope, level - 1));
		case 'polynomial':
			// Exponent 1 is the plain "N × base" generator, evaluated once per
			// generator per tick across a whole run. `Math.pow(level, 1)` is a
			// surprisingly expensive way to write a multiply.
			if (curve.exponent === 1) return num.mul(base, level);
			if (curve.exponent === 2) return num.mul(base, num.mul(level, level));
			return num.mul(base, num.pow(level, curve.exponent));
		case 'steps': {
			let value = base;
			for (const breakpoint of curve.breakpoints) {
				if (level >= breakpoint.level) value = num.mul(value, breakpoint.multiplier);
			}
			return value;
		}
		default:
			return assertNever(curve);
	}
}

/**
 * What the next level costs when `owned` levels are already held. Buying the
 * first level costs exactly `price.base`, which is the only reading of "base"
 * an author will expect.
 */
export function nextLevelCost(price: Price, owned: number): number {
	return curveAt(price.curve, price.base, owned + 1);
}

/**
 * Total cost of buying from `owned` up to `owned + count`. Summed rather than
 * closed-form: the steps curve has no closed form, and bulk buys in the editor
 * are small enough that the loop is free.
 */
export function bulkCost(price: Price, owned: number, count: number): number {
	let total = 0;
	for (let i = 0; i < count; i += 1) total = num.add(total, nextLevelCost(price, owned + i));
	return total;
}

/**
 * A generator's own output at a level, before upgrades and prestige. Level 0
 * produces nothing — an unowned generator is not a slow generator.
 */
export function generatorBaseOutput(baseRate: number, rateCurve: Curve, level: number): number {
	if (level <= 0) return 0;
	return curveAt(rateCurve, baseRate, level);
}

/** Sensible starting curve when the editor creates an entity of each kind. */
export function defaultCurve(kind: CurveKind): Curve {
	switch (kind) {
		case 'geometric':
			return { kind: 'geometric', growth: 1.15 };
		case 'linear':
			return { kind: 'linear', slope: 1 };
		case 'polynomial':
			return { kind: 'polynomial', exponent: 1 };
		case 'steps':
			return { kind: 'steps', breakpoints: [{ level: 25, multiplier: 2 }] };
		default:
			return assertNever(kind);
	}
}

export const CURVE_KINDS: CurveKind[] = ['geometric', 'linear', 'polynomial', 'steps'];

/** One-line human description, used by the inspector and by validation messages. */
export function describeCurve(curve: Curve): string {
	switch (curve.kind) {
		case 'geometric':
			return `× ${curve.growth} per level`;
		case 'linear':
			return `+ ${curve.slope} per level`;
		case 'polynomial':
			return `× level^${curve.exponent}`;
		case 'steps':
			return curve.breakpoints.length
				? curve.breakpoints.map((b) => `×${b.multiplier} at ${b.level}`).join(', ')
				: 'no breakpoints';
		default:
			return assertNever(curve);
	}
}

function assertNever(value: never): never {
	throw new Error(`unhandled curve: ${JSON.stringify(value)}`);
}
