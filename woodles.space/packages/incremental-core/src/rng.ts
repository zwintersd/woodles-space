/**
 * A seeded PRNG, inlined rather than depended on, so the package keeps zero
 * runtime dependencies. `Math.random()` must never appear in the engine: a
 * balance comparison between two policies is only meaningful if the same seed
 * produces the same run every time.
 *
 * mulberry32 — small, fast, and good enough for crit rolls. It is not
 * cryptographic and is not trying to be.
 */
export interface Rng {
	/** Uniform in [0, 1). */
	next(): number;
	/** The seed this generator was created with, for reproducing a run. */
	readonly seed: number;
}

export function createRng(seed: number): Rng {
	// Force to uint32 so a float or negative seed still gives a usable state.
	let state = Math.trunc(seed) >>> 0;
	return {
		seed,
		next(): number {
			state = (state + 0x6d2b79f5) >>> 0;
			let t = state;
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		}
	};
}
