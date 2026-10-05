import { describe, expect, it } from 'vitest';
import {
	FIELD_COLS,
	FIELD_ROWS,
	fieldBounds,
	fieldOrigin,
	fieldTiles,
	gridExtent,
	panLimit,
	seabedRelief,
	tileAtPoint,
	tileElevation,
	tileNearest,
	tileSample
} from './hexField';
import { landscapeFor, type LandscapeState } from './landscape';
import {
	HOME_COLS,
	SEDIMENT_GRID_H,
	SEDIMENT_GRID_W,
	WORLD_EXTENTS,
	emptyWorldShape,
	extentForGridWidth,
	generateSpawnPoints,
	gridWidthForExtent,
	growWorld,
	nextWorldExtent,
	normalizeWorldShape,
	placeFeatureOnBestSediment,
	sedimentCoverage,
	stable01,
	type WorldShape
} from './worldShape';

/** A home world with an island in it: a blob of deep silt, lumpy so no two tiles agree. */
function island(): WorldShape {
	const shape = emptyWorldShape();
	const cells: number[] = [];
	for (let y = 0; y < SEDIMENT_GRID_H; y++) {
		for (let x = 0; x < SEDIMENT_GRID_W; x++) {
			const dx = (x - 23.5) / 17;
			const dy = (y - 5.5) / 5.5;
			const body = Math.max(0, 1 - Math.hypot(dx, dy));
			cells.push(Math.min(1, body * 1.6 + (stable01(`lump:${x}:${y}`) - 0.5) * 0.2 * body));
		}
	}
	return { ...shape, sedimentGrid: { w: SEDIMENT_GRID_W, h: SEDIMENT_GRID_H, cells }, sedimentUnlocked: true };
}

const STATE: LandscapeState = {
	moistureHealth: 0.8,
	nutrientHealth: 0.8,
	stability: 70,
	complexity: 60,
	deaths: 0
};

describe('the sizes a world can be', () => {
	it('starts at the home world, which is the world every save began as', () => {
		expect(HOME_COLS).toBe(FIELD_COLS);
		expect(gridWidthForExtent(HOME_COLS)).toBe(SEDIMENT_GRID_W);
		expect(emptyWorldShape().worldExtent).toBe(HOME_COLS);
	});

	it('reaches 45 columns at the widest, in whole steps', () => {
		expect([...WORLD_EXTENTS]).toEqual([15, 31, 45]);
		expect(nextWorldExtent(15)).toBe(31);
		expect(nextWorldExtent(31)).toBe(45);
		expect(nextWorldExtent(45)).toBeNull();
	});

	it('widens the grid to cover every column at the same cells per column', () => {
		for (const extent of WORLD_EXTENTS) {
			const w = gridWidthForExtent(extent);
			// the outermost tiles must land on the grid, or the world's ends read as clamped
			const first = tileSample(0, 0, extent).u;
			const last = tileSample(extent - 1, 0, extent).u;
			expect(first).toBeGreaterThanOrEqual(0);
			expect(last).toBeLessThanOrEqual(1);
			expect(extentForGridWidth(w)).toBe(extent);
		}
	});

	it('pads in whole spawn blocks, so growing leaves the old blocks aligned', () => {
		for (const extent of WORLD_EXTENTS) {
			expect((gridWidthForExtent(extent) - SEDIMENT_GRID_W) / 2 % 6).toBe(0);
		}
	});

	it('reads a grid it did not size as the home world', () => {
		expect(extentForGridWidth(50)).toBe(HOME_COLS);
		expect(gridExtent({ w: 24 })).toBe(HOME_COLS);
	});
});

