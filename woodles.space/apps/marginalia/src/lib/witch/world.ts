// The world's mechanics, with nothing reactive in them.
//
// This is the same seam `vitals.ts` and `focus.ts` already state — "pure and
// rune-free so it can be unit-tested directly; the Book holds the $state and
// calls into this" — carried the rest of the way, to the tick itself and to
// every action that changes the economy.
//
// Two things drive a `World`: the Book (`book.svelte.ts`), one animation frame
// at a time, wrapping it in runes for the UI; and the balance harness
// (`sim.ts`), ten hours at a time, as fast as the CPU allows. **They run the
// same code**, which is the only way a number the harness reports can be
// trusted to describe the game someone actually plays.
//
// The rules that keep it that way:
//   - no runes, no DOM, no `localStorage`, no `Date.now()`, no `performance`.
//   - no `Math.random()`. Every roll goes through the injected `Rng`, so a
//     seed reproduces a run exactly — including which line she spoke.
//   - nothing here renders. Things worth telling a player about come back as
//     `WorldEvent`s and the caller decides what to do with them.
//
// Why it matters that this is fast: through the Book's runes, ten hours of game
// time costs ~33s — four `$state` container reassignments per tick, each
// invalidating a derived chain. Here it is ~1.3s, and the difference is what
// makes sweeping a constant in `tuning.ts` a thing you can actually do.

import { createRng, type Rng } from '@woodles/incremental-core';
import { conditionById } from './content/conditions';
import { revealedEmergences } from './content/emergences';
import {
	revealedLife,
	lifeById,
	world1Life,
	type Life,
	type LifeCategory
} from './content/life';
import { interventionForDomain } from './content/interventions';
import {
	stageFieldNoteOptions,
	fillTemplate,
	pickLine,
	equilibriumFieldNotes,
	quietFieldNotes,
	categoryMasteryFieldNotes
} from './content/fieldNoteTemplates';
import {
	STAGE_SECONDS,
	LOOK_CLOSER_SECONDS,
	STAGE_INSIGHT_MULT,
	INSIGHT_TRICKLE_ANNOUNCE_SEC,
	STOCK_DRIFT_PER_SEC,
	STOCK_LEAK,
	STOCK_NEUTRAL,
	ATTENTION_START,
	ATTENTION_COSTS,
	DISTILL_INSIGHT_COST,
	DISTILL_ESSENCE_GAIN,
	ESSENCE_ON_STUDIED,
	ESSENCE_ON_KNOWN,
	FAVOR_BASE_TARGET,
	FAVOR_PER_KNOWN,
	FAVOR_DRIFT_PER_SEC,
	favorMultiplier,
	STAGE_ACTIVITY,
	FAVOR_STRESS_PENALTY,
	WORLD_QUIET_STABILITY,
	TEND_BUMP,
	INVOKE_BUMP,
	SHAPE_BASELINE_RAISE,
	SHAPE_BASELINE_MAX,
	ENCOURAGE_STABILITY,
	ENCOURAGE_STABILITY_MAX,
	GUIDE_METABOLISM_SCALE,
	INTERVENTION_LOAD_WEIGHT,
	INTERVENTION_LOAD_FULL,
	RECALL_DECAY_PER_SEC,
	RECALL_RESTORE_PER_SEC,
	RECALL_YIELD_FLOOR,
	FLUENCY_GAIN_PER_SEC,
	FLUENCY_MAX,
	FLUENCY_YIELD_BONUS,
	FAVOR_EQUILIBRIUM_BONUS,
	EQUILIBRIUM_MIN_FACTOR,
	CATEGORY_MASTERY_BONUS
} from './tuning';
import {
	type Stocks,
	STOCK_IDS,
	STOCK_BANDS,
	neutralStocks,
	severityFor,
	nextVitality,
	lifeStockRate,
	driftRate,
	leakRate,
	focusStock,
	stabilityOf,
	type StockId
} from './vitals';
import { nextFocusStreak, focusMultiplier } from './focus';
import { visibleLifeForWorldspace, type Worldspace } from './worldShape';

// observation stages — the canonical definitions. `book.svelte.ts` re-exports
// these so the forty files that import them from there keep working.
export const STAGE_NOTICED = 0; // it has emerged; she has not looked yet
export const STAGE_OBSERVED = 1;
export const STAGE_STUDIED = 2;
export const STAGE_KNOWN = 3;

