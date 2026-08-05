import { describe, expect, it } from 'vitest';
import { createSim, prestigeGain, sampleIntervalFor, simulate, TICKS_PER_SECOND } from './engine.js';
import { greedy, greedyPolicy, idlePolicy, scriptedPolicy } from './policies.js';
import type { SimEvent } from './state.js';
import { apiaryToyDef, confessionToyDef, critDef, prestigeDef, toyDef } from './test-defs.js';
import { cozyGarden } from './fixtures/index.js';

const run = (def = toyDef(), policy = idlePolicy, duration = 60) =>
	simulate(def, policy, { duration, sampleEvery: 1, seed: 1 });

describe('determinism', () => {
	it('produces deep-equal results for the same def, policy and seed', () => {
		const a = simulate(cozyGarden, greedy, { duration: 3600, sampleEvery: 10, seed: 12345 });
		const b = simulate(cozyGarden, greedy, { duration: 3600, sampleEvery: 10, seed: 12345 });
		expect(a).toEqual(b);
	});

	it('diverges on a different seed only when randomness is actually in play', () => {
		// The toy def has no crit, so it consumes no randomness and the seed
		// cannot matter. That property is what lets balance runs be compared.
		const a = simulate(toyDef(), greedy, { duration: 300, sampleEvery: 10, seed: 1 });
		const b = simulate(toyDef(), greedy, { duration: 300, sampleEvery: 10, seed: 999 });
		expect(a.finalState).toEqual(b.finalState);

		const withCrit = (seed: number) => simulate(critDef(), greedy, { duration: 600, sampleEvery: 10, seed });
		expect(withCrit(1).finalState).not.toEqual(withCrit(2).finalState);
		expect(withCrit(7)).toEqual(withCrit(7));
	});

	it('keeps game time exact rather than accumulating tick-sized floats', () => {
		const result = run(toyDef(), idlePolicy, 3600);
		expect(result.finalState.gameTime).toBe(3600);
	});
});

describe('golden master', () => {
	/**
	 * A 60-second run of the two-generator/one-upgrade toy, worked out by hand:
	 *
	 *   t 0 → 20   `a` at level 1 makes 1/sec          → 20 points earned
	 *   t 20       buy `a` level 2 for 10 × 2^1 = 20   → balance 0, rate 2/sec
	 *   t 20 → 45  25s at 2/sec                        → 50 points earned
	 *   t 45       buy `boost` (×2 global) for 50      → balance 0, rate 4/sec
	 *   t 45 → 60  15s at 4/sec                        → 60 points earned
	 *
	 * lifetime 20 + 50 + 60 = 130, balance 60, `a` at level 2, `boost` owned.
	 */
	const script = scriptedPolicy([
		{ t: 20, action: { type: 'buyGenerator', id: 'a' } },
		{ t: 45, action: { type: 'buyUpgrade', id: 'boost' } }
	]);

	const result = simulate(toyDef(), script, { duration: 60, sampleEvery: 5, seed: 1 });

	it('lands on the hand-computed balance and lifetime', () => {
		expect(result.finalState.currencies.p.amount).toBeCloseTo(60, 6);
		expect(result.finalState.currencies.p.lifetime).toBeCloseTo(130, 6);
	});

	it('lands on the hand-computed levels', () => {
		expect(result.finalState.generators.a.level).toBe(2);
		expect(result.finalState.generators.b.level).toBe(0);
		expect(result.finalState.upgrades.boost.level).toBe(1);
	});

	it('records the purchases at the exact ticks they happened', () => {
		const purchases = result.events.filter((event) => event.kind === 'levelUp' || event.kind === 'purchase');
		expect(purchases.map(summarize)).toEqual([
			{ t: 20, id: 'a', level: 2, cost: 20 },
			{ t: 45, id: 'boost', level: 1, cost: 50 }
		]);
	});

	it('crosses the 75-point milestone on the tick the arithmetic says it should', () => {
		// lifetime is 70 at t=45; at 4/sec it passes 75 on the 13th tick after,
		// i.e. 74.8 at t=46.2 and 75.2 at t=46.3.
		expect(result.summary.timeToMilestone['seventy-five']).toBeCloseTo(46.3, 6);
	});

	it('samples the series at the requested resolution', () => {
		expect(result.series[0].t).toBe(0);
		expect(result.series.at(-1)?.t).toBe(60);
		expect(result.series).toHaveLength(13); // t = 0, 5, 10 … 60
		expect(result.series[3].currencies.p).toBeCloseTo(15, 6);
		expect(result.series[3].rates.p).toBeCloseTo(1, 6);
	});
});

