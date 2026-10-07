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
import {
	HOME_COLS,
	TILE_CELL_SPACING,
	extentForGridWidth,
	gridWidthForExtent,
	sampleSediment,
	stable01,
	type SedimentGrid
} from './worldShape';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * How many tiles the field shows. Odd-r offset, so rows alternate half a tile.
 *
 * FIELD_COLS is what the frame holds, and the width of the world a save starts as.
 * A world that has grown is wider than the frame — `extent` below — and the camera
 * pans across it.
 */
export const FIELD_COLS = HOME_COLS;
export const FIELD_ROWS = 27;

/** How many columns the world a grid holds is across. */
export function gridExtent(grid: Pick<SedimentGrid, 'w'>): number {
	return extentForGridWidth(grid.w);
}

/**
 * How far a column sits from where it stood in the home world, in columns. Zero
 * for the home world and for any tile of it, so a tile's hashed character —
 * relief, grain, which trees it grows — is the same after the world grows as
 * before. Growing adds tiles at negative and past-the-end columns rather than
 * renumbering the ones she has already built on.
 */
export function homeShift(extent: number): number {
	return (extent - FIELD_COLS) / 2;
}

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
	/** the column this tile had in the home world, so hashes keyed on it survive growth */
	homeCol: number;
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

export function edgeFalloff(col: number, row: number, extent = FIELD_COLS): number {
	const dx = (col - (extent - 1) / 2) / ((extent - 1) / 2);
	const dy = (row - (FIELD_ROWS - 1) / 2) / ((FIELD_ROWS - 1) / 2);
	const spread = Math.hypot(dx, dy);
	// a stable per-tile wobble, so the rim is ragged rather than a clean ellipse
	const wobble = (stable01(`seabed:${col - homeShift(extent)}:${row}`) - 0.5) * FIELD_EDGE_NOISE;
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

export function seabedRelief(col: number, row: number, extent = FIELD_COLS): number {
	const home = col - homeShift(extent);
	const a = stable01(`relief:${home}:${row}`);
	const b = stable01(`relief:${row}:${home}`);
	return ((a + b) / 2) * SEABED_RELIEF;
}

/**
 * Where a tile sits in the density field, in the grid's own [0,1] coordinates.
 *
 * The home world reads the grid straight across, column 0 to the left edge and the
 * last column to the right. A grown world reads it at the same number of cells per
 * column, anchored on the middle — which is the same thing at home, and is what
 * leaves every tile she had already built on reading the same silt after it grows.
 */
export function tileSample(col: number, row: number, extent = FIELD_COLS): { u: number; v: number } {
	const v = FIELD_ROWS > 1 ? row / (FIELD_ROWS - 1) : 0.5;
	if (extent === FIELD_COLS) return { u: FIELD_COLS > 1 ? col / (FIELD_COLS - 1) : 0.5, v };
	return { u: 0.5 + ((col - (extent - 1) / 2) * TILE_CELL_SPACING) / gridWidthForExtent(extent), v };
}

/**
 * The tile a grid position belongs to — tileSample run backwards, and rounded. It
 * is what puts a placed thing, stored as a fraction of the grid, on the hex under
 * it however wide the world is.
 */
export function tileNearest(
	u: number,
	v: number,
	extent = FIELD_COLS
): { col: number; row: number } {
	const colFloat =
		extent === FIELD_COLS
			? clamp01(u) * (FIELD_COLS - 1)
			: ((clamp01(u) - 0.5) * gridWidthForExtent(extent)) / TILE_CELL_SPACING + (extent - 1) / 2;
	return {
		col: Math.max(0, Math.min(extent - 1, Math.round(colFloat))),
		row: Math.max(0, Math.min(FIELD_ROWS - 1, Math.round(clamp01(v) * (FIELD_ROWS - 1))))
	};
}

export function tileElevation(grid: SedimentGrid, col: number, row: number): number {
	const extent = gridExtent(grid);
	const { u, v } = tileSample(col, row, extent);
	// same sum fieldTiles uses, so anything standing on a tile agrees with the tile
	return seabedRelief(col, row, extent) + sampleSediment(grid, u, v) * TILE_ELEVATION_SCALE;
}

/**
 * The origin that puts the middle of the field in the middle of the frame.
 *
 * Centring is a property of the field's extent rather than a tuned constant, so
 * changing FIELD_COLS or FIELD_ROWS keeps the world centred without anyone
 * remembering to re-tune an offset.
 */
export function fieldOrigin(extent = FIELD_COLS): { x: number; y: number } {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (let row = 0; row < FIELD_ROWS; row++) {
		for (let col = 0; col < extent; col++) {
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

/**
 * How wide one column is on screen, in canvas fractions — the distance a pan of one
 * tile covers.
 */
export const TILE_SCREEN_WIDTH = hexToWorld(1, 0).x;

/**
 * Where the world's far left and right edges sit on screen with the camera
 * centred, in canvas fractions. For the home world this is inside the frame; a
 * grown world runs well past it, and this is how far.
 */
export function fieldBounds(extent = FIELD_COLS): { left: number; right: number } {
	const origin = fieldOrigin(extent);
	let left = Infinity;
	let right = -Infinity;
	for (let row = 0; row < FIELD_ROWS; row++) {
		for (const col of [0, extent - 1]) {
			const { q, r } = offsetToAxial(col, row);
			const x = origin.x + hexToWorld(q, r).x;
			left = Math.min(left, x);
			right = Math.max(right, x);
		}
	}
	const half = TILE_SCREEN_WIDTH / 2;
	return { left: left - half, right: right + half };
}

/**
 * How far the camera can travel either way, in tile columns. Zero for the home
 * world, so a save that has never grown has nothing to pan.
 */
export function panLimit(extent = FIELD_COLS): number {
	return Math.max(0, (extent - FIELD_COLS) / 2);
}

/** Every tile in the field, in painter's order, with its elevation resolved. */
export function fieldTiles(grid: SedimentGrid): FieldTile[] {
	const extent = gridExtent(grid);
	const shift = homeShift(extent);
	const tiles: FieldTile[] = [];
	for (let row = 0; row < FIELD_ROWS; row++) {
		for (let col = 0; col < extent; col++) {
			const { q, r } = offsetToAxial(col, row);
			const { u, v } = tileSample(col, row, extent);
			const density = sampleSediment(grid, u, v);
			// silt on top of what the floor already had, so a bare seabed has shape
			const elevation = seabedRelief(col, row, extent) + density * TILE_ELEVATION_SCALE;
			tiles.push({
				col,
				row,
				q,
				r,
				homeCol: col - shift,
				elevation,
				density,
				land: elevation >= SEA_LEVEL,
				edge: edgeFalloff(col, row, extent)
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
	origin = fieldOrigin(),
	extent = FIELD_COLS
): { col: number; row: number; u: number; v: number } | null {
	const fractional = unprojectHex(screenX, screenY, SEA_LEVEL, origin);
	const { q, r } = hexRound(fractional.q, fractional.r);
	const row = r;
	const col = q + (r - (r & 1)) / 2;
	if (col < 0 || col >= extent || row < 0 || row >= FIELD_ROWS) return null;
	return { col, row, ...tileSample(col, row, extent) };
}