export const stageLabel = ['noticed', 'observed', 'studied', 'known'] as const;

/**
 * Everything the economy is. Plain data, structured-clone safe, and a superset
 * of what the save carries — the last three fields are session-only.
 */
export interface WorldState {
	// carried resources (will cross worlds, once prestige exists)
	essence: number;
	knowing: number;
	// this-world resources
	insight: number;
	favor: number;
	// vital signs
	stocks: Stocks;
	vitality: Record<string, number>;
	// interventions
	stockBaseline: Stocks;
	stabilityBonus: number;
	metabolismScale: Record<string, number>;
	interventionsDone: Record<string, number>;
	/** Lifetime weight of every act she has made here. Never decays. */
	interventionLoad: number;
	equilibriumSeconds: number;
	/** How readily a Known life comes to her, 0..1. Decays; attention restores it. */
	recall: Record<string, number>;
	/** Permanent durability, built by returning to something that had faded. */
	fluency: Record<string, number>;
	// attention
	attentionCapacity: number;
	attending: string[];
	study: Record<string, number>;
	// progress
	writtenConditions: string[];
	observation: Record<string, number>;
	categoryMastered: Record<string, boolean>;
	// which part of the world is being looked at — gates what is visible
	activeWorldspace: Worldspace;

	// ── session-only, never saved ────────────────────────────────────────────
	focusStreak: number;
	/** ms epoch of the last look-closer, for the streak window. */
	lastLookCloserAt: number;
	/** Sub-announcement insight, held back until it rounds to a whole number. */
	trickleAccum: number;
	trickleTimer: number;
}

/**
 * The handful of constants worth *sweeping* rather than just reading.
 *
 * Everything else in `tuning.ts` is imported directly, because a tuning value
 * you can't change without editing the file is fine — the point of this
 * interface is the balance harness, which needs to run the same world at four
 * different pacings in one pass and print the comparison. See BALANCE.md.
 */
export interface WorldTuning {
	/** Study-seconds to reach each stage. Index 0 unused; Notice is automatic. */
	stageSeconds: readonly number[];
	/** How hard a stock is pulled back per point outside its band, per second. */
	stockDriftPerSec: number;
	/** The world's passive loss per stock, per point above the band floor. */
	stockLeak: Record<StockId, number>;
}

export const defaultTuning: WorldTuning = {
	stageSeconds: STAGE_SECONDS,
	stockDriftPerSec: STOCK_DRIFT_PER_SEC,
	stockLeak: STOCK_LEAK
};

export function createWorldState(): WorldState {
	return {
		essence: 6,
		knowing: 0,
		insight: 0,
		favor: 60,
		stocks: neutralStocks(),
		vitality: {},
		stockBaseline: neutralStocks(),
		stabilityBonus: 0,
		metabolismScale: {},
		interventionsDone: {},
		interventionLoad: 0,
		equilibriumSeconds: 0,
		recall: {},
		fluency: {},
		attentionCapacity: ATTENTION_START,
		attending: [],
		study: {},
		writtenConditions: [],
		observation: {},
		categoryMastered: {},
		activeWorldspace: 'water',
		focusStreak: 0,
		lastLookCloserAt: 0,
		trickleAccum: 0,
		trickleTimer: 0
	};
}

/**
 * Something worth telling someone about. The Book turns these into field notes
 * and gain popups; the harness counts them and timestamps them. Neither has to
 * know what the other does with them.
 */
export type WorldEvent =
	| { kind: 'stage'; lifeId: string; stage: number; note: string | null }
	| { kind: 'mastery'; category: LifeCategory; note: string | null }
	| { kind: 'intervention'; lifeId: string; line: string; note: string }
	| { kind: 'equilibrium'; note: string | null }
	| { kind: 'quiet'; note: string | null }
	/** A discrete, attention-worthy grant. */
	| { kind: 'gain'; resource: 'insight' | 'essence'; amount: number }
	/** The ambient per-second insight drip, batched into whole numbers. */
	| { kind: 'trickle'; amount: number };

/**
 * The economy, driven by whoever holds it.
 *
 * Derived values are plain getters rather than cached fields, with one
 * exception: the visible-life list walks every condition and every life to
 * answer, and the tick asks for it constantly, so it sits behind a dirty flag
 * that only writing a condition or changing worldspace can trip. That is the
 * same trade `incremental-core` makes for its rate table, for the same reason.
 */
