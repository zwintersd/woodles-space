// The balance harness — a world, run faster than anyone can play it.
//
// This exists to answer questions about *feel* with numbers instead of an
// afternoon: how long until the first Known, does the world hold itself
// together unaided, and does restraint actually pay more than meddling.
//
// It drives the same `World` an app does. That is the point, and it is the
// only reason a number out of here can be trusted to describe the game
// someone actually plays: there is one implementation of the tick, not two.
//
// Borrowed from `@woodles/incremental-core`, whose engine learned all three the
// hard way:
//   - **a fixed timestep**, so a run doesn't depend on how fast the machine is.
//   - **integer tick counting.** Game time is `ticks / 10`, never accumulated by
//     adding 0.1 — three hundred float additions of 0.1 lose a whole tick.
//   - **a seeded RNG whose stream position is part of the state**, so the same
//     seed reproduces a run exactly, down to which line was spoken.
//
// What it deliberately does *not* do is decide whether a number is good. It
// reports; the caller judges.

import { World, createWorldState, tuningFromDef, STAGE_KNOWN, type WorldEvent, type WorldState, type WorldTuning } from './world.js';
import type { MarginaliaDef } from './def.js';
import { STOCK_IDS } from './vitals.js';
import type { StockId, Worldspace } from './types.js';

/** One tick of game time. Matches incremental-core, and for the same reasons. */
export const TICK_MS = 100;
export const TICKS_PER_SECOND = 1000 / TICK_MS;
const TICK_SECONDS = TICK_MS / 1000;

/**
 * What a policy may ask before deciding. Kept narrow on purpose: a policy that
 * can see everything is a policy nobody can reason about when a chart surprises
 * them.
 */
export interface PolicyContext {
	/** Game-seconds elapsed. */
	readonly t: number;
	/** Visible life, cheapest thing to ask about. */
	readonly world: World;
}

/**
 * A way of playing. Called once per tick, after the world has moved.
 *
 * Actions are applied immediately in the order returned. A policy must not
 * mutate the world itself — return intent, not effects.
 */
export interface WorldPolicy {
	readonly name: string;
	decide(ctx: PolicyContext): readonly PolicyAction[];
}

export type PolicyAction =
	| { type: 'attend'; lifeId: string }
	| { type: 'unattend'; lifeId: string }
	| { type: 'lookCloser'; lifeId: string }
	| { type: 'intervene'; lifeId: string }
	| { type: 'expandAttention' }
	| { type: 'distill' }
	| { type: 'writeCondition'; id: string };

const NOTHING: readonly PolicyAction[] = Object.freeze([]);

/**
 * Apply one decided action to a world. `simulate`'s own tick loop inlines
 * this (it additionally counts interventions for the summary), but a live
 * driver — an app running a policy frame by frame instead of tick by tick —
 * needs the same mapping without the harness bookkeeping. Kept here rather
 * than duplicated so both read one definition of what an action does.
 */
export function applyPolicyAction(world: World, action: PolicyAction, t: number, into: WorldEvent[] = []): void {
	switch (action.type) {
		case 'attend':
			world.attend(action.lifeId);
			break;
		case 'unattend':
			world.unattend(action.lifeId);
			break;
		case 'lookCloser':
			world.lookCloser(action.lifeId, t * 1000, into);
			break;
		case 'intervene':
			world.intervene(action.lifeId, into);
			break;
		case 'expandAttention':
			world.expandAttention();
			break;
		case 'distill':
			world.distillEssence(into);
			break;
		case 'writeCondition':
			world.writeCondition(action.id);
			break;
	}
}

// ── the bounds ──────────────────────────────────────────────────────────────
//
// `incremental-core` brackets play between "never buys" and "always buys the
// cheapest thing", because nobody plays worse than idling and few play better
// than always buying. Those don't transfer: a living-system world's scarce
// resource is *attention*, not currency, and "buy the cheapest thing" is not a
// strategy in a game whose central decision is which two of eleven things to
// watch.
//
// So the bracket is restraint against meddling — which is exactly the axis
// World 1's design claims to reward, and the axis any other def built this
// way would be making its own claim about.

export interface WitnessOptions {
	/**
	 * Return to a Known life only once its recall has fallen below this. 1 tops
	 * everything up the moment it slips; lower values let things fade first.
	 */
	returnBelow?: number;
	/**
	 * Fill attention slots with whatever is closest to its next stage. The
	 * alternative — leaving slots empty — is a floor nobody plays, since
	 * attending costs nothing.
	 */
	autoAttend?: boolean;
	/** Buy attention capacity when affordable. Idle games expect you to. */
	expandAttention?: boolean;
}

