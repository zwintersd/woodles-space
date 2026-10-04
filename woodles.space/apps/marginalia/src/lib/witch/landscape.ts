// What the land looks like, as a function of what the world is doing.
//
// Elevation is silt and nothing else, and biome is read off elevation. That says
// what kind of ground a tile is; it says nothing about whether the world is well.
// This is the layer that does: forests that fill in and thin out with how the
// plants' own needs are being met, and mountains that stand as tall as the world
// is complex. Nothing here is simulated and nothing is saved — it is a pure
// reading of the current state, so it can be tested without a canvas and so the
// same world always draws the same land.
//
// Everything that varies per tile comes from `stable01`, never `Math.random()`.
// Coverage is a threshold on a fixed per-tile hash, which means a forest grows by
// *adding* tiles in a stable order and shrinks by losing the same ones in
// reverse. A world that recovers regrows the same groves, not new ones.

import { SEA_LEVEL } from './hex';
import { TILE_ELEVATION_SCALE, type FieldTile } from './hexField';
import { stable01 } from './worldShape';

/** The world, reduced to the five numbers the land answers to. */
export interface LandscapeState {
	/** 0..1, how well the moisture stock sits in its band. */
	moistureHealth: number;
	/** 0..1, how well the nutrients stock sits in its band. */
	nutrientHealth: number;
	/** 0..100 */
	stability: number;
	/** The live, derived complexity — it falls when life is lost. */
	complexity: number;
	/** How many life are dead right now. */
	deaths: number;
}

/** How far up the grass band a tile stands, 0 at the waterline to 1 at the top of the scale. */
export function heightAboveSea(elevation: number): number {
	return Math.max(0, Math.min(1, (elevation - SEA_LEVEL) / (TILE_ELEVATION_SCALE - SEA_LEVEL)));
}

// Trees stand on the grass and stop short of the high ground; rock takes over
// above it. The two bands do not overlap, so no tile is both.
export const FOREST_MIN_HEIGHT = 0.1;
export const FOREST_MAX_HEIGHT = 0.58;
export const PEAK_MIN_HEIGHT = 0.6;
/**
 * Not every tile of high ground raises a peak — a peak on each would be a field
 * of spikes hiding the island under it. The chance rises with height, so the
 * summits cluster where the silt is deepest and the rest reads as foothill.
 */
export const PEAK_CHANCE_LOW = 0.3;
export const PEAK_CHANCE_HIGH = 0.85;

export function peakChance(above: number): number {
	const t = clamp01((above - PEAK_MIN_HEIGHT) / (1 - PEAK_MIN_HEIGHT));
	return PEAK_CHANCE_LOW + (PEAK_CHANCE_HIGH - PEAK_CHANCE_LOW) * t;
}

/** Complexity at which a world has no mountains to speak of, and at which it has all of them. */
export const COMPLEXITY_FLOOR = 20;
export const COMPLEXITY_FULL = 80;
/** Past this share of full complexity the high ground starts to carry snow. */
export const SNOWLINE = 0.55;
/** Each death thins the forest by this much, up to FOREST_DEATH_CAP. */
export const FOREST_DEATH_STEP = 0.12;
export const FOREST_DEATH_CAP = 0.5;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * How well the plants are doing: the two stocks they answer to, averaged. Oxygen
 * is left out on purpose — DESIGN §1.5 gates animals on it, not plants.
 */
export function vigorOf(state: Pick<LandscapeState, 'moistureHealth' | 'nutrientHealth'>): number {
	return clamp01((state.moistureHealth + state.nutrientHealth) / 2);
}

/**
 * The share of eligible tiles that carry forest. Zero when the plants' needs are
 * unmet, rising with their health and, more slowly, with how stable the world is;
 * each life lost takes a bite out of it.
 */
export function forestCoverage(state: LandscapeState): number {
	const vigor = vigorOf(state);
	const steady = 0.45 + 0.55 * clamp01(state.stability / 100);
	const grief = 1 - Math.min(FOREST_DEATH_CAP, FOREST_DEATH_STEP * Math.max(0, state.deaths));
	return clamp01(Math.pow(vigor, 1.4) * steady * grief * 0.85);
}