export class World {
	state: WorldState;
	readonly tuning: WorldTuning;
	private rng: Rng;

	/** Set true when the tick should hold back per-event announcements. */
	quietAnnouncements = false;

	private cachedLife: Life[] | null = null;
	private cachedAllLife: Life[] | null = null;
	private cachedWrittenSet: Set<string> | null = null;
	private lifeDirty = true;

	// edge detection for the once-per-transition beats
	private wasSelfBalancing = false;
	private wasQuiet = false;

	constructor(
		state: WorldState = createWorldState(),
		seed = 1,
		resumeRngFrom?: number,
		tuning: WorldTuning = defaultTuning
	) {
		this.state = state;
		this.tuning = tuning;
		this.rng = createRng(seed, resumeRngFrom);
	}

	/** Where the random stream has got to, so a save can resume it exactly. */
	get rngState(): number {
		return this.rng.state;
	}

	get seed(): number {
		return this.rng.seed;
	}

	/** A copy of this world's tuning with some values overridden, for a sweep. */
	static tuned(overrides: Partial<WorldTuning>): WorldTuning {
		return { ...defaultTuning, ...overrides };
	}

	/** Replace the whole state — a load, or a reset. Invalidates everything derived. */
	replace(state: WorldState): void {
		this.state = state;
		this.invalidate();
		this.wasSelfBalancing = false;
		this.wasQuiet = false;
	}

	private invalidate(): void {
		this.lifeDirty = true;
		this.cachedLife = null;
		this.cachedAllLife = null;
		this.cachedWrittenSet = null;
	}

	private refreshLife(): void {
		this.cachedWrittenSet = new Set(this.state.writtenConditions);
		this.cachedAllLife = revealedLife(this.cachedWrittenSet);
		this.cachedLife = visibleLifeForWorldspace(this.cachedAllLife, this.state.activeWorldspace);
		this.lifeDirty = false;
	}

	// ── derived: the web ─────────────────────────────────────────────────────

	get writtenSet(): Set<string> {
		if (this.lifeDirty) this.refreshLife();
		return this.cachedWrittenSet!;
	}

	/** Everything the written conditions have revealed, wherever it lives. */
	get allRevealedLife(): Life[] {
		if (this.lifeDirty) this.refreshLife();
		return this.cachedAllLife!;
	}

	/** What is visible from where she is standing — the tick only moves these. */
	get life(): Life[] {
		if (this.lifeDirty) this.refreshLife();
		return this.cachedLife!;
	}

	get emergences() {
		return revealedEmergences(this.writtenSet);
	}

	hasWritten(id: string): boolean {
		return this.writtenSet.has(id);
	}

	stageOf(lifeId: string): number {
		return this.state.observation[lifeId] ?? STAGE_NOTICED;
	}

	vitalityOf(lifeId: string): number {
		return this.state.vitality[lifeId] ?? 1;
	}

	severityOf(life: Life): number {
		return severityFor(life.needs, this.state.stocks);
	}

	/** How readily a Known life comes to her now. Only meaningful at Known. */
	recallOf(lifeId: string): number {
		return this.state.recall[lifeId] ?? 1;
	}

	/** Permanent durability, built by returning to something that had faded. */
	fluencyOf(lifeId: string): number {
		return this.state.fluency[lifeId] ?? 0;
	}

	/**
	 * What recall does to a Known life's yield. A forgotten thing is still
	 * known, so this floors well above zero — the point is that returning to it
	 * is *worth* a slot, not that neglect is punished.
	 */
	recallMultiplier(lifeId: string): number {
		if (this.stageOf(lifeId) < STAGE_KNOWN) return 1;
		const fresh = RECALL_YIELD_FLOOR + (1 - RECALL_YIELD_FLOOR) * this.recallOf(lifeId);
		// Fluency pays *above* full recall, which is the whole point of the
		// testing effect: durable knowledge is worth more than merely fresh
		// knowledge. Without this there is nothing above the recall ceiling, so
		// keeping everything topped up captures all there is and letting a thing
		// fade is pure loss — the opposite of what the mechanic is for.
		return fresh + FLUENCY_YIELD_BONUS * this.fluencyOf(lifeId);
	}