describe('production', () => {
	it('pays out base rate × elapsed time when nobody buys anything', () => {
		const result = run();
		expect(result.finalState.currencies.p.amount).toBeCloseTo(60, 6);
		expect(result.finalState.currencies.p.lifetime).toBeCloseTo(60, 6);
	});

	it('counts spending against the balance but never against lifetime', () => {
		const result = run(toyDef(), greedy, 120);
		const state = result.finalState;
		expect(state.currencies.p.lifetime).toBeGreaterThan(state.currencies.p.amount);
	});

	it('applies flat additions before multipliers', () => {
		// `u` adds +1/sec to `a`; the prestige layer contributes nothing yet, so
		// a level-1 `a` making 10/sec becomes 11/sec, not 10 × 1.
		const sim = createSim(prestigeDef(), idlePolicy, 1);
		sim.step(3); // 30 points, enough for the 20-point trinket
		expect(sim.apply({ type: 'buyUpgrade', id: 'u' }, [])).toBe(true);
		expect(sim.generatorRates().a).toBeCloseTo(11, 6);
	});
});

describe('crit rolls', () => {
	it('consumes no randomness until a crit is actually possible', () => {
		// Two seeds must agree right up until the crit upgrade is bought, or the
		// engine is burning RNG on generators that can never crit.
		const before = (seed: number) => simulate(critDef(), idlePolicy, { duration: 2, sampleEvery: 1, seed });
		expect(before(1)).toEqual(before(500));
	});

	it('pays more than the base rate once crit chance is up', () => {
		const plain = simulate(critDef(), idlePolicy, { duration: 300, sampleEvery: 60, seed: 3 });
		const lucky = simulate(critDef(), greedy, { duration: 300, sampleEvery: 60, seed: 3 });
		expect(lucky.finalState.currencies.p.lifetime).toBeGreaterThan(plain.finalState.currencies.p.lifetime);
	});
});

describe('prestige round trip', () => {
	const def = prestigeDef();
	// `a` makes 10/sec, so 30s of game time is 300 lifetime points → gain 3.
	const sim = createSim(def, idlePolicy, 1);
	const events: SimEvent[] = [];
	sim.step(30);
	const beforeKeep = sim.state().currencies.keep.lifetime;
	sim.apply({ type: 'buyUpgrade', id: 'u' }, events);
	const prestiged = sim.apply({ type: 'prestige', layerId: 'reset' }, events);

	it('awards floor((lifetime / threshold) ^ exponent)', () => {
		expect(prestiged).toBe(true);
		expect(sim.state().currencies.q.amount).toBe(3);
		expect(sim.state().prestige.reset.count).toBe(1);
		expect(sim.state().prestige.reset.currencyAmount).toBe(3);
	});

	it('wipes exactly the ids in resets', () => {
		const state = sim.state();
		expect(state.currencies.p.amount).toBe(0);
		expect(state.currencies.p.lifetime).toBe(0);
		expect(state.generators.a.level).toBe(1); // back to startsOwned, not to zero
		expect(state.upgrades.u.level).toBe(0);
	});

	it('leaves everything outside resets untouched', () => {
		const state = sim.state();
		expect(state.currencies.keep.lifetime).toBe(beforeKeep);
		expect(state.currencies.keep.amount).toBeGreaterThan(0);
		expect(state.generators.k.level).toBe(1);
	});

	it('applies the multiplier to production everywhere', () => {
		// 3 units at 0.5 each → ×2.5. `k` is untouched by the reset, so its rate
		// is the clean place to read the multiplier off.
		expect(sim.prestigeMultiplier()).toBeCloseTo(2.5, 6);
		expect(sim.generatorRates().k).toBeCloseTo(2.5, 6);
	});

	it('refuses a reset that would award nothing', () => {
		const fresh = createSim(prestigeDef(), idlePolicy, 1);
		expect(fresh.apply({ type: 'prestige', layerId: 'reset' }, [])).toBe(false);
		expect(prestigeGain(prestigeDef().prestigeLayers[0], fresh.state())).toBe(0);
	});
});

