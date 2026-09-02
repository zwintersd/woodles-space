import { describe, expect, it } from 'vitest';
import {
	FLOOR_FOCAL,
	FLOOR_HORIZON_Y,
	SEDIMENT_BAND_TOP,
	floorDepthAtY,
	floorDepthScale,
	floorPlaneY,
	floorXScale,
	projectFloor,
	unprojectFloor
} from './projection';

describe('the floor plane', () => {
	// The composition guarantee. Everything written against SEDIMENT_BAND_TOP —
	// drawShallowsShelf's anchor, the pour's hit-test range, worldShape's own
	// helpers — stays correct only because the plane still ends where the band did.
	it('keeps the floor band exactly where it was', () => {
		expect(floorPlaneY(0)).toBeCloseTo(SEDIMENT_BAND_TOP);
		expect(floorPlaneY(1)).toBeCloseTo(1);
	});

	it('puts the horizon above the band, so the far rows have somewhere to compress to', () => {
		expect(FLOOR_HORIZON_Y).toBeLessThan(SEDIMENT_BAND_TOP);
	});

	it('recedes monotonically', () => {
		let previous = -Infinity;
		for (let i = 0; i <= 20; i++) {
			const y = floorPlaneY(i / 20);
			expect(y).toBeGreaterThan(previous);
			previous = y;
		}
	});

	it('compresses far rows and opens near ones', () => {
		const far = floorPlaneY(1 / 12) - floorPlaneY(0);
		const near = floorPlaneY(1) - floorPlaneY(11 / 12);
		expect(near).toBeGreaterThan(far * 3);
	});

	it('foreshortens toward the far edge', () => {
		expect(floorDepthScale(1)).toBeCloseTo(1);
		expect(floorDepthScale(0)).toBeCloseTo(1 / (1 + FLOOR_FOCAL));
		expect(floorDepthScale(0.5)).toBeLessThan(floorDepthScale(0.75));
	});

	it('converges x toward the vanishing point, but not all the way', () => {
		expect(floorXScale(1)).toBeCloseTo(1);
		expect(floorXScale(0)).toBeLessThan(1);
		// a full-convergence plane would be a triangle; this one is a wide wedge.
		expect(floorXScale(0)).toBeGreaterThan(0.5);
	});

	it('leaves the near edge unconverged, so nothing shifts at the front of the frame', () => {
		expect(projectFloor(0.2, 1).x).toBeCloseTo(0.2);
		expect(projectFloor(0.8, 1).x).toBeCloseTo(0.8);
	});

	it('pulls the far edge toward center', () => {
		expect(projectFloor(0.1, 0).x).toBeGreaterThan(0.1);
		expect(projectFloor(0.9, 0).x).toBeLessThan(0.9);
		expect(projectFloor(0.5, 0).x).toBeCloseTo(0.5);
	});
});

describe('unprojecting', () => {
	it('round-trips through the projection', () => {
		for (const x of [0.15, 0.5, 0.85]) {
			for (const z of [0, 0.3, 0.7, 1]) {
				const projected = projectFloor(x, z);
				const back = unprojectFloor(projected.x, projected.y);
				expect(back).not.toBeNull();
				expect(back!.x).toBeCloseTo(x);
				expect(back!.z).toBeCloseTo(z);
			}
		}
	});

	it('rejects points off the plane, on the same range the band always used', () => {
		expect(floorDepthAtY(SEDIMENT_BAND_TOP - 0.01)).toBeNull();
		expect(floorDepthAtY(1.01)).toBeNull();
		expect(unprojectFloor(0.5, 0.2)).toBeNull();
		expect(floorDepthAtY(SEDIMENT_BAND_TOP)).toBeCloseTo(0);
		expect(floorDepthAtY(1)).toBeCloseTo(1);
	});

	// The reason pointerToWaterPoint can't just pass the raw canvas x through: the
	// near edge of the frame is wider than the far edge of the world, so the same
	// pixel column is a different column of silt depending on how far back you are.
	it('maps the same screen column to different world columns by depth', () => {
		const near = unprojectFloor(0.1, floorPlaneY(1))!;
		const far = unprojectFloor(0.1, floorPlaneY(0))!;
		expect(near.x).toBeCloseTo(0.1);
		expect(far.x).toBeLessThan(near.x);
	});

	it('clamps a click past the far edge of the world back into it', () => {
		const corner = unprojectFloor(0, floorPlaneY(0))!;
		expect(corner.x).toBe(0);
		expect(unprojectFloor(1, floorPlaneY(0))!.x).toBe(1);
	});
});