	// ── derived: the idle engine ─────────────────────────────────────────────

	/** Insight/sec from witnessed life, before the Favor multiplier. */
	get baseInsightRate(): number {
		let r = 0;
		for (const l of this.life) {
			const mastery = this.state.categoryMastered[l.category] ? 1 + CATEGORY_MASTERY_BONUS : 1;
			r +=
				l.insightWeight *
				(STAGE_INSIGHT_MULT[this.stageOf(l.id)] ?? 0) *
				this.vitalityOf(l.id) *
				mastery *
				this.recallMultiplier(l.id);
		}
		return r;
	}

	get favorMult(): number {
		return favorMultiplier(this.state.favor);
	}

	get insightPerSec(): number {
		return this.baseInsightRate * this.favorMult;
	}

	get focusMult(): number {
		return focusMultiplier(this.state.focusStreak);
	}

	get attentionUsed(): number {
		return this.state.attending.length;
	}

	get attentionFree(): number {
		return this.state.attentionCapacity - this.state.attending.length;
	}

	/** Cost to raise attention capacity by one, or null at the maximum. */
	get attentionUpgradeCost(): number | null {
		const tier = this.state.attentionCapacity - ATTENTION_START;
		return tier < ATTENTION_COSTS.length ? ATTENTION_COSTS[tier] : null;
	}

	/**
	 * Measured against the whole authored world, not the visible subset — so
	 * closing the book on a world you only half-explored reads honestly.
	 */
	get knownCount(): number {
		return world1Life.filter((l) => (this.state.observation[l.id] ?? 0) >= STAGE_KNOWN).length;
	}

	// ── derived: world metrics ───────────────────────────────────────────────

	get complexity(): number {
		let c = 0;
		for (const l of this.life) c += 1 + this.stageOf(l.id);
		return c + 1.5 * this.emergences.length + 2 * this.knownCount;
	}

	private get knownEcosystems(): number {
		return this.life.filter((l) => l.domain === 'ecosystem' && this.stageOf(l.id) >= STAGE_KNOWN)
			.length;
	}

	get stability(): number {
		return Math.min(
			100,
			stabilityOf(this.state.stocks, this.knownEcosystems) + this.state.stabilityBonus
		);
	}

	get quiet(): boolean {
		return this.life.length > 0 && this.stability < WORLD_QUIET_STABILITY;
	}

	get allStocksInBand(): boolean {
		return STOCK_IDS.every((id) => {
			const [lo, hi] = STOCK_BANDS[id];
			return this.state.stocks[id] >= lo && this.state.stocks[id] <= hi;
		});
	}

	/**
	 * A balanced world she is *not* propping up. 0..1.
	 *
	 * The load term is lifetime, not recent: it counts every act she has made
	 * here. When it decayed, intervening was free within a minute — and since
	 * intervening *repairs* a world, and repair is what this rewards, the
	 * mechanic paid a meddler more than an ascetic. See BALANCE.md §3.
	 */
	get equilibriumFactor(): number {
		if (!this.allStocksInBand) return 0;
		return Math.max(0, 1 - Math.min(1, this.state.interventionLoad / INTERVENTION_LOAD_FULL));
	}

	/**
	 * Which stocks currently sit outside their band, so the Ledger can say *why*
	 * a world is not holding itself. The opening water worldspace settles two
	 * points under the nutrient floor by design (BALANCE.md §6) and a permanent
	 * "not balanced" with no explanation reads as a bug rather than as the
	 * reason to open the shallows.
	 */
	get outOfBand(): StockId[] {
		return STOCK_IDS.filter((id) => {
			const [lo, hi] = STOCK_BANDS[id];
			const shift = this.state.stockBaseline[id] - STOCK_NEUTRAL;
			return this.state.stocks[id] < lo + shift || this.state.stocks[id] > hi + shift;
		});
	}

	get selfBalancing(): boolean {
		return this.life.length > 0 && this.equilibriumFactor > EQUILIBRIUM_MIN_FACTOR;
	}

	// ── the web (author mode) ────────────────────────────────────────────────

	canWrite(id: string): boolean {
		const c = conditionById(id);
		if (!c || this.hasWritten(id)) return false;
		return this.state.essence >= c.cost;
	}

