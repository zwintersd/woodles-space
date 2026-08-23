// The tuning panel's schema: one entry per editable number in `MarginaliaDef`,
// grouped the way def.ts groups them. Plain data, not runes — `TuningPanel`
// walks this to render forms instead of fifty hand-written inputs.
//
// Index 0 of stage.seconds/insightMult/activity is deliberately absent:
// Notice is automatic and always 0 at that index (see world1/tuning.ts's
// header comments), so exposing it would just be a way to break an
// invariant nothing checks for.

import { SHAPE_IDS, type ShapeId } from '@woodles/dynamics';
import { world1Def } from '@woodles/witch-engine';
import type { TuningGroupKey, TuningGroups, TuningGroupsSource } from './tuning.svelte';

export interface TuningField {
	group: TuningGroupKey;
	path: (string | number)[];
	label: string;
	hint?: string;
	step: number;
	min?: number;
	max?: number;
}

/** Reads only, so it accepts a def's own readonly groups as well as the working copy. */
export function fieldValue(groups: TuningGroupsSource, field: TuningField): number {
	let cur: unknown = groups[field.group];
	for (const key of field.path) cur = (cur as Record<string | number, unknown>)[key];
	return cur as number;
}

/**
 * Writes, so it needs the mutable working copy. The casts here are the
 * irreducible cost of walking a path TypeScript can't see the shape of —
 * they no longer paper over a `readonly`, which is what `TuningGroups`
 * being deep-mutable bought. `tuningFields.test.ts` is what actually holds
 * these paths honest.
 */
export function setFieldValue(groups: TuningGroups, field: TuningField, value: number): void {
	let cur: unknown = groups[field.group];
	for (let i = 0; i < field.path.length - 1; i++) cur = (cur as Record<string | number, unknown>)[field.path[i]];
	(cur as Record<string | number, unknown>)[field.path[field.path.length - 1]] = value;
}

/** World 1's shipped value for a field, for a "this has been changed" comparison. */
export function defaultFieldValue(field: TuningField): number {
	return fieldValue(world1Def, field);
}

export interface TuningGroupSpec {
	key: TuningGroupKey;
	title: string;
	/** What this group is in World 1 specifically. */
	blurb: string;
	/**
	 * Which @woodles/dynamics shapes these numbers configure. This is the
	 * taxonomy `packages/dynamics/README.md` lays out, and the same mapping
	 * the engine's `def.ts` states in comments — here as data, so the panel
	 * can show a reader that "Vital signs" is not a bespoke mechanic but an
	 * instance of Banded Stock.
	 */
	shapes: ShapeId[];
	/** Only where the relationship to the shape needs qualifying. */
	shapeNote?: string;
	fields: TuningField[];
}

