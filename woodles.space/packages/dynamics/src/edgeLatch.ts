/**
 * Shape L — Edge Latch. The smallest primitive in the palette: one bit of
 * memory whose entire job is turning a held condition into a single,
 * non-repeating moment — a beat to log the first time a world balances,
 * not an alarm that fires on every tick it stays that way.
 */

export interface EdgeLatch {
	was: boolean;
}

/** True only the instant `now` becomes true after being false. Mutates `latch`. */
export function risingEdge(latch: EdgeLatch, now: boolean): boolean {
	const fired = now && !latch.was;
	latch.was = now;
	return fired;
}
