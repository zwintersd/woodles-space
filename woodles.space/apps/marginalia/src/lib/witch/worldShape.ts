import type { Life, LifeCategory, LifeDomain } from './content/life';

// Worldspace's shape now lives in @woodles/witch-engine; re-exported here so
// existing imports keep working.
import type { Worldspace } from '@woodles/witch-engine';
import { SEDIMENT_BAND_TOP, floorDepthAtY, floorPlaneY } from './projection';
export type { Worldspace };
export type SpawnLayer = 'water' | 'floor' | 'shore' | 'air';
export type SpawnRarity = 'common' | 'uncommon' | 'rare';

export const SEDIMENT_GRID_W = 48;
export const SEDIMENT_GRID_H = 12;
export const SEDIMENT_CELL_THRESHOLD = 0.35;
export const SEDIMENT_UNLOCK_COVERAGE = 0.6;
export const SEDIMENT_UNLOCK_COST = 60;
export const SEDIMENT_POUR_RATE = 0.8;
export const SEDIMENT_POUR_RADIUS = 2.5;
export const SEDIMENT_POUR_STRENGTH = 0.46;
export const WORLD_WATER_TOP = 0.34;
// the floor plane's screen band and the perspective over it — see projection.ts.
export { SEDIMENT_BAND_TOP } from './projection';

// waymarks — spawn points she authors directly, in full. reuses the exact
// tag vocabulary spawnWeightForLife already reads (excludes 'rare', which is
// the dedicated `rarity` field below, not a tag). a flat cap keeps this from
// letting her carpet the world with points.
export const CUSTOM_SPAWN_TAGS = ['mineral', 'nutrient', 'shelter', 'bottom', 'perch'] as const;
export const MAX_CUSTOM_SPAWN_POINTS = 6;

export interface SedimentGrid {
	w: number;
	h: number;
	cells: number[];
}

export interface PlacedWorldFeature {
	id: string;
	featureId: WorldFeatureId;
	x: number;
	y: number;
	rotation: number;
	scale: number;
}

// A placed instance of a CREATURE_SPECS entry — decorative only, no vitals/
// insight participation. Parallels PlacedWorldFeature exactly.
export interface PlacedCreature {
	id: string;
	creatureId: string;
	x: number;
	y: number;
	rotation: number;
	scale: number;
}

// A spawn point she authors herself, in full — "waymarks." x/y are plain
// canvas fractions, the same convention DEFAULT_WATER_SPAWNS/SHALLOWS_SPAWNS
// already use (not the sediment-grid-normalized space PlacedWorldFeature.y
// uses, since a waymark isn't sediment-anchored).
export interface PlacedSpawnPoint {
	id: string;
	x: number;
	y: number;
	category: LifeCategory;
	layer: SpawnLayer;
	tags: string[];
	weight: number;
	rarity: SpawnRarity;
}

export interface WorldShape {
	activeWorldspace: Worldspace;
	unlockedWorldspaces: Worldspace[];
	sedimentUnlocked: boolean;
	sedimentGrid: SedimentGrid;
	seenUnlocks: Worldspace[];
	placedFeatures: PlacedWorldFeature[];
	placedCreatures: PlacedCreature[];
	customSpawnPoints: PlacedSpawnPoint[];
	spawnRevision: number;
}

export interface WorldFeatureSpec {
	id: string;
	name: string;
	short: string;
	effect: string;
	tags: string[];
	categories: LifeCategory[];
	minSediment: number;
	sprite?: string;
}

export interface SpawnPoint {
	id: string;
	x: number;
	y: number;
	category: LifeCategory;
	tags: string[];
	weight: number;
	rarity: SpawnRarity;
	layer: SpawnLayer;
	scale: number;
	featureId?: string;
}

