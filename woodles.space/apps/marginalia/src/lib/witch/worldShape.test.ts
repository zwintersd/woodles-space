import { describe, expect, it } from 'vitest';
import type { Life } from './content/life';
import {
	MAX_CUSTOM_SPAWN_POINTS,
	SEDIMENT_BAND_TOP,
	SEDIMENT_CELL_THRESHOLD,
	SEDIMENT_UNLOCK_COVERAGE,
	applySedimentPour,
	canPlaceCustomSpawnPoint,
	creaturePlacementStatus,
	customSpawnPointCost,
	emptySedimentGrid,
	emptyWorldShape,
	featurePlacementStatus,
	generateSpawnPoints,
	lifeVisibleInWorldspace,
	normalizeWorldShape,
	placeCreature,
	placeCustomSpawnPoint,
	placeFeatureOnBestSediment,
	removeCustomSpawnPoint,
	resolveSpawnPointForLife,
	sedimentCoverage,
	unlockWorldspacesForCoverage,
	visibleLifeForWorldspace,
	sampleSediment,
	waterGridYToWorld,
	worldYToWaterGrid,
	type Worldspace
} from './worldShape';
import { SEA_LEVEL_Y, isAboveWater, projectFloor } from './projection';

const aquaticLife: Life = {
	id: 'soft_swimmer',
	name: 'soft-bodied swimmers',
	scientificName: 'Mollis natans',
	category: 'aquatic',
	domain: 'animal',
	requires: [],
	insightWeight: 1.4,
	studyEase: 0.9,
	notice: '',
	observe: '',
	study: '',
	know: ''
};

const landLife: Life = {
	...aquaticLife,
	id: 'lichen',
	name: 'the lichens',
	category: 'terrestrial',
	domain: 'plant',
	insightWeight: 0.7,
	studyEase: 1.3
};

describe('worldShape sediment', () => {
	it('counts sediment coverage above the threshold', () => {
		const grid = emptySedimentGrid(4, 2);
		grid.cells = [0, SEDIMENT_CELL_THRESHOLD, 0.8, 0.1, 0.2, 0.34, 0.35, 1];
		expect(sedimentCoverage(grid)).toBe(0.5);
	});

	it('adds sediment with radial falloff and clamps cells', () => {
		const grid = emptySedimentGrid(9, 5);
		const poured = applySedimentPour(grid, 0.5, 0.5, 3);
		const center = poured.cells[2 * poured.w + 4];
		const corner = poured.cells[0];
		expect(center).toBeGreaterThan(SEDIMENT_CELL_THRESHOLD);
		expect(corner).toBe(0);
		expect(Math.max(...poured.cells)).toBeLessThanOrEqual(1);
	});

	it('unlocks shallows when coverage reaches sixty percent', () => {
		const shape = emptyWorldShape();
		const cells = shape.sedimentGrid.cells.map((_, index) =>
			index / shape.sedimentGrid.cells.length < SEDIMENT_UNLOCK_COVERAGE ? 0.7 : 0
		);
		const next = unlockWorldspacesForCoverage({
			...shape,
			sedimentGrid: { ...shape.sedimentGrid, cells }
		});
		expect(next.unlockedWorldspaces).toContain('shallows');
		expect(next.spawnRevision).toBe(1);
	});

	it('confines the sediment/floor band to the bottom fraction of the canvas', () => {
		expect(waterGridYToWorld(0)).toBeCloseTo(SEDIMENT_BAND_TOP);
		expect(waterGridYToWorld(1)).toBeCloseTo(1);
		expect(worldYToWaterGrid(SEDIMENT_BAND_TOP - 0.01)).toBeNull();
		expect(worldYToWaterGrid(SEDIMENT_BAND_TOP)).toBeCloseTo(0);
		expect(worldYToWaterGrid(1)).toBeCloseTo(1);
	});
});

describe('worldShape life gating', () => {
	it('keeps water worldspace aquatic-only', () => {
		expect(lifeVisibleInWorldspace(aquaticLife, 'water')).toBe(true);
		expect(lifeVisibleInWorldspace(landLife, 'water')).toBe(false);
		expect(visibleLifeForWorldspace([aquaticLife, landLife], 'water')).toEqual([aquaticLife]);
	});

	it('reveals all categories in the shallows', () => {
		expect(visibleLifeForWorldspace([aquaticLife, landLife], 'shallows')).toEqual([
			aquaticLife,
			landLife
		]);
	});
});