describe('policies', () => {
	it('never buys anything under the idle policy', () => {
		const result = run(toyDef(), idlePolicy, 600);
		expect(result.finalState.generators.a.level).toBe(1);
		expect(result.finalState.upgrades.boost.level).toBe(0);
		expect(result.events.filter((event) => event.kind !== 'milestone')).toEqual([]);
	});

	it('out-earns idling on every fixture', () => {
		// Measured on *lifetime*, not on the balance: greedy spends, and a
		// prestige zeroes what it holds, so the balance is not the invariant —
		// "played rather than idled produces more" is.
		for (const def of [toyDef(), critDef(), prestigeDef(), cozyGarden]) {
			const lazy = simulate(def, idlePolicy, { duration: 1800, sampleEvery: 60, seed: 4 });
			const keen = simulate(def, greedy, { duration: 1800, sampleEvery: 60, seed: 4 });
			for (const currency of def.currencies) {
				expect(keen.summary.lifetime[currency.id], `${def.meta.id}/${currency.id}`).toBeGreaterThanOrEqual(
					lazy.summary.lifetime[currency.id]
				);
			}
		}
	});

	it('holds off on a reset until it would beat what it already has', () => {
		const eager = simulate(cozyGarden, greedyPolicy({ prestigeAdvantageThreshold: 1 }), {
			duration: 36000,
			sampleEvery: 600,
			seed: 5
		});
		const patient = simulate(cozyGarden, greedyPolicy({ prestigeAdvantageThreshold: 8 }), {
			duration: 36000,
			sampleEvery: 600,
			seed: 5
		});
		expect(eager.summary.totalPrestiges.rebirth).toBeGreaterThan(patient.summary.totalPrestiges.rebirth);
	});

	it('can be told not to prestige at all', () => {
		const result = simulate(cozyGarden, greedyPolicy({ allowPrestige: false }), {
			duration: 36000,
			sampleEvery: 600,
			seed: 5
		});
		expect(result.summary.totalPrestiges.rebirth).toBe(0);
	});

	it('replays a script at the times it was given, in order', () => {
		const result = simulate(
			toyDef(),
			scriptedPolicy([
				{ t: 45, action: { type: 'buyUpgrade', id: 'boost' } },
				{ t: 20, action: { type: 'buyGenerator', id: 'a' } }
			]),
			{ duration: 60, sampleEvery: 30, seed: 1 }
		);
		expect(result.finalState.generators.a.level).toBe(2);
		expect(result.finalState.upgrades.boost.level).toBe(1);
	});
});

describe('purchase rules', () => {
	it('is a no-op rather than an error when the buy is unaffordable', () => {
		const sim = createSim(toyDef(), idlePolicy, 1);
		expect(sim.apply({ type: 'buyGenerator', id: 'b' }, [])).toBe(false);
		expect(sim.state().generators.b.level).toBe(0);
	});

	it('refuses an id that is not in the def', () => {
		const sim = createSim(toyDef(), idlePolicy, 1);
		expect(sim.apply({ type: 'buyGenerator', id: 'nope' }, [])).toBe(false);
		expect(sim.apply({ type: 'buyUpgrade', id: 'nope' }, [])).toBe(false);
		expect(sim.apply({ type: 'prestige', layerId: 'nope' }, [])).toBe(false);
	});

	it('stops a bulk buy at the first level it cannot pay for', () => {
		const sim = createSim(toyDef(), idlePolicy, 1);
		sim.step(100); // 100 points: enough for level 2 (20) and 3 (40), not 4 (80)
		sim.apply({ type: 'buyGenerator', id: 'a', count: 10 }, []);
		expect(sim.state().generators.a.level).toBe(3);
		expect(sim.state().currencies.p.amount).toBeCloseTo(40, 6);
	});

	it('will not buy a one-shot upgrade twice', () => {
		const sim = createSim(toyDef(), idlePolicy, 1);
		sim.step(200);
		expect(sim.apply({ type: 'buyUpgrade', id: 'boost' }, [])).toBe(true);
		expect(sim.apply({ type: 'buyUpgrade', id: 'boost' }, [])).toBe(false);
		expect(sim.nextCost('boost')).toBeNull();
	});

	it('respects a generator max level', () => {
		const def = toyDef();
		def.generators[0].maxLevel = 2;
		const sim = createSim(def, idlePolicy, 1);
		sim.step(500);
		sim.apply({ type: 'buyGenerator', id: 'a', count: 5 }, []);
		expect(sim.state().generators.a.level).toBe(2);
		expect(sim.nextCost('a')).toBeNull();
	});

	it('honours purchasableWhen and visibleWhen', () => {
		const sim = createSim(cozyGarden, idlePolicy, 1);
		// Eternal Garden needs Golden Touch at level 10; nothing is owned yet.
		expect(sim.apply({ type: 'buyUpgrade', id: 'eternal-garden' }, [])).toBe(false);
	});
});