	writeCondition(id: string): boolean {
		const c = conditionById(id);
		if (!c || !this.canWrite(id)) return false;
		this.state.essence -= c.cost;
		this.state.writtenConditions = [...this.state.writtenConditions, id];
		this.state.knowing += 1;
		this.invalidate();
		return true;
	}

	// ── attention ────────────────────────────────────────────────────────────

	isAttending(lifeId: string): boolean {
		return this.state.attending.includes(lifeId);
	}

	/**
	 * Known life is attendable again — that is what attention is *for* once the
	 * stages are done. Reaching Known still releases the slot (see
	 * `settleStages`), so returning to something is always a deliberate act
	 * rather than a slot quietly staying occupied forever.
	 */
	canAttend(lifeId: string): boolean {
		if (this.isAttending(lifeId)) return false;
		if (!this.life.some((l) => l.id === lifeId)) return false;
		// nothing to gain from returning to something already fully in mind
		if (this.stageOf(lifeId) >= STAGE_KNOWN && this.recallOf(lifeId) >= 1) return false;
		return this.attentionFree > 0;
	}

	attend(lifeId: string): boolean {
		if (!this.canAttend(lifeId)) return false;
		this.state.attending = [...this.state.attending, lifeId];
		return true;
	}

	unattend(lifeId: string): boolean {
		if (!this.isAttending(lifeId)) return false;
		this.state.attending = this.state.attending.filter((id) => id !== lifeId);
		return true;
	}

	/** Study-seconds needed for the attended life's next stage advance. */
	stageThreshold(lifeId: string): number {
		const next = this.stageOf(lifeId) + 1;
		return this.tuning.stageSeconds[next] ?? Infinity;
	}

	/** 0..1 progress toward the next stage. */
	stageProgress(lifeId: string): number {
		const t = this.stageThreshold(lifeId);
		if (!isFinite(t)) return 1;
		return Math.min(1, (this.state.study[lifeId] ?? 0) / t);
	}

	/**
	 * The clicker hook. `now` is passed in rather than read from the clock, so
	 * the harness can drive a streak deterministically and the Book can hand it
	 * a real timestamp.
	 */
	lookCloser(lifeId: string, now: number, into: WorldEvent[] = []): WorldEvent[] {
		if (!this.isAttending(lifeId)) return into;
		this.state.focusStreak = nextFocusStreak(this.state.focusStreak, this.state.lastLookCloserAt, now);
		this.state.lastLookCloserAt = now;
		const seconds = LOOK_CLOSER_SECONDS * (lifeById(lifeId)?.studyEase ?? 1) * this.focusMult;
		this.addStudy(lifeId, seconds, into);
		return into;
	}

	private addStudy(lifeId: string, seconds: number, into: WorldEvent[]): void {
		const banked = (this.state.study[lifeId] ?? 0) + seconds;
		this.state.study = { ...this.state.study, [lifeId]: banked };
		this.settleStages(lifeId, into);
	}

	/** Advance as many stages as the banked study-seconds allow. */
	private settleStages(lifeId: string, into: WorldEvent[]): number {
		let crossed = 0;
		let stage = this.stageOf(lifeId);
		let banked = this.state.study[lifeId] ?? 0;
		const life = lifeById(lifeId);
		while (stage < STAGE_KNOWN) {
			const threshold = this.tuning.stageSeconds[stage + 1];
			if (banked < threshold) break;
			banked -= threshold;
			stage += 1;
			crossed += 1;
			this.state.observation = { ...this.state.observation, [lifeId]: stage };
			this.state.knowing += 1;
			if (stage === STAGE_STUDIED) {
				this.state.essence += ESSENCE_ON_STUDIED;
				into.push({ kind: 'gain', resource: 'essence', amount: ESSENCE_ON_STUDIED });
			}
			if (stage === STAGE_KNOWN) {
				this.state.essence += ESSENCE_ON_KNOWN;
				into.push({ kind: 'gain', resource: 'essence', amount: ESSENCE_ON_KNOWN });
				// freshly Known is fully in mind; it fades from here
				this.state.recall = { ...this.state.recall, [lifeId]: 1 };
			}
			if (life) {
				const line = pickLine(stageFieldNoteOptions(life.domain, stage), this.rng.next());
				into.push({
					kind: 'stage',
					lifeId,
					stage,
					note: line ? fillTemplate(line, life.name) : null
				});
				if (stage === STAGE_KNOWN) this.checkCategoryMastery(life.category, into);
			}
		}
		if (stage >= STAGE_KNOWN) {
			// fully known — it no longer needs watching; free the slot
			banked = 0;
			this.state.attending = this.state.attending.filter((id) => id !== lifeId);
		}
		this.state.study = { ...this.state.study, [lifeId]: banked };
		return crossed;
	}

