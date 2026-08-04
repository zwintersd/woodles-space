import { describe, expect, it } from 'vitest';
import { formatNumber, num } from './num.js';
import type { NumberFormat } from './types.js';

const format = (notation: NumberFormat['notation'], decimalPlaces = 2): NumberFormat => ({
	decimalPlaces,
	notation
});

describe('formatting', () => {
	it('leaves small numbers alone in every notation', () => {
		expect(formatNumber(12.5, format('plain'))).toBe('12.50');
		expect(formatNumber(12.5, format('thousands'))).toBe('12.50');
		expect(formatNumber(12.5, format('letters'))).toBe('12.50');
	});

	it('steps the short scale by thousands', () => {
		expect(formatNumber(1234.56, format('thousands'))).toBe('1.23K');
		expect(formatNumber(1_230_000, format('thousands'))).toBe('1.23M');
		expect(formatNumber(1.23e9, format('thousands'))).toBe('1.23B');
		expect(formatNumber(1.23e12, format('thousands'))).toBe('1.23T');
	});

	it('uses letters past a thousand', () => {
		expect(formatNumber(1234, format('letters'))).toBe('1.23a');
		expect(formatNumber(1.23e6, format('letters'))).toBe('1.23b');
		expect(formatNumber(1.23e78, format('letters'))).toBe('1.23z');
		expect(formatNumber(1.23e81, format('letters'))).toBe('1.23aa');
	});

	it('falls back to scientific rather than inventing a suffix', () => {
		// A wrong suffix is worse than an honest exponent — the short scale runs
		// out long before a double does.
		expect(formatNumber(1e40, format('thousands'))).toBe('1.00e40');
		expect(formatNumber(1.5e45, format('scientific'))).toBe('1.50e45');
	});

	it('does not round a value up into the wrong tier', () => {
		// 999999.9 is a hair under 1M; showing "1000.00K" would be embarrassing.
		expect(formatNumber(999_999.9, format('thousands'))).toBe('1.00M');
		expect(formatNumber(999_499, format('thousands'))).toBe('999.50K');
	});

	it('keeps the sign and respects decimal places', () => {
		expect(formatNumber(-1500, format('thousands'))).toBe('-1.50K');
		expect(formatNumber(1500, format('thousands', 0))).toBe('2K');
		expect(formatNumber(1500, format('plain', 0))).toBe('1500');
		expect(formatNumber(0, format('thousands'))).toBe('0.00');
	});

	it('says something sane about values that are not numbers', () => {
		expect(formatNumber(Infinity, format('thousands'))).toBe('∞');
		expect(formatNumber(-Infinity, format('thousands'))).toBe('-∞');
		expect(formatNumber(NaN, format('thousands'))).toBe('—');
	});

	it('clamps nonsense decimal places instead of throwing', () => {
		expect(formatNumber(1.5, format('plain', -3))).toBe('2');
		expect(formatNumber(1.5, format('plain', 99))).not.toBe('');
	});
});

describe('the arithmetic facade', () => {
	it('routes the operations the engine uses', () => {
		// The point of these is not the arithmetic — it is that every call site
		// goes through one module, so swapping the number type is one file.
		expect(num.add(1, 2)).toBe(3);
		expect(num.sub(5, 2)).toBe(3);
		expect(num.mul(3, 4)).toBe(12);
		expect(num.div(12, 4)).toBe(3);
		expect(num.pow(2, 10)).toBe(1024);
		expect(num.floor(3.9)).toBe(3);
		expect(num.max(3, 7)).toBe(7);
		expect(num.min(3, 7)).toBe(3);
	});

	it('compares without leaking operators into the engine', () => {
		expect(num.gte(3, 3)).toBe(true);
		expect(num.gt(3, 3)).toBe(false);
		expect(num.lte(2, 3)).toBe(true);
		expect(num.lt(3, 3)).toBe(false);
		expect(num.eq(3, 3)).toBe(true);
	});
});
