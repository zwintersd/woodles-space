// Characterization tests — the safety net for the world/Book split.
//
// These pin what the Book *does today*, to exact numbers, so the extraction of
// the mechanics into world.ts can be proven behaviour-preserving rather than
// hoped to be. They are golden-value tests on purpose: if a number here moves,
// either the refactor changed the game or a tuning constant was edited, and
// both are things you want to be told about.
//
// Nothing here asserts a number is *correct* — that is what sim.test.ts and the
// balance runs are for. This file only asserts it has not changed.

import { describe, expect, it } from 'vitest';
import { Book, STAGE_KNOWN, STAGE_OBSERVED } from './book.svelte';
import { conditions } from './content/conditions';
import { INTERVENTION_LOAD_FULL } from './tuning';

/** A book with essence to burn, so writing conditions is never the constraint. */
function freshBook(): Book {
	const b = new Book();
	b.essence = 10_000;
	return b;
}

function writeAll(b: Book) {
	for (const c of conditions) b.writeCondition(c.id);
}

/** Advance in fixed 100ms steps, the way a real tick loop does. */
function run(b: Book, seconds: number) {
	const steps = Math.round(seconds * 10);
	for (let i = 0; i < steps; i++) b.tick(0.1);
}

describe('characterization — a fresh book', () => {
	it('starts where it has always started', () => {
		const b = new Book();
		expect(b.essence).toBe(6);
		expect(b.knowing).toBe(0);
		expect(b.insight).toBe(0);
		expect(b.favor).toBe(60);
		expect(b.attentionCapacity).toBe(2);
		expect(b.stocks).toEqual({ nutrients: 50, oxygen: 50, moisture: 50 });
		expect(b.life).toHaveLength(0);
		expect(b.complexity).toBe(0);
		expect(b.mode).toBe('web');
	});

	// The property the drift model exists to guarantee. It used to mean "stays at
	// 50"; with the world's own losses (evaporation, leach) it means "dries to
	// the floor of its bands and stops there" — still in band, still stable, and
	// still not drifting anywhere on its own.
	it('an empty world settles at the floor of its bands and holds', () => {
		const b = new Book();
		run(b, 4 * 3600);
		expect(b.stocks.nutrients).toBeCloseTo(40, 3);
		expect(b.stocks.oxygen).toBeCloseTo(45, 3);
		expect(b.stocks.moisture).toBeCloseTo(35, 3);
		// at the floor it is genuinely at rest — another hour moves nothing
		const settled = { ...b.stocks };
		run(b, 3600);
		expect(b.stocks.nutrients).toBeCloseTo(settled.nutrients, 6);
		expect(b.stocks.oxygen).toBeCloseTo(settled.oxygen, 6);
		expect(b.stocks.moisture).toBeCloseTo(settled.moisture, 6);
		// a floor is still inside the band, so an empty world is a stable one
		expect(b.stability).toBe(100);
		expect(b.insight).toBe(0);
	});
});

describe('characterization — writing conditions', () => {
	it('charges essence and reveals life', () => {
		const b = freshBook();
		b.writeCondition('holding');
		expect(b.essence).toBe(9_999);
		expect(b.knowing).toBe(1);
		expect(b.writtenConditions).toEqual(['holding']);
		expect(b.life.map((l) => l.id)).toEqual(['salt_deposit']);
	});

	it('will not write the same condition twice', () => {
		const b = freshBook();
		b.writeCondition('holding');
		b.writeCondition('holding');
		expect(b.writtenConditions).toEqual(['holding']);
		expect(b.essence).toBe(9_999);
	});

	it('will not write what it cannot afford', () => {
		const b = new Book();
		b.essence = 0;
		b.writeCondition('holding');
		expect(b.writtenConditions).toEqual([]);
	});

	it('the whole web reveals a fixed world', () => {
		const b = freshBook();
		writeAll(b);
		// the opening worldspace is water-only, so this is the visible subset
		expect(b.life.map((l) => l.id)).toEqual([
			'salt_deposit',
			'algae_bloom',
			'tidal_pool',
			'soft_swimmer'
		]);
		expect(b.allRevealedLife).toHaveLength(11);
		expect(b.emergences).toHaveLength(9);
		expect(b.complexity).toBe(17.5); // 4 visible life x (1+0) + 1.5 x 9 emergences
	});
});