	/**
	 * A category is mastered the moment its last un-Known life reaches Known, so
	 * this only ever needs checking right after a Known crossing. Sticky: once
	 * true, later-emerging life in the category can't revoke it.
	 */
	private checkCategoryMastery(category: LifeCategory, into: WorldEvent[]): void {
		if (this.state.categoryMastered[category]) return;
		const inCategory = this.life.filter((l) => l.category === category);
		if (inCategory.length === 0 || !inCategory.every((l) => this.stageOf(l.id) >= STAGE_KNOWN)) {
			return;
		}
		this.state.categoryMastered = { ...this.state.categoryMastered, [category]: true };
		into.push({
			kind: 'mastery',
			category,
			note: pickLine(categoryMasteryFieldNotes[category], this.rng.next())
		});
	}

	// ── interventions ────────────────────────────────────────────────────────

	hasIntervened(lifeId: string): boolean {
		return lifeId in this.state.interventionsDone;
	}

	interventionCostFor(lifeId: string): { insight: number; essence: number } {
		const life = lifeById(lifeId);
		return life ? interventionForDomain(life.domain).cost : { insight: 0, essence: 0 };
	}

	canIntervene(lifeId: string): boolean {
		if (this.stageOf(lifeId) < STAGE_KNOWN || this.hasIntervened(lifeId)) return false;
		const c = this.interventionCostFor(lifeId);
		return this.state.insight >= c.insight && this.state.essence >= c.essence;
	}

	interventionLineFor(lifeId: string): string | null {
		const idx = this.state.interventionsDone[lifeId];
		const life = lifeById(lifeId);
		if (idx === undefined || !life) return null;
		return interventionForDomain(life.domain).lines[idx] ?? null;
	}

	intervene(lifeId: string, into: WorldEvent[] = []): WorldEvent[] {
		if (!this.canIntervene(lifeId)) return into;
		const life = lifeById(lifeId)!;
		const spec = interventionForDomain(life.domain);
		this.state.insight -= spec.cost.insight;
		this.state.essence -= spec.cost.essence;
		this.applyInterventionEffect(life);
		const idx = Math.floor(this.rng.next() * spec.lines.length);
		this.state.interventionsDone = { ...this.state.interventionsDone, [lifeId]: idx };
		this.state.interventionLoad += INTERVENTION_LOAD_WEIGHT[spec.permanence];
		into.push({
			kind: 'intervention',
			lifeId,
			line: spec.lines[idx],
			note: `${life.name}: "${spec.lines[idx]}"`
		});
		return into;
	}

	/** Each verb does its own thing — see DESIGN.md §2.2. */
	private applyInterventionEffect(life: Life): void {
		const focus = focusStock(life.metabolism, life.needs);
		switch (life.domain) {
			case 'plant': {
				// tend: a small, temporary bump to the stock it lives by; drift fades it
				const s = { ...this.state.stocks };
				s[focus] = Math.min(100, s[focus] + TEND_BUMP);
				this.state.stocks = s;
				break;
			}
			case 'weather': {
				// invoke: a broad, uncertain moisture push — asked, never commanded
				const s = { ...this.state.stocks };
				s.moisture = Math.min(100, s.moisture + INVOKE_BUMP * (0.6 + this.rng.next() * 0.8));
				this.state.stocks = s;
				break;
			}
			case 'geology': {
				// shape: move a stock's baseline for good — monumental, slow
				const b = { ...this.state.stockBaseline };
				b[focus] = Math.min(SHAPE_BASELINE_MAX, b[focus] + SHAPE_BASELINE_RAISE);
				this.state.stockBaseline = b;
				break;
			}
			case 'ecosystem': {
				// encourage: raise the floor under everything
				this.state.stabilityBonus = Math.min(
					ENCOURAGE_STABILITY_MAX,
					this.state.stabilityBonus + ENCOURAGE_STABILITY
				);
				break;
			}
			case 'animal': {
				// guide: ease what it draws from the world
				this.state.metabolismScale = {
					...this.state.metabolismScale,
					[life.id]: GUIDE_METABOLISM_SCALE
				};
				break;
			}
		}
	}

