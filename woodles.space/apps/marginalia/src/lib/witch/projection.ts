// The floor is a plane in perspective, not a band in elevation.
//
// See 2_5D.md part 1. The diorama already believed in a ground plane — it draws
// flattened ellipse shadows under floor creatures and lays a bezier shelf-edge at
// the floor line — while the geometry underneath was a uniform rectangle. This is
// the projection that finishes the argument.
//
// `z` is depth into the scene on that plane: 0 at the far edge, 1 at the near edge
// (the bottom of the frame). That is exactly the axis the sediment grid's rows
// already are — SEDIMENT_GRID_H rows front-to-back — so nothing about the persisted
// grid changes meaning here, only how it is drawn. `x` stays a world fraction in
// [0, 1] and converges toward the vanishing point as z recedes.
//
// Two properties are load-bearing, and `projection.test.ts` pins both:
//
//   projectFloor(x, 0).y === SEDIMENT_BAND_TOP     the far edge is where it was
//   projectFloor(x, 1).y === 1                     the near edge is where it was
//
// so the floor still occupies exactly the screen band it occupied before, and every
// clamp, hit-test range, and shelf anchor written against SEDIMENT_BAND_TOP stays
// correct verbatim. Only the distribution *within* the band changes: far rows
// compress toward the horizon, near rows open up.

// the sediment floor — and anything anchored to it (placed features, the pour
// interaction) — is confined to this bottom fraction of the canvas, not the whole
// water column. Keeps the open water clear for creatures to read against, rather
// than sediment texture filling the entire depth.
export const SEDIMENT_BAND_TOP = 0.8;

// How hard the plane recedes. The primary tunable in this file: raising it pushes
// the horizon up and compresses the far rows harder. At 1.5 the near row of a
// 12-row grid is about 5x the screen height of the far row, which reads as depth
// without collapsing the back half into stripes.
export const FLOOR_FOCAL = 1.5;

// How much of the vertical convergence the horizontal axis borrows. A true camera
// would use all of it (1), but this scene is wide and shallow, and full convergence
// turns the floor into a triangle. At 0.45 the far edge spans ~73% of the width.
export const FLOOR_X_CONVERGENCE = 0.45;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// the depth scale at the far edge — what a 1-unit object at z=0 shrinks to.
const Q_FAR = 1 / (1 + FLOOR_FOCAL);

// Derived, not authored: the horizon sits wherever it must for the far edge of the
// plane to land on SEDIMENT_BAND_TOP. This is what preserves the composition.
export const FLOOR_HORIZON_Y = (SEDIMENT_BAND_TOP - Q_FAR) / (1 - Q_FAR);

/** Foreshortening at depth z — 1 at the near edge, Q_FAR at the far edge. */
export function floorDepthScale(z: number): number {
	return 1 / (1 + FLOOR_FOCAL * (1 - clamp01(z)));
}

/** Screen y (canvas fraction) of the floor plane at depth z. */
export function floorPlaneY(z: number): number {
	return FLOOR_HORIZON_Y + (1 - FLOOR_HORIZON_Y) * floorDepthScale(z);
}

/** How much the world's full width shrinks to at depth z. */
export function floorXScale(z: number): number {
	return 1 - FLOOR_X_CONVERGENCE * (1 - floorDepthScale(z));
}

/**
 * Depth of the *flat* floor plane at screen y, ignoring the seabed's shape. Only
 * meaningful where nothing stands proud of the plane; `floorDepthAt` is the one to
 * reach for once bathymetry is in play.
 */
export function floorDepthAtY(y: number): number | null {
	if (y < SEDIMENT_BAND_TOP || y > 1) return null;
	const q = (y - FLOOR_HORIZON_Y) / (1 - FLOOR_HORIZON_Y);
	if (q <= 0) return null;
	return clamp01(1 - (1 / q - 1) / FLOOR_FOCAL);
}

// How far a full-density cell of silt stands proud of the seabed, in canvas
// fractions, measured at the near edge.
export const FLOOR_HEIGHT_UNIT = 0.055;