describe('worldShape features and spawns', () => {
	it('blocks feature placement until shallows and sediment exist', () => {
		const shape = emptyWorldShape();
		expect(featurePlacementStatus(shape, 'shell_bed')).toEqual({ ok: false, reason: 'locked' });
		const unlocked = { ...shape, unlockedWorldspaces: ['water', 'shallows'] as Worldspace[] };
		expect(featurePlacementStatus(unlocked, 'shell_bed')).toEqual({
			ok: false,
			reason: 'needs-sediment'
		});
	});

	it('places a feature on dense sediment and adds spawn points', () => {
		const shape = normalizeWorldShape({
			unlockedWorldspaces: ['water', 'shallows'],
			sedimentGrid: { w: 3, h: 3, cells: [0, 0, 0, 0, 0.8, 0, 0, 0, 0] }
		});
		const placed = placeFeatureOnBestSediment(shape, 'shell_bed');
		expect(placed.placedFeatures).toHaveLength(1);
		expect(featurePlacementStatus(placed, 'shell_bed')).toEqual({
			ok: false,
			reason: 'already-placed'
		});
		expect(generateSpawnPoints(placed).some((point) => point.featureId)).toBe(true);
	});

	it('resolves weighted spawn choices deterministically', () => {
		const shape = normalizeWorldShape({
			unlockedWorldspaces: ['water', 'shallows'],
			activeWorldspace: 'shallows',
			sedimentGrid: { w: 3, h: 3, cells: [0, 0, 0, 0, 0.9, 0, 0, 0, 0] }
		});
		const withFeature = placeFeatureOnBestSediment(shape, 'shell_bed');
		const first = resolveSpawnPointForLife(aquaticLife, withFeature);
		const second = resolveSpawnPointForLife(aquaticLife, withFeature);
		expect(second).toEqual(first);
	});

	it('gives dense sediment blocks a procedural surface tag, independent of features', () => {
		const w = 12;
		const h = 6;
		const shape = normalizeWorldShape({
			unlockedWorldspaces: ['water', 'shallows'],
			sedimentGrid: { w, h, cells: new Array(w * h).fill(0.7) }
		});
		const sedimentPoints = generateSpawnPoints(shape).filter((point) => point.tags.includes('sediment'));
		const surfaceVocab = ['mineral', 'nutrient', 'shelter', 'bottom'];
		expect(sedimentPoints.length).toBeGreaterThan(1);
		for (const point of sedimentPoints) {
			expect(point.tags.some((tag) => surfaceVocab.includes(tag))).toBe(true);
		}
		// different blocks get their own (deterministic) roll, not one fixed tag
		const distinctSurfaceTags = new Set(
			sedimentPoints.map((point) => point.tags.find((tag) => surfaceVocab.includes(tag)))
		);
		expect(distinctSurfaceTags.size).toBeGreaterThan(1);
	});
});

describe('worldShape decorative creatures', () => {
	it('places a water-layer creature for free with no shallows requirement', () => {
		const shape = emptyWorldShape();
		expect(creaturePlacementStatus(shape, 'star_drifter')).toEqual({ ok: true, reason: 'ready' });
		const placed = placeCreature(shape, 'star_drifter');
		expect(placed.placedCreatures).toHaveLength(1);
		expect(placed.placedCreatures[0].creatureId).toBe('star_drifter');
		expect(placed.spawnRevision).toBe(shape.spawnRevision + 1);
	});

	it('refuses a second placement of the same creature', () => {
		const shape = placeCreature(emptyWorldShape(), 'star_drifter');
		expect(creaturePlacementStatus(shape, 'star_drifter')).toEqual({
			ok: false,
			reason: 'already-placed'
		});
		expect(placeCreature(shape, 'star_drifter')).toBe(shape);
	});

	it('rejects an unknown creature id', () => {
		expect(creaturePlacementStatus(emptyWorldShape(), 'not_a_creature')).toEqual({
			ok: false,
			reason: 'unknown'
		});
	});

	it('spreads successive placements across the width instead of stacking', () => {
		const withOne = placeCreature(emptyWorldShape(), 'star_drifter');
		const withTwo = placeCreature(withOne, 'spotted_swimmer');
		const [first, second] = withTwo.placedCreatures;
		expect(first.x).not.toBeCloseTo(second.x, 1);
	});
});

