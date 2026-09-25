/**
 * Shape C — Banded Stock. The one primitive with real inertia: nothing pulls
 * on the value inside its band, so it settles wherever its inputs put it, and
 * only past an edge does a restoring force engage, proportional to how far
 * out it's gone. A separate, smaller loss bleeds off anything sitting above
 * the band's floor, so an untouched stock settles there rather than at zero.
 *
 * `driftRate` and `leakRate` are exported separately from `stepStock` because
 * a caller may want to read either in isolation (a UI explaining *why* a
 * stock is moving, a balance report attributing drift vs. leak) without
 * re-deriving the composed step.
 */

export interface Band {
	lo: number;
	hi: number;
}

/** Zero inside [lo,hi]; proportional to distance once outside it. */
export function driftRate(value: number, band: Band, driftPerSec: number): number {
	if (value < band.lo) return driftPerSec * (band.lo - value);
	if (value > band.hi) return driftPerSec * (band.hi - value);
	return 0;
}

/** Never below `floor`, and zero at or under it — a stock leaks toward its floor, not past it. */
export function leakRate(value: number, floor: number, leakPerSec: number): number {
	return value <= floor ? 0 : -leakPerSec * (value - floor);
}

export interface StockStepOptions {
	driftPerSec: number;
	leakPerSec: number;
	min?: number;
	max?: number;
}

/** One step: signed `input` (a caller's summed contributions), the band's pull, and its leak — then clamped. */
export function stepStock(value: number, band: Band, input: number, dt: number, opts: StockStepOptions): number {
	const drift = driftRate(value, band, opts.driftPerSec);
	const leak = leakRate(value, band.lo, opts.leakPerSec);
	const next = value + (input + drift + leak) * dt;
	const min = opts.min ?? -Infinity;
	const max = opts.max ?? Infinity;
	return Math.min(max, Math.max(min, next));
}

/** 100 inside the band, falling linearly to 0 at `falloff` points outside it — a stock's own health reading. */
export function bandHealth(value: number, band: Band, falloff: number): number {
	if (value >= band.lo && value <= band.hi) return 100;
	const dist = value < band.lo ? band.lo - value : value - band.hi;
	return Math.max(0, 100 * (1 - dist / falloff));
}
