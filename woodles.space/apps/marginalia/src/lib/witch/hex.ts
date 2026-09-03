// The world is a hex field seen from a tilted camera.
//
// This replaces the perspective floor plane of steps A-D, and not for taste: a
// receding plane has a vanishing point, and 2_5D.md's "two horizons" showed that a
// drawn water line and a floor horizon cannot both be honoured in one frame once
// terrain has to cross the water. An axonometric camera has no vanishing point at
// all, so there is nothing left to disagree with — sea level becomes a world
// height, and land is any tile whose top face clears it.
//
// Axial coordinates (q, r) over pointy-top hexes, which is the hex the rest of the
// app already draws: MiniHex and HexStage both clip to
// polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%).
//
// Screen space stays canvas fractions in [0, 1], the convention the previous
// projection used, so the renderer's callers keep their shape.

/**
 * Circumradius of one hex, as a fraction of canvas width.
 *
 * Sized against the frame rather than picked: the canvas is 2:1 and the tilt
 * squashes rows, so a field of FIELD_COLS tiles at this size spans about three
 * quarters of the width and two thirds of the height — roughly 2.3:1 in pixels,
 * which reads as a wide island with open water around it. hexField.test.ts holds
 * the field inside the frame, so changing this without changing the field's shape
 * fails there rather than overflowing silently.
 */
export const HEX_SIZE = 0.028;

/**
 * How much the camera flattens the world vertically. 1 is straight overhead — a
 * flat map with no sense of a surface to stand on. 0 is edge-on. 0.56 leaves a
 * tile's top readable as a top while still giving its side room to show thickness.
 */
export const CAMERA_TILT = 0.56;

/** How tall one unit of elevation stands, before the tilt. */
export const TILE_THICKNESS = 0.052;

/** Sea level, in elevation units. Terrain above this is land. */
export const SEA_LEVEL = 1;

const SQRT3 = Math.sqrt(3);

export interface HexPoint {
	/** canvas fraction */
	x: number;
	/** canvas fraction, already tilted and raised by elevation */
	y: number;
	/** screen height of this tile's exposed side, in canvas fractions */
	side: number;
}

/** Flat world position of a hex's centre, before tilt or elevation. */
export function hexToWorld(q: number, r: number): { x: number; y: number } {
	return { x: HEX_SIZE * SQRT3 * (q + r / 2), y: HEX_SIZE * 1.5 * r };
}

/** The inverse — which fractional hex a flat world position falls in. */
export function worldToHex(x: number, y: number): { q: number; r: number } {
	const r = y / (HEX_SIZE * 1.5);
	return { q: x / (HEX_SIZE * SQRT3) - r / 2, r };
}

/**
 * A hex at (q, r) standing `elevation` units tall, placed on screen.
 *
 * `origin` is where world (0, 0) lands, which is the whole of the camera: with no
 * perspective to recompute, panning is a translation and nothing else. That is the
 * other thing axonometry buys — the lateral travel step E wanted is now free.
 */
export function projectHex(
	q: number,
	r: number,
	elevation: number,
	origin: { x: number; y: number } = { x: 0.5, y: 0.5 }
): HexPoint {
	const world = hexToWorld(q, r);
	const lift = elevation * TILE_THICKNESS;
	return {
		x: origin.x + world.x,
		y: origin.y + world.y * CAMERA_TILT - lift,
		side: lift
	};
}

/** Screen position back to a fractional hex, at a known elevation. */
export function unprojectHex(
	screenX: number,
	screenY: number,
	elevation: number,
	origin: { x: number; y: number } = { x: 0.5, y: 0.5 }
): { q: number; r: number } {
	const lift = elevation * TILE_THICKNESS;
	return worldToHex(screenX - origin.x, (screenY - origin.y + lift) / CAMERA_TILT);
}

/** Rounds a fractional axial coordinate to the hex it lands in. */
export function hexRound(q: number, r: number): { q: number; r: number } {
	const s = -q - r;
	let rq = Math.round(q);
	let rr = Math.round(r);
	const rs = Math.round(s);
	const dq = Math.abs(rq - q);
	const dr = Math.abs(rr - r);
	const ds = Math.abs(rs - s);
	if (dq > dr && dq > ds) rq = -rr - rs;
	else if (dr > ds) rr = -rq - rs;
	return { q: rq, r: rr };
}

/**
 * The six corners of a pointy-top hex's top face, tilted. Offsets in canvas
 * fractions from the tile's centre, starting at the top point, going clockwise.
 */
export function hexCorners(): { x: number; y: number }[] {
	const corners: { x: number; y: number }[] = [];
	for (let i = 0; i < 6; i++) {
		const angle = (Math.PI / 180) * (60 * i - 90);
		corners.push({
			x: HEX_SIZE * Math.cos(angle),
			y: HEX_SIZE * Math.sin(angle) * CAMERA_TILT
		});
	}
	return corners;
}

/**
 * Painter's order for the field: back rows first, and within a row left to right,
 * so a tile's raised side is covered by whatever stands in front of it. With no
 * perspective this ordering is exact rather than an approximation — another thing
 * the axonometric camera makes simpler than the plane did.
 */
export function byHexRow(a: { q: number; r: number }, b: { q: number; r: number }): number {
	return a.r - b.r || a.q - b.q;
}

/**
 * The rectangular sediment grid read as a hex field.
 *
 * SedimentGrid is 48x12 and persisted at that size. Odd-r offset coordinates are
 * how hex maps are normally stored anyway — a rectangular array with every other
 * row shifted half a tile — so the grid is already a hex map and needs no
 * migration to become one. Same move as step A, which turned the grid's rows into
 * a depth axis by reinterpreting them rather than changing them.
 */
export function offsetToAxial(col: number, row: number): { q: number; r: number } {
	return { q: col - (row - (row & 1)) / 2, r: row };
}

export function axialToOffset(q: number, r: number): { col: number; row: number } {
	return { col: q + (r - (r & 1)) / 2, row: r };
}
