import { describe, expect, it } from 'vitest';
import { SEA_LEVEL } from './hex';
import { FIELD_COLS, FIELD_ROWS, TILE_ELEVATION_SCALE, fieldTiles, type FieldTile } from './hexField';
import {
	FOREST_MAX_HEIGHT,
	FOREST_MIN_HEIGHT,
	PEAK_MIN_HEIGHT,
	forestCoverage,
	heightAboveSea,
	landscapeFor,
	vigorOf,
	type LandscapeState
} from './landscape';
import { emptySedimentGrid } from './worldShape';

const HEALTHY: LandscapeState = {
	moistureHealth: 1,
	nutrientHealth: 1,
	stability: 100,
	complexity: 80,
	deaths: 0
};

/** A field of land tiles at one height, for exercising the rules without a grid. */
function flatLand(above: number): FieldTile[] {
	const elevation = SEA_LEVEL + above * (TILE_ELEVATION_SCALE - SEA_LEVEL);
	const tiles: FieldTile[] = [];
	for (let row = 0; row < FIELD_ROWS; row++) {
		for (let col = 0; col < FIELD_COLS; col++) {
			tiles.push({ col, row, q: col, r: row, homeCol: col, elevation, density: 1, land: true, edge: 1 });
		}
	}
	return tiles;
}

const treeCount = (tiles: FieldTile[], state: LandscapeState) =>
	landscapeFor(tiles, state).tiles.reduce((n, t) => n + t.trees.length, 0);

describe('forestCoverage', () => {
	it('is zero for plants whose needs are unmet', () => {
		expect(forestCoverage({ ...HEALTHY, moistureHealth: 0, nutrientHealth: 0 })).toBe(0);
	});

	it('never exceeds the cap', () => {
		expect(forestCoverage(HEALTHY)).toBeLessThanOrEqual(0.85);
		expect(forestCoverage(HEALTHY)).toBeGreaterThan(0.5);
	});

	it('rises with health, with stability, and falls with each death', () => {
		const base = { ...HEALTHY, moistureHealth: 0.7, nutrientHealth: 0.7, stability: 60 };
		expect(forestCoverage({ ...base, moistureHealth: 0.9, nutrientHealth: 0.9 })).toBeGreaterThan(forestCoverage(base));
		expect(forestCoverage({ ...base, stability: 90 })).toBeGreaterThan(forestCoverage(base));
		expect(forestCoverage({ ...base, deaths: 2 })).toBeLessThan(forestCoverage(base));
	});

	it('caps what loss can take, so a grieving world still has some forest', () => {
		expect(forestCoverage({ ...HEALTHY, deaths: 50 })).toBeCloseTo(forestCoverage({ ...HEALTHY, deaths: 5 }), 10);
		expect(forestCoverage({ ...HEALTHY, deaths: 50 })).toBeGreaterThan(0);
	});

	it('ignores oxygen: vigor is moisture and nutrients only', () => {
		expect(vigorOf({ moistureHealth: 1, nutrientHealth: 0 })).toBe(0.5);
	});
});

