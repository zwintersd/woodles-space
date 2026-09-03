import { describe, expect, it } from 'vitest';
import {
	CAMERA_TILT,
	HEX_SIZE,
	SEA_LEVEL,
	TILE_THICKNESS,
	axialToOffset,
	byHexRow,
	hexCorners,
	hexRound,
	hexToWorld,
	offsetToAxial,
	projectHex,
	unprojectHex,
	worldToHex
} from './hex';

describe('the hex field', () => {
	it('puts the origin hex at the origin', () => {
		expect(hexToWorld(0, 0)).toEqual({ x: 0, y: 0 });
	});

	it('round-trips world position and axial coordinate', () => {
		for (const [q, r] of [
			[0, 0],
			[3, -2],
			[-4, 5],
			[7, 7]
		]) {
			const w = hexToWorld(q, r);
			const back = worldToHex(w.x, w.y);
			expect(back.q).toBeCloseTo(q);
			expect(back.r).toBeCloseTo(r);
		}
	});

	it('offsets every other row by half a tile, which is what makes it a hex grid', () => {
		const evenRow = hexToWorld(offsetToAxial(0, 0).q, offsetToAxial(0, 0).r);
		const oddRow = hexToWorld(offsetToAxial(0, 1).q, offsetToAxial(0, 1).r);
		expect(Math.abs(oddRow.x - evenRow.x)).toBeCloseTo((HEX_SIZE * Math.sqrt(3)) / 2);
	});

	// The reason the 48x12 sediment grid needs no migration to become a hex map.
	it('round-trips offset and axial coordinates', () => {
		for (let row = 0; row < 12; row++) {
			for (let col = 0; col < 48; col += 7) {
				const { q, r } = offsetToAxial(col, row);
				expect(axialToOffset(q, r)).toEqual({ col, row });
			}
		}
	});

	it('rounds a fractional coordinate to a real hex, keeping the cube constraint', () => {
		for (const [q, r] of [
			[0.4, 0.4],
			[2.6, -1.2],
			[-3.1, 4.9]
		]) {
			const h = hexRound(q, r);
			expect(Number.isInteger(h.q)).toBe(true);
			expect(Number.isInteger(h.r)).toBe(true);
			expect(Number.isInteger(-h.q - h.r)).toBe(true);
		}
	});
});

describe('the camera', () => {
	it('flattens the world vertically without touching its width', () => {
		const flat = hexToWorld(0, 4);
		const shown = projectHex(0, 4, 0, { x: 0, y: 0 });
		expect(shown.y).toBeCloseTo(flat.y * CAMERA_TILT);
		expect(shown.x).toBeCloseTo(flat.x);
	});

	it('raises a tile by its elevation and reports the side that exposes', () => {
		const flatTile = projectHex(0, 0, 0, { x: 0, y: 0 });
		const tall = projectHex(0, 0, 2, { x: 0, y: 0 });
		expect(flatTile.y - tall.y).toBeCloseTo(2 * TILE_THICKNESS);
		expect(tall.side).toBeCloseTo(2 * TILE_THICKNESS);
	});

	// The property that made this worth switching to: there is no vanishing point,
	// so nothing in the scene has a horizon to disagree with. See 2_5D.md's "the
	// two horizons" for what that cost under the old perspective floor.
	it('draws a tile the same size wherever it stands', () => {
		const near = projectHex(0, 9, 0, { x: 0, y: 0 });
		const far = projectHex(0, -9, 0, { x: 0, y: 0 });
		const nearNeighbour = projectHex(1, 9, 0, { x: 0, y: 0 });
		const farNeighbour = projectHex(1, -9, 0, { x: 0, y: 0 });
		expect(nearNeighbour.x - near.x).toBeCloseTo(farNeighbour.x - far.x);
	});

	it('pans by translation alone, so lateral travel costs nothing', () => {
		const a = projectHex(2, 3, 1, { x: 0.5, y: 0.5 });
		const b = projectHex(2, 3, 1, { x: 0.2, y: 0.5 });
		expect(a.x - b.x).toBeCloseTo(0.3);
		expect(a.y).toBeCloseTo(b.y);
	});

	it('round-trips screen position back to the hex it came from', () => {
		for (const elevation of [0, 1, 2.5]) {
			for (const [q, r] of [
				[0, 0],
				[4, -3],
				[-2, 6]
			]) {
				const p = projectHex(q, r, elevation);
				const back = unprojectHex(p.x, p.y, elevation);
				expect(back.q).toBeCloseTo(q);
				expect(back.r).toBeCloseTo(r);
			}
		}
	});

	it('gives a hex six corners, flattened by the same tilt', () => {
		const corners = hexCorners();
		expect(corners).toHaveLength(6);
		const width = Math.max(...corners.map((c) => c.x)) - Math.min(...corners.map((c) => c.x));
		const height = Math.max(...corners.map((c) => c.y)) - Math.min(...corners.map((c) => c.y));
		expect(height / width).toBeLessThan(1);
		expect(height).toBeCloseTo(2 * HEX_SIZE * CAMERA_TILT);
	});
});

describe('drawing order', () => {
	it('goes back to front, so a tile covers the side of the one behind it', () => {
		const tiles = [
			{ q: 0, r: 2 },
			{ q: 5, r: 0 },
			{ q: 1, r: 0 },
			{ q: 0, r: 1 }
		];
		expect([...tiles].sort(byHexRow)).toEqual([
			{ q: 1, r: 0 },
			{ q: 5, r: 0 },
			{ q: 0, r: 1 },
			{ q: 0, r: 2 }
		]);
	});

	it('is exact rather than approximate, because rows never interleave in depth', () => {
		// Every tile in row r sits strictly above every tile in row r+1 on screen,
		// whatever their elevations, up to the tallest tile the world allows.
		const rowY = (r: number, elevation: number) => projectHex(0, r, elevation, { x: 0, y: 0 }).y;
		expect(rowY(0, 0)).toBeLessThan(rowY(1, 0));
		expect(HEX_SIZE * 1.5 * CAMERA_TILT).toBeGreaterThan(0);
	});
});

describe('sea level', () => {
	it('is a plain world height, with no horizon to reconcile it against', () => {
		expect(SEA_LEVEL).toBeGreaterThan(0);
		const drowned = projectHex(0, 0, SEA_LEVEL - 0.4);
		const risen = projectHex(0, 0, SEA_LEVEL + 0.4);
		expect(risen.y).toBeLessThan(drowned.y);
	});
});
