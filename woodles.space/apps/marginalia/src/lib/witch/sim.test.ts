// Tests for the balance harness. Three things matter here and nothing else
// does: the same seed reproduces a run exactly, the harness and the Book agree
// (they share a World, so this is really a test that nothing has grown a second
// copy of the tick), and it is fast enough to be worth using.

import { describe, expect, it } from 'vitest';
import {
	simulate,
	compare,
	witnessOnly,
	interventionist,
	doNothing,
	conceptsFor,
	createWorld,
	TICKS_PER_SECOND
} from './sim';
import { Book } from './book.svelte';
import { World, createWorldState, STAGE_KNOWN } from './world';
import { conditions } from './content/conditions';

const HOUR = 3600;

describe('sim — determinism', () => {
	it('the same seed produces an identical run', () => {
		const opts = { duration: 1800, seed: 7 };
		const a = simulate(witnessOnly(), opts);
		const b = simulate(witnessOnly(), opts);
		expect(b.summary).toEqual(a.summary);
		expect(b.series).toEqual(a.series);
		expect(b.events).toEqual(a.events);
	});

	it('the prose is reproducible too, which Math.random never was', () => {
		const notes = (seed: number) =>
			simulate(witnessOnly(), { duration: 900, seed })
				.events.map((e) => ('note' in e.event ? e.event.note : null))
				.filter(Boolean);
		expect(notes(3)).toEqual(notes(3));
		expect(notes(3).length).toBeGreaterThan(0);
	});

	it('a different seed changes the prose but not the economy', () => {
		const a = simulate(witnessOnly(), { duration: 900, seed: 1 });
		const b = simulate(witnessOnly(), { duration: 900, seed: 2 });
		// no roll feeds a number — only which line she speaks
		expect(b.summary.finalInsight).toBeCloseTo(a.summary.finalInsight, 10);
		expect(b.summary.timeToKnown).toEqual(a.summary.timeToKnown);
	});
});

describe('sim — it runs the same world the Book does', () => {
	it('a harness run and a hand-driven Book agree exactly', () => {
		// same setup, same actions, one through the runes and one not
		const b = new Book();
		b.essence = 10_000;
		for (const c of conditions) b.writeCondition(c.id);
		b.attend('salt_deposit');
		for (let i = 0; i < 600 * TICKS_PER_SECOND; i++) b.tick(0.1);

		const world = createWorld({ duration: 0, seed: 1 });
		world.attend('salt_deposit');
		for (let i = 0; i < 600 * TICKS_PER_SECOND; i++) world.tick(0.1);

		expect(world.state.insight).toBeCloseTo(b.insight, 9);
		expect(world.state.favor).toBeCloseTo(b.favor, 9);
		expect(world.state.stocks).toEqual(b.stocks);
		expect(world.state.observation).toEqual(b.observation);
		expect(world.state.essence).toBe(b.essence);
	});
});

describe('sim — performance', () => {
	// The whole reason world.ts exists. Through the Book's runes this took ~33s;
	// the budget here is incremental-core's own, and generous against CI.
	it('ten hours of game time runs inside the budget', { timeout: 60_000 }, () => {
		const t0 = performance.now();
		simulate(witnessOnly(), { duration: 10 * HOUR, seed: 1, sampleEvery: 60 });
		const ms = performance.now() - t0;
		expect(ms).toBeLessThan(8000);
	});
});

describe('sim — the policies bracket play', () => {
	it('doing nothing knows nothing', () => {
		const r = simulate(doNothing, { duration: 2 * HOUR, seed: 1 });
		expect(r.summary.timeToFirstKnown).toBeNull();
		expect(r.summary.finalInsight).toBe(0);
	});

	it('witnessing beats doing nothing', () => {
		const idle = simulate(doNothing, { duration: 2 * HOUR, seed: 1 });
		const witness = simulate(witnessOnly(), { duration: 2 * HOUR, seed: 1 });
		expect(witness.summary.finalInsight).toBeGreaterThan(idle.summary.finalInsight);
		expect(witness.summary.finalKnowing).toBeGreaterThan(idle.summary.finalKnowing);
		expect(witness.summary.timeToFirstKnown).not.toBeNull();
	});

	it('the interventionist actually intervenes', () => {
		const r = simulate(interventionist(), { duration: 4 * HOUR, seed: 1 });
		expect(r.summary.interventions).toBeGreaterThan(0);
	});

	it('every policy leaves the world inside its bounds', () => {
		for (const policy of [doNothing, witnessOnly(), interventionist()]) {
			const r = simulate(policy, { duration: 4 * HOUR, seed: 1 });
			for (const s of r.series) {
				for (const v of Object.values(s.stocks)) {
					expect(v).toBeGreaterThanOrEqual(0);
					expect(v).toBeLessThanOrEqual(100);
				}
				expect(s.favor).toBeGreaterThanOrEqual(0);
				expect(s.favor).toBeLessThanOrEqual(100);
				expect(s.vitality).toBeGreaterThan(0);
				expect(s.stability).toBeGreaterThanOrEqual(0);
			}
		}
	});
});

