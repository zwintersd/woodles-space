import { describe, expect, it } from 'vitest';
import { pushSample, trend, sparklinePoints } from './history';
import { STOCK_HISTORY_LENGTH } from './tuning';

describe('pushSample', () => {
	it('appends a sample', () => {
		expect(pushSample([1, 2], 3)).toEqual([1, 2, 3]);
	});

	it('does not mutate the input array', () => {
		const original = [1, 2];
		pushSample(original, 3);
		expect(original).toEqual([1, 2]);
	});

	it('caps at STOCK_HISTORY_LENGTH, dropping the oldest', () => {
		const full = Array.from({ length: STOCK_HISTORY_LENGTH }, (_, i) => i);
		const next = pushSample(full, 999);
		expect(next.length).toBe(STOCK_HISTORY_LENGTH);
		expect(next[0]).toBe(1);
		expect(next[next.length - 1]).toBe(999);
	});
});

describe('trend', () => {
	it('reads flat with fewer than two samples', () => {
		expect(trend([])).toBe(0);
		expect(trend([50])).toBe(0);
	});

	it('reads rising when the tail is well above the head', () => {
		expect(trend([50, 55, 60, 70])).toBe(1);
	});

	it('reads falling when the tail is well below the head', () => {
		expect(trend([70, 60, 55, 50])).toBe(-1);
	});

	it('reads flat for small wobbles under the epsilon', () => {
		expect(trend([50, 50.5, 50.2, 50.8])).toBe(0);
	});
});

describe('sparklinePoints', () => {
	it('draws a flat mid-line for an empty series', () => {
		expect(sparklinePoints([], 60, 18)).toBe('0,9 60,9');
	});

	it('draws a flat mid-line for a single sample', () => {
		expect(sparklinePoints([42], 60, 18)).toBe('0,9 60,9');
	});

	it('produces one point pair per sample', () => {
		const points = sparklinePoints([10, 20, 30], 60, 18);
		expect(points.split(' ')).toHaveLength(3);
	});

	it('does not divide by zero for a perfectly flat series', () => {
		expect(() => sparklinePoints([50, 50, 50], 60, 18)).not.toThrow();
		const points = sparklinePoints([50, 50, 50], 60, 18);
		expect(points).toBeTruthy();
	});

	it('maps the lowest value to the bottom and highest to the top', () => {
		const points = sparklinePoints([0, 100], 60, 18);
		const [first, second] = points.split(' ').map((p) => p.split(',').map(Number));
		expect(first[1]).toBeCloseTo(18, 1); // low value -> bottom (y = h)
		expect(second[1]).toBeCloseTo(0, 1); // high value -> top (y = 0)
	});
});
