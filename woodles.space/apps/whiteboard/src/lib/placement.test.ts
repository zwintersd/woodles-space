import { describe, expect, it } from 'vitest';
import { DEFAULT_PLACEMENT, extendChain, nextPlacement, snapToGrid, type Placed, type PlacementRequest, type Rect } from './placement';

const visible: Rect = { x: 0, y: 0, width: 1000, height: 600 };
const slip = { width: 170, height: 48 };

function world(items: Record<string, Rect>) {
	return (id: string) => items[id] ?? null;
}

function request(overrides: Partial<PlacementRequest> & { chain: Placed[]; items: Record<string, Rect> }): PlacementRequest {
	const { items, ...rest } = overrides;
	return { settings: DEFAULT_PLACEMENT, now: 1000, size: slip, fallback: { x: 400, y: 300 }, visible, lookup: world(items), ...rest };
}

const placed = (id: string, x: number, y: number, at = 0, width = 170, height = 48): Placed => ({ id, x, y, width, height, at });

describe('nextPlacement', () => {
	it('starts at the fallback when there is nothing to continue from', () => {
		expect(nextPlacement(request({ chain: [], items: {} }))).toEqual({ x: 400, y: 300, chained: false });
	});

	it('goes under an unmoved slip with a small gap', () => {
		const first = placed('a', 400, 300);
		const next = nextPlacement(request({ chain: [first], items: { a: first } }));
		expect(next).toEqual({ x: 400, y: 358, chained: true });
	});

	it('uses the previous thing’s current height, which grows as text is typed', () => {
		const first = placed('a', 400, 300);
		const next = nextPlacement(request({ chain: [first], items: { a: { ...first, height: 90 } } }));
		expect(next.y).toBe(400);
	});

	it('does not continue from a thing that has been moved, removed, or left too long', () => {
		const first = placed('a', 400, 300, 0);
		expect(nextPlacement(request({ chain: [first], items: { a: { ...first, x: 420 } } })).chained).toBe(false);
		expect(nextPlacement(request({ chain: [first], items: {} })).chained).toBe(false);
		expect(nextPlacement(request({ chain: [first], items: { a: first }, now: 5001 })).chained).toBe(false);
		expect(nextPlacement(request({ chain: [first], items: { a: first }, now: 5000 })).chained).toBe(true);
	});

	it('honours the keep-for setting, including until moved', () => {
		const first = placed('a', 400, 300, 0);
		const later = 10 * 60 * 1000;
		const base = { chain: [first], items: { a: first }, now: later };
		expect(nextPlacement(request({ ...base, settings: { ...DEFAULT_PLACEMENT, keep: 60 } })).chained).toBe(false);
		expect(nextPlacement(request({ ...base, settings: { ...DEFAULT_PLACEMENT, keep: 'moved' } })).chained).toBe(true);
		expect(nextPlacement(request({ ...base, now: 14_000, settings: { ...DEFAULT_PLACEMENT, keep: 15 } })).chained).toBe(true);
	});

	it('leaves everything at the fallback in centre mode', () => {
		const first = placed('a', 400, 300);
		const next = nextPlacement(request({ chain: [first], items: { a: first }, settings: { ...DEFAULT_PLACEMENT, mode: 'center' } }));
		expect(next).toEqual({ x: 400, y: 300, chained: false });
	});

	it('runs a new column down the right when the column fills the screen', () => {
		const first = placed('a', 100, 40);
		const last = placed('b', 100, 520);
		const next = nextPlacement(request({ chain: [first, last], items: { a: first, b: last } }));
		expect(next).toEqual({ x: 280, y: 40, chained: true });
	});

	it('flows left to right, then wraps to a row below', () => {
		const settings = { ...DEFAULT_PLACEMENT, mode: 'flow' as const };
		const first = placed('a', 100, 100);
		expect(nextPlacement(request({ chain: [first], items: { a: first }, settings }))).toEqual({ x: 280, y: 100, chained: true });
		const row = [placed('a', 100, 100), placed('b', 280, 100), placed('c', 460, 100), placed('d', 640, 100), placed('e', 820, 100)];
		const items = Object.fromEntries(row.map((entry) => [entry.id, entry]));
		const wrapped = nextPlacement(request({ chain: row, items, settings }));
		expect(wrapped).toEqual({ x: 100, y: 158, chained: true });
	});

	it('starts over at the fallback when the next spot would be out of view', () => {
		const first = placed('a', 100, 5000);
		expect(nextPlacement(request({ chain: [first], items: { a: first } })).chained).toBe(false);
	});

	it('spaces by the chosen gap', () => {
		const first = placed('a', 400, 300);
		const items = { a: first };
		expect(nextPlacement(request({ chain: [first], items, settings: { ...DEFAULT_PLACEMENT, gap: 'tight' } })).y).toBe(354);
		expect(nextPlacement(request({ chain: [first], items, settings: { ...DEFAULT_PLACEMENT, gap: 'roomy' } })).y).toBe(372);
	});

	it('lines new things up on the grid, never overlapping the last one', () => {
		const first = placed('a', 400, 300);
		const next = nextPlacement(request({ chain: [first], items: { a: first }, settings: { ...DEFAULT_PLACEMENT, grid: 24 } }));
		expect(next.y % 24).toBe(0);
		expect(next.y).toBeGreaterThanOrEqual(358);
		expect(nextPlacement(request({ chain: [], items: {}, fallback: { x: 410, y: 301 }, settings: { ...DEFAULT_PLACEMENT, grid: 24 } }))).toMatchObject({ x: 408, y: 312 });
	});
});

describe('extendChain', () => {
	it('grows while chained and restarts when not', () => {
		const a = placed('a', 0, 0);
		const b = placed('b', 0, 58);
		expect(extendChain([a], { x: 0, y: 58, chained: true }, b)).toEqual([a, b]);
		expect(extendChain([a], { x: 0, y: 58, chained: false }, b)).toEqual([b]);
	});
});

describe('snapToGrid', () => {
	it('is a no-op with no grid, and rounds or rounds up otherwise', () => {
		expect(snapToGrid(13, 0)).toBe(13);
		expect(snapToGrid(13, 8)).toBe(16);
		expect(snapToGrid(9, 8, 'up')).toBe(16);
		expect(snapToGrid(16, 8, 'up')).toBe(16);
	});
});
