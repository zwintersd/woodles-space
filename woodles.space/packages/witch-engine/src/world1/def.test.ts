// The risk in a file that hand-assembles fifty constants into nested objects
// isn't a design error — it's a transcription one. These tests cross-check
// every field in `world1Def` against the source it was assembled from, so a
// typo'd constant fails loudly here instead of silently, three steps later,
// as an unexplained balance drift.

import { describe, expect, it } from 'vitest';
import { world1Def } from './def.js';
import { world1Life } from './life.js';
import { conditions } from './conditions.js';
import { emergences } from './emergences.js';
import { fieldNotesByDomain, equilibriumFieldNotes, quietFieldNotes, categoryMasteryFieldNotes } from './fieldNotes.js';
import { interventions } from './interventions.js';
import { STOCK_IDS } from '../vitals.js';
import {
	STAGE_SECONDS,
	STAGE_INSIGHT_MULT,
	STAGE_ACTIVITY,
	STOCK_DRIFT_PER_SEC,
	STOCK_LEAK,
	VITALITY_DRAIN_PER_SEC,
	FAVOR_DRIFT_PER_SEC,
	favorMultiplier,
	RECALL_RESTORE_PER_SEC,
	RECALL_DECAY_PER_SEC,
	FLUENCY_GAIN_PER_SEC,
	FLUENCY_MAX,
	ATTENTION_COSTS,
	INTERVENTION_LOAD_FULL,
	TEND_BUMP,
	CATEGORY_MASTERY_BONUS,
	FOCUS_STREAK_MAX
} from './tuning.js';

describe('world1Def content', () => {
	it('carries the exact same life roster, conditions, emergences, and interventions', () => {
		expect(world1Def.life).toBe(world1Life);
		expect(world1Def.conditions).toBe(conditions);
		expect(world1Def.emergences).toBe(emergences);
		expect(world1Def.interventions).toBe(interventions);
	});

	it('every emergence names two conditions that exist', () => {
		const ids = new Set(conditions.map((c) => c.id));
		for (const e of world1Def.emergences) {
			expect(ids.has(e.from[0])).toBe(true);
			expect(ids.has(e.from[1])).toBe(true);
		}
	});

	it('every life requires only conditions that exist', () => {
		const ids = new Set(conditions.map((c) => c.id));
		for (const life of world1Def.life) {
			for (const req of life.requires) expect(ids.has(req)).toBe(true);
		}
	});

	it('has an intervention for every domain a life actually uses', () => {
		const domains = new Set(world1Def.life.map((l) => l.domain));
		for (const domain of domains) expect(interventions[domain]).toBeDefined();
	});
});

describe('world1Def worldspaces', () => {
	it('water shows only aquatic life; shallows shows everything', () => {
		expect(world1Def.worldspaces.water.visibleCategories).toEqual(['aquatic']);
		expect(world1Def.worldspaces.shallows.visibleCategories).toBe('all');
	});
});

describe('world1Def tuning, cross-checked against tuning.ts', () => {
	it('stage', () => {
		expect(world1Def.stage.seconds).toBe(STAGE_SECONDS);
		expect(world1Def.stage.insightMult).toBe(STAGE_INSIGHT_MULT);
		expect(world1Def.stage.activity).toBe(STAGE_ACTIVITY);
	});

	it('stock', () => {
		expect(world1Def.stock.driftPerSec).toBe(STOCK_DRIFT_PER_SEC);
		expect(world1Def.stock.leak).toBe(STOCK_LEAK);
		for (const id of STOCK_IDS) {
			expect(world1Def.stock.bands[id][0]).toBeLessThan(world1Def.stock.bands[id][1]);
		}
	});

	it('vitality', () => {
		expect(world1Def.vitality.drainPerSec).toBe(VITALITY_DRAIN_PER_SEC);
	});

	it("favor's multiplier formula matches tuning.ts's function at both ends", () => {
		const { base, perPoint } = world1Def.favor.multiplier;
		expect(base + perPoint * 0).toBeCloseTo(favorMultiplier(0), 10);
		expect(base + perPoint * 100).toBeCloseTo(favorMultiplier(100), 10);
		expect(world1Def.favor.driftPerSec).toBe(FAVOR_DRIFT_PER_SEC);
	});

	it('recall — already shaped as @woodles/dynamics DecayRestoreOptions', () => {
		expect(world1Def.recall).toEqual({
			restoreRate: RECALL_RESTORE_PER_SEC,
			baseDecayRate: RECALL_DECAY_PER_SEC,
			companionGainRate: FLUENCY_GAIN_PER_SEC,
			companionCap: FLUENCY_MAX
		});
	});

	it('attention costs match the ladder', () => {
		expect(world1Def.attention.costs).toBe(ATTENTION_COSTS);
	});

	it('restraint', () => {
		expect(world1Def.restraint.loadFull).toBe(INTERVENTION_LOAD_FULL);
	});

	it('intervention effects', () => {
		expect(world1Def.interventionEffects.tendBump).toBe(TEND_BUMP);
	});

	it('progress', () => {
		expect(world1Def.progress.categoryMasteryBonus).toBe(CATEGORY_MASTERY_BONUS);
	});

	it('focus — already shaped as @woodles/dynamics ComboOptions', () => {
		expect(world1Def.focus.maxLevel).toBe(FOCUS_STREAK_MAX);
	});

	it('field notes carry the exact same content', () => {
		expect(world1Def.fieldNotes.byDomain).toBe(fieldNotesByDomain);
		expect(world1Def.fieldNotes.equilibrium).toBe(equilibriumFieldNotes);
		expect(world1Def.fieldNotes.quiet).toBe(quietFieldNotes);
		expect(world1Def.fieldNotes.categoryMastery).toBe(categoryMasteryFieldNotes);
	});
});