describe('sim — the summary reports what it says it does', () => {
	it('time-to-known is ordered and consistent', () => {
		const r = simulate(witnessOnly(), { duration: 4 * HOUR, seed: 1 });
		const times = Object.values(r.summary.timeToKnown);
		expect(times.length).toBeGreaterThan(0);
		expect(r.summary.timeToFirstKnown).toBe(Math.min(...times));
		for (const t of times) {
			expect(t).toBeGreaterThan(0);
			expect(t).toBeLessThanOrEqual(4 * HOUR);
		}
	});

	it('a life reported Known really is Known at the end', () => {
		const r = simulate(witnessOnly(), { duration: 4 * HOUR, seed: 1 });
		for (const id of Object.keys(r.summary.timeToKnown)) {
			expect(r.final.stageOf(id)).toBe(STAGE_KNOWN);
		}
	});

	it('equilibrium share and banked seconds agree', () => {
		const r = simulate(witnessOnly(), { duration: 2 * HOUR, seed: 1 });
		// equilibriumSeconds banks whenever the factor clears EQUILIBRIUM_MIN_FACTOR,
		// which is a strictly weaker test than selfBalancing, so it's the larger
		expect(r.summary.equilibriumSeconds).toBeGreaterThanOrEqual(
			r.summary.equilibriumShare * 2 * HOUR - 1
		);
	});

	it('samples span the run', () => {
		const r = simulate(witnessOnly(), { duration: HOUR, seed: 1, sampleEvery: 60 });
		expect(r.series[0].t).toBe(0);
		expect(r.series[r.series.length - 1].t).toBeCloseTo(HOUR, 6);
		expect(r.series.length).toBeGreaterThan(50);
	});
});

describe('sim — the prestige formula', () => {
	it('scales sublinearly, as diminishing returns should', () => {
		const a = conceptsFor(100, 5, 3600);
		const b = conceptsFor(400, 5, 3600);
		expect(b).toBeGreaterThan(a);
		expect(b - a).toBeLessThan(a); // quadrupling complexity less than doubles the mint
	});

	it('rewards a gentle world over a merely long one', () => {
		const gentle = conceptsFor(50, 4, 7200);
		const hurried = conceptsFor(50, 4, 0);
		expect(gentle).toBeGreaterThan(hurried);
	});
});

// These pin the *current* pacing so that editing tuning.ts tells you what it
// did. They are not claims that the numbers are right. When you retune, expect
// these to fail, read the new number, and update it deliberately.
describe('sim — pacing, as it currently stands', () => {
	it('the opening worldspace is an opening act, not a demo', () => {
		const s = simulate(witnessOnly(), { duration: 4 * HOUR, seed: 1 }).summary;
		expect(s.timeToFirstKnown).toBeCloseTo(958, -1); // ~16 minutes
		expect(s.timeToAllKnown).toBeGreaterThan(30 * 60); // half an hour, at least
		expect(s.timeToAllKnown).toBeLessThan(45 * 60);
	});

	it('the shallows takes about an hour', () => {
		const s = simulate(witnessOnly(), {
			duration: 4 * HOUR,
			seed: 1,
			worldspace: 'shallows'
		}).summary;
		expect(s.timeToAllKnown).toBeGreaterThan(45 * 60);
		expect(s.timeToAllKnown).toBeLessThan(80 * 60);
	});

	// The restraint dividend is still broken, and the retune made it worse
	// rather than better. It used to pay a meddler and an ascetic *identically*
	// (the load never got high enough to gate anything). Now that a world can
	// genuinely leave its band, intervening repairs it — `shape` lifts the
	// nutrient baseline, `tend` bumps the stock a life lives by — and repair is
	// exactly what the dividend rewards. So meddling out-earns restraint.
	//
	// Nothing in §2.3 was touched by this pass, deliberately: the fix is a
	// design decision about what `interventionLoad` should mean, and it is
	// open. See BALANCE.md §3.
	it('meddling out-earns restraint — the dividend is still inverted', () => {
		const opts = { duration: 2 * HOUR, seed: 1 };
		const w = simulate(witnessOnly(), opts).summary;
		const i = simulate(interventionist(), opts).summary;
		expect(i.equilibriumSeconds).toBeGreaterThan(w.equilibriumSeconds);
		expect(i.interventions).toBeGreaterThan(0);
	});
});

