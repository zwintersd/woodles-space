import { describe, expect, it } from 'vitest';
import { createSim, sampleIntervalFor, simulate } from '../engine.js';
import { greedy, idlePolicy } from '../policies.js';
import { validateGameDef } from '../validate.js';
import { apiaryOfBadDecisions } from './index.js';
import { fastestRun } from './fastestRun.js';

/**
 * Proof that the stress test — a generator whose output scales with owned
 * upgrades the player has deliberately left unequipped — is a def Bloomforge
 * can actually run, not just author. See `test-defs.ts#apiaryToyDef` for the
 * same mechanic worked out on paper; this exercises the real shipped sample.
 */
describe('the Apiary of Bad Decisions fixture', () => {
	it('is a valid definition with nothing but intentional warnings', () => {
		const issues = validateGameDef(apiaryOfBadDecisions);
		expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
	});

	it('gives the Hive almost nothing on its own — the population boost is meant to carry it', () => {
		const sim = createSim(apiaryOfBadDecisions, idlePolicy, 1);
		expect(sim.generatorRates().hive).toBe(0); // not owned yet
		expect(apiaryOfBadDecisions.generators.find((g) => g.id === 'hive')?.baseRate).toBeLessThan(
			apiaryOfBadDecisions.generators.find((g) => g.id === 'forager')?.baseRate ?? 0
		);
	});

	it('neither built-in policy ever discovers the hoarding strategy', () => {
		// Idle buys nothing, and Greedy always equips what it buys — "own it but
		// leave it in the box on purpose" is a choice neither bot bound makes.
		// That's exactly what makes the milestone mean something: it can only
		// fire under a player (or a script) that chooses not to deploy something
		// it already owns.
		const duration = 36000;
		for (const policy of [idlePolicy, greedy]) {
			const result = simulate(apiaryOfBadDecisions, policy, {
				duration,
				sampleEvery: sampleIntervalFor(duration),
				seed: 1
			});
			expect(result.summary.timeToMilestone['first-flower']).toBeNull();
			expect(result.summary.timeToMilestone['overgrown-garden']).toBeNull();
		}
	});

	it('rewards hoarding: unequipping owned upgrades boosts the Hive past what equipping them gives it', () => {
		const sim = createSim(apiaryOfBadDecisions, idlePolicy, 1);

		sim.step(60); // 60 honey from Forager alone
		expect(sim.apply({ type: 'buyUpgrade', id: 'clover-patch' }, [])).toBe(true); // ×1.4 Forager, equipped

		sim.step(400); // plenty to afford the Hive and three more upgrades
		expect(sim.apply({ type: 'buyGenerator', id: 'hive' }, [])).toBe(true);
		expect(sim.apply({ type: 'buyUpgrade', id: 'sunbaked-combs' }, [])).toBe(true); // +0.4 Hive
		expect(sim.apply({ type: 'buyUpgrade', id: 'waggle-dance-training' }, [])).toBe(true);
		expect(sim.apply({ type: 'buyUpgrade', id: 'pollen-baskets' }, [])).toBe(true); // ×1.15 Forager

		sim.step(400); // enough left over for the last upgrade
		expect(sim.apply({ type: 'buyUpgrade', id: 'queen-excluder' }, [])).toBe(true);

		// All five owned and equipped: Hive reads its own curve, untouched by
		// any population boost — (0.5 + 0.4) × 1.
		expect(sim.generatorRates().hive).toBeCloseTo(0.9, 6);

		// Unequip everything except Sunbaked Combs, whose flat +0.4 stays. Four
		// flowers now sit unused: (0.5 + 0.4) × (1 + 0.35×4) = 2.16.
		for (const id of ['clover-patch', 'waggle-dance-training', 'pollen-baskets', 'queen-excluder']) {
			expect(sim.apply({ type: 'unequipUpgrade', id }, [])).toBe(true);
			sim.step(0.1); // lets checkMilestones see the new count
		}
		expect(sim.generatorRates().hive).toBeCloseTo(2.16, 6);
		// Forager loses both its multipliers, back to its bare curve.
		expect(sim.generatorRates().forager).toBeCloseTo(1, 6);

		expect(sim.milestoneTimeline['first-flower']).not.toBeNull();
		expect(sim.milestoneTimeline['overgrown-garden']).not.toBeNull();
	});

	it('simulates ten hours of hoarding play without blowing up', { timeout: 30_000 }, () => {
		const duration = 36000;
		// Fastest of a few attempts under contention — see fastestRun. Budget unchanged.
		const { ms, result } = fastestRun(1000, () =>
			simulate(apiaryOfBadDecisions, greedy, {
				duration,
				sampleEvery: sampleIntervalFor(duration),
				seed: 1
			})
		);
		expect(result.finalState.gameTime).toBe(duration);
		expect(ms).toBeLessThan(1000);
	});

	it('out-earns idling under a naive greedy player, same as any other def', () => {
		const lazy = simulate(apiaryOfBadDecisions, idlePolicy, { duration: 3600, sampleEvery: 60, seed: 4 });
		const keen = simulate(apiaryOfBadDecisions, greedy, { duration: 3600, sampleEvery: 60, seed: 4 });
		expect(keen.summary.lifetime.honey).toBeGreaterThanOrEqual(lazy.summary.lifetime.honey);
	});
});