describe('the Apiary of Bad Decisions — equip state and population boosts', () => {
	it('applies an upgrade effect only while equipped, and a populationBoost only while not', () => {
		const sim = createSim(apiaryToyDef(), idlePolicy, 1);
		expect(sim.generatorRates().bees).toBeCloseTo(2, 6); // level 1, nothing owned

		sim.step(10); // 20 honey banked, plenty for two 1-honey upgrades
		expect(sim.apply({ type: 'buyUpgrade', id: 'petal-a' }, [])).toBe(true);
		expect(sim.apply({ type: 'buyUpgrade', id: 'petal-b' }, [])).toBe(true);
		// Both equipped by default: (2 + 3 + 3) × (1 + 0.5×0 unequipped) = 8.
		expect(sim.generatorRates().bees).toBeCloseTo(8, 6);

		expect(sim.apply({ type: 'unequipUpgrade', id: 'petal-a' }, [])).toBe(true);
		// Petal A stops contributing +3, and now counts as one unequipped flower:
		// (2 + 3) × (1 + 0.5×1) = 7.5.
		expect(sim.generatorRates().bees).toBeCloseTo(7.5, 6);

		expect(sim.apply({ type: 'unequipUpgrade', id: 'petal-b' }, [])).toBe(true);
		// Both unequipped: 2 × (1 + 0.5×2) = 4 — hoarding beats leaving one on.
		expect(sim.generatorRates().bees).toBeCloseTo(4, 6);

		expect(sim.apply({ type: 'equipUpgrade', id: 'petal-a' }, [])).toBe(true);
		expect(sim.generatorRates().bees).toBeCloseTo(7.5, 6);
	});

	it('refuses to equip or unequip an upgrade nobody owns, and is a no-op if already in that state', () => {
		const sim = createSim(apiaryToyDef(), idlePolicy, 1);
		expect(sim.apply({ type: 'unequipUpgrade', id: 'petal-a' }, [])).toBe(false);
		expect(sim.apply({ type: 'equipUpgrade', id: 'petal-a' }, [])).toBe(false);

		sim.step(10);
		sim.apply({ type: 'buyUpgrade', id: 'petal-a' }, []);
		expect(sim.apply({ type: 'equipUpgrade', id: 'petal-a' }, [])).toBe(false); // already equipped
		expect(sim.apply({ type: 'unequipUpgrade', id: 'petal-a' }, [])).toBe(true);
		expect(sim.apply({ type: 'unequipUpgrade', id: 'petal-a' }, [])).toBe(false); // already unequipped
	});

	it('logs an equip event distinct from a purchase', () => {
		const sim = createSim(apiaryToyDef(), idlePolicy, 1);
		sim.step(10);
		sim.apply({ type: 'buyUpgrade', id: 'petal-a' }, []);
		const events: SimEvent[] = [];
		sim.apply({ type: 'unequipUpgrade', id: 'petal-a' }, events);
		expect(events).toEqual([
			expect.objectContaining({ kind: 'unequip', id: 'petal-a', message: 'Petal A unequipped' })
		]);
	});

	it('re-equips on prestige reset, so a fresh run starts clean', () => {
		const def = apiaryToyDef();
		def.prestigeLayers.push({
			id: 'swarm',
			name: 'Swarm',
			currencyId: 'honey',
			gainFormula: { sourceCurrencyId: 'honey', threshold: 1, exponent: 1 },
			multiplier: { perUnit: 0 },
			resets: ['honey', 'bees', 'petal-a']
		});
		const sim = createSim(def, idlePolicy, 1);
		sim.step(10);
		sim.apply({ type: 'buyUpgrade', id: 'petal-a' }, []);
		sim.apply({ type: 'unequipUpgrade', id: 'petal-a' }, []);
		expect(sim.state().upgrades['petal-a'].equipped).toBe(false);

		sim.apply({ type: 'prestige', layerId: 'swarm' }, []);
		expect(sim.state().upgrades['petal-a'].level).toBe(0);
		expect(sim.state().upgrades['petal-a'].equipped).toBe(true);
	});
});