describe('characterization — attention and study', () => {
	it('capacity bounds what can be attended', () => {
		const b = freshBook();
		writeAll(b);
		expect(b.attentionFree).toBe(2);
		b.attend('salt_deposit');
		b.attend('algae_bloom');
		expect(b.attentionFree).toBe(0);
		expect(b.canAttend('tidal_pool')).toBe(false);
		b.attend('tidal_pool');
		expect(b.attending).toEqual(['salt_deposit', 'algae_bloom']);
	});

	it('study accrues at studyEase and crosses stages at the thresholds', () => {
		const b = freshBook();
		b.writeCondition('holding'); // salt_deposit, studyEase 1.4
		b.attend('salt_deposit');

		run(b, 21); // 21s x 1.4 = 29.4 study-seconds, threshold is 30
		expect(b.stageOf('salt_deposit')).toBe(0);
		expect(b.stageProgress('salt_deposit')).toBeCloseTo(0.98, 6);

		run(b, 1); // 30.8 — crosses into Observed
		expect(b.stageOf('salt_deposit')).toBe(STAGE_OBSERVED);
		expect(b.knowing).toBe(2); // 1 for the condition, 1 for the stage
	});

	it('reaching Known pays essence and frees the slot', () => {
		const b = freshBook();
		b.writeCondition('holding');
		b.attend('salt_deposit');
		const essenceBefore = b.essence;

		run(b, 1000); // comfortably past 30 + 210 + 1100 study-seconds at ease 1.4
		expect(b.stageOf('salt_deposit')).toBe(STAGE_KNOWN);
		// ESSENCE_ON_STUDIED (1) + ESSENCE_ON_KNOWN (2)
		expect(b.essence).toBe(essenceBefore + 3);
		expect(b.attending).toEqual([]);
		expect(b.knownCount).toBe(1);
	});

	it('look closer adds a click of study, and a streak compounds it', () => {
		const b = freshBook();
		b.writeCondition('holding');
		b.attend('salt_deposit');

		b.lookCloser('salt_deposit');
		// LOOK_CLOSER_SECONDS 2.5 x studyEase 1.4 x streak-1 multiplier 1.0
		expect(b.study['salt_deposit']).toBeCloseTo(3.5, 6);
		expect(b.focusStreak).toBe(1);

		b.lookCloser('salt_deposit'); // immediately after — inside the window
		expect(b.focusStreak).toBe(2);
		expect(b.focusMult).toBeCloseTo(1.09, 6);
		expect(b.study['salt_deposit']).toBeCloseTo(3.5 + 2.5 * 1.4 * 1.09, 6);
	});

	it('ignores a look at something not attended', () => {
		const b = freshBook();
		b.writeCondition('holding');
		b.lookCloser('salt_deposit');
		expect(b.study['salt_deposit']).toBeUndefined();
	});
});

describe('characterization — insight and favor', () => {
	it('yields insight at the documented rate', () => {
		const b = freshBook();
		b.writeCondition('holding');
		b.attend('salt_deposit');
		run(b, 1000); // salt_deposit reaches Known

		// insightWeight 0.5 x STAGE_INSIGHT_MULT[3] 1.0 x vitality 1 (no needs),
		// x 1.12 because category mastery has fired: only 'holding' was written,
		// so salt_deposit is the *only* aquatic life revealed, and a category
		// where every revealed member is Known counts as mastered. Sticky, so
		// later aquatic life can't revoke it. Pinned as-is — see sim.test.ts for
		// whether that's a balance problem.
		expect(b.stageOf('salt_deposit')).toBe(STAGE_KNOWN);
		expect(b.categoryMastered.aquatic).toBe(true);
		// ...and by recall: reaching Known releases the slot, so it has begun to
		// slip since. A forgotten thing is still known — the multiplier floors
		// well above zero — but it is worth less than one freshly in mind.
		expect(b.recallOf('salt_deposit')).toBeLessThan(1);
		const expected = 0.5 * 1.12 * b.recallMultiplier('salt_deposit') * b.favorMult;
		expect(b.insightPerSec).toBeCloseTo(expected, 6);
	});

	it('favor eases toward a target lifted by what is Known', () => {
		const b = freshBook();
		b.writeCondition('holding');
		b.attend('salt_deposit');
		run(b, 1000);
		expect(b.knownCount).toBe(1);
		// target = 50 + 6*1 - stress + equilibrium bonus; favor is easing up to it
		expect(b.favor).toBeGreaterThan(60);
		expect(b.favor).toBeLessThan(70);
		expect(b.favorBand).toBe('even');
	});

	it('the favor multiplier spans the documented range', () => {
		const b = new Book();
		b.favor = 0;
		expect(b.favorMult).toBeCloseTo(0.5, 6);
		b.favor = 100;
		expect(b.favorMult).toBeCloseTo(1.5, 6);
	});
});