/**
 * The thesis's ideal player: watch closely, buy capacity, and never touch
 * anything. Never intervenes, never distills, never clicks.
 */
export function witnessOnly(options: WitnessOptions = {}): WorldPolicy {
	const autoAttend = options.autoAttend ?? true;
	const expand = options.expandAttention ?? true;
	const returnBelow = options.returnBelow ?? 1;
	return {
		name: 'Witness',
		decide({ world }) {
			const actions: PolicyAction[] = [];
			if (expand) {
				const cost = world.attentionUpgradeCost;
				if (cost !== null && world.state.insight >= cost) actions.push({ type: 'expandAttention' });
			}
			if (autoAttend) {
				// let go of anything fully back in mind — otherwise the first
				// things Known sit in their slots forever and capacity means
				// nothing again
				for (const id of world.state.attending) {
					if (world.stageOf(id) >= STAGE_KNOWN && world.recallOf(id) >= 0.999) {
						actions.push({ type: 'unattend', lifeId: id });
					}
				}
				fillAttention(world, actions, returnBelow);
			}
			return actions.length ? actions : NOTHING;
		}
	};
}

/**
 * The ceiling on meddling: everything Witness does, plus intervene on anything
 * Known the moment it can be afforded, and distill spare insight into essence.
 *
 * Deliberately naive — it is a *bound*, not a model of a thoughtful player.
 * Nobody meddles harder than this.
 */
export function interventionist(options: WitnessOptions = {}): WorldPolicy {
	const base = witnessOnly(options);
	return {
		name: 'Interventionist',
		decide(ctx) {
			const { world } = ctx;
			const actions: PolicyAction[] = [...base.decide(ctx)];
			for (const l of world.life) {
				if (world.canIntervene(l.id)) actions.push({ type: 'intervene', lifeId: l.id });
			}
			if (world.canDistill()) actions.push({ type: 'distill' });
			return actions.length ? actions : NOTHING;
		}
	};
}

/**
 * The study bound: it lets a thing fade before returning to it.
 *
 * The claim this exists to check is Bjork's, and a def's own design: retrieving
 * something nearly forgotten is worth more than topping up something never let
 * slip. If `patient` doesn't beat `witnessOnly` on fluency — and eventually on
 * the slots it frees — the recall numbers are wrong and the mechanic is just a
 * chore.
 */
export function patient(returnBelow = 0.4, options: WitnessOptions = {}): WorldPolicy {
	const inner = witnessOnly({ ...options, returnBelow });
	return {
		name: `Patient(${returnBelow})`,
		decide: (ctx) => inner.decide(ctx)
	};
}

/** Does nothing at all. The true floor — not even attention. */
export const doNothing: WorldPolicy = {
	name: 'Nothing',
	decide: () => NOTHING
};

/**
 * Fill every free slot, so attention is never idle.
 *
 * Deepening comes first — a life that hasn't reached Known yet is progress the
 * world can't make any other way. Only then does it return to something Known
 * that has slipped, worst-remembered first.
 *
 * `returnBelow` is the whole difference between the two study policies. At 1 it
 * is the anxious reading: top everything up the instant it slips at all. Lower
 * it and things are left to fade before returning to them, which is what
 * builds fluency — see `patient`.
 */
function fillAttention(world: World, into: PolicyAction[], returnBelow = 1): void {
	let free = world.attentionFree;
	if (free <= 0) return;

	const deepening = world.life
		.filter((l) => world.stageOf(l.id) < STAGE_KNOWN && !world.isAttending(l.id))
		.sort((a, b) => world.stageProgress(b.id) - world.stageProgress(a.id));

	const faded = world.life
		.filter(
			(l) =>
				world.stageOf(l.id) >= STAGE_KNOWN &&
				!world.isAttending(l.id) &&
				world.recallOf(l.id) < returnBelow
		)
		.sort((a, b) => world.recallOf(a.id) - world.recallOf(b.id));

	for (const l of [...deepening, ...faded]) {
		if (free <= 0) break;
		into.push({ type: 'attend', lifeId: l.id });
		free -= 1;
	}
}

// ── running ─────────────────────────────────────────────────────────────────

export interface SimOptions {
	/** How long to run, in game-seconds. */
	duration: number;
	/** Series resolution in game-seconds. Defaults to ~400 samples. */
	sampleEvery?: number;
	seed?: number;
	/** Conditions written before the clock starts. Defaults to all of them. */
	writeConditions?: string[] | 'all' | 'none';
	/** Essence granted up front, so writing conditions isn't the bottleneck. */
	startingEssence?: number;
	/** Which part of the world to stand in. The def's own default worldspace otherwise. */
	worldspace?: Worldspace;
	/** Seed a specific state instead — overrides every option above. */
	initialState?: WorldState;
	/**
	 * Candidate numbers to run instead of the def's shipped ones. This is what
	 * makes a sweep possible: run the same world at four pacings in one pass and
	 * print the comparison, rather than editing tuning and re-running.
	 */
	tuning?: Partial<WorldTuning>;
}

