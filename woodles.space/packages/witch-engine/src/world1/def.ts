// `world1Def` — everything about World 1, in the `MarginaliaDef` shape
// def.ts defines. Assembled from this directory's own content (life.ts,
// conditions.ts, interventions.ts, emergences.ts, fieldNotes.ts) and
// tuning.ts's numbers — the same content and numbers apps/marginalia has
// always run, bundled here so any consumer of @woodles/witch-engine has
// something real to point at.

import type { MarginaliaDef } from '../def.js';
import { conditions } from './conditions.js';
import { emergences } from './emergences.js';
import { fieldNotesByDomain, equilibriumFieldNotes, quietFieldNotes, categoryMasteryFieldNotes } from './fieldNotes.js';
import { interventions } from './interventions.js';
import { world1Life } from './life.js';
import {
	STAGE_SECONDS,
	STAGE_INSIGHT_MULT,
	STAGE_ACTIVITY,
	LOOK_CLOSER_SECONDS,
	STOCK_START,
	STOCK_NEUTRAL,
	STOCK_DRIFT_PER_SEC,
	STOCK_LEAK,
	BAND_FALLOFF,
	VITALITY_DRAIN_PER_SEC,
	VITALITY_RECOVER_PER_SEC,
	VITALITY_FLOOR,
	FAVOR_BASE_TARGET,
	FAVOR_PER_KNOWN,
	FAVOR_DRIFT_PER_SEC,
	FAVOR_STRESS_PENALTY,
	FAVOR_EQUILIBRIUM_BONUS,
	RECALL_DECAY_PER_SEC,
	RECALL_RESTORE_PER_SEC,
	RECALL_YIELD_FLOOR,
	FLUENCY_GAIN_PER_SEC,
	FLUENCY_MAX,
	FLUENCY_YIELD_BONUS,
	ATTENTION_START,
	ATTENTION_COSTS,
	INTERVENTION_LOAD_WEIGHT,
	INTERVENTION_LOAD_FULL,
	EQUILIBRIUM_MIN_FACTOR,
	TEND_BUMP,
	INVOKE_BUMP,
	SHAPE_BASELINE_RAISE,
	SHAPE_BASELINE_MAX,
	ENCOURAGE_STABILITY,
	ENCOURAGE_STABILITY_MAX,
	GUIDE_METABOLISM_SCALE,
	DISTILL_INSIGHT_COST,
	DISTILL_ESSENCE_GAIN,
	ESSENCE_ON_STUDIED,
	ESSENCE_ON_KNOWN,
	STABILITY_ECOSYSTEM_BONUS,
	WORLD_QUIET_STABILITY,
	CATEGORY_MASTERY_BONUS,
	INSIGHT_TRICKLE_ANNOUNCE_SEC,
	FOCUS_STREAK_WINDOW_SEC,
	FOCUS_STREAK_STEP,
	FOCUS_STREAK_MAX
} from './tuning.js';

/**
 * Deliberately excluded: `OFFLINE_CAP_SECONDS`, `STOCK_HISTORY_SAMPLE_SEC`,
 * `STOCK_HISTORY_LENGTH`, `FIELD_NOTES_MAX`. Those govern session/UI
 * bookkeeping — how much offline time to credit, how many sparkline samples
 * or log lines to keep — not the economy itself. A def meant for balancing
 * the *simulation* has no business holding them.
 */
export const world1Def: MarginaliaDef = {
	meta: { id: 'world1', title: 'World 1 — the shallows' },

	life: world1Life,
	conditions,
	emergences,
	interventions,
	worldspaces: {
		water: { id: 'water', visibleCategories: ['aquatic'] },
		shallows: { id: 'shallows', visibleCategories: 'all' }
	},

	stage: {
		seconds: STAGE_SECONDS,
		insightMult: STAGE_INSIGHT_MULT,
		activity: STAGE_ACTIVITY,
		lookCloserSeconds: LOOK_CLOSER_SECONDS
	},
	stock: {
		// The bands that define a *balanced* world — distinct from per-life
		// needs, which say what one creature tolerates rather than what
		// equilibrium looks like. World 1's own numbers; not reusable as a
		// generic default, so they live here rather than in vitals.ts.
		bands: { nutrients: [40, 80], oxygen: [45, 85], moisture: [35, 75] },
		driftPerSec: STOCK_DRIFT_PER_SEC,
		leak: STOCK_LEAK,
		start: STOCK_START,
		neutral: STOCK_NEUTRAL,
		bandFalloff: BAND_FALLOFF
	},
	vitality: {
		drainPerSec: VITALITY_DRAIN_PER_SEC,
		recoverPerSec: VITALITY_RECOVER_PER_SEC,
		floor: VITALITY_FLOOR
	},
	favor: {
		baseTarget: FAVOR_BASE_TARGET,
		perKnown: FAVOR_PER_KNOWN,
		driftPerSec: FAVOR_DRIFT_PER_SEC,
		stressPenalty: FAVOR_STRESS_PENALTY,
		equilibriumBonus: FAVOR_EQUILIBRIUM_BONUS,
		multiplier: { base: 0.5, perPoint: 0.01 }
	},
	recall: {
		restoreRate: RECALL_RESTORE_PER_SEC,
		baseDecayRate: RECALL_DECAY_PER_SEC,
		companionGainRate: FLUENCY_GAIN_PER_SEC,
		companionCap: FLUENCY_MAX
	},
	recallYield: {
		floor: RECALL_YIELD_FLOOR,
		fluencyBonus: FLUENCY_YIELD_BONUS
	},
	attention: {
		start: ATTENTION_START,
		costs: ATTENTION_COSTS
	},
	restraint: {
		loadWeight: INTERVENTION_LOAD_WEIGHT,
		loadFull: INTERVENTION_LOAD_FULL,
		minFactor: EQUILIBRIUM_MIN_FACTOR
	},
	interventionEffects: {
		tendBump: TEND_BUMP,
		invokeBump: INVOKE_BUMP,
		shapeBaselineRaise: SHAPE_BASELINE_RAISE,
		shapeBaselineMax: SHAPE_BASELINE_MAX,
		encourageStability: ENCOURAGE_STABILITY,
		encourageStabilityMax: ENCOURAGE_STABILITY_MAX,
		guideMetabolismScale: GUIDE_METABOLISM_SCALE
	},
	insightSinks: {
		distillInsightCost: DISTILL_INSIGHT_COST,
		distillEssenceGain: DISTILL_ESSENCE_GAIN
	},
	progress: {
		essenceOnStudied: ESSENCE_ON_STUDIED,
		essenceOnKnown: ESSENCE_ON_KNOWN,
		stabilityEcosystemBonus: STABILITY_ECOSYSTEM_BONUS,
		quietStability: WORLD_QUIET_STABILITY,
		categoryMasteryBonus: CATEGORY_MASTERY_BONUS,
		insightTrickleAnnounceSec: INSIGHT_TRICKLE_ANNOUNCE_SEC
	},
	focus: {
		windowSeconds: FOCUS_STREAK_WINDOW_SEC,
		stepBonus: FOCUS_STREAK_STEP,
		maxLevel: FOCUS_STREAK_MAX
	},
	fieldNotes: {
		byDomain: fieldNotesByDomain,
		equilibrium: equilibriumFieldNotes,
		quiet: quietFieldNotes,
		categoryMastery: categoryMasteryFieldNotes
	}
};
