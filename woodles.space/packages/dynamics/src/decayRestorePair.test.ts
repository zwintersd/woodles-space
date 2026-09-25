import { describe, expect, it } from 'vitest';
import { decay, restore, type DecayRestoreOptions } from './decayRestorePair.js';

const opts: DecayRestoreOptions = {
	restoreRate: 0.011,
	baseDecayRate: 0.001,
	companionGainRate: 0.006,
	companionCap: 3
};

describe('restore', () => {
	it('eases primary toward 1 and grows companion in proportion to the gap', () => {
		const start = { primary: 0.4, companion: 0 };
		const next = restore(start, 10, opts);
		expect(next.primary).toBeGreaterThan(start.primary);
		expect(next.primary).toBeLessThan(1);
		expect(next.companion).toBeGreaterThan(0);
	});

	it('grows companion more from a bigger gap — a near-total return is worth more than topping up', () => {
		const nearlyLost = restore({ primary: 0.1, companion: 0 }, 1, opts);
		const barelyFaded = restore({ primary: 0.9, companion: 0 }, 1, opts);
		expect(nearlyLost.companion).toBeGreaterThan(barelyFaded.companion);
	});

	it('is a no-op once primary is already full', () => {
		const full = { primary: 1, companion: 1 };
		expect(restore(full, 100, opts)).toBe(full);
	});

	it('caps companion', () => {
		let state = { primary: 0.01, companion: 0 };
		for (let i = 0; i < 100; i += 1) {
			state = restore({ primary: 0.01, companion: state.companion }, 1000, opts);
		}
		expect(state.companion).toBe(opts.companionCap);
	});
});

describe('decay', () => {
	it('fades primary toward 0 and leaves companion untouched', () => {
		const start = { primary: 1, companion: 2 };
		const next = decay(start, 100, opts);
		expect(next.primary).toBeLessThan(1);
		expect(next.companion).toBe(2);
	});

	it('decays slower the more companion has been built', () => {
		const unfluent = decay({ primary: 1, companion: 0 }, 500, opts);
		const fluent = decay({ primary: 1, companion: 2 }, 500, opts);
		expect(fluent.primary).toBeGreaterThan(unfluent.primary);
	});

	it('is a no-op once primary has already hit 0', () => {
		const empty = { primary: 0, companion: 1 };
		expect(decay(empty, 100, opts)).toBe(empty);
	});
});
