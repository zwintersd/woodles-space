import { describe, expect, it } from 'vitest';
import {
	axialToPoint,
	hexDistance,
	hexNeighbors,
	hexesWithinRadius,
	pointToHex,
	rotate
} from './arcadeMath';

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