// ── the seabed's own shape ───────────────────────────────────────────────────
//
// Sea level. Flat, because sea level is: the water's surface is drawn edge-on as
// a line, the way a cutaway shows it (2_5D.md part 2).
export const SEA_LEVEL_Y = 0.34;

// The shelf's shape. A smoothstep from toe to crest and flat after — a shelf
// rather than a spike. A quadratic was tried first and back-loads everything into
// the last few percent of the width, which makes land a sliver at the frame edge
// instead of a beach.
export const SHELF_TOE = 0.3;
export const SHELF_CREST = 0.86;

// How high the bare seabed sits, and how much her silt lifts it.
//
// These are deliberately short of what the shelf would need to break the surface,
// and that is a blocked design decision rather than a tuning choice. See 2_5D.md
// "the two horizons": the seabed's vanishing point sits at FLOOR_HORIZON_Y 0.667,
// while the water is drawn as a line at SEA_LEVEL_Y 0.340 — a third of the frame
// *above* it. Terrain can rise above a horizon, but to get there from here the
// near edge of the shelf has to ramp across 66% of the frame height, and it reads
// as a wall thrown across the diorama rather than as a beach. That is the two
// cameras in this scene disagreeing, and reconciling them is a composition
// decision, not a number.
//
// So the shelf shallows and does not emerge. Everything needed for it to emerge —
// the profile, the coverage coupling, the land shading, the coupled inverse — is
// here and works; only these two numbers hold it under water.
export const SHELF_COVERAGE_LIFT = 0.08;
export const SHELF_BASE = 0.2;

export function shelfProfile(x: number): number {
	const t = clamp01((clamp01(x) - SHELF_TOE) / (SHELF_CREST - SHELF_TOE));
	return t * t * (3 - 2 * t);
}

/**
 * The seabed's elevation at world x, before the silt she has laid on top of it —
 * deep on the left, shelving up to the right, and lifted bodily by how much of the
 * floor she has covered. `coverage` is `book.sedimentCoverage`, 0 to 1.
 *
 * This is the term that makes the waterline hers. The shoreline is wherever the
 * seabed crosses SEA_LEVEL_Y; nothing places it, and pouring moves it.
 */
export function bathymetryRise(x: number, coverage = 0): number {
	return (SHELF_BASE + clamp01(coverage) * SHELF_COVERAGE_LIFT) * shelfProfile(x);
}

const zFromQ = (q: number) => clamp01(1 - (1 / q - 1) / FLOOR_FOCAL);

/**
 * Depth at a screen point, accounting for the shelf.
 *
 * Bathymetry couples the two axes — the height of the seabed depends on x, and
 * which x a screen column corresponds to depends on z — so this cannot be solved
 * in one step the way the flat plane could. Given a rise it *is* closed form:
 *
 *   planeY(z) - rise·q = y   →   q = (y - HORIZON) / (1 - HORIZON - rise)
 *
 * so a few rounds of "guess the depth, read off x, take that column's rise, solve
 * again" converge quickly, because the shelf is smooth and shallow in x. Four is
 * comfortably past the point where the answer stops moving.
 */
export function floorDepthAt(screenX: number, y: number, coverage = 0): number | null {
	if (!Number.isFinite(y) || y > 1) return null;
	// The flat-plane answer is only a seed now, and often not even a legal one: a
	// shelf raises its part of the seabed well above SEDIMENT_BAND_TOP, so a point
	// genuinely on the floor can sit anywhere between sea level and the frame's
	// bottom. Start from the flat solution where it exists and mid-depth where it
	// does not, then let the iteration find the real one.
	let z = floorDepthAtY(y) ?? 0.5;
	for (let i = 0; i < 6; i++) {
		const worldX = clamp01(0.5 + (screenX - 0.5) / floorXScale(z));
		const denominator = 1 - FLOOR_HORIZON_Y - bathymetryRise(worldX, coverage);
		// Degenerate where the shelf would rise to the horizon itself.
		if (Math.abs(denominator) < 1e-6) break;
		const q = (y - FLOOR_HORIZON_Y) / denominator;
		if (q <= 0) break;
		z = zFromQ(q);
	}
	// Whether the point was on the seabed at all is decided by whether the answer
	// projects back to it. Solving against the bare shelf rather than the silt on
	// top costs at most FLOOR_HEIGHT_UNIT of error, which is under a pixel and a
	// good trade for keeping this module free of world state.
	const worldX = clamp01(0.5 + (screenX - 0.5) / floorXScale(z));
	return Math.abs(projectFloor(worldX, z, 0, coverage).y - y) < 0.012 ? z : null;
}