	// ── insight sinks ────────────────────────────────────────────────────────

	expandAttention(): boolean {
		const cost = this.attentionUpgradeCost;
		if (cost === null || this.state.insight < cost) return false;
		this.state.insight -= cost;
		this.state.attentionCapacity += 1;
		return true;
	}

	canDistill(): boolean {
		return this.state.insight >= DISTILL_INSIGHT_COST;
	}

	distillEssence(into: WorldEvent[] = []): WorldEvent[] {
		if (!this.canDistill()) return into;
		this.state.insight -= DISTILL_INSIGHT_COST;
		this.state.essence += DISTILL_ESSENCE_GAIN;
		into.push({ kind: 'gain', resource: 'essence', amount: DISTILL_ESSENCE_GAIN });
		return into;
	}

	setWorldspace(worldspace: Worldspace): void {
		if (this.state.activeWorldspace === worldspace) return;
		this.state.activeWorldspace = worldspace;
		this.invalidate();
	}

	// ── recall: what attention is for after Known ────────────────────────────

	/**
	 * She returns to it. Recall eases back toward full, and — the desirable
	 * difficulty — the further it had slipped, the more permanent fluency the
	 * return builds. Topping up something never allowed to fade is worth almost
	 * nothing; recovering something half-lost is worth a great deal.
	 */
	private restoreRecall(lifeId: string, dt: number): void {
		const current = this.recallOf(lifeId);
		if (current >= 1) return;
		const gap = 1 - current;
		const next = Math.min(1, current + gap * (1 - Math.exp(-RECALL_RESTORE_PER_SEC * dt)));
		this.state.recall = { ...this.state.recall, [lifeId]: next };
		const gained = Math.min(
			FLUENCY_MAX,
			this.fluencyOf(lifeId) + FLUENCY_GAIN_PER_SEC * gap * dt
		);
		this.state.fluency = { ...this.state.fluency, [lifeId]: gained };
	}

	/** It slips, slower the more fluent she is with it. Exponential, dt-stable. */
	private fadeRecall(lifeId: string, dt: number): void {
		const current = this.recallOf(lifeId);
		if (current <= 0) return;
		const k = RECALL_DECAY_PER_SEC / (1 + this.fluencyOf(lifeId));
		const next = Math.max(0, current * Math.exp(-k * dt));
		this.state.recall = { ...this.state.recall, [lifeId]: next };
	}

	// ── the idle tick ────────────────────────────────────────────────────────