describe('characterization — the metabolism', () => {
	// The scenario itself lives in sim.test.ts, where the harness can name a
	// worldspace and a condition set directly. This just pins that a Book with
	// the whole web in the opening water worldspace lands where it should.
	it('the water worldspace settles below its nutrient band', () => {
		const b = freshBook();
		writeAll(b);
		b.attend('algae_bloom');
		run(b, 1400);
		expect(b.stageOf('algae_bloom')).toBe(STAGE_KNOWN);
		// four aquatic life, only one of which returns nutrients at any scale —
		// the water world is nutrient-poor until the shallows open
		expect(b.stocks.nutrients).toBeLessThan(45);
		expect(b.stocks.oxygen).toBeGreaterThan(50);
	});

	// generous timeout: two hours of game time through the rune-backed Book is
	// ~6s of wall clock. That cost is the whole reason world.ts exists.
	it('stocks stay inside their bounds under a long run', { timeout: 60_000 }, () => {
		const b = freshBook();
		writeAll(b);
		b.attend('algae_bloom');
		b.attend('tidal_pool');
		run(b, 7200);
		for (const v of Object.values(b.stocks)) {
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(100);
		}
		expect(b.stability).toBeGreaterThanOrEqual(0);
		expect(b.stability).toBeLessThanOrEqual(100);
	});

	it('vitality drains when a need falls out of band', () => {
		const b = freshBook();
		writeAll(b);
		// soft_swimmer needs oxygen >= 45; push oxygen to the floor
		b.stocks = { ...b.stocks, oxygen: 0 };
		expect(b.severityOf(b.life.find((l) => l.id === 'soft_swimmer')!)).toBeCloseTo(1, 6);
		run(b, 300);
		expect(b.vitalityOf('soft_swimmer')).toBeLessThan(1);
		expect(b.vitalityOf('soft_swimmer')).toBeGreaterThanOrEqual(0.05);
	});
});

describe('characterization — the insight sinks', () => {
	it('expanding attention walks the cost table', () => {
		const b = freshBook();
		b.insight = 10_000;
		expect(b.attentionUpgradeCost).toBe(45);
		b.expandAttention();
		expect(b.attentionCapacity).toBe(3);
		expect(b.insight).toBe(9_955);
		expect(b.attentionUpgradeCost).toBe(130);
		b.expandAttention();
		b.expandAttention();
		b.expandAttention();
		expect(b.attentionCapacity).toBe(6);
		expect(b.attentionUpgradeCost).toBeNull();
		b.expandAttention(); // at the cap, a no-op
		expect(b.attentionCapacity).toBe(6);
	});

	it('distilling trades insight for essence', () => {
		const b = new Book();
		b.insight = 60;
		expect(b.canDistill()).toBe(true);
		b.distillEssence();
		expect(b.insight).toBe(0);
		expect(b.essence).toBe(7);
		expect(b.canDistill()).toBe(false);
	});
});

describe('characterization — interventions', () => {
	function bookWithKnownSalt() {
		const b = freshBook();
		writeAll(b);
		b.attend('salt_deposit');
		run(b, 1000);
		b.insight = 10_000;
		return b;
	}

	it('is gated on Known and charges the domain cost', () => {
		const b = bookWithKnownSalt();
		expect(b.stageOf('salt_deposit')).toBe(STAGE_KNOWN);
		// salt_deposit is geology → shape, the dearest verb
		expect(b.interventionCostFor('salt_deposit')).toEqual({ insight: 150, essence: 2 });
		expect(b.canIntervene('salt_deposit')).toBe(true);

		const essenceBefore = b.essence;
		b.intervene('salt_deposit');
		expect(b.insight).toBe(9_850);
		expect(b.essence).toBe(essenceBefore - 2);
		expect(b.hasIntervened('salt_deposit')).toBe(true);
		expect(b.interventionLineFor('salt_deposit')).toBeTruthy();
	});

	it('shape raises a stock baseline, permanently', () => {
		const b = bookWithKnownSalt();
		expect(b.stockBaseline.nutrients).toBe(50);
		b.intervene('salt_deposit');
		expect(b.stockBaseline.nutrients).toBe(65); // +SHAPE_BASELINE_RAISE
	});

	it('is one-shot per life', () => {
		const b = bookWithKnownSalt();
		b.intervene('salt_deposit');
		const insightAfter = b.insight;
		b.intervene('salt_deposit');
		expect(b.insight).toBe(insightAfter);
		expect(b.stockBaseline.nutrients).toBe(65);
	});

	// Load is a lifetime measure now. It used to forget at 0.01/sec, which made
	// a permanent act free within a minute of making it — see BALANCE.md §3.
	it('raises intervention load, and the load does not forget', () => {
		const b = bookWithKnownSalt();
		b.intervene('salt_deposit');
		expect(b.interventionLoad).toBeCloseTo(0.5, 6); // permanent → 0.5
		run(b, 600);
		expect(b.interventionLoad).toBeCloseTo(0.5, 6);
	});

	it('will not intervene on something not yet Known', () => {
		const b = freshBook();
		writeAll(b);
		b.insight = 10_000;
		expect(b.canIntervene('salt_deposit')).toBe(false);
		b.intervene('salt_deposit');
		expect(b.hasIntervened('salt_deposit')).toBe(false);
	});
});

