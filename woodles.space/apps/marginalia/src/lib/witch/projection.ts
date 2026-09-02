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

/** Depth of the floor plane at screen y, or null if that y isn't on the plane. */
export function floorDepthAtY(y: number): number | null {
	if (y < SEDIMENT_BAND_TOP || y > 1) return null;
	const q = (y - FLOOR_HORIZON_Y) / (1 - FLOOR_HORIZON_Y);
	if (q <= 0) return null;
	return clamp01(1 - (1 / q - 1) / FLOOR_FOCAL);
}

/**
 * World (x, z) on the floor plane to screen position and foreshortening. `x` and
 * the returned `x`/`y` are canvas fractions; `scale` multiplies any size drawn at
 * that spot.
 */
export function projectFloor(x: number, z: number): { x: number; y: number; scale: number } {
	const scale = floorDepthScale(z);
	return {
		x: 0.5 + (x - 0.5) * floorXScale(z),
		y: floorPlaneY(z),
		scale
	};
}

/**
 * The inverse — screen position to world (x, z) on the plane. Null when the point
 * isn't on the floor at all, which is the same range check callers already made
 * against SEDIMENT_BAND_TOP. `x` is clamped, since the near-edge frame is wider
 * than the far-edge world and a click at the far corner falls outside it.
 */
export function unprojectFloor(x: number, y: number): { x: number; z: number } | null {
	const z = floorDepthAtY(y);
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
