/**
 * Shape B — Eased Stat. A value that approaches a target — a constant, or a
 * live formula the caller recomputes each step — at an exponential rate that
 * stays stable at any step size, including an hours-long offline jump. The
 * two directions may carry different rates, because a thing that eases up
 * doesn't always ease down at the same speed.
 *
 * `next` is always a convex combination of `value` and `target`, so it can
 * never overshoot — `floor`/`ceiling` exist only to guard the case where a
 * target itself sits outside them (Marginalia's vitality target is exactly 0
 * or 1, but a caller composing several eased stats might feed one a target
 * that later moves).
 */

export interface EaseRates {
	/** Rate used while approaching from below (value < target). */
	up: number;
	/** Rate used while approaching from above. Defaults to `up`. */
	down?: number;
	floor?: number;
	ceiling?: number;
}

export function ease(value: number, target: number, dt: number, rates: EaseRates): number {
	const rate = value < target ? rates.up : (rates.down ?? rates.up);
	const next = value + (target - value) * (1 - Math.exp(-rate * dt));
	const floored = rates.floor === undefined ? next : Math.max(rates.floor, next);
	return rates.ceiling === undefined ? floored : Math.min(rates.ceiling, floored);
}