export const FEATURE_SPECS = [
	{
		id: 'shell_bed',
		name: 'shell bed',
		short: 'a pale scatter where tiny lives learn shelter.',
		effect: 'rare aquatic life is more likely to gather near shelter.',
		tags: ['shelter', 'shallows', 'rare'],
		categories: ['aquatic'],
		minSediment: 0.35
	},
	{
		id: 'black_silt',
		name: 'black silt',
		short: 'a dark floor that keeps what falls.',
		effect: 'bottom-feeding and nutrient-bound life prefer this sediment.',
		tags: ['bottom', 'nutrient', 'hidden'],
		categories: ['aquatic'],
		minSediment: 0.35
	},
	{
		id: 'mineral_glint',
		name: 'mineral glint',
		short: 'bright flecks in the floor, almost a memory of stone.',
		effect: 'geologic life leans toward mineral-rich water.',
		tags: ['mineral', 'glint', 'rare'],
		categories: ['aquatic', 'terrestrial'],
		minSediment: 0.45
	},
	{
		id: 'reef_nub',
		name: 'reef nub',
		short: 'the first hard little place to rest against.',
		effect: 'adds perch and shallows tags for later life.',
		tags: ['perch', 'shallows', 'shelter'],
		categories: ['aquatic', 'terrestrial'],
		minSediment: 0.55
	}
] as const satisfies readonly WorldFeatureSpec[];

export type WorldFeatureId = (typeof FEATURE_SPECS)[number]['id'];

// Shared, public, decorative creature sprites — separate from Bestiary
// bindings (which are per-user) and from Life (which has vitals/stages).
// These are pure visual flourish: Brianna can call one into the scene, it
// gets a spot and plays its animation loop, and that's the whole mechanic.
// `cols`/`rows`/`frameCount`/`fps` describe the sprite sheet exactly the way
// witch-influence sheets already do (see WorldCanvas.svelte's loadSheet).
export interface CreatureSpec {
	id: string;
	name: string;
	blurb: string;
	sprite: string;
	cols: number;
	rows: number;
	frameCount: number;
	fps: number;
	layer: SpawnLayer;
	boxScale: number;
}

// names/blurbs below are a placeholder draft in Brianna's voice — redline freely.
export const CREATURE_SPECS = [
	{
		id: 'star_drifter',
		name: 'star-drifter',
		blurb: 'something with more points than it needs, going nowhere in particular.',
		sprite: 'star-drifter.png',
		cols: 4,
		rows: 3,
		frameCount: 12,
		fps: 8,
		layer: 'water',
		boxScale: 0.9
	},
	{
		id: 'spotted_swimmer',
		name: 'spotted swimmer',
		blurb: 'small, spotted, unbothered. it was already here when she looked.',
		sprite: 'spotted-swimmer.png',
		cols: 4,
		rows: 3,
		frameCount: 12,
		fps: 10,
		layer: 'water',
		boxScale: 1.05
	}
] as const satisfies readonly CreatureSpec[];

export type CreatureId = (typeof CREATURE_SPECS)[number]['id'];

export function creatureById(id: unknown): CreatureSpec | null {
	return CREATURE_SPECS.find((creature) => creature.id === id) ?? null;
}

export function isCreatureId(id: unknown): id is CreatureId {
	return CREATURE_SPECS.some((creature) => creature.id === id);
}

const DEFAULT_WATER_SPAWNS: SpawnPoint[] = [
	{
		id: 'surface-drift',
		x: 0.2,
		y: 0.5,
		category: 'aquatic',
		tags: ['water', 'surface', 'drift'],
		weight: 0.9,
		rarity: 'common',
		layer: 'water',
		scale: 0.86
	},
	{
		id: 'middle-current',
		x: 0.52,
		y: 0.69,
		category: 'aquatic',
		tags: ['water', 'current'],
		weight: 1.15,
		rarity: 'common',
		layer: 'water',
		scale: 1
	},
	{
		id: 'deep-blue',
		x: 0.8,
		y: 0.84,
		category: 'aquatic',
		tags: ['water', 'deep', 'bottom'],
		weight: 0.82,
		rarity: 'uncommon',
		layer: 'floor',
		scale: 0.94
	}
];

