/**
 * Shape F — Tally → Factor → Gated Accrual. Three primitives chained, not
 * one: a permanent record of weighted acts (the tally — kept by the caller,
 * since it's nothing more than a running sum) feeds a bounded factor; an
 * independent condition can zero that factor regardless of the tally; and
 * whatever survives throttles how fast a separate accumulator banks.
 */

export interface FactorOptions {
	/** Tally value at which the factor bottoms out at 0. */
	cap: number;
	/** An unrelated condition — pass `false` to zero the factor outright. */
	gate?: boolean;
}

/** The tally's remaining headroom against its cap, as a 0..1 factor. */
export function factorFor(tally: number, opts: FactorOptions): number {
	if (opts.gate === false) return 0;
	if (opts.cap <= 0) return 0;
	return Math.max(0, 1 - Math.min(1, tally / opts.cap));
}

/** Banks `factor · dt` onto an accumulator, only once the factor clears `minFactor`. */
export function accrue(accumulated: number, factor: number, dt: number, minFactor: number): number {
	if (factor <= minFactor) return accumulated;
	return accumulated + factor * dt;
}