describe('worldShape waymarks (player-authored spawn points)', () => {
	const mark = {
		x: 0.4,
		y: 0.5,
		category: 'aquatic' as const,
		layer: 'water' as const,
		tags: ['mineral'],
		weight: 1,
		rarity: 'common' as const
	};

	it('costs more for higher weight and rarer marks', () => {
		const cheap = customSpawnPointCost(0.3, 'common');
		const dear = customSpawnPointCost(2, 'rare');
		expect(dear).toBeGreaterThan(cheap);
		expect(cheap).toBeGreaterThan(0);
	});

	it('places a water-layer waymark with no shallows requirement', () => {
		const shape = emptyWorldShape();
		expect(canPlaceCustomSpawnPoint(shape, 'water')).toBe(true);
		const placed = placeCustomSpawnPoint(shape, mark);
		expect(placed.customSpawnPoints).toHaveLength(1);
		expect(placed.spawnRevision).toBe(shape.spawnRevision + 1);
		expect(generateSpawnPoints(placed).some((point) => point.id === placed.customSpawnPoints[0].id)).toBe(
			true
		);
	});

	it('gates shore/air waymarks behind the shallows unlock', () => {
		const shape = emptyWorldShape();
		expect(canPlaceCustomSpawnPoint(shape, 'shore')).toBe(false);
		expect(placeCustomSpawnPoint(shape, { ...mark, layer: 'shore', category: 'terrestrial' })).toBe(shape);
		const unlocked = { ...shape, unlockedWorldspaces: ['water', 'shallows'] as Worldspace[] };
		expect(canPlaceCustomSpawnPoint(unlocked, 'shore')).toBe(true);
	});

	it('enforces the flat cap', () => {
		let shape = emptyWorldShape();
		for (let i = 0; i < MAX_CUSTOM_SPAWN_POINTS; i++) {
			shape = placeCustomSpawnPoint(shape, mark);
		}
		expect(shape.customSpawnPoints).toHaveLength(MAX_CUSTOM_SPAWN_POINTS);
		expect(canPlaceCustomSpawnPoint(shape, 'water')).toBe(false);
		expect(placeCustomSpawnPoint(shape, mark)).toBe(shape);
	});

	it('drops unrecognized tags rather than storing arbitrary strings', () => {
		const placed = placeCustomSpawnPoint(emptyWorldShape(), { ...mark, tags: ['mineral', 'made-up-tag'] });
		expect(placed.customSpawnPoints[0].tags).toEqual(['mineral']);
	});

	it('removes a waymark and drops it from generated spawn points', () => {
		const placed = placeCustomSpawnPoint(emptyWorldShape(), mark);
		const id = placed.customSpawnPoints[0].id;
		const removed = removeCustomSpawnPoint(placed, id);
		expect(removed.customSpawnPoints).toHaveLength(0);
		expect(removed.spawnRevision).toBe(placed.spawnRevision + 1);
		expect(generateSpawnPoints(removed).some((point) => point.id === id)).toBe(false);
	});
});

describe('sampling the sediment grid', () => {
	const grid = { w: 4, h: 2, cells: [0, 1, 0, 1, 1, 0, 1, 0] };

	it('returns a cell exactly at its own center', () => {
		expect(sampleSediment(grid, 1 / 8, 1 / 4)).toBeCloseTo(0);
		expect(sampleSediment(grid, 3 / 8, 1 / 4)).toBeCloseTo(1);
		expect(sampleSediment(grid, 1 / 8, 3 / 4)).toBeCloseTo(1);
	});

	it('interpolates between neighbors rather than stepping', () => {
		const mid = sampleSediment(grid, 2 / 8, 1 / 4);
		expect(mid).toBeGreaterThan(0.4);
		expect(mid).toBeLessThan(0.6);
	});

	it('clamps at the edges instead of reading past them', () => {
		expect(sampleSediment(grid, 0, 0)).toBeCloseTo(0);
		expect(sampleSediment(grid, 1, 1)).toBeCloseTo(0);
		expect(sampleSediment(grid, -5, -5)).toBeCloseTo(0);
		expect(sampleSediment(grid, 5, 5)).toBeCloseTo(0);
	});

	it('never invents density in an empty world', () => {
		const empty = { w: 8, h: 4, cells: Array(32).fill(0) };
		for (let i = 0; i <= 10; i++) expect(sampleSediment(empty, i / 10, i / 10)).toBe(0);
	});

	it('survives a degenerate grid', () => {
		expect(sampleSediment({ w: 0, h: 0, cells: [] }, 0.5, 0.5)).toBe(0);
	});
});

// The shelf rises with coverage, which is the mechanic: the floor she fills is the
// floor that shallows. It does not yet break the surface — 2_5D.md "the two
// horizons" explains why that is blocked on a composition decision rather than a
// number — so what is pinned here is the coupling, not a shoreline.
describe('coverage and the shelf', () => {
	it('lifts the seabed as the floor fills', () => {
		const bare = projectFloor(1, 1, 0, 0).y;
		const atUnlock = projectFloor(1, 1, 0, SEDIMENT_UNLOCK_COVERAGE).y;
		expect(atUnlock).toBeLessThan(bare);
	});

	it('leaves the shore under water at every coverage, for now', () => {
		for (const c of [0, SEDIMENT_UNLOCK_COVERAGE, 1]) {
			expect(isAboveWater(1, 1, 1, c)).toBe(false);
		}
	});

	it('never lifts the deep water, however full the floor gets', () => {
		expect(projectFloor(0.1, 0.5, 0, 1).y).toBeCloseTo(projectFloor(0.1, 0.5, 0, 0).y);
	});
});
