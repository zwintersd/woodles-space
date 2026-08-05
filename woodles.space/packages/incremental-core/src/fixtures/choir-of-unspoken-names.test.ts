import { describe, expect, it } from 'vitest';
import { createSim, sampleIntervalFor, simulate } from '../engine.js';
import { greedy, idlePolicy } from '../policies.js';
import { validateGameDef } from '../validate.js';
import { choirOfUnspokenNames } from './index.js';

/**
 * Proof that the third stress test — a generator whose rate sums a
 * designer-defined tag across generators, upgrades and a prestige layer, none
 * of them the generator itself — is a def Bloomforge can actually run. See
 * `test-defs.ts#choirToyDef` for the mechanic worked out on paper; this
 * exercises the real shipped sample.
 */
describe('the Choir of Unspoken Names fixture', () => {
	it('is a valid definition with nothing but intentional warnings', () => {
		const issues = validateGameDef(choirOfUnspokenNames);
		expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
	});

	it('reads the tag across all three kinds it names in its own description', () => {
		const tags = {
			penitent: choirOfUnspokenNames.generators.find((g) => g.id === 'penitent')?.tags,
			choir: choirOfUnspokenNames.generators.find((g) => g.id === 'choir')?.tags,
			vow: choirOfUnspokenNames.upgrades.find((u) => u.id === 'whispered-vow')?.tags,
			order: choirOfUnspokenNames.prestigeLayers.find((p) => p.id === 'order')?.tags
		};
		expect(tags.penitent).toContain('devotional');
		expect(tags.vow).toContain('devotional');
		expect(tags.order).toContain('devotional');
		// The boosted generator itself must never carry the tag it reads.
		expect(tags.choir ?? []).not.toContain('devotional');
	});

	it('grows the Choir purely by leveling tagged things, never by leveling the Choir itself', () => {
		const sim = createSim(choirOfUnspokenNames, idlePolicy, 1);
		sim.step(100); // past the 300-lifetime unlock and enough to afford the Choir
		expect(sim.apply({ type: 'buyGenerator', id: 'choir' }, [])).toBe(true);
		const before = sim.generatorRates().choir;

		sim.step(200); // enough for Penitent to fund a level and Whispered Vow
		sim.apply({ type: 'buyGenerator', id: 'penitent' }, []);
		sim.apply({ type: 'buyUpgrade', id: 'whispered-vow' }, []);

		expect(sim.generatorRates().choir).toBeGreaterThan(before);
	});

	it('an untagged upgrade never moves the Choir, however much it helps Penitent', () => {
		const sim = createSim(choirOfUnspokenNames, idlePolicy, 1);
		sim.step(100);
		sim.apply({ type: 'buyGenerator', id: 'choir' }, []);
		sim.step(100);
		const before = sim.generatorRates().choir;
		expect(sim.apply({ type: 'buyUpgrade', id: 'steady-faith' }, [])).toBe(true); // no tag
		expect(sim.generatorRates().choir).toBeCloseTo(before, 6);
	});

	it('simulates ten hours under a naive greedy player, reaching both tag milestones', () => {
		const duration = 36000;
		const started = performance.now();
		const result = simulate(choirOfUnspokenNames, greedy, {
			duration,
			sampleEvery: sampleIntervalFor(duration),
			seed: 1
		});
		expect(result.finalState.gameTime).toBe(duration);
		expect(performance.now() - started).toBeLessThan(1000);
		expect(result.summary.timeToMilestone['first-name']).not.toBeNull();
		expect(result.summary.timeToMilestone['hundred-names']).not.toBeNull();
	});

	it('out-earns idling under a naive greedy player, same as any other def', () => {
		const lazy = simulate(choirOfUnspokenNames, idlePolicy, { duration: 3600, sampleEvery: 60, seed: 4 });
		const keen = simulate(choirOfUnspokenNames, greedy, { duration: 3600, sampleEvery: 60, seed: 4 });
		expect(keen.summary.lifetime.faith).toBeGreaterThanOrEqual(lazy.summary.lifetime.faith);
	});
});
