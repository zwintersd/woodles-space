// Parameter sweeps — `pnpm --filter marginalia balance`.
//
// The balance report says what the shipped numbers do. This says what candidate
// numbers *would* do, which is the question you actually have when retuning.

import { describe, it, expect } from 'vitest';
import { simulate, witnessOnly, createWorld } from './sim';
import { STAGE_KNOWN } from './world';
import { STOCK_IDS } from './vitals';

const HOUR = 3600;
const hm = (s: number | null) =>
	s === null
		? '  never'
		: s < 60
			? `${s.toFixed(0).padStart(5)}s`
			: s < 3600
				? `${(s / 60).toFixed(1).padStart(5)}m`
				: `${(s / 3600).toFixed(2).padStart(5)}h`;

describe('sweeps', () => {
	it('S1: the content-to-time ratio', () => {
		// Shape matters as much as scale: a fast first beat with a long final
		// commitment reads better than everything stretched evenly.
		const candidates: Array<[string, number[]]> = [
			['shipped      [0,8,30,95]', [0, 8, 30, 95]],
			['x4           [0,32,120,380]', [0, 32, 120, 380]],
			['steeper      [0,20,150,700]', [0, 20, 150, 700]],
			['steeper+     [0,30,210,1100]', [0, 30, 210, 1100]],
			['long tail    [0,30,240,1800]', [0, 30, 240, 1800]]
		];
		console.log('\n── S1 · pacing (Witness, water worldspace) ──');
		console.log('  curve                        │ total │ 1st Known │ all four │ Observed');
		for (const [label, stageSeconds] of candidates) {
			const r = simulate(witnessOnly(), {
				duration: 12 * HOUR,
				seed: 1,
				tuning: { stageSeconds }
			});
			const total = stageSeconds.reduce((a, b) => a + b, 0);
			// first Observed = the opening beat, on the quickest life (ease 1.4)
			const firstObserved = stageSeconds[1] / 1.4;
			console.log(
				`  ${label.padEnd(28)} │ ${String(total).padStart(5)} │ ${hm(r.summary.timeToFirstKnown)}     │ ${hm(r.summary.timeToAllKnown)}    │ ${hm(firstObserved)}`
			);
		}
		expect(true).toBe(true);
	}, 300000);

	it('S2: the drift constant, with band-proportional drift', () => {
		// The question is whether the algae bloom (nutrients -0.06/s, needs
		// nutrients >= 30) can pull nutrients below its own need. Band floor is
		// 40, so equilibrium sits at 40 - 0.06/k.
		console.log('\n── S2 · drift (flow+reaching only: algae, no decomposer, 6h) ──');
		console.log('  drift  │ nutrients │ oxygen │ stressed │ vitality │ predicted N');
		for (const k of [0.02, 0.01, 0.006, 0.005, 0.003, 0.002]) {
			const r = simulate(witnessOnly(), {
				duration: 6 * HOUR,
				seed: 1,
				writeConditions: ['flow', 'reaching'],
				tuning: { stockDriftPerSec: k }
			});
			const f = r.series[r.series.length - 1];
			console.log(
				`  ${k.toFixed(3)}  │ ${f.stocks.nutrients.toFixed(1).padStart(9)} │ ${f.stocks.oxygen.toFixed(1).padStart(6)} │ ${(r.summary.stressedShare * 100).toFixed(0).padStart(7)}% │ ${f.vitality.toFixed(3).padStart(8)} │ ${(40 - 0.06 / k).toFixed(1).padStart(11)}`
			);
		}
		expect(true).toBe(true);
	}, 300000);

	it('S3: does the decomposer close the loop?', () => {
		console.log('\n── S3 · DESIGN.md §1.2, at candidate drift values (6h) ──');
		for (const k of [0.02, 0.005, 0.003]) {
			console.log(`  drift ${k}:`);
			for (const [label, conds] of [
				['plants only  (flow+reaching)', ['flow', 'reaching']],
				['+ returning  (closes loop)', ['flow', 'reaching', 'returning', 'holding']]
			] as Array<[string, string[]]>) {
				const r = simulate(witnessOnly(), {
					duration: 6 * HOUR,
					seed: 1,
					writeConditions: conds,
					worldspace: 'shallows',
					tuning: { stockDriftPerSec: k }
				});
				const f = r.series[r.series.length - 1];
				console.log(
					`    ${label.padEnd(30)} N=${f.stocks.nutrients.toFixed(1).padStart(5)} O=${f.stocks.oxygen.toFixed(1).padStart(5)} stressed=${(r.summary.stressedShare * 100).toFixed(0).padStart(3)}% vitality=${f.vitality.toFixed(3)} stability=${f.stability.toFixed(0).padStart(3)}`
				);
			}
		}
		expect(true).toBe(true);
	}, 300000);

	it('S4: the two changes together, full world', () => {
		console.log('\n── S4 · combined (shallows, all 11 life, 12h) ──');
		const combos: Array<[string, number[], number]> = [
			['shipped', [0, 8, 30, 95], 0.02],
			['new pacing only', [0, 30, 210, 1100], 0.02],
			['new drift only', [0, 8, 30, 95], 0.005],
			['both', [0, 30, 210, 1100], 0.005],
			['both, harder drift', [0, 30, 210, 1100], 0.003]
		];
		console.log('  variant             │ allKnown │ stressed │ eq.share │ vitality │ stability │ quiet');
		for (const [label, stageSeconds, stockDriftPerSec] of combos) {
			const r = simulate(witnessOnly(), {
				duration: 12 * HOUR,
				seed: 1,
				worldspace: 'shallows',
				tuning: { stageSeconds, stockDriftPerSec }
			});
			const f = r.series[r.series.length - 1];
			console.log(
				`  ${label.padEnd(19)} │ ${hm(r.summary.timeToAllKnown)}    │ ${(r.summary.stressedShare * 100).toFixed(0).padStart(7)}% │ ${(r.summary.equilibriumShare * 100).toFixed(0).padStart(7)}% │ ${f.vitality.toFixed(3).padStart(8)} │ ${f.stability.toFixed(0).padStart(9)} │ ${r.summary.wentQuiet}`
			);
		}
		expect(true).toBe(true);
	}, 300000);

	it('S6: which stock leaves its band, and what is stressed', () => {
		console.log('\n── S6 · full web, shallows, 6h — per-stock diagnosis ──');
		const bands = { nutrients: [40, 80], oxygen: [45, 85], moisture: [35, 75] } as const;
		for (const k of [0.02, 0.01, 0.005]) {
			const r = simulate(witnessOnly(), {
				duration: 6 * HOUR,
				seed: 1,
				worldspace: 'shallows',
				tuning: { stockDriftPerSec: k }
			});
			const w = r.final;
			const out = STOCK_IDS.map((id) => {
				const v = w.state.stocks[id];
				const [lo, hi] = bands[id];
				const where = v < lo ? `${(lo - v).toFixed(0)} BELOW` : v > hi ? `${(v - hi).toFixed(0)} ABOVE` : 'in band';
				return `${id}=${v.toFixed(1)} (${where})`;
			});
			const stressed = w.life.filter((l) => w.severityOf(l) > 0).map((l) => `${l.id}:${w.severityOf(l).toFixed(2)}`);
			console.log(`  drift ${k}: ${out.join('  ')}`);
			console.log(`             stressed: ${stressed.length ? stressed.join(', ') : 'nothing'}`);
		}
		expect(true).toBe(true);
	}, 300000);

	it('S7: the learning arc — does the web teach the lesson?', () => {
		// DESIGN.md §1.2's claim: plants alone crash nutrients; allowing
		// `returning` closes the loop. Written incrementally, does it read?
		console.log('\n── S7 · writing the web one condition at a time (drift 0.005, 6h, shallows) ──');
		const steps: Array<[string, string[]]> = [
			['flow+reaching (algae)', ['flow', 'reaching']],
			['+ holding (salt)', ['flow', 'reaching', 'holding']],
			['+ returning (fungal net)', ['flow', 'reaching', 'holding', 'returning']],
			['+ boundary', ['flow', 'reaching', 'holding', 'returning', 'boundary']],
			['the whole web', 'all' as unknown as string[]]
		];
		console.log('  written                  │    N │    O │    M │ stressed │ vitality │ stability');
		for (const [label, conds] of steps) {
			const r = simulate(witnessOnly(), {
				duration: 6 * HOUR,
				seed: 1,
				worldspace: 'shallows',
				writeConditions: conds as string[] | 'all',
				tuning: { stockDriftPerSec: 0.005 }
			});
			const f = r.series[r.series.length - 1];
			console.log(
				`  ${label.padEnd(24)} │ ${f.stocks.nutrients.toFixed(0).padStart(4)} │ ${f.stocks.oxygen.toFixed(0).padStart(4)} │ ${f.stocks.moisture.toFixed(0).padStart(4)} │ ${(r.summary.stressedShare * 100).toFixed(0).padStart(7)}% │ ${f.vitality.toFixed(3).padStart(8)} │ ${f.stability.toFixed(0).padStart(9)}`
			);
		}
		expect(true).toBe(true);
	}, 300000);

	it('S8: the whole web is net-positive on every stock', () => {
		// Sum the authored metabolism. If this is positive everywhere, then with
		// no neutral-seeking pull every stock runs to its ceiling and the only
		// thing that can ever bite is a transient shortage in a partial web.
		const w = createWorld({ duration: 0, seed: 1, worldspace: 'shallows' });
		const net = { nutrients: 0, oxygen: 0, moisture: 0 } as Record<string, number>;
		console.log('\n── S8 · the authored metabolism, summed at full activity ──');
		for (const l of w.life) {
			for (const id of STOCK_IDS) net[id] += l.metabolism?.[id] ?? 0;
		}
		for (const id of STOCK_IDS) console.log(`  ${id.padEnd(10)} net ${net[id] >= 0 ? '+' : ''}${net[id].toFixed(2)}/sec`);
		console.log('  every `needs` band in the game, for comparison:');
		for (const l of w.life) {
			if (l.needs) console.log(`    ${l.id.padEnd(14)} ${JSON.stringify(l.needs)}`);
		}
		expect(true).toBe(true);
	}, 120000);

	it('S5: an empty world still holds still', () => {
		// The property the old drift model existed to guarantee. Band-proportional
		// drift must not break it: nothing acting on a stock inside its band
		// should leave it exactly where it started.
		console.log('\n── S5 · empty world, 24h ──');
		for (const k of [0.02, 0.005, 0.003]) {
			const w = createWorld({ duration: 0, seed: 1, writeConditions: 'none', tuning: { stockDriftPerSec: k } });
			for (let i = 0; i < 24 * HOUR * 10; i++) w.tick(0.1);
			console.log(
				`  drift ${k}: ${STOCK_IDS.map((id) => `${id[0].toUpperCase()}=${w.state.stocks[id].toFixed(2)}`).join(' ')} (started at 50)`
			);
		}
		expect(true).toBe(true);
	}, 300000);
});