describe('landscapeFor — forests', () => {
	const grass = flatLand((FOREST_MIN_HEIGHT + FOREST_MAX_HEIGHT) / 2);

	it('puts trees on grass in a healthy world and none in a dead one', () => {
		expect(treeCount(grass, HEALTHY)).toBeGreaterThan(0);
		expect(treeCount(grass, { ...HEALTHY, moistureHealth: 0, nutrientHealth: 0 })).toBe(0);
	});

	it('is deterministic', () => {
		expect(landscapeFor(grass, HEALTHY)).toEqual(landscapeFor(grass, HEALTHY));
	});

	it('grows by adding tiles: every forested tile stays forested as the world improves', () => {
		const weak = { ...HEALTHY, moistureHealth: 0.6, nutrientHealth: 0.6 };
		const forested = (s: LandscapeState) =>
			new Set(landscapeFor(grass, s).tiles.filter((t) => t.trees.length).map((t) => `${t.col}:${t.row}`));
		const before = forested(weak);
		const after = forested(HEALTHY);
		expect(before.size).toBeGreaterThan(0);
		expect(after.size).toBeGreaterThan(before.size);
		for (const id of before) expect(after.has(id)).toBe(true);
	});

	it('keeps trees off the shoreline sand and off the high ground', () => {
		expect(treeCount(flatLand(0.02), HEALTHY)).toBe(0);
		expect(treeCount(flatLand(0.8), HEALTHY)).toBe(0);
	});

	it('never puts trees and a peak on the same tile', () => {
		for (const above of [0.05, 0.3, 0.58, 0.6, 0.9]) {
			for (const t of landscapeFor(flatLand(above), HEALTHY).tiles) {
				expect(Boolean(t.trees.length) && Boolean(t.peak)).toBe(false);
			}
		}
	});

	it('leaves open water and the faded rim bare', () => {
		const water: FieldTile[] = flatLand(0.3).map((t) => ({ ...t, land: false }));
		const rim: FieldTile[] = flatLand(0.3).map((t) => ({ ...t, edge: 0 }));
		expect(landscapeFor(water, HEALTHY).tiles).toEqual([]);
		expect(landscapeFor(rim, HEALTHY).tiles).toEqual([]);
	});

	it('carries the rim fade so what stands on a faded tile can fade with it', () => {
		const rim = flatLand(0.3).map((t) => ({ ...t, edge: 0.4 }));
		const tiles = landscapeFor(rim, HEALTHY).tiles;
		expect(tiles.length).toBeGreaterThan(0);
		for (const tile of tiles) expect(tile.edge).toBe(0.4);
	});

	it('gives each tree a position inside its tile', () => {
		for (const tile of landscapeFor(grass, HEALTHY).tiles) {
			expect(tile.trees.length).toBeLessThanOrEqual(3);
			for (const t of tile.trees) {
				expect(Math.abs(t.dx)).toBeLessThanOrEqual(0.28);
				expect(Math.abs(t.dy)).toBeLessThanOrEqual(0.2);
				expect(t.size).toBeGreaterThanOrEqual(0.7);
				expect(t.size).toBeLessThanOrEqual(1.15);
			}
		}
	});
});

describe('landscapeFor — mountains', () => {
	const high = flatLand(0.9);
	const peaks = (s: LandscapeState, field = high) =>
		landscapeFor(field, s).tiles.filter((t) => t.peak).map((t) => t.peak!);
	const tallest = (s: LandscapeState) => Math.max(...peaks(s).map((p) => p.height));

	it('stands on the high ground only', () => {
		expect(landscapeFor(flatLand(PEAK_MIN_HEIGHT - 0.02), HEALTHY).tiles.every((t) => !t.peak)).toBe(true);
		expect(peaks(HEALTHY).length).toBeGreaterThan(0);
	});

	it('does not raise a peak on every tile of high ground, and raises more where it is higher', () => {
		const tiles = FIELD_COLS * FIELD_ROWS;
		const low = peaks(HEALTHY, flatLand(PEAK_MIN_HEIGHT + 0.01)).length;
		const top = peaks(HEALTHY, flatLand(1)).length;
		expect(low).toBeGreaterThan(0);
		expect(low).toBeLessThan(top);
		expect(top).toBeLessThan(tiles);
	});

	it('follows live complexity, so losing life lowers the range', () => {
		const rich = tallest({ ...HEALTHY, complexity: 80 });
		const poor = tallest({ ...HEALTHY, complexity: 30 });
		const bare = tallest({ ...HEALTHY, complexity: 0 });
		expect(rich).toBeGreaterThan(poor);
		expect(poor).toBeGreaterThan(bare);
		expect(bare).toBeGreaterThan(0); // a low rise, never nothing
		expect(rich).toBeLessThanOrEqual(1);
	});

	it('carries snow only in a complex world, and only on the highest ground', () => {
		const snow = (s: LandscapeState, above: number) =>
			Math.max(...peaks(s, flatLand(above)).map((p) => p.snow));
		expect(snow({ ...HEALTHY, complexity: 80 }, 0.95)).toBeGreaterThan(0.9);
		expect(snow({ ...HEALTHY, complexity: 40 }, 0.95)).toBe(0);
		expect(snow({ ...HEALTHY, complexity: 80 }, 0.7)).toBe(0);
	});

	it('does not depend on the plants: stress thins forests, not mountains', () => {
		const starved = { ...HEALTHY, moistureHealth: 0, nutrientHealth: 0 };
		expect(tallest(starved)).toBe(tallest(HEALTHY));
	});
});

describe('landscapeFor — a real world', () => {
	it('draws nothing on an untouched seabed', () => {
		expect(landscapeFor(fieldTiles(emptySedimentGrid()), HEALTHY).tiles).toEqual([]);
	});

	it('reads the same height scale the field does', () => {
		expect(heightAboveSea(SEA_LEVEL)).toBe(0);
		expect(heightAboveSea(TILE_ELEVATION_SCALE)).toBe(1);
		expect(heightAboveSea(SEA_LEVEL - 1)).toBe(0);
	});
});
