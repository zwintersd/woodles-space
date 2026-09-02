import { describe, expect, it } from 'vitest';
import { createSim, sampleIntervalFor, simulate } from '../engine.js';
import { greedy, idlePolicy } from '../policies.js';
import { validateGameDef } from '../validate.js';
import { confessionBooth } from './index.js';
import { fastestRun } from './fastestRun.js';

/**
 * Proof that the second stress test — a generator that consumes a currency
 * instead of producing one, fed by a tax automatically skimmed off every
 * purchase anywhere in the game — is a def Bloomforge can actually run. See
 * `test-defs.ts#confessionToyDef` for the mechanic worked out on paper; this
 * exercises the real shipped sample.
 */
describe('the Confession Booth fixture', () => {
	it('is a valid definition with nothing but intentional warnings', () => {
		const issues = validateGameDef(confessionBooth);
		expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
	});

	it('starts with no guilt and a Booth that produces nothing — nobody has spent anything yet', () => {
		const sim = createSim(confessionBooth, idlePolicy, 1);
		expect(sim.state().currencies.guilt.amount).toBe(0);
		expect(sim.generatorRates().booth).toBe(0); // not owned, and nothing to convert either way
	});

	it('taxes a purchase into Guilt and reveals the Booth once enough has piled up', () => {
		const sim = createSim(confessionBooth, idlePolicy, 1);
		sim.step(15); // Toiler alone: 60 coins, plenty for the 40-coin Overtime
		expect(sim.apply({ type: 'buyUpgrade', id: 'overtime' }, [])).toBe(true);

		// 40 coins spent at a 25% spend tax → 10 guilt, no purchase of guilt
		// itself required — it's a pure byproduct.
		expect(sim.state().currencies.guilt.amount).toBeCloseTo(10, 6);
		// The 5-guilt unlock threshold is now well behind us.
		sim.step(0.1);
		expect(sim.state().unlocked.has('booth')).toBe(true);
	});

	it('never runs a naive idle player into any guilt at all — nothing is ever spent', () => {
		const result = simulate(confessionBooth, idlePolicy, {
			duration: 36000,
			sampleEvery: sampleIntervalFor(36000),
			seed: 1
		});
		expect(result.finalState.currencies.guilt.amount).toBe(0);
		expect(result.finalState.currencies.absolution.amount).toBe(0);
		expect(result.summary.timeToMilestone['first-confession']).toBeNull();
	});

	it('funds itself under a naive greedy player, purely as a byproduct of normal play', () => {
		const result = simulate(confessionBooth, greedy, {
			duration: 36000,
			sampleEvery: sampleIntervalFor(36000),
			seed: 1
		});
		// Unlike the Apiary's hoarding trick, nothing here needs a deliberate
		// choice — spending is spending, and Greedy spends constantly.
		expect(result.summary.timeToMilestone['first-confession']).not.toBeNull();
		expect(result.summary.timeToMilestone['first-redemption']).not.toBeNull();
		expect(result.summary.totalPrestiges.redemption).toBeGreaterThan(0);
	});

	it('simulates ten hours without blowing up', { timeout: 30_000 }, () => {
		const duration = 36000;
		// Fastest of a few attempts under contention — see fastestRun. Budget unchanged.
		const { ms, result } = fastestRun(1000, () =>
			simulate(confessionBooth, greedy, {
				duration,
				sampleEvery: sampleIntervalFor(duration),
				seed: 1
			})
		);
		expect(result.finalState.gameTime).toBe(duration);
		expect(ms).toBeLessThan(1000);
	});
});