	/**
	 * One step of the world's clock. The order here is load-bearing and matches
	 * what shipped: rates are gathered from the stages held at the *start* of
	 * the tick, study lands next, and Favor eases last against the insight the
	 * tick already paid out.
	 */
	tick(dt: number, into: WorldEvent[] = []): WorldEvent[] {
		if (dt <= 0) return into;
		const s = this.state;
		const present = this.life;
		const presentIds = new Set(present.map((life) => life.id));
		if (s.attending.some((id) => !presentIds.has(id))) {
			s.attending = s.attending.filter((id) => presentIds.has(id));
		}

		// 1) vitality eases with each life's stress, and a wilting life
		//    metabolises less — so a stressed world eases its own pressure.
		//    Gather stock rates and the world's total stress in the same pass.
		const nextVit: Record<string, number> = { ...s.vitality };
		const rate: Stocks = { nutrients: 0, oxygen: 0, moisture: 0 };
		let stress = 0;
		for (const l of present) {
			const v = nextVitality(this.vitalityOf(l.id), this.severityOf(l), dt);
			nextVit[l.id] = v;
			stress += 1 - v;
			const scale = s.metabolismScale[l.id] ?? 1;
			const r = lifeStockRate(l.metabolism, (STAGE_ACTIVITY[this.stageOf(l.id)] ?? 0) * scale, v);
			for (const id of STOCK_IDS) rate[id] += r[id] ?? 0;
		}
		s.vitality = nextVit;

		// 2) attended life either deepens or is returned to. Study is slowed when
		//    a life is suffering; recall is not — she can always bring a thing to
		//    mind, however badly the world is treating it.
		const attendedNow = new Set(s.attending);
		for (const id of [...s.attending]) {
			if (!presentIds.has(id)) continue;
			const life = lifeById(id);
			if (!life) continue;
			if (this.stageOf(id) >= STAGE_KNOWN) {
				this.restoreRecall(id, dt);
			} else {
				this.addStudy(id, dt * life.studyEase * this.vitalityOf(id), into);
			}
		}

		// 2b) everything Known that she is *not* holding in mind slips a little.
		//     Storage never decays — it stays Known — only retrieval does.
		for (const l of present) {
			if (attendedNow.has(l.id) || this.stageOf(l.id) < STAGE_KNOWN) continue;
			this.fadeRecall(l.id, dt);
		}

		// 3) stocks move by metabolism, then get pulled back only if they have
		//    left their band — inside it the world is free to settle wherever
		//    its life holds it.
		const stocks = { ...s.stocks };
		for (const id of STOCK_IDS) {
			const shift = s.stockBaseline[id] - STOCK_NEUTRAL;
			const drift = driftRate(
				stocks[id],
				s.stockBaseline[id],
				STOCK_BANDS[id],
				this.tuning.stockDriftPerSec
			);
			// the world's own losses — evaporation, leach. Never below the floor,
			// so an unattended world settles there rather than draining away.
			const leak = leakRate(stocks[id], STOCK_BANDS[id][0] + shift, this.tuning.stockLeak[id]);
			stocks[id] = Math.max(0, Math.min(100, stocks[id] + (rate[id] + drift + leak) * dt));
		}
		s.stocks = stocks;

		// 4) the world yields Insight every second it is witnessed. Batched into
		//    an occasional whole number rather than announced every frame.
		const gained = this.insightPerSec * dt;
		s.insight += gained;
		if (!this.quietAnnouncements) {
			s.trickleAccum += gained;
			s.trickleTimer += dt;
			if (s.trickleTimer >= INSIGHT_TRICKLE_ANNOUNCE_SEC) {
				s.trickleTimer = 0;
				const whole = Math.floor(s.trickleAccum);
				if (whole > 0) {
					s.trickleAccum -= whole;
					into.push({ kind: 'trickle', amount: whole });
				}
			}
		}

		// 5) a balanced world she isn't propping up banks the equilibrium
		//    dividend. Load does not decay — see tuning.ts. Forgetting was the
		//    bug: it made every act free within a minute of making it.
		const eq = this.equilibriumFactor;
		// Banked *in proportion to* the factor, not gated on it. Gating was the
		// second half of why load never mattered: a binary `eq > 0.5` meant any
		// load short of the threshold cost exactly nothing, so the lightest hand
		// and a fairly heavy one banked identically. Now every act she makes
		// shows up in the dividend immediately, at its own weight.
		if (eq > EQUILIBRIUM_MIN_FACTOR) s.equilibriumSeconds += eq * dt;

		// 6) a beat the first time this world settles into balance, or the first
		//    time it goes quiet — not a repeating alarm.
		const balancingNow = this.selfBalancing;
		if (balancingNow && !this.wasSelfBalancing) {
			into.push({ kind: 'equilibrium', note: pickLine(equilibriumFieldNotes, this.rng.next()) });
		}
		this.wasSelfBalancing = balancingNow;

		const quietNow = this.quiet;
		if (quietNow && !this.wasQuiet) {
			into.push({ kind: 'quiet', note: pickLine(quietFieldNotes, this.rng.next()) });
		}
		this.wasQuiet = quietNow;

		// 7) Favor eases toward a target set by how much she has Known, pulled
		//    down by the world's stress and lifted when it holds itself.
		//    Exponential approach stays stable for any dt (incl. offline jumps).
		const target = Math.max(
			0,
			FAVOR_BASE_TARGET +
				FAVOR_PER_KNOWN * this.knownCount -
				FAVOR_STRESS_PENALTY * stress +
				FAVOR_EQUILIBRIUM_BONUS * eq
		);
		const k = 1 - Math.exp(-FAVOR_DRIFT_PER_SEC * dt);
		s.favor = Math.max(0, Math.min(100, s.favor + (target - s.favor) * k));
		return into;
	}
}
