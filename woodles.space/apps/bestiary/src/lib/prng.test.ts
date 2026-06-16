import { describe, expect, it } from 'vitest';
import { seededRng } from './prng';

describe('seededRng', () => {
	it('yields values in [0, 1)', () => {
		const rng = seededRng('hourling');
		for (let i = 0; i < 1000; i++) {
			const v = rng();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('is deterministic — same seed, same sequence', () => {
		const a = seededRng('echo');
		const b = seededRng('echo');
		const seqA = Array.from({ length: 16 }, () => a());
		const seqB = Array.from({ length: 16 }, () => b());
		expect(seqA).toEqual(seqB);
	});

	it('decorrelates different seeds', () => {
		const a = seededRng('mossback');
		const b = seededRng('driftwisp');
		const seqA = Array.from({ length: 16 }, () => a());
		const seqB = Array.from({ length: 16 }, () => b());
		expect(seqA).not.toEqual(seqB);
	});

	it('advances — successive draws differ', () => {
		const rng = seededRng('the-same-id');
		expect(rng()).not.toBe(rng());
	});

	it('spreads roughly evenly across the unit interval', () => {
		const rng = seededRng('spread');
		let sum = 0;
		const n = 5000;
		for (let i = 0; i < n; i++) sum += rng();
		// mean of a uniform [0,1) sits near 0.5; allow generous slack
		expect(sum / n).toBeGreaterThan(0.45);
		expect(sum / n).toBeLessThan(0.55);
	});
});
