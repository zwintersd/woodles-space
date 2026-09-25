/**
 * `MarginaliaDef` — the schema half of what used to be scattered module-level
 * constants in `tuning.ts` and the `content/` files. The role this plays is
 * exactly `GameDef`'s role in `@woodles/incremental-core`: a def describes a
 * game, `World` (see world.ts) simulates one, and the two can't drift apart
 * because they're reading the same object.
 *
 * This file holds only the shape. Marginalia's own `world1Def` — the def
 * that describes World 1 as it plays today — lives in
 * `apps/marginalia/src/lib/witch/def.ts`, built from that app's own content
 * and tuning. Nothing here is specific to any one world.
 *
 * Grouped by primitive shape (see packages/dynamics/README.md) wherever a
 * group of fields configures one shape's instance, so the fields read as
 * "here is recall's DecayRestoreOptions" rather than an alphabetical dump.
 */

import type { DecayRestoreOptions, ComboOptions } from '@woodles/dynamics';
import type { Condition, Emergence, Intervention, Life, LifeCategory, LifeDomain, StockId, Worldspace } from './types.js';

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
	/** `base + perPoint * favor` — a structured stand-in for what was a function, so the def stays plain data. */
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
 * shows. `'all'` is `shallows` in World 1; `water` shows only `aquatic`.
 */
export interface WorldspaceDef {
	id: Worldspace;
	visibleCategories: 'all' | LifeCategory[];
}

/** The flavor text `World`'s tick reaches for when it produces an event. See world.ts's note on this coupling. */
export interface FieldNotesDef {
	/** `byDomain[domain][stage]` — options for a stage-crossing note; absent means no line for that combination. */
	byDomain: Record<LifeDomain, Partial<Record<number, readonly string[]>>>;
	equilibrium: readonly string[];
	quiet: readonly string[];
	categoryMastery: Record<LifeCategory, readonly string[]>;
}

export interface MarginaliaDef {
	meta: { id: string; title: string };

	life: Life[];
	conditions: Condition[];
	/** Tier 2: revealed automatically once both of the conditions it names are written. */
	emergences: Emergence[];
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
	fieldNotes: FieldNotesDef;
}
