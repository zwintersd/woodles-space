/**
 * Test-only. Not exported from the package index.
 *
 * A wall-clock budget is the only way these fixtures can assert "the engine is
 * fast enough to sweep a constant with", but `pnpm test` runs fifteen packages at
 * once and a timed run under that much contention measures the machine's mood as
 * much as the code. Contention only ever makes a run *slower*, never faster, so
 * the fastest of a few attempts is the honest estimate of what the work costs.
 *
 * Raising the threshold instead would just hide the next real regression — which
 * is why this exists rather than a bigger number. Stops at the first attempt
 * inside budget, so a healthy machine pays for exactly one run and only a loaded
 * one pays for more; the busier the box, the more samples it takes to catch a
 * quiet window, which is why ATTEMPTS is not 2 or 3.
 *
 * Returns the fastest observed duration in milliseconds, and whatever the last
 * attempt produced, so callers can assert on the result as well as the time.
 */
export const ATTEMPTS = 5;

export function fastestRun<T>(
	budgetMs: number,
	run: () => T,
	attempts = ATTEMPTS
): { ms: number; result: T } {
	let ms = Infinity;
	let result!: T;
	for (let attempt = 0; attempt < attempts && ms >= budgetMs; attempt += 1) {
		const started = performance.now();
		result = run();
		ms = Math.min(ms, performance.now() - started);
	}
	return { ms, result };
}
