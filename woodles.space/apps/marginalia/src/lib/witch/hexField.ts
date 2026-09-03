// The sediment grid, read as the island she is building.
//
// Elevation is silt and nothing else. The `bathymetryRise` of step D was a shelf
// authored to work around the aquarium framing; under the hex camera it is not
// needed, and dropping it makes the mechanic more honest rather than less: a tile
// stands as high as the silt she has poured into it, and land is a tile whose top
// clears sea level. Nothing places the shoreline. An untouched world is open
// water, which is exactly where World 1 starts.
//
// The visible field is coarser than the stored grid. 48 columns of hexes would be
// four and a half canvas widths across, so the field samples the density field
// through `sampleSediment` instead of mapping cell-to-tile. The pour writes the
// fine grid and reads back through the same transform, so the two stay consistent.

import {
	CAMERA_TILT,
	SEA_LEVEL,
	byHexRow,
	hexRound,
	hexToWorld,
	offsetToAxial,
	unprojectHex
} from './hex';
import { sampleSediment, type SedimentGrid } from './worldShape';

/** How many tiles the field shows. Odd-r offset, so rows alternate half a tile. */
export const FIELD_COLS = 15;
export const FIELD_ROWS = 27;

/**
 * Silt density to elevation. At this scale a cell needs a density of about 0.45
 * to break the surface, a little above SEDIMENT_CELL_THRESHOLD — so a tile counts
 * as covered slightly before it counts as land, and the shore lags the coverage
 * meter by a beat rather than arriving with it.
 */
export const TILE_ELEVATION_SCALE = 2.2;

/** Below this a tile is bare seabed and is not drawn at all — open water. */
export const TILE_MIN_ELEVATION = 0.16;

export interface FieldTile {
	col: number;
	row: number;
	q: number;
	r: number;
	/** 0..TILE_ELEVATION_SCALE */
	elevation: number;
	/** how much silt is in it, 0..1 */
	density: number;
	land: boolean;
}

/** Where a tile sits in the density field, in the grid's own [0,1] coordinates. */
export function tileSample(col: number, row: number): { u: number; v: number } {
	return {
		u: FIELD_COLS > 1 ? col / (FIELD_COLS - 1) : 0.5,
		v: FIELD_ROWS > 1 ? row / (FIELD_ROWS - 1) : 0.5
	};
}

export function tileElevation(grid: SedimentGrid, col: number, row: number): number {
	const { u, v } = tileSample(col, row);
	return sampleSediment(grid, u, v) * TILE_ELEVATION_SCALE;
}

/**
 * The origin that puts the middle of the field in the middle of the frame.
 *
 * Centring is a property of the field's extent rather than a tuned constant, so
 * changing FIELD_COLS or FIELD_ROWS keeps the world centred without anyone
 * remembering to re-tune an offset.
 */
export function fieldOrigin(): { x: number; y: number } {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (let row = 0; row < FIELD_ROWS; row++) {
		for (let col = 0; col < FIELD_COLS; col++) {
			const { q, r } = offsetToAxial(col, row);
			const w = hexToWorld(q, r);
			minX = Math.min(minX, w.x);
			maxX = Math.max(maxX, w.x);
			minY = Math.min(minY, w.y);
			maxY = Math.max(maxY, w.y);
		}
	}
	return { x: 0.5 - (minX + maxX) / 2, y: 0.5 - ((minY + maxY) / 2) * CAMERA_TILT };
}

/** Every tile in the field, in painter's order, with its elevation resolved. */
export function fieldTiles(grid: SedimentGrid): FieldTile[] {
	const tiles: FieldTile[] = [];
	for (let row = 0; row < FIELD_ROWS; row++) {
		for (let col = 0; col < FIELD_COLS; col++) {
			const { q, r } = offsetToAxial(col, row);
			const { u, v } = tileSample(col, row);
			const density = sampleSediment(grid, u, v);
			const elevation = density * TILE_ELEVATION_SCALE;
			tiles.push({ col, row, q, r, elevation, density, land: elevation >= SEA_LEVEL });
		}
	}
	tiles.sort(byHexRow);
	return tiles;
}

/**
 * Which tile a screen point falls on, and where that lands in the density field.
 *
 * Resolved against the water's surface rather than each tile's own top, so a click
 * means the same place whether the seabed there is bare or heaped. Returns null
 * outside the field, which is what stops a pour from writing off the edge of the
 * world.
 */
export function tileAtPoint(
	screenX: number,
	screenY: number,
	origin = fieldOrigin()
): { col: number; row: number; u: number; v: number } | null {
	const fractional = unprojectHex(screenX, screenY, SEA_LEVEL, origin);
	const { q, r } = hexRound(fractional.q, fractional.r);
	const row = r;
	const col = q + (r - (r & 1)) / 2;
	if (col < 0 || col >= FIELD_COLS || row < 0 || row >= FIELD_ROWS) return null;
	return { col, row, ...tileSample(col, row) };
}
