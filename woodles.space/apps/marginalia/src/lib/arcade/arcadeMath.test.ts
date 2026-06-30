import { describe, expect, it } from 'vitest';
import {
	axialToPoint,
	cappedReward,
	clamp,
	hexDistance,
	hexNeighbors,
	hexesWithinRadius,
	pointToHex,
	rotate
} from './arcadeMath';

describe('clamp', () => {
	it('keeps in-range values unchanged', () => {
		expect(clamp(5, 0, 10)).toBe(5);
	});

	it('clamps below the minimum and above the maximum', () => {
		expect(clamp(-5, 0, 10)).toBe(0);
		expect(clamp(15, 0, 10)).toBe(10);
	});
});

describe('cappedReward', () => {
	it('floors negative raw rewards at zero', () => {
		expect(cappedReward(-10, 20)).toBe(0);
	});

	it('caps raw rewards at the max', () => {
		expect(cappedReward(99, 20)).toBe(20);
	});

	it('passes through in-range raw rewards', () => {
		expect(cappedReward(12, 20)).toBe(12);
	});
});

describe('arcade hex helpers', () => {
	it('round-trips pointy axial positions through screen space', () => {
		const hex = { q: 2, r: -1, s: -1 };
		const point = axialToPoint(hex, 21);

		expect(pointToHex(point, 21)).toEqual(hex);
	});

	it('returns the six adjacent cube neighbors', () => {
		const origin = { q: 0, r: 0, s: 0 };
		const neighbors = hexNeighbors(origin);

		expect(neighbors).toHaveLength(6);
		expect(neighbors.every((neighbor) => hexDistance(origin, neighbor) === 1)).toBe(true);
	});

	it('enumerates a closed hex radius', () => {
		expect(hexesWithinRadius(0)).toEqual([{ q: 0, r: 0, s: 0 }]);
		expect(hexesWithinRadius(2)).toHaveLength(19);
	});

	it('rotates vectors around the origin', () => {
		const rotated = rotate({ x: 1, y: 0 }, Math.PI / 2);

		expect(rotated.x).toBeCloseTo(0);
		expect(rotated.y).toBeCloseTo(1);
	});
});
