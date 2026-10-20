// A tiny seedable PRNG, so a creature's frost looks the same every time you
// open it. The art is procedural — snow, frost crystals, cracked ice — and we
// want each creature to carry its own *fixed* pattern, not reshuffle on every
// edit. Seed it with the creature id and the same fingerprint comes back.
//
// djb2 folds the id string into a uint32; mulberry32 turns that into a fast,
// well-distributed stream of values in [0, 1). Both are pure and dependency-
// free, so the frost generators can be unit-tested without a DOM.

// djb2 string hash → uint32. (h * 33 + c), kept in 32-bit lanes via imul.
function hashSeed(seed: string): number {
	let h = 5381;
	for (let i = 0; i < seed.length; i++) {
		h = (Math.imul(h, 33) + seed.charCodeAt(i)) | 0;
	}
	return h >>> 0;
}

// mulberry32 — a compact, good-enough generator for visual noise.
function mulberry32(a: number): () => number {
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// Seed from a string (the creature id) → a function yielding values in [0, 1).
// Same seed, same sequence — the creature's stable frost fingerprint.
export function seededRng(seed: string): () => number {
	return mulberry32(hashSeed(seed));
}
