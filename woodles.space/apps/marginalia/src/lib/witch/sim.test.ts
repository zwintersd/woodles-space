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
// did. They are not claims that the numbers are right — BALANCE.md argues at
// length that four of them are wrong. When you retune, expect these to fail,
// read the new number, and update it deliberately.
describe('sim — pacing, as it currently stands', () => {
	const run = () => simulate(witnessOnly(), { duration: 2 * HOUR, seed: 1 });

	it('the opening worldspace is exhausted in minutes, not hours', () => {
		const s = run().summary;
		expect(s.timeToFirstKnown).toBeCloseTo(95, 0); // 1.6 minutes
		expect(s.timeToAllKnown).toBeLessThan(300); // every visible life, inside 5
	});

	it('the vital signs never bite: nothing is ever stressed', () => {
		const s = run().summary;
		expect(s.stressedShare).toBe(0);
		expect(s.equilibriumShare).toBe(1);
		expect(s.wentQuiet).toBe(false);
	});

	it('the curve is flat: the rate stops moving well inside the first hour', () => {
		const r = simulate(witnessOnly(), { duration: 2 * HOUR, seed: 1, sampleEvery: 300 });
		const late = r.series.filter((s) => s.t >= 15 * 60);
		const first = late[0].insightPerSec;
		// after 15 minutes the production rate moves by less than a thousandth
		// of a percent across the next hour and three quarters
		for (const s of late) {
			expect(Math.abs(s.insightPerSec - first) / first).toBeLessThan(1e-4);
		}
	});

	it('restraint and meddling bank the identical dividend', () => {
		const opts = { duration: 2 * HOUR, seed: 1 };
		const w = simulate(witnessOnly(), opts).summary;
		const i = simulate(interventionist(), opts).summary;
		// the mechanic meant to reward the light touch cannot currently tell
		// the two apart — see BALANCE.md §3
		expect(i.equilibriumSeconds).toBeCloseTo(w.equilibriumSeconds, 6);
		expect(i.concepts).toBe(w.concepts);
		expect(i.finalFavor).toBeCloseTo(w.finalFavor, 6);
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