export interface SeriesSample {
	t: number;
	insight: number;
	insightPerSec: number;
	essence: number;
	favor: number;
	stability: number;
	complexity: number;
	stocks: Record<StockId, number>;
	/** Mean vitality across visible life — 1 is a contented world. */
	vitality: number;
	/** Mean recall across Known life — 1 is a world entirely in mind. */
	recall: number;
	/** Total fluency across Known life — permanent, only ever rises. */
	fluency: number;
	equilibriumFactor: number;
	knownCount: number;
}

export interface SimSummary {
	policy: string;
	seed: number;
	duration: number;
	/** Game-seconds at which each life first reached Known; absent if never. */
	timeToKnown: Record<string, number>;
	/** Game-seconds to the first Known anywhere, or null. */
	timeToFirstKnown: number | null;
	/** Game-seconds to Knowing every life visible from where it stood, or null. */
	timeToAllKnown: number | null;
	/** Game-seconds at which the world first held itself, or null if never. */
	timeToSelfBalancing: number | null;
	/** Fraction of the run the world spent balanced and unpropped. */
	equilibriumShare: number;
	/** Fraction of the run at least one life was stressed. */
	stressedShare: number;
	/** Did it ever go quiet (the soft-fail placeholder)? */
	wentQuiet: boolean;
	finalInsight: number;
	finalEssence: number;
	finalFavor: number;
	finalKnowing: number;
	peakComplexity: number;
	equilibriumSeconds: number;
	/** Mean recall at the end of the run, across Known life. */
	finalRecall: number;
	/** Total fluency built — the durable half of what studying bought. */
	finalFluency: number;
	interventions: number;
	/** What a prestige-style minting formula would grant if the book closed here. */
	concepts: number;
}

export interface SimResult {
	summary: SimSummary;
	series: SeriesSample[];
	events: TimedEvent[];
	final: World;
}

export interface TimedEvent {
	t: number;
	event: WorldEvent;
}

/**
 * A minting formula, computed on a finished run. Nothing consumes this yet —
 * it's here because "would this run be worth closing the book on?" is a
 * balance question the harness can answer before the feature exists, and
 * because it's the only number that reads `equilibriumSeconds`, the restraint
 * dividend.
 */
export function conceptsFor(peakComplexity: number, knownCount: number, equilibriumSeconds: number): number {
	return Math.floor(
		0.5 * Math.sqrt(peakComplexity) + 0.3 * knownCount + 0.2 * Math.sqrt(equilibriumSeconds)
	);
}

export function createWorld(def: MarginaliaDef, opts: SimOptions = { duration: 0 }): World {
	const tuning: WorldTuning = opts.tuning ? { ...tuningFromDef(def), ...opts.tuning } : tuningFromDef(def);
	if (opts.initialState) return new World(def, opts.initialState, opts.seed ?? 1, undefined, tuning);

	const state = createWorldState(def);
	state.essence = opts.startingEssence ?? 10_000;
	if (opts.worldspace) state.activeWorldspace = opts.worldspace;
	const world = new World(def, state, opts.seed ?? 1, undefined, tuning);
	world.quietAnnouncements = true; // nothing is watching; skip the popup bookkeeping

	const which = opts.writeConditions ?? 'all';
	if (which === 'all') {
		for (const c of def.conditions) world.writeCondition(c.id);
	} else if (which !== 'none') {
		for (const id of which) world.writeCondition(id);
	}
	return world;
}

/**
 * Run a policy against a world and report what happened.
 *
 * The loop is deliberately the same shape as `incremental-core`'s: tick, then
 * let the policy act, then sample on a fixed cadence. Ticks are counted as
 * integers and game time derived from the count.
 */