// DESIGN.md §1.2's worked example. Until the drift rework and the world's own
// losses landed this was unreachable — the stocks sat within a few points of
// neutral no matter what lived in the world, because the pull toward neutral
// was the same order of magnitude as the entire metabolism.
//
//   "write only plants and oxygen climbs while nutrients crash — until you
//    allow *returning* and the decomposers close the loop. **that** is the
//    lesson the journal already gestures at, made mechanical."
describe('the §1.2 lesson', () => {
	it('plants alone: oxygen climbs, nutrients crash, the algae wilts', () => {
		// flow + reaching reveals the algae bloom and nothing else. It produces
		// oxygen (+0.20), eats nutrients (-0.06), and needs nutrients >= 30.
		const r = simulate(witnessOnly(), {
			duration: 4 * HOUR,
			seed: 1,
			writeConditions: ['flow', 'reaching']
		});
		const w = r.final;
		expect(w.life.map((l) => l.id)).toEqual(['algae_bloom']);

		expect(w.state.stocks.oxygen).toBeGreaterThan(55);
		// nutrients crash to the algae's own need floor and stop there: as it
		// wilts it metabolises less, so the world eases the very pressure that
		// was hurting it. That is the equilibrium loop, holding it at the
		// boundary rather than driving it to zero.
		expect(w.state.stocks.nutrients).toBeLessThanOrEqual(30.01);
		expect(w.severityOf(w.life[0])).toBeGreaterThan(0);
		expect(w.vitalityOf('algae_bloom')).toBeLessThan(1);
		// stressed, but dormant rather than dead — VITALITY_FLOOR holds it
		expect(w.vitalityOf('algae_bloom')).toBeGreaterThan(0.05);
		expect(r.summary.stressedShare).toBeGreaterThan(0.5);
	});

	it('allowing `returning` closes the loop and the world recovers', () => {
		const r = simulate(witnessOnly(), {
			duration: 6 * HOUR,
			seed: 1,
			worldspace: 'shallows'
		});
		const w = r.final;
		// the fungal net (+0.15 nutrients) is the biggest single return in the
		// game, and with the whole web written the three stocks settle mid-band
		expect(w.state.stocks.nutrients).toBeGreaterThan(50);
		expect(w.state.stocks.oxygen).toBeGreaterThan(55);
		expect(w.state.stocks.moisture).toBeGreaterThan(45);
		expect(w.allStocksInBand).toBe(true);
		expect(w.stability).toBe(100);
		// and nothing is left suffering
		for (const l of w.life) expect(w.severityOf(l)).toBe(0);
	});

	it('a complete world is a balanced one; a partial world is not', () => {
		const partial = simulate(witnessOnly(), {
			duration: 4 * HOUR,
			seed: 1,
			writeConditions: ['flow', 'reaching']
		}).summary;
		const whole = simulate(witnessOnly(), {
			duration: 4 * HOUR,
			seed: 1,
			worldspace: 'shallows'
		}).summary;
		expect(partial.stressedShare).toBeGreaterThan(whole.stressedShare);
		expect(whole.equilibriumShare).toBeGreaterThan(partial.equilibriumShare);
	});
});

describe('sim — a World can be seeded into any state', () => {
	it('starts where it is told to', () => {
		const state = createWorldState();
		state.insight = 500;
		state.observation = { salt_deposit: STAGE_KNOWN };
		state.writtenConditions = ['holding'];
		const world = new World(state, 1);
		expect(world.state.insight).toBe(500);
		expect(world.stageOf('salt_deposit')).toBe(STAGE_KNOWN);
		expect(world.life.map((l) => l.id)).toEqual(['salt_deposit']);
	});

	it('compare runs every policy over the same setup', () => {
		const results = compare([doNothing, witnessOnly()], { duration: 600, seed: 1 });
		expect(results).toHaveLength(2);
		expect(results.map((r) => r.summary.policy)).toEqual(['Nothing', 'Witness']);
		expect(results[0].summary.seed).toBe(results[1].summary.seed);
	});
});