const SHALLOWS_SPAWNS: SpawnPoint[] = [
	{
		id: 'first-shelf',
		x: 0.38,
		y: 0.56,
		category: 'terrestrial',
		tags: ['shore', 'shallows', 'shelter'],
		weight: 0.95,
		rarity: 'common',
		layer: 'shore',
		scale: 0.88
	},
	{
		id: 'salt-mist-line',
		x: 0.7,
		y: 0.28,
		category: 'atmospheric',
		tags: ['air', 'mist', 'water'],
		weight: 1,
		rarity: 'common',
		layer: 'air',
		scale: 0.82
	}
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function stableHash(input: string): number {
	let h = 2166136261;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

export function stable01(input: string): number {
	return (stableHash(input) % 100000) / 100000;
}

export function emptySedimentGrid(w = SEDIMENT_GRID_W, h = SEDIMENT_GRID_H): SedimentGrid {
	return { w, h, cells: Array.from({ length: w * h }, () => 0) };
}

export function normalizeSedimentGrid(input: unknown): SedimentGrid {
	if (!input || typeof input !== 'object') return emptySedimentGrid();
	const maybe = input as Partial<SedimentGrid>;
	const w = Number.isInteger(maybe.w) && maybe.w! > 0 ? maybe.w! : SEDIMENT_GRID_W;
	const h = Number.isInteger(maybe.h) && maybe.h! > 0 ? maybe.h! : SEDIMENT_GRID_H;
	const cells = Array.isArray(maybe.cells) ? maybe.cells : [];
	const normalized = Array.from({ length: w * h }, (_, index) => {
		const value = Number(cells[index] ?? 0);
		return Number.isFinite(value) ? clamp01(value) : 0;
	});
	return { w, h, cells: normalized };
}

export function sedimentCoverage(
	grid: SedimentGrid,
	threshold = SEDIMENT_CELL_THRESHOLD
): number {
	if (grid.cells.length === 0) return 0;
	let filled = 0;
	for (const value of grid.cells) if (value >= threshold) filled += 1;
	return filled / grid.cells.length;
}

export function applySedimentPour(
	grid: SedimentGrid,
	x: number,
	y: number,
	seconds: number,
	radius = SEDIMENT_POUR_RADIUS
): SedimentGrid {
	if (seconds <= 0 || radius <= 0) return grid;
	const cx = clamp01(x) * (grid.w - 1);
	const cy = clamp01(y) * (grid.h - 1);
	const cells = grid.cells.slice();
	const minX = Math.max(0, Math.floor(cx - radius));
	const maxX = Math.min(grid.w - 1, Math.ceil(cx + radius));
	const minY = Math.max(0, Math.floor(cy - radius));
	const maxY = Math.min(grid.h - 1, Math.ceil(cy + radius));

	for (let gy = minY; gy <= maxY; gy++) {
		for (let gx = minX; gx <= maxX; gx++) {
			const dist = Math.hypot(gx - cx, gy - cy);
			if (dist > radius) continue;
			const falloff = Math.pow(1 - dist / radius, 1.35);
			const index = gy * grid.w + gx;
			cells[index] = clamp01(cells[index] + SEDIMENT_POUR_STRENGTH * seconds * falloff);
		}
	}

	return { ...grid, cells };
}

export function emptyWorldShape(): WorldShape {
	return {
		activeWorldspace: 'water',
		unlockedWorldspaces: ['water'],
		sedimentUnlocked: false,
		sedimentGrid: emptySedimentGrid(),
		seenUnlocks: [],
		placedFeatures: [],
		placedCreatures: [],
		customSpawnPoints: [],
		spawnRevision: 0
	};
}

function uniqueWorldspaces(values: unknown): Worldspace[] {
	const source = Array.isArray(values) ? values : [];
	const next = new Set<Worldspace>(['water']);
	for (const value of source) {
		if (value === 'water' || value === 'shallows') next.add(value);
	}
	return Array.from(next);
}

export function normalizeWorldShape(input: unknown): WorldShape {
	const defaults = emptyWorldShape();
	if (!input || typeof input !== 'object') return defaults;
	const maybe = input as Partial<WorldShape>;
	const sedimentGrid = normalizeSedimentGrid(maybe.sedimentGrid);
	const unlockedWorldspaces = uniqueWorldspaces(maybe.unlockedWorldspaces);
	if (sedimentCoverage(sedimentGrid) >= SEDIMENT_UNLOCK_COVERAGE) {
		unlockedWorldspaces.push('shallows');
	}
	const unlocked = Array.from(new Set(unlockedWorldspaces));
	const active =
		maybe.activeWorldspace === 'shallows' && unlocked.includes('shallows') ? 'shallows' : 'water';
	return {
		activeWorldspace: active,
		unlockedWorldspaces: unlocked,
		sedimentUnlocked: Boolean(maybe.sedimentUnlocked),
		sedimentGrid,
		seenUnlocks: uniqueWorldspaces(maybe.seenUnlocks).filter((space) => space !== 'water'),
		placedFeatures: normalizePlacedFeatures(maybe.placedFeatures),
		placedCreatures: normalizePlacedCreatures(maybe.placedCreatures),
		customSpawnPoints: normalizePlacedSpawnPoints(maybe.customSpawnPoints),
		spawnRevision: Number.isFinite(maybe.spawnRevision) ? Math.max(0, maybe.spawnRevision ?? 0) : 0
	};
}

const LIFE_CATEGORIES: readonly LifeCategory[] = ['aquatic', 'terrestrial', 'atmospheric'];
const SPAWN_LAYERS: readonly SpawnLayer[] = ['water', 'floor', 'shore', 'air'];
const SPAWN_RARITIES: readonly SpawnRarity[] = ['common', 'uncommon', 'rare'];

function normalizePlacedSpawnPoints(input: unknown): PlacedSpawnPoint[] {
	if (!Array.isArray(input)) return [];
	const seen = new Set<string>();
	const out: PlacedSpawnPoint[] = [];
	for (const item of input) {
		if (!item || typeof item !== 'object') continue;
		const maybe = item as Partial<PlacedSpawnPoint>;
		if (
			!maybe.id ||
			seen.has(maybe.id) ||
			!LIFE_CATEGORIES.includes(maybe.category as LifeCategory) ||
			!SPAWN_LAYERS.includes(maybe.layer as SpawnLayer) ||
			!SPAWN_RARITIES.includes(maybe.rarity as SpawnRarity)
		) {
			continue;
		}
		seen.add(maybe.id);
		const tags = Array.isArray(maybe.tags)
			? maybe.tags.filter((tag): tag is string => CUSTOM_SPAWN_TAGS.includes(tag as (typeof CUSTOM_SPAWN_TAGS)[number]))
			: [];
		out.push({
			id: maybe.id,
			x: clamp01(Number(maybe.x ?? 0.5)),
			y: clamp01(Number(maybe.y ?? 0.5)),
			category: maybe.category as LifeCategory,
			layer: maybe.layer as SpawnLayer,
			tags,
			weight: Number.isFinite(maybe.weight) ? Math.max(0.3, Math.min(2, maybe.weight!)) : 1,
			rarity: maybe.rarity as SpawnRarity
		});
		if (out.length >= MAX_CUSTOM_SPAWN_POINTS) break;
	}
	return out;
}

function normalizePlacedFeatures(input: unknown): PlacedWorldFeature[] {
	if (!Array.isArray(input)) return [];
	const seen = new Set<string>();
	const out: PlacedWorldFeature[] = [];
	for (const item of input) {
		if (!item || typeof item !== 'object') continue;
		const maybe = item as Partial<PlacedWorldFeature>;
		if (!maybe.id || seen.has(maybe.id) || !isWorldFeatureId(maybe.featureId)) continue;
		seen.add(maybe.id);
		out.push({
			id: maybe.id,
			featureId: maybe.featureId,
			x: clamp01(Number(maybe.x ?? 0.5)),
			y: clamp01(Number(maybe.y ?? 0.5)),
			rotation: Number.isFinite(maybe.rotation) ? maybe.rotation! : 0,
			scale: Number.isFinite(maybe.scale) ? Math.max(0.5, Math.min(1.6, maybe.scale!)) : 1
		});
	}
	return out;
}

function normalizePlacedCreatures(input: unknown): PlacedCreature[] {
	if (!Array.isArray(input)) return [];
	const seen = new Set<string>();
	const out: PlacedCreature[] = [];
	for (const item of input) {
		if (!item || typeof item !== 'object') continue;
		const maybe = item as Partial<PlacedCreature>;
		if (!maybe.id || seen.has(maybe.id) || !isCreatureId(maybe.creatureId)) continue;
		seen.add(maybe.id);
		out.push({
			id: maybe.id,
			creatureId: maybe.creatureId,
			x: clamp01(Number(maybe.x ?? 0.5)),
			y: clamp01(Number(maybe.y ?? 0.5)),
			rotation: Number.isFinite(maybe.rotation) ? maybe.rotation! : 0,
			scale: Number.isFinite(maybe.scale) ? Math.max(0.5, Math.min(1.6, maybe.scale!)) : 1
		});
	}
	return out;
}

export function featureById(id: unknown): WorldFeatureSpec | null {
	return FEATURE_SPECS.find((feature) => feature.id === id) ?? null;
}

export function isWorldFeatureId(id: unknown): id is WorldFeatureId {
	return FEATURE_SPECS.some((feature) => feature.id === id);
}

export function lifeVisibleInWorldspace(life: Life, worldspace: Worldspace): boolean {
	return worldspace === 'shallows' || life.category === 'aquatic';
}

export function visibleLifeForWorldspace(life: Life[], worldspace: Worldspace): Life[] {
	return life.filter((item) => lifeVisibleInWorldspace(item, worldspace));
}

export function isShallowsUnlocked(shape: WorldShape): boolean {
	return shape.unlockedWorldspaces.includes('shallows');
}

export function unlockWorldspacesForCoverage(shape: WorldShape): WorldShape {
	if (sedimentCoverage(shape.sedimentGrid) < SEDIMENT_UNLOCK_COVERAGE || isShallowsUnlocked(shape)) {
		return shape;
	}
	return {
		...shape,
		unlockedWorldspaces: [...shape.unlockedWorldspaces, 'shallows'],
		spawnRevision: shape.spawnRevision + 1
	};
}

export type FeaturePlacementReason =
	| 'ready'
	| 'locked'
	| 'already-placed'
	| 'needs-sediment';

export function featurePlacementStatus(
	shape: WorldShape,
	featureId: WorldFeatureId
): { ok: boolean; reason: FeaturePlacementReason } {
	const feature = featureById(featureId);
	if (!feature || !isShallowsUnlocked(shape)) return { ok: false, reason: 'locked' };
	if (shape.placedFeatures.some((placed) => placed.featureId === featureId)) {
		return { ok: false, reason: 'already-placed' };
	}
	return findFeatureAnchor(shape.sedimentGrid, feature.minSediment)
		? { ok: true, reason: 'ready' }
		: { ok: false, reason: 'needs-sediment' };
}

export function placeFeatureOnBestSediment(
	shape: WorldShape,
	featureId: WorldFeatureId
): WorldShape {
	const status = featurePlacementStatus(shape, featureId);
	const feature = featureById(featureId);
	if (!status.ok || !feature) return shape;
	const anchor = findFeatureAnchor(shape.sedimentGrid, feature.minSediment);
	if (!anchor) return shape;
	const index = shape.placedFeatures.length + 1;
	const id = `${featureId}-${index}`;
	const seed = stable01(`${id}:${anchor.x.toFixed(3)}:${anchor.y.toFixed(3)}`);
	return {
		...shape,
		placedFeatures: [
			...shape.placedFeatures,
			{
				id,
				featureId,
				x: anchor.x,
				y: anchor.y,
				rotation: -0.35 + seed * 0.7,
				scale: 0.82 + seed * 0.36
			}
		],
		spawnRevision: shape.spawnRevision + 1
	};
}

export type CreaturePlacementReason = 'ready' | 'locked' | 'already-placed' | 'unknown';

export function creaturePlacementStatus(
	shape: WorldShape,
	creatureId: string
): { ok: boolean; reason: CreaturePlacementReason } {
	const creature = creatureById(creatureId);
	if (!creature) return { ok: false, reason: 'unknown' };
	if ((creature.layer === 'shore' || creature.layer === 'air') && !isShallowsUnlocked(shape)) {
		return { ok: false, reason: 'locked' };
	}
	if (shape.placedCreatures.some((placed) => placed.creatureId === creatureId)) {
		return { ok: false, reason: 'already-placed' };
	}
	return { ok: true, reason: 'ready' };
}

// the band each layer occupies, in plain canvas-fraction terms — not the
// sediment-grid-normalized space placedFeatures.y uses, since creatures
// aren't sediment-anchored. matches DEFAULT_WATER_SPAWNS/SHALLOWS_SPAWNS'
// own y values for each layer.
const CREATURE_LAYER_BANDS: Record<SpawnLayer, { lo: number; hi: number }> = {
	air: { lo: 0.14, hi: 0.3 },
	shore: { lo: 0.5, hi: 0.6 },
	water: { lo: 0.42, hi: 0.72 },
	floor: { lo: SEDIMENT_BAND_TOP, hi: 0.93 }
};

// free and auto-placed, same as placeFeatureOnBestSediment but with no
// sediment anchor to seek — decorative creatures just need a spot within
// their layer's natural band.
export function placeCreature(shape: WorldShape, creatureId: string): WorldShape {
	const status = creaturePlacementStatus(shape, creatureId);
	const creature = creatureById(creatureId);
	if (!status.ok || !creature) return shape;
	const index = shape.placedCreatures.length;
	const id = `${creatureId}-${index + 1}`;
	const band = CREATURE_LAYER_BANDS[creature.layer];
	const seed = stable01(`${id}:seed`);
	// successive placements spread across the width by index rather than
	// clustering — the same crowding problem spawn points have (see
	// WorldCanvas.svelte's drawCreatureLayers), avoided here by construction.
	const x = 0.12 + ((index * 0.37 + seed * 0.16) % 0.76);
	const y = band.lo + seed * (band.hi - band.lo);
	return {
		...shape,
		placedCreatures: [
			...shape.placedCreatures,
			{ id, creatureId, x, y, rotation: -0.2 + seed * 0.4, scale: 0.88 + seed * 0.28 }
		],
		spawnRevision: shape.spawnRevision + 1
	};
}

// waymarks — spawn points she authors directly. cost scales with how much
// pull she's asking for, in the same range interventions already cost
// (25–150 insight, content/interventions.ts): a cheap, common, low-weight
// mark is close to free; a rare, high-weight one costs like a real
// intervention.
export function customSpawnPointCost(weight: number, rarity: SpawnRarity): number {
	const rarityBonus = rarity === 'rare' ? 50 : rarity === 'uncommon' ? 20 : 0;
	return Math.round(20 + weight * 25 + rarityBonus);
}

export function canPlaceCustomSpawnPoint(shape: WorldShape, layer: SpawnLayer): boolean {
	if (shape.customSpawnPoints.length >= MAX_CUSTOM_SPAWN_POINTS) return false;
	if ((layer === 'shore' || layer === 'air') && !isShallowsUnlocked(shape)) return false;
	return true;
}

export interface CustomSpawnPointInput {
	x: number;
	y: number;
	category: LifeCategory;
	layer: SpawnLayer;
	tags: string[];
	weight: number;
	rarity: SpawnRarity;
}

// spawnRevision is monotonically increasing and bumped exactly once per
// mutation (including removals below), so shape.spawnRevision + 1 has never
// been used as an id before — collision-free even after a mark is removed
// and a new one takes its place, unlike a plain array-length-based id would be.
export function placeCustomSpawnPoint(shape: WorldShape, input: CustomSpawnPointInput): WorldShape {
	if (!canPlaceCustomSpawnPoint(shape, input.layer)) return shape;
	const id = `waymark-${shape.spawnRevision + 1}`;
	return {
		...shape,
		customSpawnPoints: [
			...shape.customSpawnPoints,
			{
				id,
				x: clamp01(input.x),
				y: clamp01(input.y),
				category: input.category,
				layer: input.layer,
				tags: input.tags.filter((tag) =>
					CUSTOM_SPAWN_TAGS.includes(tag as (typeof CUSTOM_SPAWN_TAGS)[number])
				),
				weight: Math.max(0.3, Math.min(2, input.weight)),
				rarity: input.rarity
			}
		],
		spawnRevision: shape.spawnRevision + 1
	};
}

export function removeCustomSpawnPoint(shape: WorldShape, id: string): WorldShape {
	if (!shape.customSpawnPoints.some((point) => point.id === id)) return shape;
	return {
		...shape,
		customSpawnPoints: shape.customSpawnPoints.filter((point) => point.id !== id),
		spawnRevision: shape.spawnRevision + 1
	};
}

function findFeatureAnchor(
	grid: SedimentGrid,
	minSediment: number
): { x: number; y: number } | null {
	let best = -Infinity;
	let bestPoint: { x: number; y: number } | null = null;
	for (let y = 0; y < grid.h; y++) {
		for (let x = 0; x < grid.w; x++) {
			const value = grid.cells[y * grid.w + x] ?? 0;
			if (value < minSediment) continue;
			const centered = 1 - Math.abs((x + 0.5) / grid.w - 0.5) * 0.35;
			const floorBias = 0.85 + ((y + 0.5) / grid.h) * 0.25;
			const score = value * centered * floorBias;
			if (score > best) {
				best = score;
				bestPoint = { x: (x + 0.5) / grid.w, y: (y + 0.5) / grid.h };
			}
		}
	}
	return bestPoint;
}

// These two are now the forward and inverse of the floor projection rather than a
// linear remap of the band (2_5D.md part 1). Their endpoints are unchanged — 0 maps
// to SEDIMENT_BAND_TOP and 1 to the bottom of the frame — so every caller keeps
// working and the grid's stored y keeps meaning exactly what it meant. What changed
// is the distribution between those endpoints: the rows are depth now.
export function waterGridYToWorld(y: number): number {
	return floorPlaneY(clamp01(y));
}

export function worldYToWaterGrid(y: number): number | null {
	return floorDepthAtY(y);
}

export function generateSpawnPoints(shape: WorldShape): SpawnPoint[] {
	const points = DEFAULT_WATER_SPAWNS.map((point) => ({ ...point }));
	points.push(...sedimentSpawnPoints(shape.sedimentGrid));
	if (shape.activeWorldspace === 'shallows') points.push(...SHALLOWS_SPAWNS.map((point) => ({ ...point })));
	for (const placed of shape.placedFeatures) {
		const feature = featureById(placed.featureId);
		if (!feature) continue;
		for (const category of feature.categories) {
			if (category !== 'aquatic' && shape.activeWorldspace !== 'shallows') continue;
			points.push({
				id: `feature-${placed.id}-${category}`,
				x: placed.x,
				y: waterGridYToWorld(placed.y),
				category,
				tags: feature.tags,
				weight: feature.tags.includes('rare') ? 0.62 : 0.86,
				rarity: feature.tags.includes('rare') ? 'rare' : 'uncommon',
				layer: category === 'terrestrial' ? 'shore' : 'floor',
				scale: placed.scale,
				featureId: placed.id
			});
		}
	}
	for (const mark of shape.customSpawnPoints) {
		points.push({
			id: mark.id,
			x: mark.x,
			y: mark.y,
			category: mark.category,
			tags: mark.tags,
			weight: mark.weight,
			rarity: mark.rarity,
			layer: mark.layer,
			scale: 1
		});
	}
	return points;
}

// The raw floor's own character, independent of anything placed on it —
// reuses the exact vocabulary spawnWeightForLife already knows how to read
// (mineral/nutrient/shelter/bottom), so a naturally mineral-rich patch of
// sediment can draw geology life before a mineral_glint feature ever lands
// there. Varies by grid position, not by world/save — spatial variety
// within one world is what spawn points need; per-world reseeding is a
// procedural-worlds (DESIGN.md phase E) concern, not this one.
const SEDIMENT_SURFACE_TAGS = ['mineral', 'nutrient', 'shelter', 'bottom'] as const;

function sedimentSurfaceTag(bx: number, by: number): string {
	const roll = stable01(`sediment-surface:${bx}:${by}`);
	return SEDIMENT_SURFACE_TAGS[Math.floor(roll * SEDIMENT_SURFACE_TAGS.length)];
}

function sedimentSpawnPoints(grid: SedimentGrid): SpawnPoint[] {
	const points: SpawnPoint[] = [];
	const blockW = 6;
	const blockH = 3;
	for (let by = 0; by < grid.h; by += blockH) {
		for (let bx = 0; bx < grid.w; bx += blockW) {
			let sum = 0;
			let count = 0;
			for (let y = by; y < Math.min(grid.h, by + blockH); y++) {
				for (let x = bx; x < Math.min(grid.w, bx + blockW); x++) {
					sum += grid.cells[y * grid.w + x] ?? 0;
					count += 1;
				}
			}
			const avg = count ? sum / count : 0;
			if (avg < SEDIMENT_CELL_THRESHOLD * 0.55) continue;
			const x = (bx + Math.min(blockW, grid.w - bx) / 2) / grid.w;
			const waterY = (by + Math.min(blockH, grid.h - by) / 2) / grid.h;
			points.push({
				id: `sediment-${bx}-${by}`,
				x,
				y: waterGridYToWorld(waterY),
				category: 'aquatic',
				tags: ['sediment', waterY > 0.55 ? 'bottom' : 'shallow', sedimentSurfaceTag(bx, by)],
				weight: 0.45 + avg,
				rarity: avg > 0.62 ? 'uncommon' : 'common',
				layer: 'floor',
				scale: 0.74 + avg * 0.32
			});
		}
	}
	return points;
}

export function resolveSpawnPointForLife(
	life: Pick<Life, 'id' | 'category' | 'domain' | 'insightWeight' | 'studyEase'>,
	shape: WorldShape
): SpawnPoint {
	const candidates = generateSpawnPoints(shape).filter((point) => point.category === life.category);
	const points = candidates.length > 0 ? candidates : DEFAULT_WATER_SPAWNS;
	const weighted = points.map((point) => ({ point, weight: spawnWeightForLife(life, point) }));
	const total = weighted.reduce((sum, item) => sum + item.weight, 0);
	let cursor = stable01(`${life.id}:${shape.activeWorldspace}:${shape.spawnRevision}`) * total;
	for (const item of weighted) {
		cursor -= item.weight;
		if (cursor <= 0) return item.point;
	}
	return weighted[weighted.length - 1].point;
}

export function spawnWeightForLife(
	life: Pick<Life, 'domain' | 'insightWeight' | 'studyEase'>,
	point: SpawnPoint
): number {
	let weight = point.weight;
	const domain = life.domain as LifeDomain;
	if (point.tags.includes('shelter') && domain === 'animal') weight *= 1.45;
	if (point.tags.includes('bottom') && (domain === 'geology' || domain === 'ecosystem')) weight *= 1.3;
	if (point.tags.includes('nutrient') && (domain === 'plant' || domain === 'ecosystem')) weight *= 1.35;
	if (point.tags.includes('mineral') && domain === 'geology') weight *= 1.65;
	if (point.tags.includes('perch') && domain === 'animal') weight *= 1.25;
	if (point.rarity === 'rare') {
		const strange = life.insightWeight >= 1.4 || life.studyEase <= 0.8;
		weight *= strange ? 1.65 : 0.58;
	}
	return Math.max(0.01, weight);
}

export function spawnTagsForShape(shape: WorldShape): string[] {
	const tags = new Set<string>();
	for (const point of generateSpawnPoints(shape)) for (const tag of point.tags) tags.add(tag);
	return Array.from(tags).sort();
}

export function featureEffectLines(shape: WorldShape): string[] {
	return shape.placedFeatures
		.map((placed) => featureById(placed.featureId)?.effect)
		.filter((effect): effect is string => Boolean(effect));
}
