/**
 * Where the next new thing goes. Everything the dock (and paste, and the
 * image picker) adds used to land on the middle of the screen, so a quick run
 * of them piled up. A chain remembers what was just added; the next one
 * continues from it — under it, or beside it — for as long as the last one has
 * not been moved or left alone too long.
 *
 * Pure: the page supplies the clock, the viewport, and a way to look a thing
 * up, and keeps the chain.
 */

export type PlaceMode = 'center' | 'below' | 'flow';
export type PlaceGap = 'tight' | 'normal' | 'roomy';
/** Seconds the last addition stays the thing to continue from, or until it is moved. */
export type PlaceKeep = 5 | 15 | 60 | 'moved';

export type PlacementSettings = { mode: PlaceMode; gap: PlaceGap; keep: PlaceKeep; grid: number };

export const PLACE_MODES: readonly PlaceMode[] = ['center', 'below', 'flow'];
export const PLACE_GAPS: readonly PlaceGap[] = ['tight', 'normal', 'roomy'];
export const PLACE_KEEPS: readonly PlaceKeep[] = [5, 15, 60, 'moved'];
export const GRID_SIZES: readonly number[] = [0, 16, 24, 32, 48];
export const GAP_UNITS: Record<PlaceGap, number> = { tight: 6, normal: 10, roomy: 24 };

export const DEFAULT_PLACEMENT: PlacementSettings = { mode: 'below', gap: 'normal', keep: 5, grid: 0 };

export type Rect = { x: number; y: number; width: number; height: number };
export type Placed = Rect & { id: string; at: number };

export type PlacementRequest = {
	chain: readonly Placed[];
	settings: PlacementSettings;
	now: number;
	/** The size of the thing about to be added. */
	size: { width: number; height: number };
	/** Where it goes when there is nothing to continue from: top-left, in board units. */
	fallback: { x: number; y: number };
	/** The part of the board in view and free of chrome, in board units. */
	visible: Rect;
	/** What a thing in the chain looks like now, or null if it has gone. */
	lookup: (id: string) => Rect | null;
};

export type Placement = { x: number; y: number; chained: boolean };

export function snapToGrid(value: number, grid: number, direction: 'nearest' | 'up' = 'nearest'): number {
	if (!(grid > 0)) return value;
	return (direction === 'up' ? Math.ceil(value / grid) : Math.round(value / grid)) * grid;
}

/** The last addition, if it is still the thing to continue from. */
function liveTail(request: PlacementRequest): { tail: Placed; current: Rect } | null {
	const tail = request.chain[request.chain.length - 1];
	if (!tail) return null;
	const current = request.lookup(tail.id);
	if (!current || current.x !== tail.x || current.y !== tail.y) return null;
	const { keep } = request.settings;
	if (keep !== 'moved' && request.now - tail.at > keep * 1000) return null;
	return { tail, current };
}

const EDGE = 16;

function fits(rect: Rect, visible: Rect): boolean {
	return rect.x >= visible.x - 1 && rect.y >= visible.y - 1 &&
		rect.x + rect.width <= visible.x + visible.width + EDGE && rect.y + rect.height <= visible.y + visible.height + EDGE;
}

/** Entries of the chain, walking back from the end while `same` holds — one column, or one row. */
function runBack(chain: readonly Placed[], same: (entry: Placed) => boolean): Placed[] {
	const run: Placed[] = [];
	for (let index = chain.length - 1; index >= 0 && same(chain[index]); index--) run.unshift(chain[index]);
	return run;
}

function sizeOf(entry: Placed, request: PlacementRequest): Rect {
	return request.lookup(entry.id) ?? entry;
}

export function nextPlacement(request: PlacementRequest): Placement {
	const { settings, size, visible } = request;
	const start = { x: snapToGrid(request.fallback.x, settings.grid), y: snapToGrid(request.fallback.y, settings.grid), chained: false };
	if (settings.mode === 'center') return start;
	const live = liveTail(request);
	if (!live) return start;
	const gap = GAP_UNITS[settings.gap];
	const up = (value: number) => snapToGrid(value, settings.grid, 'up');
	const { tail, current } = live;
	let candidate: { x: number; y: number };

	if (settings.mode === 'below') {
		candidate = { x: tail.x, y: up(current.y + current.height + gap) };
		if (candidate.y + size.height > visible.y + visible.height) {
			// Out of room: a new column to the right of this one, back at the top.
			const column = runBack(request.chain, (entry) => entry.x === tail.x);
			const top = Math.min(...column.map((entry) => entry.y));
			const width = Math.max(...column.map((entry) => sizeOf(entry, request).width));
			candidate = { x: up(tail.x + width + gap), y: top };
		}
	} else {
		candidate = { x: up(current.x + current.width + gap), y: tail.y };
		if (candidate.x + size.width > visible.x + visible.width) {
			// Out of room: a new row under this one, back at the left.
			const row = runBack(request.chain, (entry) => entry.y === tail.y);
			const left = Math.min(...row.map((entry) => entry.x));
			const height = Math.max(...row.map((entry) => sizeOf(entry, request).height));
			candidate = { x: left, y: up(tail.y + height + gap) };
		}
	}

	// Nothing in view to land on (the board has been panned away): start over here.
	if (!fits({ ...candidate, ...size }, visible)) return start;
	return { ...candidate, chained: true };
}

/** Extend the chain with what was just added, or start a new one. */
export function extendChain(chain: readonly Placed[], placement: Placement, added: Placed): Placed[] {
	return placement.chained ? [...chain, added] : [added];
}