describe('growing the world', () => {
	it('pads the grid with open water on both sides and nothing else', () => {
		const home = island();
		const grown = growWorld(home);
		const pad = (gridWidthForExtent(31) - SEDIMENT_GRID_W) / 2;
		expect(grown.worldExtent).toBe(31);
		expect(grown.sedimentGrid.w).toBe(gridWidthForExtent(31));
		expect(grown.sedimentGrid.h).toBe(SEDIMENT_GRID_H);
		for (let y = 0; y < SEDIMENT_GRID_H; y++) {
			for (let x = 0; x < grown.sedimentGrid.w; x++) {
				const value = grown.sedimentGrid.cells[y * grown.sedimentGrid.w + x];
				const inside = x >= pad && x < pad + SEDIMENT_GRID_W;
				expect(value).toBe(inside ? home.sedimentGrid.cells[y * SEDIMENT_GRID_W + (x - pad)] : 0);
			}
		}
	});

	it('does not change how much silt there is, only what it is a share of', () => {
		const home = island();
		const grown = growWorld(home);
		const homeFilled = sedimentCoverage(home.sedimentGrid) * home.sedimentGrid.cells.length;
		const grownFilled = sedimentCoverage(grown.sedimentGrid) * grown.sedimentGrid.cells.length;
		expect(grownFilled).toBeCloseTo(homeFilled);
		expect(sedimentCoverage(grown.sedimentGrid)).toBeLessThan(sedimentCoverage(home.sedimentGrid));
	});

	it('steps through every size and then stops', () => {
		const sizes: number[] = [];
		let shape = island();
		for (let i = 0; i < 5; i++) {
			shape = growWorld(shape);
			sizes.push(shape.worldExtent);
		}
		expect(sizes).toEqual([31, 45, 45, 45, 45]);
		const widest = growWorld(growWorld(island()));
		expect(growWorld(widest)).toBe(widest);
	});

	it('will not widen a grid it did not size', () => {
		const odd: WorldShape = { ...island(), sedimentGrid: { w: 20, h: 4, cells: new Array(80).fill(0) } };
		expect(growWorld(odd)).toBe(odd);
	});

	it('leaves every tile she had built on reading the same ground', () => {
		const home = island();
		const grown = growWorld(home);
		const shift = (grown.worldExtent - HOME_COLS) / 2;
		const before = fieldTiles(home.sedimentGrid);
		const after = new Map(fieldTiles(grown.sedimentGrid).map((t) => [`${t.col}:${t.row}`, t]));
		expect(after.size).toBe(grown.worldExtent * FIELD_ROWS);
		for (const tile of before) {
			const same = after.get(`${tile.col + shift}:${tile.row}`)!;
			expect(same.homeCol).toBe(tile.col);
			expect(same.density).toBeCloseTo(tile.density, 9);
			expect(same.elevation).toBeCloseTo(tile.elevation, 9);
			expect(same.land).toBe(tile.land);
		}
	});

	it('holds at every size, not only the first step', () => {
		const home = island();
		const wide = growWorld(growWorld(home));
		const shift = (wide.worldExtent - HOME_COLS) / 2;
		for (let row = 0; row < FIELD_ROWS; row += 3) {
			for (let col = 0; col < FIELD_COLS; col++) {
				expect(tileElevation(wide.sedimentGrid, col + shift, row)).toBeCloseTo(
					tileElevation(home.sedimentGrid, col, row),
					9
				);
			}
		}
	});

	it('keeps the bare seabed the same shape under what was already there', () => {
		for (const extent of [31, 45]) {
			const shift = (extent - HOME_COLS) / 2;
			for (let col = 0; col < FIELD_COLS; col += 2) {
				expect(seabedRelief(col + shift, 5, extent)).toBe(seabedRelief(col, 5));
			}
		}
	});

	it('carries what was placed on the island to the same tile', () => {
		const withFeature = placeFeatureOnBestSediment(
			{ ...island(), unlockedWorldspaces: ['water', 'shallows'], activeWorldspace: 'shallows' },
			'black_silt'
		);
		expect(withFeature.placedFeatures).toHaveLength(1);
		const placed = withFeature.placedFeatures[0];
		const before = tileNearest(placed.x, placed.y, HOME_COLS);
		for (const next of [growWorld(withFeature), growWorld(growWorld(withFeature))]) {
			const carried = next.placedFeatures[0];
			const shift = (next.worldExtent - HOME_COLS) / 2;
			const after = tileNearest(carried.x, carried.y, next.worldExtent);
			expect(after).toEqual({ col: before.col + shift, row: before.row });
			expect(carried.y).toBe(placed.y);
		}
	});

	it('refreshes spawns, since the world they were drawn for changed', () => {
		const home = island();
		expect(growWorld(home).spawnRevision).toBe(home.spawnRevision + 1);
	});

	it('keeps the world’s own spawn points on the home world, not stretched across new land', () => {
		const home = island();
		const grown = growWorld(growWorld(home));
		const reach = (0.5 * SEDIMENT_GRID_W) / grown.sedimentGrid.w;
		const own = generateSpawnPoints(grown).filter((p) => ['surface-drift', 'middle-current', 'deep-blue'].includes(p.id));
		expect(own).toHaveLength(3);
		for (const point of own) expect(Math.abs(point.x - 0.5)).toBeLessThanOrEqual(reach + 1e-9);
		// at home they are exactly where they always were
		const atHome = generateSpawnPoints(home).find((p) => p.id === 'deep-blue')!;
		expect(atHome.x).toBe(0.8);
	});

	it('names the home blocks of silt as it always did', () => {
		const home = island();
		const grown = growWorld(home);
		const homeIds = generateSpawnPoints(home)
			.filter((p) => p.id.startsWith('sediment-'))
			.map((p) => p.id);
		const grownIds = new Set(generateSpawnPoints(grown).map((p) => p.id));
		expect(homeIds.length).toBeGreaterThan(0);
		for (const id of homeIds) expect(grownIds.has(id)).toBe(true);
	});
});

