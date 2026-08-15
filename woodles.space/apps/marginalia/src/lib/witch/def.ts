/**
 * `MarginaliaDef` — everything about World 1 that today lives as scattered
 * module-level constants in `tuning.ts` and the `content/` files, gathered
 * into one serializable shape. The role this plays is exactly `GameDef`'s
 * role in `@woodles/incremental-core`: the editor (eventually) edits this,
 * the engine (eventually) takes it as a parameter instead of importing its
 * pieces directly, and the two can't drift apart because they're reading
 * the same object.
 *
 * This file is step A of that migration: the schema, and `world1Def`, the
 * def that describes exactly the game as it plays today. Nothing yet
 * *reads* `world1Def` — `world.ts` and `vitals.ts` still import `tuning.ts`
 * and `content/life.ts` directly, the same as before. Wiring that up is
 * step B, verified the same way every prior step was: the full test suite,
 * unchanged, has to still pass.
 *
 * Grouped by primitive shape (see packages/dynamics/README.md) wherever a
 * group of constants configures one shape's instance, so the fields read as
 * "here is recall's DecayRestoreOptions" rather than an alphabetical dump.
 */

import type { DecayRestoreOptions, ComboOptions } from '@woodles/dynamics';
import { conditions, type Condition } from './content/conditions';
import { interventions, type Intervention } from './content/interventions';
import { world1Life, type Life, type LifeCategory, type LifeDomain } from './content/life';
import type { Worldspace } from './worldShape';
import { STOCK_BANDS, type StockId } from './vitals';
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
} from './tuning';

/** Shape E, Threshold Ladder — study seconds climbing toward each observation stage. */
export interface StageDef {
	/** Study-seconds to reach each stage; index 0 unused. */
	seconds: readonly number[];
	/** Insight-yield multiplier by deepest stage reached. */
	insightMult: readonly number[];
	/** How metabolically present life is at each stage. */
	activity: readonly number[];
	/** A manual "look closer" click's base study-seconds. */
	lookCloserSeconds: number;
}

/** Shape C, Banded Stock — nutrients/oxygen/moisture share one config shape, three instances. */
export interface StockDef {
	bands: Record<StockId, [number, number]>;
	driftPerSec: number;
	leak: Record<StockId, number>;
	start: number;
	neutral: number;
	/** Points outside a band at which health falls to 0 — shared by stocks and per-life needs. */
	bandFalloff: number;
}

/** Shape B, Eased Stat — vitality's target is binary (0 or 1); see `VitalityDef.floor`. */
export interface VitalityDef {
	drainPerSec: number;
	recoverPerSec: number;
	floor: number;
}

/** Shape B, Eased Stat — favor's target is a live formula, not a constant. */
export interface FavorDef {
	baseTarget: number;
	perKnown: number;
	driftPerSec: number;
	stressPenalty: number;
	equilibriumBonus: number;
	/** Replaces `tuning.ts`'s `favorMultiplier` function: `base + perPoint * favor`. */
	multiplier: { base: number; perPoint: number };
}

/** The read side of shape D — how recall and fluency turn into a yield multiplier. */
export interface RecallYieldDef {
	floor: number;
	fluencyBonus: number;
}

/** Shape G, Capacity + Roster. */
export interface AttentionDef {
	start: number;
	costs: readonly number[];
}

/** Shape F, Tally -> Factor -> Gated Accrual — the restraint dividend. */
export interface RestraintDef {
	loadWeight: Record<'temporary' | 'lasting' | 'permanent', number>;
	loadFull: number;
	minFactor: number;
}

/**
 * The five intervention verbs' effect magnitudes — not their own shape, but
 * four injection points into shapes that already exist (see world.ts's
 * `applyInterventionEffect`): a stock's live value, a capped tally shifting
 * a band, a capped tally inside the stability formula, and a per-instance
 * coefficient override.
 */
export interface InterventionEffectsDef {
	tendBump: number;
	invokeBump: number;
	shapeBaselineRaise: number;
	shapeBaselineMax: number;
	encourageStability: number;
	encourageStabilityMax: number;
	guideMetabolismScale: number;
}

/** Shape J, Manual Conversion — the two insight sinks that aren't an intervention. */
export interface InsightSinksDef {
	distillInsightCost: number;
	distillEssenceGain: number;
}

/** Discrete grants (shape I) fired by a stage crossing, and the two remaining world-level knobs. */
export interface ProgressDef {
	essenceOnStudied: number;
	essenceOnKnown: number;
	stabilityEcosystemBonus: number;
	quietStability: number;
	categoryMasteryBonus: number;
	insightTrickleAnnounceSec: number;
}

/**
 * Shape H, Emergence Gate, at the scene level: which categories a worldspace
 * shows. `'all'` is `shallows` today; `water` shows only `aquatic` — see
 * `worldShape.ts`'s `lifeVisibleInWorldspace`, which this replaces with data.
 */
export interface WorldspaceDef {
	id: Worldspace;
	visibleCategories: 'all' | LifeCategory[];
}

export interface MarginaliaDef {
	meta: { id: string; title: string };

	life: Life[];
	conditions: Condition[];
	interventions: Record<LifeDomain, Intervention>;
	worldspaces: Record<Worldspace, WorldspaceDef>;

	stage: StageDef;
	stock: StockDef;
	vitality: VitalityDef;
	favor: FavorDef;
	/** Shape D itself — already typed by @woodles/dynamics, nothing to add. */
	recall: DecayRestoreOptions;
	recallYield: RecallYieldDef;
	attention: AttentionDef;
	restraint: RestraintDef;
	interventionEffects: InterventionEffectsDef;
	insightSinks: InsightSinksDef;
	progress: ProgressDef;
	/** Shape K itself — already typed by @woodles/dynamics, nothing to add. */
	focus: ComboOptions;
}

/**
 * Deliberately excluded: `OFFLINE_CAP_SECONDS`, `STOCK_HISTORY_SAMPLE_SEC`,
 * `STOCK_HISTORY_LENGTH`, `FIELD_NOTES_MAX`. Those govern session/UI
 * bookkeeping — how much offline time to credit, how many sparkline samples
 * or log lines to keep — not the economy itself. The same distinction
 * `GameDef.layout` draws for the canvas: "editor-owned; the engine ignores
 * it," just the opposite direction — these are player/UI-owned, and a def
 * meant for balancing the *simulation* has no business holding them.
 */
export const world1Def: MarginaliaDef = {
	meta: { id: 'world1', title: 'World 1 — the shallows' },

	life: world1Life,
	conditions,
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
		bands: STOCK_BANDS,
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
	}
};
