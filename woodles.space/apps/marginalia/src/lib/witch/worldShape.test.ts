import { describe, expect, it } from 'vitest';
import type { Life } from './content/life';
import {
	SEDIMENT_CELL_THRESHOLD,
	SEDIMENT_UNLOCK_COVERAGE,
	applySedimentPour,
	emptySedimentGrid,
	emptyWorldShape,
	featurePlacementStatus,
	generateSpawnPoints,
	lifeVisibleInWorldspace,
	normalizeWorldShape,
	placeFeatureOnBestSediment,
	resolveSpawnPointForLife,
	sedimentCoverage,
	unlockWorldspacesForCoverage,
	visibleLifeForWorldspace,
	type Worldspace
} from './worldShape';

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
});
