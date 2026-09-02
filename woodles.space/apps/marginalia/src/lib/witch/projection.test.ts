import { describe, expect, it } from 'vitest';
import {
	FLOOR_FOCAL,
	FLOOR_HEIGHT_UNIT,
	FLOOR_HORIZON_Y,
	FOG_MAX,
	SCENE_FAR_Z,
	SEDIMENT_BAND_TOP,
	floorDepthAtY,
	floorDepthScale,
	floorPlaneY,
	byDepth,
	floorXScale,
	fogAlpha,
	projectFloor,
	sceneDepthFromSeed,
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

describe('scene depth and fog', () => {
	it('keeps the water column in front of the floor plane it shares an axis with', () => {
		expect(sceneDepthFromSeed(0)).toBeCloseTo(SCENE_FAR_Z);
		expect(sceneDepthFromSeed(1)).toBeCloseTo(1);
		expect(SCENE_FAR_Z).toBeGreaterThan(0);
	});

	it('spreads points through the volume rather than onto one pane', () => {
		const seeds = [0.05, 0.3, 0.62, 0.95].map(sceneDepthFromSeed);
		expect(new Set(seeds).size).toBe(4);
		for (const z of seeds) {
			expect(z).toBeGreaterThanOrEqual(SCENE_FAR_Z);
			expect(z).toBeLessThanOrEqual(1);
		}
	});

	it('clears the fog at the near edge and lands on FOG_MAX at the far one', () => {
		expect(fogAlpha(1)).toBeCloseTo(0);
		expect(fogAlpha(0)).toBeCloseTo(FOG_MAX);
	});

	it('thickens monotonically with distance', () => {
		let previous = -Infinity;
		for (let i = 10; i >= 0; i--) {
			const a = fogAlpha(i / 10);
			expect(a).toBeGreaterThan(previous);
			previous = a;
		}
	});

	it('never fogs anything to invisibility', () => {
		expect(fogAlpha(0)).toBeLessThan(0.6);
	});
});

describe('depth ordering', () => {
	it('sorts back to front, so nearer things are painted last', () => {
		const items = [{ z: 0.9 }, { z: 0.35 }, { z: 1 }, { z: 0.6 }];
		expect([...items].sort(byDepth).map((i) => i.z)).toEqual([0.35, 0.6, 0.9, 1]);
	});

	it('is stable enough to leave co-located things in collection order', () => {
		const a = { z: 0.5, tag: 'a' };
		const b = { z: 0.5, tag: 'b' };
		expect([a, b].sort(byDepth).map((i) => i.tag)).toEqual(['a', 'b']);
	});
});

describe('height above the plane', () => {
	it('leaves the floor itself where the plane is', () => {
		expect(projectFloor(0.5, 0.5, 0).y).toBeCloseTo(floorPlaneY(0.5));
	});

	it('raises silt toward the viewer, never below the floor', () => {
		const flat = projectFloor(0.5, 0.6, 0).y;
		const mound = projectFloor(0.5, 0.6, 1).y;
		expect(mound).toBeLessThan(flat);
		expect(flat - mound).toBeCloseTo(FLOOR_HEIGHT_UNIT * floorDepthScale(0.6));
	});

	it('foreshortens height, so the same mound rises less at the back', () => {
		const near = projectFloor(0.5, 1, 1);
		const far = projectFloor(0.5, 0, 1);
		expect(floorPlaneY(1) - near.y).toBeGreaterThan(floorPlaneY(0) - far.y);
	});

	it('does not move a raised point sideways', () => {
		expect(projectFloor(0.3, 0.4, 0.8).x).toBeCloseTo(projectFloor(0.3, 0.4, 0).x);
	});

	// The mound has to stay in the floor's own band; silt climbing into the open
	// water would break the composition A was careful to preserve.
	it('keeps a full mound inside the frame', () => {
		for (let i = 0; i <= 10; i++) {
			const y = projectFloor(0.5, i / 10, 1).y;
			expect(y).toBeGreaterThan(0.5);
			expect(y).toBeLessThanOrEqual(1);
		}
	});
});
