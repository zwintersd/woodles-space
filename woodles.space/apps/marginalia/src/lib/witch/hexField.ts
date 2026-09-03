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
import { sampleSediment, stable01, type SedimentGrid } from './worldShape';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

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

/**
 * How faintly a tile with no silt in it is drawn.
 *
 * Not zero, and that matters. Skipping empty tiles made an island read as an
 * island rather than as a tiled floor, but applied to the whole field it meant an
 * untouched world drew nothing at all — a new player, before she has the insight
 * to unlock pouring, was looking at an empty blue rectangle. The seabed is always
 * there; it is just quiet until she gives it something to be.
 */
export const SEABED_ALPHA = 0.24;

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
	/**
	 * 1 in the body of the field, falling to 0 around a ragged ellipse near its
	 * rim — see edgeFalloff. Silt can still be poured out there; the eye just
	 * cannot find where the world stops.
	 */
	edge: number;
}

/**
 * How the seabed ends.
 *
 * The first attempt faded from the field's rectangular border inward, which
 * removed the hard cut but kept the shape: a scalloped top edge and a combed side,
 * a slab lying in the sea. A seabed has no rectangle in it. This fades radially
 * instead, from an ellipse matching the field's own proportions, and roughens the
 * boundary per tile so it dissolves unevenly the way a real one would.
 */
export const FIELD_CORE = 0.62;
export const FIELD_EDGE_NOISE = 0.17;

export function edgeFalloff(col: number, row: number): number {
	const dx = (col - (FIELD_COLS - 1) / 2) / ((FIELD_COLS - 1) / 2);
	const dy = (row - (FIELD_ROWS - 1) / 2) / ((FIELD_ROWS - 1) / 2);
	const spread = Math.hypot(dx, dy);
	// a stable per-tile wobble, so the rim is ragged rather than a clean ellipse
	const wobble = (stable01(`seabed:${col}:${row}`) - 0.5) * FIELD_EDGE_NOISE;
	const t = clamp01((1 - (spread + wobble)) / (1 - FIELD_CORE));
	return t * t * (3 - 2 * t);
}

/**
 * A little relief on the bare seabed, in elevation units.
 *
 * Without it the untouched floor is one flat plane of identical tiles and reads as
 * a texture rather than a place — every tile the same height means no tile has a
 * visible side. This is deterministic per tile, so the floor is the same every
 * time she opens the book, and small enough that poured silt still dominates it.
 */
export const SEABED_RELIEF = 0.22;

export function seabedRelief(col: number, row: number): number {
	const a = stable01(`relief:${col}:${row}`);
	const b = stable01(`relief:${row}:${col}`);
	return ((a + b) / 2) * SEABED_RELIEF;
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
	// same sum fieldTiles uses, so anything standing on a tile agrees with the tile
	return seabedRelief(col, row) + sampleSediment(grid, u, v) * TILE_ELEVATION_SCALE;
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
			// silt on top of what the floor already had, so a bare seabed has shape
			const elevation = seabedRelief(col, row) + density * TILE_ELEVATION_SCALE;
			tiles.push({
				col,
				row,
				q,
				r,
				elevation,
				density,
				land: elevation >= SEA_LEVEL,
				edge: edgeFalloff(col, row)
			});
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
