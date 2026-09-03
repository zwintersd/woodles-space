import { describe, expect, it } from 'vitest';
import { SEA_LEVEL, projectHex } from './hex';
import {
	FIELD_COLS,
	FIELD_ROWS,
	SEABED_ALPHA,
	edgeFalloff,
	TILE_ELEVATION_SCALE,
	fieldOrigin,
	fieldTiles,
	tileAtPoint,
	tileElevation,
	tileSample
} from './hexField';
import { SEDIMENT_GRID_H, SEDIMENT_GRID_W, type SedimentGrid } from './worldShape';

const gridOf = (fill: (u: number, v: number) => number): SedimentGrid => {
	const cells: number[] = [];
	for (let y = 0; y < SEDIMENT_GRID_H; y++) {
		for (let x = 0; x < SEDIMENT_GRID_W; x++) {
			cells.push(fill(x / (SEDIMENT_GRID_W - 1), y / (SEDIMENT_GRID_H - 1)));
		}
	}
	return { w: SEDIMENT_GRID_W, h: SEDIMENT_GRID_H, cells };
};

const empty = gridOf(() => 0);
const full = gridOf(() => 1);

describe('the field over the grid', () => {
	it('covers the whole density field, corner to corner', () => {
		expect(tileSample(0, 0)).toEqual({ u: 0, v: 0 });
		expect(tileSample(FIELD_COLS - 1, FIELD_ROWS - 1)).toEqual({ u: 1, v: 1 });
	});

	it('gives one tile per field position', () => {
		expect(fieldTiles(empty)).toHaveLength(FIELD_COLS * FIELD_ROWS);
	});

	// The whole mechanic in one assertion: an untouched world is open water.
	it('is all water until she pours', () => {
		for (const tile of fieldTiles(empty)) {
			expect(tile.elevation).toBe(0);
			expect(tile.land).toBe(false);
		}
	});

	it('becomes land where the silt is deep', () => {
		expect(fieldTiles(full).every((t) => t.land)).toBe(true);
	});

	it('reads elevation straight off the silt, with nothing authored under it', () => {
		expect(tileElevation(empty, 7, 6)).toBe(0);
		expect(tileElevation(full, 7, 6)).toBeCloseTo(TILE_ELEVATION_SCALE);
	});

	it('puts the shore a little past the coverage threshold, not with it', () => {
		// A cell counts as covered at 0.35 but does not stand above water until
		// about 0.45, so the shore lags the meter by a beat.
		const covered = SEA_LEVEL / TILE_ELEVATION_SCALE;
		expect(covered).toBeGreaterThan(0.35);
		expect(covered).toBeLessThan(0.5);
	});

	it('draws back to front', () => {
		const tiles = fieldTiles(full);
		for (let i = 1; i < tiles.length; i++) {
			expect(tiles[i].r).toBeGreaterThanOrEqual(tiles[i - 1].r);
		}
	});
});

describe('centring', () => {
	it('puts the middle of the field in the middle of the frame', () => {
		const origin = fieldOrigin();
		const middle = fieldTiles(empty).find(
			(t) => t.col === Math.floor(FIELD_COLS / 2) && t.row === Math.floor(FIELD_ROWS / 2)
		)!;
		const p = projectHex(middle.q, middle.r, 0, origin);
		expect(p.x).toBeCloseTo(0.5, 1);
		expect(p.y).toBeCloseTo(0.5, 1);
	});

	it('keeps the whole field inside the frame, with water around it', () => {
		const origin = fieldOrigin();
		for (const tile of fieldTiles(empty)) {
			const p = projectHex(tile.q, tile.r, 0, origin);
			expect(p.x).toBeGreaterThan(0.04);
			expect(p.x).toBeLessThan(0.96);
		}
	});
});

describe('pointing at a tile', () => {
	it('round-trips a tile centre back to itself', () => {
		const origin = fieldOrigin();
		for (const tile of fieldTiles(empty)) {
			const p = projectHex(tile.q, tile.r, SEA_LEVEL, origin);
			const hit = tileAtPoint(p.x, p.y, origin);
			expect(hit).not.toBeNull();
			expect(hit!.col).toBe(tile.col);
			expect(hit!.row).toBe(tile.row);
		}
	});

	it('refuses points outside the field, so a pour cannot write off the world', () => {
		const origin = fieldOrigin();
		expect(tileAtPoint(-0.5, 0.5, origin)).toBeNull();
		expect(tileAtPoint(1.5, 0.5, origin)).toBeNull();
		expect(tileAtPoint(0.5, -0.6, origin)).toBeNull();
		expect(tileAtPoint(0.5, 1.8, origin)).toBeNull();
	});

	it('hands back where in the density field the tile reads from', () => {
		const origin = fieldOrigin();
		const corner = fieldTiles(empty).find((t) => t.col === 0 && t.row === 0)!;
		const p = projectHex(corner.q, corner.r, SEA_LEVEL, origin);
		const hit = tileAtPoint(p.x, p.y, origin)!;
		expect(hit.u).toBe(0);
		expect(hit.v).toBe(0);
	});
});

// The regression that shipped in the first hex build: an untouched world drew
// nothing at all, so a new player — before she has the insight to unlock pouring
// — was looking at an empty rectangle. The seabed is always there.
describe('the world before she touches it', () => {
	it('still has a floor', () => {
		expect(SEABED_ALPHA).toBeGreaterThan(0);
	});

	it('gives every tile a place to be drawn, silt or no silt', () => {
		const tiles = fieldTiles(empty);
		expect(tiles).toHaveLength(FIELD_COLS * FIELD_ROWS);
		expect(tiles.every((t) => Number.isFinite(t.elevation))).toBe(true);
	});
});

describe('the field dissolving into deep water', () => {
	it('is full strength in the middle and nothing at the border', () => {
		expect(edgeFalloff(Math.floor(FIELD_COLS / 2), Math.floor(FIELD_ROWS / 2))).toBeCloseTo(1);
		expect(edgeFalloff(0, 0)).toBe(0);
		expect(edgeFalloff(FIELD_COLS - 1, FIELD_ROWS - 1)).toBe(0);
	});

	it('fades on every side, so the field has no visible corner', () => {
		for (let col = 0; col < FIELD_COLS; col++) {
			expect(edgeFalloff(col, 0)).toBe(0);
			expect(edgeFalloff(col, FIELD_ROWS - 1)).toBe(0);
		}
		for (let row = 0; row < FIELD_ROWS; row++) {
			expect(edgeFalloff(0, row)).toBe(0);
			expect(edgeFalloff(FIELD_COLS - 1, row)).toBe(0);
		}
	});

	it('rises without stepping, so the edge has no seam', () => {
		let previous = -1;
		for (let col = 0; col <= Math.floor(FIELD_COLS / 2); col++) {
			const e = edgeFalloff(col, Math.floor(FIELD_ROWS / 2));
			expect(e).toBeGreaterThanOrEqual(previous);
			previous = e;
		}
	});
});
