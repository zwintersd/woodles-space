// The balance report — `pnpm --filter marginalia balance`.
//
// A readout, not a test: it runs the harness over the questions in
// ABSTRACTION.md §1 and prints tables. Nothing here asserts a number is *good*;
// judging that is the point of reading it. What the current numbers say is
// written up in BALANCE.md — re-run this after touching `tuning.ts` and the
// tables should move.
//
// It lives outside the default test glob (see vitest.balance.config.ts) because
// it takes ~40 seconds, and a suite that slow stops being run.

import { describe, it, expect } from 'vitest';
import { simulate, witnessOnly, interventionist, createWorld } from './sim';
import { STAGE_KNOWN } from './world';
import { conditions } from './content/conditions';

const HOUR = 3600;
const hm = (s: number | null) =>
	s === null ? 'never' : s < 60 ? `${s.toFixed(0)}s` : s < 3600 ? `${(s / 60).toFixed(1)}m` : `${(s / 3600).toFixed(2)}h`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

describe('balance report', () => {
	it('Q1: how long to the first Known, and to all of them?', () => {
		const r = simulate(witnessOnly(), { duration: 24 * HOUR, seed: 1 });
		console.log('\n── Q1 · pacing (Witness, water worldspace, 24h) ──');
		console.log(`  first Known:  ${hm(r.summary.timeToFirstKnown)}`);
		console.log(`  all visible:  ${hm(r.summary.timeToAllKnown)}`);
		const entries = Object.entries(r.summary.timeToKnown).sort((a, b) => a[1] - b[1]);
		for (const [id, t] of entries) console.log(`    ${id.padEnd(16)} ${hm(t)}`);
		console.log(`  visible life: ${r.final.life.map((l) => l.id).join(', ')}`);
		console.log(`  knowing=${r.summary.finalKnowing} insight=${r.summary.finalInsight.toFixed(0)} favor=${r.summary.finalFavor.toFixed(1)}`);
		expect(true).toBe(true);
	}, 120000);

	it('Q2: does the world self-balance unaided?', () => {
		for (const hours of [1, 6, 24]) {
			const r = simulate(witnessOnly(), { duration: hours * HOUR, seed: 1 });
			const f = r.series[r.series.length - 1];
			console.log(`\n── Q2 · ${hours}h, Witness ──`);
			console.log(`  self-balancing from: ${hm(r.summary.timeToSelfBalancing)}  share of run: ${pct(r.summary.equilibriumShare)}`);
			console.log(`  stressed share: ${pct(r.summary.stressedShare)}   went quiet: ${r.summary.wentQuiet}`);
			console.log(`  final stocks: N=${f.stocks.nutrients.toFixed(1)} O=${f.stocks.oxygen.toFixed(1)} M=${f.stocks.moisture.toFixed(1)}  stability=${f.stability.toFixed(1)} vitality=${f.vitality.toFixed(3)}`);
		}
		expect(true).toBe(true);
	}, 120000);

	it('Q3: does restraint actually pay?', () => {
		console.log('\n── Q3 · restraint vs. meddling ──');
		console.log('  hours │ policy          │ insight    │ favor │ eq.share │ equil.s │ concepts');
		for (const hours of [2, 6, 12, 24]) {
			for (const p of [witnessOnly(), interventionist()]) {
				const r = simulate(p, { duration: hours * HOUR, seed: 1 });
				const s = r.summary;
				console.log(
					`  ${String(hours).padStart(5)} │ ${s.policy.padEnd(15)} │ ${s.finalInsight.toFixed(0).padStart(10)} │ ${s.finalFavor.toFixed(1).padStart(5)} │ ${pct(s.equilibriumShare).padStart(8)} │ ${s.equilibriumSeconds.toFixed(0).padStart(7)} │ ${String(s.concepts).padStart(8)}`
				);
			}
		}
		expect(true).toBe(true);
	}, 120000);

	it('Q4: what does attention capacity do to the curve?', () => {
		console.log('\n── Q4 · attention (6h, Witness) ──');
		for (const expand of [false, true]) {
			const r = simulate(witnessOnly({ expandAttention: expand }), { duration: 6 * HOUR, seed: 1 });
			console.log(
				`  expandAttention=${String(expand).padEnd(5)} capacity=${r.final.state.attentionCapacity} known=${r.final.knownCount} insight=${r.summary.finalInsight.toFixed(0)} firstKnown=${hm(r.summary.timeToFirstKnown)}`
			);
		}
		expect(true).toBe(true);
	}, 120000);

	it('Q5: is there a dead stretch where nothing is affordable?', () => {
		const r = simulate(witnessOnly(), { duration: 6 * HOUR, seed: 1, sampleEvery: 300 });
		console.log('\n── Q5 · the first six hours, sampled every 5m ──');
		console.log('     t │  insight │  ins/s │ favor │ known │ complexity');
		for (const s of r.series.slice(0, 25)) {
			console.log(
				`  ${hm(s.t).padStart(5)} │ ${s.insight.toFixed(0).padStart(8)} │ ${s.insightPerSec.toFixed(3).padStart(6)} │ ${s.favor.toFixed(1).padStart(5)} │ ${String(s.knownCount).padStart(5)} │ ${s.complexity.toFixed(1).padStart(10)}`
			);
		}
		expect(true).toBe(true);
	}, 120000);

	it('Q6: the shallows — the full eleven-life world', () => {
		console.log('\n── Q6 · shallows worldspace (all 11 life), 24h ──');
		for (const p of [witnessOnly(), interventionist()]) {
			const r = simulate(p, { duration: 24 * HOUR, seed: 1, worldspace: 'shallows' });
			const s = r.summary;
			const f = r.series[r.series.length - 1];
			console.log(
				`  ${s.policy.padEnd(15)} known=${r.final.knownCount}/11 allKnown=${hm(s.timeToAllKnown)} eq=${pct(s.equilibriumShare)} stressed=${pct(s.stressedShare)} quiet=${s.wentQuiet}`
			);
			console.log(
				`                  stocks N=${f.stocks.nutrients.toFixed(1)} O=${f.stocks.oxygen.toFixed(1)} M=${f.stocks.moisture.toFixed(1)} stability=${f.stability.toFixed(1)} vitality=${f.vitality.toFixed(3)} concepts=${s.concepts}`
			);
		}
		expect(true).toBe(true);
	}, 120000);

	it('Q7: category mastery — does it fire trivially?', () => {
		console.log('\n── Q7 · category mastery ──');
		const one = createWorld({ duration: 0, seed: 1, writeConditions: ['holding'] });
		one.attend('salt_deposit');
		for (let i = 0; i < 3000 * 10; i++) one.tick(0.1);
		console.log(`  wrote only 'holding' → aquatic life revealed: ${one.life.length}`);
		console.log(`  salt_deposit Known: ${one.stageOf('salt_deposit') === STAGE_KNOWN}  aquatic mastered: ${!!one.state.categoryMastered.aquatic}`);
		const full = simulate(witnessOnly(), { duration: 24 * HOUR, seed: 1 });
		console.log(`  full web, 24h → mastered: ${JSON.stringify(full.final.state.categoryMastered)}`);
		console.log(`  (total conditions: ${conditions.length})`);
		expect(true).toBe(true);
	}, 120000);
});