describe('characterization — the equilibrium dividend', () => {
	it('banks seconds only while balanced and unpropped', () => {
		const b = freshBook();
		writeAll(b);
		expect(b.equilibriumFactor).toBe(1); // neutral stocks are all in band
		run(b, 100);
		expect(b.equilibriumSeconds).toBeCloseTo(100, 1);
		expect(b.selfBalancing).toBe(true);
	});

	it('a heavy hand suppresses the dividend, in proportion to how heavy', () => {
		const b = freshBook();
		writeAll(b);
		// partway to the full mark costs partway — the dividend is banked in
		// proportion to the factor now, not gated on it, which is what makes a
		// single act cost something a player can feel
		b.interventionLoad = INTERVENTION_LOAD_FULL / 2;
		expect(b.equilibriumFactor).toBeCloseTo(0.5, 6);

		// and touching everything the world allows ends it entirely
		b.interventionLoad = INTERVENTION_LOAD_FULL;
		expect(b.equilibriumFactor).toBe(0);
		const before = b.equilibriumSeconds;
		run(b, 10);
		expect(b.equilibriumSeconds).toBe(before);
	});

	it('an out-of-band world banks nothing however light the hand', () => {
		const b = freshBook();
		writeAll(b);
		b.stocks = { ...b.stocks, oxygen: 5 };
		expect(b.equilibriumFactor).toBe(0);
	});
});

describe('characterization — determinism of the numeric core', () => {
	it('two identical runs agree exactly', () => {
		const play = () => {
			const b = freshBook();
			writeAll(b);
			b.attend('algae_bloom');
			b.attend('tidal_pool');
			run(b, 1800);
			return {
				insight: b.insight,
				essence: b.essence,
				favor: b.favor,
				knowing: b.knowing,
				stocks: { ...b.stocks },
				observation: { ...b.observation },
				equilibriumSeconds: b.equilibriumSeconds
			};
		};
		expect(play()).toEqual(play());
	});
});

describe('characterization — save round trip', () => {
	it('survives toSave/fromSave unchanged', () => {
		const b = freshBook();
		writeAll(b);
		b.attend('algae_bloom');
		run(b, 900);

		const saved = b.toSave();
		const restored = new Book();
		restored.fromSave(saved);

		expect(restored.insight).toBe(b.insight);
		expect(restored.essence).toBe(b.essence);
		expect(restored.favor).toBe(b.favor);
		expect(restored.knowing).toBe(b.knowing);
		expect(restored.stocks).toEqual(b.stocks);
		expect(restored.observation).toEqual(b.observation);
		expect(restored.attending).toEqual(b.attending);
		expect(restored.study).toEqual(b.study);
		expect(restored.writtenConditions).toEqual(b.writtenConditions);
		expect(restored.complexity).toBe(b.complexity);
		expect(restored.insightPerSec).toBeCloseTo(b.insightPerSec, 10);
	});

	it('a restored book ticks on identically to one that never stopped', () => {
		const b = freshBook();
		writeAll(b);
		b.attend('algae_bloom');
		run(b, 600);

		const restored = new Book();
		restored.fromSave(b.toSave());

		run(b, 600);
		run(restored, 600);

		expect(restored.insight).toBeCloseTo(b.insight, 10);
		expect(restored.favor).toBeCloseTo(b.favor, 10);
		expect(restored.stocks).toEqual(b.stocks);
		expect(restored.observation).toEqual(b.observation);
	});
});
