import type { NumberFormat, Notation } from './types.js';

/**
 * Every piece of arithmetic in the engine goes through this module, including
 * the comparisons. That looks like ceremony while the underlying type is
 * `number` — and it is — but it's the difference between "swap in
 * break_eternity.js" being one file and being a codebase sweep. The day a
 * design needs values past ~1e308, only this file changes.
 *
 * Formatting lives here too, because turning a magnitude into text is the same
 * concern: it has to know what the underlying representation is.
 */

export type Num = number;

export const num = {
	of: (value: number): Num => value,
	toNumber: (value: Num): number => value,

	add: (a: Num, b: Num): Num => a + b,
	sub: (a: Num, b: Num): Num => a - b,
	mul: (a: Num, b: Num): Num => a * b,
	div: (a: Num, b: Num): Num => a / b,
	pow: (base: Num, exponent: number): Num => Math.pow(base, exponent),
	floor: (value: Num): Num => Math.floor(value),
	max: (a: Num, b: Num): Num => (a > b ? a : b),
	min: (a: Num, b: Num): Num => (a < b ? a : b),

	gte: (a: Num, b: Num): boolean => a >= b,
	gt: (a: Num, b: Num): boolean => a > b,
	lte: (a: Num, b: Num): boolean => a <= b,
	lt: (a: Num, b: Num): boolean => a < b,
	eq: (a: Num, b: Num): boolean => a === b,

	isFinite: (value: Num): boolean => Number.isFinite(value),

	format: (value: Num, format: NumberFormat): string => formatNumber(value, format)
};

/** 1e3-stepped short scale. Past this the value has earned scientific notation. */
const THOUSAND_SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function formatNumber(value: number, format: NumberFormat): string {
	const places = clampPlaces(format.decimalPlaces);

	if (!Number.isFinite(value)) return value > 0 ? '∞' : Number.isNaN(value) ? '—' : '-∞';

	const sign = value < 0 ? '-' : '';
	const magnitude = Math.abs(value);

	switch (format.notation) {
		case 'plain':
			return sign + fixed(magnitude, places);
		case 'scientific':
			return sign + scientific(magnitude, places);
		case 'thousands':
			return sign + tiered(magnitude, places, thousandsSuffix);
		case 'letters':
			return sign + tiered(magnitude, places, letterSuffix);
		default:
			return sign + fixed(magnitude, places);
	}
}

/**
 * Below 1000 nothing is abbreviated, so small numbers stay readable; above it,
 * step down by thousands and let `suffixFor` name the tier. A tier with no name
 * (past the end of the short scale, past 'zz') falls back to scientific — a
 * wrong suffix is worse than an honest exponent.
 */
function tiered(magnitude: number, places: number, suffixFor: (tier: number) => string | null): string {
	if (magnitude < 1000) return fixed(magnitude, places);

	const tier = Math.floor(Math.log10(magnitude) / 3);
	const suffix = suffixFor(tier);
	if (suffix === null) return scientific(magnitude, places);

	// Recompute rather than dividing repeatedly: floating error compounds fast
	// at high tiers, and a balance readout that drifts is a balance readout
	// nobody trusts.
	const scaled = magnitude / Math.pow(1000, tier);
	// Rounding, not scaling, is what pushes a value over the tier line: 999999.9
	// scales to 999.9999, which `fixed` renders as "1000.00". Test the rounded
	// text, or the readout says "1000.00K" where it means "1.00M".
	if (Number(fixed(scaled, places)) >= 1000) {
		const next = suffixFor(tier + 1);
		return next === null ? scientific(magnitude, places) : fixed(scaled / 1000, places) + next;
	}
	return fixed(scaled, places) + suffix;
}

function thousandsSuffix(tier: number): string | null {
	return tier < THOUSAND_SUFFIXES.length ? THOUSAND_SUFFIXES[tier] : null;
}

/** a = 1e3, b = 1e6, … z = 1e78, then aa, ab, … zz. */
function letterSuffix(tier: number): string | null {
	if (tier === 0) return '';
	const index = tier - 1;
	if (index < 26) return LETTERS[index];
	const second = index - 26;
	if (second < 26 * 26) return LETTERS[Math.floor(second / 26)] + LETTERS[second % 26];
	return null;
}

function scientific(magnitude: number, places: number): string {
	if (magnitude === 0) return fixed(0, places);
	const exponent = Math.floor(Math.log10(magnitude));
	const mantissa = magnitude / Math.pow(10, exponent);
	return `${fixed(mantissa, places)}e${exponent}`;
}

function fixed(value: number, places: number): string {
	return value.toFixed(places);
}

function clampPlaces(places: number): number {
	if (!Number.isFinite(places)) return 2;
	return Math.min(20, Math.max(0, Math.trunc(places)));
}

/** The default a new currency gets in the editor. */
export const DEFAULT_FORMAT: NumberFormat = { decimalPlaces: 2, notation: 'thousands' };

export const NOTATIONS: Notation[] = ['plain', 'thousands', 'scientific', 'letters'];