export function projectFloor(
	x: number,
	z: number,
	h = 0,
	coverage = 0
): { x: number; y: number; scale: number } {
	const scale = floorDepthScale(z);
	// The bathymetry is added here rather than by callers on purpose: the shelf is
	// a property of the world, not of whoever is drawing. Everything already
	// anchored to the floor — the sediment surface, placed features and their
	// auras, floor-layer life, the pour's landing point — rides the seabed's shape
	// with no change at its call site, the same way step A moved them all onto the
	// plane by changing one function.
	return {
		x: 0.5 + (x - 0.5) * floorXScale(z),
		y: floorPlaneY(z) - (bathymetryRise(x, coverage) + h * FLOOR_HEIGHT_UNIT) * scale,
		scale
	};
}

/** True where the seabed at (x, z, silt h) stands above the water. */
export function isAboveWater(x: number, z: number, h = 0, coverage = 0): boolean {
	return projectFloor(x, z, h, coverage).y <= SEA_LEVEL_Y;
}

/**
 * The inverse — screen position to world (x, z) on the plane. Null when the point
 * isn't on the floor at all, which is the same range check callers already made
 * against SEDIMENT_BAND_TOP. `x` is clamped, since the near-edge frame is wider
 * than the far-edge world and a click at the far corner falls outside it.
 */
export function unprojectFloor(
	x: number,
	y: number,
	coverage = 0
): { x: number; z: number } | null {
	const z = floorDepthAt(x, y, coverage);
	if (z === null) return null;
	return { x: clamp01(0.5 + (x - 0.5) / floorXScale(z)), z };
}

// ── the scene beyond the floor ───────────────────────────────────────────────
//
// The floor carries a real depth axis; the water column above it does not. A spawn
// point there stores only (x, y), where y is its layer's band — height, not
// distance. Rather than invent a persisted depth field for it, a point takes a
// *stable* depth derived from its own id: deterministic across frames and reloads,
// distinct per point, and costing nothing in the save. The volume gets populated;
// no data changes.
//
// The column occupies the near end of the same axis the floor uses, so one
// foreshortening function serves the whole scene — a creature at the back of the
// water reads at the same scale as the floor does at that distance, which is the
// point of having a single camera.

/** The far wall of the water column. Nothing in the column sits behind this. */
export const SCENE_FAR_Z = 0.35;

/** Depth for a point in the water column, from a stable [0, 1) seed. */
export function sceneDepthFromSeed(seed: number): number {
	return SCENE_FAR_Z + (1 - SCENE_FAR_Z) * Math.max(0, Math.min(1, seed));
}

// Fog. Underwater this is not a stylistic flourish — water genuinely swallows
// contrast over distance, which is why an aquarium is the easiest subject in the
// world to give depth to. Beer-Lambert falloff, normalized so the far wall lands
// exactly on FOG_MAX rather than wherever the exponential happens to be.
export const FOG_MAX = 0.42;
export const FOG_DENSITY = 1.6;
const FOG_NORM = 1 - Math.exp(-FOG_DENSITY);

/** How much atmosphere sits between the viewer and depth z. */
export function fogAlpha(z: number): number {
	const d = 1 - Math.max(0, Math.min(1, z));
	return (FOG_MAX * (1 - Math.exp(-FOG_DENSITY * d))) / FOG_NORM;
}

/**
 * Back-to-front comparator. Painter's order on a plane means the far thing goes
 * down first, so a nearer one can cover it — which is what the scene's passes were
 * missing: they drew in roster order, where a creature at the back could land on
 * top of one at the front.
 */
export function byDepth(a: { z: number }, b: { z: number }): number {
	return a.z - b.z;
}