/** 0 = a world with nothing built, 1 = as complex as World 1 gets. */
export function complexityShare(complexity: number): number {
	return clamp01((complexity - COMPLEXITY_FLOOR) / (COMPLEXITY_FULL - COMPLEXITY_FLOOR));
}

export interface TreeSpec {
	/** Offset from the tile's centre, in tile widths. */
	dx: number;
	dy: number;
	/** 0.7..1.15 */
	size: number;
	conifer: boolean;
	/** Where in its sway cycle this tree starts. */
	phase: number;
}

export interface PeakSpec {
	/** 0..1, how tall against the tallest a peak gets. */
	height: number;
	/** 0..1, how much of it is under snow. */
	snow: number;
	/** Which way the summit leans, -1..1, so a range is not a row of copies. */
	lean: number;
}

export interface LandscapeTile {
	col: number;
	row: number;
	/** 0..1, the field's rim fade for this tile. Land tops are drawn at this alpha, and what stands on them has to match. */
	edge: number;
	trees: TreeSpec[];
	peak: PeakSpec | null;
}

export interface Landscape {
	/** 0..1, shared by every tree: how green the forest reads. */
	vigor: number;
	tiles: LandscapeTile[];
}

/** Which tiles hold forest is a threshold on this, fixed per tile. Patchy on purpose: half of it is shared with the neighbours. */
function groveHash(col: number, row: number): number {
	return 0.5 * stable01(`forest:${col}:${row}`) + 0.5 * stable01(`grove:${col >> 1}:${row >> 1}`);
}

export function landscapeFor(tiles: readonly FieldTile[], state: LandscapeState): Landscape {
	const coverage = forestCoverage(state);
	const vigor = vigorOf(state);
	const share = complexityShare(state.complexity);
	const out: LandscapeTile[] = [];

	for (const tile of tiles) {
		if (!tile.land || tile.edge <= 0.05) continue;
		const above = heightAboveSea(tile.elevation);
		const trees: TreeSpec[] = [];
		let peak: PeakSpec | null = null;

		if (above >= PEAK_MIN_HEIGHT) {
			if (stable01(`peak:${tile.col}:${tile.row}`) >= peakChance(above)) continue;
			// The high ground is always there; what the world's complexity decides is
			// how much of it stands up. A flat world keeps a low rise, never nothing,
			// so there is something for complexity to grow.
			const rise = 0.7 + 0.5 * (above - PEAK_MIN_HEIGHT) / (1 - PEAK_MIN_HEIGHT);
			peak = {
				height: clamp01((0.22 + 0.78 * share) * rise),
				snow: above > 0.75 ? clamp01((share - SNOWLINE) / (1 - SNOWLINE)) : 0,
				lean: (stable01(`lean:${tile.col}:${tile.row}`) - 0.5) * 2
			};
		} else if (above >= FOREST_MIN_HEIGHT && above <= FOREST_MAX_HEIGHT && groveHash(tile.col, tile.row) < coverage) {
			// 1..3, more of them in a healthy forest
			const count = 1 + Math.round(vigor * 2 * stable01(`count:${tile.col}:${tile.row}`));
			for (let i = 0; i < count; i++) {
				const key = `${tile.col}:${tile.row}:${i}`;
				trees.push({
					dx: (stable01(`tx:${key}`) - 0.5) * 0.56,
					dy: (stable01(`ty:${key}`) - 0.5) * 0.4,
					size: 0.7 + 0.45 * stable01(`ts:${key}`),
					conifer: above > 0.4 || stable01(`tk:${key}`) < 0.25,
					phase: stable01(`tp:${key}`) * Math.PI * 2
				});
			}
		}

		if (trees.length || peak) out.push({ col: tile.col, row: tile.row, edge: tile.edge, trees, peak });
	}
	return { vigor, tiles: out };
}