export const TUNING_GROUPS: TuningGroupSpec[] = [
	{
		key: 'stage',
		title: 'Observation stages',
		blurb: 'How long each life takes to move from Observed to Studied to Known, and what that buys.',
		shapes: ['E'],
		fields: [
			{ group: 'stage', path: ['seconds', 1], label: 'seconds → Observed', step: 1, min: 0 },
			{ group: 'stage', path: ['seconds', 2], label: 'seconds → Studied', step: 5, min: 0 },
			{ group: 'stage', path: ['seconds', 3], label: 'seconds → Known', step: 10, min: 0 },
			{ group: 'stage', path: ['insightMult', 1], label: 'insight mult · Observed', step: 0.05, min: 0 },
			{ group: 'stage', path: ['insightMult', 2], label: 'insight mult · Studied', step: 0.05, min: 0 },
			{ group: 'stage', path: ['insightMult', 3], label: 'insight mult · Known', step: 0.05, min: 0 },
			{ group: 'stage', path: ['activity', 1], label: 'activity · Observed', step: 0.05, min: 0, max: 1 },
			{ group: 'stage', path: ['activity', 2], label: 'activity · Studied', step: 0.05, min: 0 },
			{ group: 'stage', path: ['activity', 3], label: 'activity · Known', step: 0.05, min: 0 },
			{ group: 'stage', path: ['lookCloserSeconds'], label: '"look closer" click, seconds', step: 0.5, min: 0 }
		]
	},
	{
		key: 'stock',
		title: 'Vital signs',
		blurb: "Nutrients, oxygen, moisture — the world's metabolism. Bands say what's healthy; drift and leak say how it settles.",
		shapes: ['C'],
		fields: [
			{ group: 'stock', path: ['bands', 'nutrients', 0], label: 'nutrients band · low', step: 1, min: 0, max: 100 },
			{ group: 'stock', path: ['bands', 'nutrients', 1], label: 'nutrients band · high', step: 1, min: 0, max: 100 },
			{ group: 'stock', path: ['bands', 'oxygen', 0], label: 'oxygen band · low', step: 1, min: 0, max: 100 },
			{ group: 'stock', path: ['bands', 'oxygen', 1], label: 'oxygen band · high', step: 1, min: 0, max: 100 },
			{ group: 'stock', path: ['bands', 'moisture', 0], label: 'moisture band · low', step: 1, min: 0, max: 100 },
			{ group: 'stock', path: ['bands', 'moisture', 1], label: 'moisture band · high', step: 1, min: 0, max: 100 },
			{ group: 'stock', path: ['driftPerSec'], label: 'drift toward band, /sec', step: 0.001, min: 0 },
			{ group: 'stock', path: ['leak', 'nutrients'], label: 'nutrients leak, /sec', step: 0.001, min: 0 },
			{ group: 'stock', path: ['leak', 'oxygen'], label: 'oxygen leak, /sec', step: 0.001, min: 0 },
			{ group: 'stock', path: ['leak', 'moisture'], label: 'moisture leak, /sec', step: 0.001, min: 0 },
			{ group: 'stock', path: ['start'], label: 'starting value', step: 1, min: 0, max: 100 },
			{ group: 'stock', path: ['neutral'], label: 'neutral (drift target)', step: 1, min: 0, max: 100 },
			{ group: 'stock', path: ['bandFalloff'], label: 'band falloff, points', step: 1, min: 1 }
		]
	},
	{
		key: 'vitality',
		title: 'Vitality',
		blurb: "Each life's health, easing toward 0 under stress and back toward 1 when its needs are met.",
		shapes: ['B'],
		fields: [
			{ group: 'vitality', path: ['drainPerSec'], label: 'drain, /sec', step: 0.005, min: 0 },
			{ group: 'vitality', path: ['recoverPerSec'], label: 'recover, /sec', step: 0.005, min: 0 },
			{ group: 'vitality', path: ['floor'], label: 'floor (never vanishes below)', step: 0.01, min: 0, max: 1 }
		]
	},
	{
		key: 'favor',
		title: 'Favor',
		blurb: 'The relationship. Eases toward a target set by what she has Known, and multiplies insight.',
		shapes: ['B'],
		shapeNote:
			'Same shape as vitality, but its target is a live formula rather than a constant.',
		fields: [
			{ group: 'favor', path: ['baseTarget'], label: 'base target', step: 1, min: 0, max: 100 },
			{ group: 'favor', path: ['perKnown'], label: 'target · per life Known', step: 0.5, min: 0 },
			{ group: 'favor', path: ['driftPerSec'], label: 'drift toward target, /sec', step: 0.001, min: 0 },
			{ group: 'favor', path: ['stressPenalty'], label: 'target penalty · per unit stress', step: 0.5, min: 0 },
			{ group: 'favor', path: ['equilibriumBonus'], label: 'target bonus · in equilibrium', step: 1, min: 0 },
			{ group: 'favor', path: ['multiplier', 'base'], label: 'insight multiplier · base (favor 0)', step: 0.05, min: 0 },
			{ group: 'favor', path: ['multiplier', 'perPoint'], label: 'insight multiplier · per favor point', step: 0.001, min: 0 }
		]
	},
	{
		key: 'recall',
		title: 'Recall',
		blurb: 'Storage never decays — a Known life stays Known. Retrieval does, and returning to it is what freshens it.',
		shapes: ['D'],
		fields: [
			{ group: 'recall', path: ['restoreRate'], label: 'restore, /sec of attention', step: 0.001, min: 0 },
			{ group: 'recall', path: ['baseDecayRate'], label: 'decay, /sec unattended', step: 0.0005, min: 0 },
			{ group: 'recall', path: ['companionGainRate'], label: 'fluency gain, /sec', step: 0.001, min: 0 },
			{ group: 'recall', path: ['companionCap'], label: 'fluency cap', step: 0.1, min: 0 }
		]
	},
	{
		key: 'recallYield',
		title: 'Recall yield',
		blurb: 'What recall and fluency turn into a yield multiplier.',
		shapes: ['D'],
		shapeNote:
			'The read side of the same shape: how recall and fluency become a yield multiplier.',
		fields: [
			{ group: 'recallYield', path: ['floor'], label: 'yield floor (forgotten, never below)', step: 0.05, min: 0, max: 1 },
			{ group: 'recallYield', path: ['fluencyBonus'], label: 'yield · per fluency point', step: 0.01, min: 0 }
		]
	},
	{
		key: 'attention',
		title: 'Attention',
		blurb: 'The one capacity upgrade — how many life she can hold in mind at once.',
		shapes: ['G'],
		fields: [
			{ group: 'attention', path: ['start'], label: 'starting capacity', step: 1, min: 1 },
			{ group: 'attention', path: ['costs', 0], label: 'cost → capacity 3', step: 5, min: 0 },
			{ group: 'attention', path: ['costs', 1], label: 'cost → capacity 4', step: 5, min: 0 },
			{ group: 'attention', path: ['costs', 2], label: 'cost → capacity 5', step: 5, min: 0 },
			{ group: 'attention', path: ['costs', 3], label: 'cost → capacity 6', step: 5, min: 0 }
		]
	},
	{
		key: 'restraint',
		title: 'Restraint',
		blurb: 'The lightest touch is worth the most: load weighs by permanence and never forgets.',
		shapes: ['F'],
		fields: [
			{ group: 'restraint', path: ['loadWeight', 'temporary'], label: 'load · temporary act', step: 0.05, min: 0 },
			{ group: 'restraint', path: ['loadWeight', 'lasting'], label: 'load · lasting act', step: 0.05, min: 0 },
			{ group: 'restraint', path: ['loadWeight', 'permanent'], label: 'load · permanent act', step: 0.05, min: 0 },
			{ group: 'restraint', path: ['loadFull'], label: 'load at which the dividend is gone', step: 0.1, min: 0 },
			{ group: 'restraint', path: ['minFactor'], label: 'equilibrium min factor to bank', step: 0.05, min: 0, max: 1 }
		]
	},
	{
		key: 'interventionEffects',
		title: 'Intervention effects',
		blurb: 'The five verbs, in magnitudes: tend/invoke bump and fade, shape/encourage/guide last.',
		shapes: ['C', 'M', 'I'],
		shapeNote:
			"No shape of its own — four injection points into shapes that already exist: tend and invoke write a stock's value, and shape shifts its band (C); encourage feeds a capped tally inside the stability formula (M); guide overrides one life's metabolism coefficient (I).",
		fields: [
			{ group: 'interventionEffects', path: ['tendBump'], label: 'tend · stock bump', step: 1, min: 0 },
			{ group: 'interventionEffects', path: ['invokeBump'], label: 'invoke · moisture bump', step: 1, min: 0 },
			{ group: 'interventionEffects', path: ['shapeBaselineRaise'], label: 'shape · baseline raise', step: 1, min: 0 },
			{ group: 'interventionEffects', path: ['shapeBaselineMax'], label: 'shape · baseline max', step: 1, min: 0, max: 100 },
			{ group: 'interventionEffects', path: ['encourageStability'], label: 'encourage · stability add', step: 0.5, min: 0 },
			{ group: 'interventionEffects', path: ['encourageStabilityMax'], label: 'encourage · stability cap', step: 1, min: 0 },
			{ group: 'interventionEffects', path: ['guideMetabolismScale'], label: 'guide · metabolism ease', step: 0.05, min: 0, max: 1 }
		]
	},
	{
		key: 'insightSinks',
		title: 'Insight sinks',
		blurb: 'The impatient path to Essence.',
		shapes: ['J'],
		fields: [
			{ group: 'insightSinks', path: ['distillInsightCost'], label: 'distill · insight cost', step: 5, min: 0 },
			{ group: 'insightSinks', path: ['distillEssenceGain'], label: 'distill · essence gain', step: 1, min: 0 }
		]
	},
	{
		key: 'progress',
		title: 'Progress',
		blurb: 'Grants fired by a stage crossing, and the two remaining world-level knobs.',
		shapes: ['I'],
		fields: [
			{ group: 'progress', path: ['essenceOnStudied'], label: 'essence · on Studied', step: 1, min: 0 },
			{ group: 'progress', path: ['essenceOnKnown'], label: 'essence · on Known', step: 1, min: 0 },
			{ group: 'progress', path: ['stabilityEcosystemBonus'], label: 'stability · per ecosystem Known', step: 0.01, min: 0 },
			{ group: 'progress', path: ['quietStability'], label: 'stability below which the world goes quiet', step: 1, min: 0 },
			{ group: 'progress', path: ['categoryMasteryBonus'], label: 'yield bonus · category mastered', step: 0.01, min: 0 },
			{ group: 'progress', path: ['insightTrickleAnnounceSec'], label: 'trickle popup, seconds', step: 0.5, min: 0.1 }
		]
	},
	{
		key: 'focus',
		title: 'Focus streak',
		blurb: 'Consecutive "look closer" clicks build a bounded streak.',
		shapes: ['K'],
		fields: [
			{ group: 'focus', path: ['windowSeconds'], label: 'streak window, seconds', step: 0.1, min: 0 },
			{ group: 'focus', path: ['stepBonus'], label: 'bonus · per streak level', step: 0.01, min: 0 },
			{ group: 'focus', path: ['maxLevel'], label: 'streak levels, max', step: 1, min: 1 }
		]
	}
];

/** The shapes some group of tunable numbers configures. */
export const TUNED_SHAPES: readonly ShapeId[] = Object.freeze(
	SHAPE_IDS.filter((id) => TUNING_GROUPS.some((g) => g.shapes.includes(id)))
);

/**
 * The shapes Marginalia uses that have no numbers to turn — they are
 * structural rather than tuned. Derived rather than listed, so it stays true
 * on its own as groups gain and lose shapes.
 */
export const UNTUNED_SHAPES: readonly ShapeId[] = Object.freeze(
	SHAPE_IDS.filter((id) => !TUNING_GROUPS.some((g) => g.shapes.includes(id)))
);