describe('the field at any width', () => {
	it('reads the home world exactly as it always did', () => {
		expect(tileSample(0, 0)).toEqual({ u: 0, v: 0 });
		expect(tileSample(FIELD_COLS - 1, FIELD_ROWS - 1)).toEqual({ u: 1, v: 1 });
		expect(tileNearest(0, 0)).toEqual({ col: 0, row: 0 });
		expect(tileNearest(1, 1)).toEqual({ col: FIELD_COLS - 1, row: FIELD_ROWS - 1 });
		expect(panLimit()).toBe(0);
	});

	it('finds the tile a sample belongs to, whatever the width', () => {
		for (const extent of WORLD_EXTENTS) {
			for (let row = 0; row < FIELD_ROWS; row += 4) {
				for (let col = 0; col < extent; col++) {
					const { u, v } = tileSample(col, row, extent);
					expect(tileNearest(u, v, extent)).toEqual({ col, row });
				}
			}
		}
	});

	it('keeps the middle of the world in the middle of the frame', () => {
		for (const extent of WORLD_EXTENTS) {
			const { left, right } = fieldBounds(extent);
			expect((left + right) / 2).toBeCloseTo(0.5, 5);
			expect(fieldOrigin(extent).y).toBeCloseTo(fieldOrigin().y, 9);
		}
	});

	it('runs the world past the frame once it has grown, and only then', () => {
		const home = fieldBounds(HOME_COLS);
		expect(home.left).toBeGreaterThan(0);
		expect(home.right).toBeLessThan(1);
		const wide = fieldBounds(45);
		expect(wide.left).toBeLessThan(0);
		expect(wide.right).toBeGreaterThan(1);
	});

	it('lets the camera travel as far as the world is wider than the frame', () => {
		expect(panLimit(31)).toBe(8);
		expect(panLimit(45)).toBe(15);
	});

	it('finds a tile past the old frame only in a world wide enough to have one', () => {
		const origin = fieldOrigin(31);
		const tiles = fieldTiles(growWorld(island()).sedimentGrid);
		const far = tiles.find((t) => t.col === 30 && t.row === 13)!;
		expect(far).toBeDefined();
		const { q, r } = { q: far.q, r: far.r };
		// project the tile's own centre at sea level and pick it back out
		const x = origin.x + 0.028 * Math.sqrt(3) * (q + r / 2);
		const y = origin.y + 0.028 * 1.5 * r * 0.56 - 0.032;
		expect(tileAtPoint(x, y, origin, 31)).toMatchObject({ col: 30, row: 13 });
		expect(tileAtPoint(x, y, origin, HOME_COLS)).toBeNull();
	});

	it('draws the same forest and the same mountains on the island after it grows', () => {
		const home = island();
		const grown = growWorld(home);
		const shift = (grown.worldExtent - HOME_COLS) / 2;
		// the grid is read at shifted indices, so heights agree to rounding and no further
		const key = (t: { col: number; row: number; trees: unknown[]; peak: unknown }) =>
			JSON.stringify([t.col, t.row, t.trees, t.peak], (_, v) =>
				typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : v
			);
		const before = landscapeFor(fieldTiles(home.sedimentGrid), STATE).tiles.map(key);
		const after = landscapeFor(fieldTiles(grown.sedimentGrid), STATE).tiles.map((t) =>
			key({ ...t, col: t.col - shift })
		);
		expect(before.length).toBeGreaterThan(0);
		expect(after).toEqual(before);
	});
});

describe('saving a grown world', () => {
	it('reads an old save as the home world', () => {
		expect(normalizeWorldShape({ activeWorldspace: 'water', sedimentUnlocked: true }).worldExtent).toBe(
			HOME_COLS
		);
	});

	it('takes the width from the grid, so a save cannot claim a world it does not hold', () => {
		const grown = growWorld(island());
		expect(normalizeWorldShape({ ...grown, worldExtent: 45 }).worldExtent).toBe(31);
		expect(normalizeWorldShape({ ...island(), worldExtent: 45 }).worldExtent).toBe(HOME_COLS);
		expect(normalizeWorldShape(JSON.parse(JSON.stringify(grown)))).toEqual(grown);
	});
});