export function simulate(def: MarginaliaDef, policy: WorldPolicy, opts: SimOptions): SimResult {
	const world = createWorld(def, opts);
	const totalTicks = Math.round(opts.duration * TICKS_PER_SECOND);
	const sampleEvery = opts.sampleEvery ?? Math.max(TICK_SECONDS, opts.duration / 400);
	const sampleTicks = Math.max(1, Math.round(sampleEvery * TICKS_PER_SECOND));

	const series: SeriesSample[] = [];
	const events: TimedEvent[] = [];
	const timeToKnown: Record<string, number> = {};
	let timeToSelfBalancing: number | null = null;
	let equilibriumTicks = 0;
	let stressedTicks = 0;
	let wentQuiet = false;
	let peakComplexity = 0;
	let interventions = 0;

	const buffer: WorldEvent[] = [];

	for (let tick = 0; tick < totalTicks; tick++) {
		const t = tick / TICKS_PER_SECOND;

		buffer.length = 0;
		world.tick(TICK_SECONDS, buffer);

		for (const action of policy.decide({ t, world })) {
			switch (action.type) {
				case 'attend':
					world.attend(action.lifeId);
					break;
				case 'unattend':
					world.unattend(action.lifeId);
					break;
				case 'lookCloser':
					// game time doubles as the click clock, so a streak is
					// reproducible rather than dependent on the wall clock
					world.lookCloser(action.lifeId, t * 1000, buffer);
					break;
				case 'intervene': {
					const before = buffer.length;
					world.intervene(action.lifeId, buffer);
					if (buffer.length > before) interventions += 1;
					break;
				}
				case 'expandAttention':
					world.expandAttention();
					break;
				case 'distill':
					world.distillEssence(buffer);
					break;
				case 'writeCondition':
					world.writeCondition(action.id);
					break;
			}
		}

		for (const e of buffer) {
			events.push({ t, event: e });
			if (e.kind === 'stage' && e.stage === STAGE_KNOWN && timeToKnown[e.lifeId] === undefined) {
				timeToKnown[e.lifeId] = t;
			}
			if (e.kind === 'quiet') wentQuiet = true;
		}

		if (world.selfBalancing) {
			equilibriumTicks += 1;
			if (timeToSelfBalancing === null) timeToSelfBalancing = t;
		}
		if (world.life.some((l) => world.severityOf(l) > 0)) stressedTicks += 1;
		const complexity = world.complexity;
		if (complexity > peakComplexity) peakComplexity = complexity;

		if (tick % sampleTicks === 0) series.push(sampleWorld(world, t));
	}

	series.push(sampleWorld(world, totalTicks / TICKS_PER_SECOND));

	const knownTimes = Object.values(timeToKnown);
	const visibleIds = world.life.map((l) => l.id);
	const allVisibleKnown = visibleIds.every((id) => timeToKnown[id] !== undefined);

	return {
		summary: {
			policy: policy.name,
			seed: world.seed,
			duration: opts.duration,
			timeToKnown,
			timeToFirstKnown: knownTimes.length ? Math.min(...knownTimes) : null,
			timeToAllKnown:
				allVisibleKnown && visibleIds.length > 0
					? Math.max(...visibleIds.map((id) => timeToKnown[id]))
					: null,
			timeToSelfBalancing,
			equilibriumShare: totalTicks ? equilibriumTicks / totalTicks : 0,
			stressedShare: totalTicks ? stressedTicks / totalTicks : 0,
			wentQuiet,
			finalInsight: world.state.insight,
			finalEssence: world.state.essence,
			finalFavor: world.state.favor,
			finalKnowing: world.state.knowing,
			peakComplexity,
			equilibriumSeconds: world.state.equilibriumSeconds,
			finalRecall: series[series.length - 1].recall,
			finalFluency: series[series.length - 1].fluency,
			interventions,
			concepts: conceptsFor(peakComplexity, world.knownCount, world.state.equilibriumSeconds)
		},
		series,
		events,
		final: world
	};
}

function sampleWorld(world: World, t: number): SeriesSample {
	const life = world.life;
	let vitality = 0;
	for (const l of life) vitality += world.vitalityOf(l.id);
	const stocks = {} as Record<StockId, number>;
	for (const id of STOCK_IDS) stocks[id] = world.state.stocks[id];
	const known = life.filter((l) => world.stageOf(l.id) >= STAGE_KNOWN);
	let recall = 0;
	let fluency = 0;
	for (const l of known) {
		recall += world.recallOf(l.id);
		fluency += world.fluencyOf(l.id);
	}
	return {
		t,
		insight: world.state.insight,
		insightPerSec: world.insightPerSec,
		essence: world.state.essence,
		favor: world.state.favor,
		stability: world.stability,
		complexity: world.complexity,
		stocks,
		vitality: life.length ? vitality / life.length : 1,
		recall: known.length ? recall / known.length : 1,
		fluency,
		equilibriumFactor: world.equilibriumFactor,
		knownCount: world.knownCount
	};
}

/**
 * Run several policies over the same world and duration. The comparison is the
 * product — one run in isolation says almost nothing about whether a number is
 * right.
 */
export function compare(def: MarginaliaDef, policies: WorldPolicy[], opts: SimOptions): SimResult[] {
	return policies.map((p) => simulate(def, p, opts));
}

/** Every life a def contains, for tests and readouts. */
export function allLifeIds(def: MarginaliaDef): string[] {
	return def.life.map((l) => l.id);
}