describe('the Confession Booth — spend taxes and converters', () => {
	it('taxes a spend into another currency the instant the purchase happens', () => {
		const sim = createSim(confessionToyDef(), idlePolicy, 1);
		sim.step(10); // miner alone: 20 coins
		expect(sim.state().currencies.guilt.amount).toBe(0);

		expect(sim.apply({ type: 'buyUpgrade', id: 'trinket' }, [])).toBe(true);
		// Spending 10 coins at spendTax rate 1 mints 10 guilt, synchronously.
		expect(sim.state().currencies.coins.amount).toBeCloseTo(10, 6);
		expect(sim.state().currencies.guilt.amount).toBeCloseTo(10, 6);
		expect(sim.state().currencies.guilt.lifetime).toBeCloseTo(10, 6);
	});

	it('runs a converter at full ceiling while its input can sustain it, then starves', () => {
		const sim = createSim(confessionToyDef(), idlePolicy, 1);
		sim.step(10);
		sim.apply({ type: 'buyUpgrade', id: 'trinket' }, []); // 10 guilt minted

		// 10 guilt at a 1:1 ratio sustains the 3/sec ceiling for 3.33s.
		expect(sim.generatorRates().booth).toBeCloseTo(3, 6);

		sim.step(2); // well inside the sustainable window
		expect(sim.state().currencies.guilt.amount).toBeCloseTo(4, 6); // 10 − 3×2
		expect(sim.state().currencies.absolution.amount).toBeCloseTo(6, 6);
		expect(sim.generatorRates().booth).toBeCloseTo(3, 6); // still unthrottled

		sim.step(2); // crosses the point guilt runs out mid-window
		expect(sim.state().currencies.guilt.amount).toBeCloseTo(0, 6);
		expect(sim.state().currencies.absolution.amount).toBeCloseTo(10, 6); // all 10 guilt converted, 1:1

		sim.step(5); // nothing left to convert, no new spending to feed it
		expect(sim.state().currencies.guilt.amount).toBe(0);
		expect(sim.state().currencies.absolution.amount).toBeCloseTo(10, 6);
		expect(sim.generatorRates().booth).toBe(0);
	});

	it('never lets a converter run its input balance negative', () => {
		const sim = createSim(confessionToyDef(), idlePolicy, 1);
		sim.step(600); // plenty of time for the booth to try to run dry repeatedly
		expect(sim.state().currencies.guilt.amount).toBeGreaterThanOrEqual(0);
	});

	it('leaves currencies with no spendTax completely unaffected by spending', () => {
		const def = confessionToyDef();
		delete def.currencies[0].spendTax;
		const sim = createSim(def, idlePolicy, 1);
		sim.step(10);
		sim.apply({ type: 'buyUpgrade', id: 'trinket' }, []);
		expect(sim.state().currencies.guilt.amount).toBe(0);
	});
});

describe('stepping', () => {
	it('carries sub-tick time instead of dropping it', () => {
		const fine = createSim(toyDef(), idlePolicy, 1);
		for (let i = 0; i < 20; i += 1) fine.step(0.05);
		const coarse = createSim(toyDef(), idlePolicy, 1);
		coarse.step(1);
		expect(fine.state()).toEqual(coarse.state());
	});

	it('ignores a negative or non-finite step from a stalled clock', () => {
		const sim = createSim(toyDef(), idlePolicy, 1);
		sim.step(-5);
		sim.step(Number.NaN);
		expect(sim.state().gameTime).toBe(0);
		sim.step(1);
		expect(sim.state().gameTime).toBe(1);
	});

	it('agrees with a batch run of the same length', () => {
		const stepped = createSim(toyDef(), greedy, 1);
		for (let i = 0; i < 300; i += 1) stepped.step(1);
		const batched = simulate(toyDef(), greedy, { duration: 300, sampleEvery: 60, seed: 1 });
		expect(stepped.state()).toEqual(batched.finalState);
	});

	it('returns the events that happened during the step', () => {
		const sim = createSim(toyDef(), greedy, 1);
		const events = sim.step(120);
		expect(events.length).toBeGreaterThan(0);
		expect(events.every((event) => event.t > 0 && event.t <= 120)).toBe(true);
	});
});

describe('refusing invalid work', () => {
	it('will not simulate a def with a dangling reference', () => {
		const broken = toyDef();
		broken.generators[0].producesCurrencyId = 'ghost';
		expect(() => simulate(broken, idlePolicy, { duration: 10, sampleEvery: 1, seed: 1 })).toThrow(
			/cannot simulate an invalid GameDef/
		);
	});
});

describe('sample sizing', () => {
	it('keeps a long run near the point budget', () => {
		const interval = sampleIntervalFor(36000, 2000);
		expect(36000 / interval).toBeLessThanOrEqual(2000);
		expect(interval * TICKS_PER_SECOND).toBe(Math.round(interval * TICKS_PER_SECOND));
	});

	it('never asks for a sample finer than one tick', () => {
		expect(sampleIntervalFor(1, 100000)).toBe(0.1);
		expect(sampleIntervalFor(0)).toBe(0.1);
	});
});

function summarize(event: SimEvent) {
	return { t: event.t, id: event.id, level: event.level, cost: event.cost };
}
