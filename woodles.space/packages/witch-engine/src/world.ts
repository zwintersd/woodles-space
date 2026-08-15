// The world's mechanics, with nothing reactive in them.
//
// This is the same seam `vitals.ts` states — "pure and rune-free so it can
// be unit-tested directly" — carried the rest of the way, to the tick itself
// and to every action that changes the economy.
//
// Two things drive a `World`: an app's own reactive wrapper (Marginalia
// wraps this in Svelte runes, one animation frame at a time), and a balance
// harness, ten hours at a time, as fast as the CPU allows. **They run the
// same code**, which is the only way a number a harness reports can be
// trusted to describe the game someone actually plays.
//
// The rules that keep it that way:
//   - no runes, no DOM, no `localStorage`, no `Date.now()`, no `performance`.
//   - no `Math.random()`. Every roll goes through the injected `Rng`, so a
//     seed reproduces a run exactly — including which line was spoken.
//   - nothing here renders. Things worth telling a player about come back as
//     `WorldEvent`s and the caller decides what to do with them.
//
// A `World` is content plus tuning plus state. `def: MarginaliaDef` is the
// first two, and `state: WorldState` is the third. Nothing in this file
// imports a specific world's content — that's the whole point of extracting
// it here — so `def` is a required constructor parameter, not a default:
// an engine bundling one app's content as its own fallback would only be
// generic in name. `WorldTuning` is the one deliberate exception; see the
// comment on it below.

import { createRng, type Rng } from '@woodles/incremental-core';
import {
	accrue,
	admit,
	canAffordAll,
	comboMultiplier,
	decay as decayPrimary,
	dismiss,
	ease,
	factorFor,
	freeSlots,
	isMember,
	isRevealed,
	nextCapacityCost,
	nextComboLevel,
	restore as restorePrimary,
	risingEdge,
	stepStock,
	advanceLadder,
	type EdgeLatch
} from '@woodles/dynamics';
import type { MarginaliaDef } from './def.js';
import type { Condition, Life, LifeCategory, StockId, Stocks, Worldspace } from './types.js';
import { fillTemplate, pickLine } from './text.js';
import {
	STOCK_IDS,
	neutralStocks,
	severityFor,
	nextVitality,
	lifeStockRate,
	focusStock,
	stabilityOf
} from './vitals.js';

// observation stages — the canonical definitions.
export const STAGE_NOTICED = 0; // it has emerged; not yet looked at
export const STAGE_OBSERVED = 1;
export const STAGE_STUDIED = 2;
export const STAGE_KNOWN = 3;

export const stageLabel = ['noticed', 'observed', 'studied', 'known'] as const;

/**
 * Everything the economy is. Plain data, structured-clone safe, and a superset
 * of what a save carries — the last three fields are session-only.
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
	/** Lifetime weight of every act made here. Never decays. */
	interventionLoad: number;
	equilibriumSeconds: number;
	/** How readily a Known life comes to mind, 0..1. Decays; attention restores it. */
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
 * The handful of values worth *sweeping* rather than just reading off `def`.
 *
 * This is deliberately narrower than `MarginaliaDef.stage`/`.stock` — a
 * sweep runs the same *content* at several different pacings, so `World`
 * takes `tuning` as a second, separate parameter rather than folding it into
 * `def`. `tuningFromDef` is the identity case: the same three numbers `def`
 * already holds, addressable on their own for a caller that wants to
 * override just one.
 */
export interface WorldTuning {
	/** Study-seconds to reach each stage. Index 0 unused; Notice is automatic. */
	stageSeconds: readonly number[];
	/** How hard a stock is pulled back per point outside its band, per second. */
	stockDriftPerSec: number;
	/** The world's passive loss per stock, per point above the band floor. */
	stockLeak: Record<StockId, number>;
}

export function tuningFromDef(def: MarginaliaDef): WorldTuning {
	return {
		stageSeconds: def.stage.seconds,
		stockDriftPerSec: def.stock.driftPerSec,
		stockLeak: def.stock.leak
	};
}

export function createWorldState(def: MarginaliaDef): WorldState {
	return {
		essence: 6,
		knowing: 0,
		insight: 0,
		favor: 60,
		stocks: neutralStocks(def.stock.start),
		vitality: {},
		stockBaseline: neutralStocks(def.stock.start),
		stabilityBonus: 0,
		metabolismScale: {},
		interventionsDone: {},
		interventionLoad: 0,
		equilibriumSeconds: 0,
		recall: {},
		fluency: {},
		attentionCapacity: def.attention.start,
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
 * Something worth telling someone about. An app turns these into field notes
 * and gain popups; a harness counts them and timestamps them. Neither has to
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
	readonly def: MarginaliaDef;
	readonly tuning: WorldTuning;
	private rng: Rng;

	/** Built once from `def.life`/`def.conditions` — a `find()` per lookup is
	 * invisible at eleven entries and ruinous at 360,000 ticks. */
	private readonly lifeMap: Map<string, Life>;
	private readonly conditionMap: Map<string, Condition>;

	/** Set true when the tick should hold back per-event announcements. */
	quietAnnouncements = false;

	private cachedLife: Life[] | null = null;
	private cachedAllLife: Life[] | null = null;
	private cachedWrittenSet: Set<string> | null = null;
	private lifeDirty = true;

	// edge detection for the once-per-transition beats — shape L, Edge Latch
	private selfBalancingLatch: EdgeLatch = { was: false };
	private quietLatch: EdgeLatch = { was: false };

	constructor(
		def: MarginaliaDef,
		state: WorldState = createWorldState(def),
		seed = 1,
		resumeRngFrom?: number,
		tuning: WorldTuning = tuningFromDef(def)
	) {
		this.def = def;
		this.state = state;
		this.tuning = tuning;
		this.lifeMap = new Map(def.life.map((l) => [l.id, l]));
		this.conditionMap = new Map(def.conditions.map((c) => [c.id, c]));
		this.rng = createRng(seed, resumeRngFrom);
	}

	private lifeById(id: string): Life | undefined {
		return this.lifeMap.get(id);
	}

	private conditionById(id: string): Condition | undefined {
		return this.conditionMap.get(id);
	}

	/** Where the random stream has got to, so a save can resume it exactly. */
	get rngState(): number {
		return this.rng.state;
	}

	get seed(): number {
		return this.rng.seed;
	}

	/** A copy of `def`'s tuning with some values overridden, for a sweep. */
	static tuned(def: MarginaliaDef, overrides: Partial<WorldTuning>): WorldTuning {
		return { ...tuningFromDef(def), ...overrides };
	}

	/** Replace the whole state — a load, or a reset. Invalidates everything derived. */
	replace(state: WorldState): void {
		this.state = state;
		this.invalidate();
		this.selfBalancingLatch = { was: false };
		this.quietLatch = { was: false };
	}

	private invalidate(): void {
		this.lifeDirty = true;
		this.cachedLife = null;
		this.cachedAllLife = null;
		this.cachedWrittenSet = null;
	}

	/** Shape H, Emergence Gate, both at the life level and — see `worldspaces` below — the scene level. */
	private refreshLife(): void {
		const written = new Set(this.state.writtenConditions);
		this.cachedWrittenSet = written;
		this.cachedAllLife = this.def.life.filter((l) => isRevealed(l.requires, written));

		const worldspace = this.def.worldspaces[this.state.activeWorldspace];
		const categories = worldspace.visibleCategories;
		this.cachedLife =
			categories === 'all' ? this.cachedAllLife : this.cachedAllLife.filter((l) => categories.includes(l.category));
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

	/** What is visible from where the world stands — the tick only moves these. */
	get life(): Life[] {
		if (this.lifeDirty) this.refreshLife();
		return this.cachedLife!;
	}

	/** Tier 2: each one names two conditions, both of which have to be written — same gate shape, a fixed-size `requires`. */
	get emergences() {
		const written = this.writtenSet;
		return this.def.emergences.filter((e) => isRevealed(e.from, written));
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
		return severityFor(life.needs, this.state.stocks, this.def.stock.bandFalloff);
	}

	/** How readily a Known life comes to mind now. Only meaningful at Known. */
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
		const { floor, fluencyBonus } = this.def.recallYield;
		const fresh = floor + (1 - floor) * this.recallOf(lifeId);
		// Fluency pays *above* full recall, which is the whole point of the
		// testing effect: durable knowledge is worth more than merely fresh
		// knowledge. Without this there is nothing above the recall ceiling, so
		// keeping everything topped up captures all there is and letting a thing
		// fade is pure loss — the opposite of what the mechanic is for.
		return fresh + fluencyBonus * this.fluencyOf(lifeId);
	}

	// ── derived: the idle engine ─────────────────────────────────────────────

	/** Insight/sec from witnessed life, before the Favor multiplier. */
	get baseInsightRate(): number {
		let r = 0;
		for (const l of this.life) {
			const mastery = this.state.categoryMastered[l.category] ? 1 + this.def.progress.categoryMasteryBonus : 1;
			r +=
				l.insightWeight *
				(this.def.stage.insightMult[this.stageOf(l.id)] ?? 0) *
				this.vitalityOf(l.id) *
				mastery *
				this.recallMultiplier(l.id);
		}
		return r;
	}

	get favorMult(): number {
		const { base, perPoint } = this.def.favor.multiplier;
		return base + perPoint * this.state.favor;
	}

	get insightPerSec(): number {
		return this.baseInsightRate * this.favorMult;
	}

	get focusMult(): number {
		return comboMultiplier(this.state.focusStreak, this.def.focus);
	}

	get attentionUsed(): number {
		return this.state.attending.length;
	}

	// Shape G, Capacity + Roster: attentionCapacity + attending.
	get attentionFree(): number {
		return freeSlots({ capacity: this.state.attentionCapacity, members: this.state.attending });
	}

	/** Cost to raise attention capacity by one, or null at the maximum. */
	get attentionUpgradeCost(): number | null {
		return nextCapacityCost(this.state.attentionCapacity, this.def.attention.start, this.def.attention.costs);
	}

	/**
	 * Measured against the whole authored world, not the visible subset — so
	 * closing the book on a world only half-explored reads honestly.
	 */
	get knownCount(): number {
		return this.def.life.filter((l) => (this.state.observation[l.id] ?? 0) >= STAGE_KNOWN).length;
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
			stabilityOf(
				this.state.stocks,
				this.knownEcosystems,
				this.def.stock.bands,
				this.def.stock.bandFalloff,
				this.def.progress.stabilityEcosystemBonus
			) + this.state.stabilityBonus
		);
	}

	get quiet(): boolean {
		return this.life.length > 0 && this.stability < this.def.progress.quietStability;
	}

	get allStocksInBand(): boolean {
		return STOCK_IDS.every((id) => {
			const [lo, hi] = this.def.stock.bands[id];
			return this.state.stocks[id] >= lo && this.state.stocks[id] <= hi;
		});
	}

	/**
	 * A balanced world not being propped up. 0..1.
	 *
	 * The load term is lifetime, not recent: it counts every act ever made
	 * here. When it decayed, intervening was free within a minute — and since
	 * intervening *repairs* a world, and repair is what this rewards, the
	 * mechanic paid a meddler more than an ascetic.
	 */
	get equilibriumFactor(): number {
		return factorFor(this.state.interventionLoad, { cap: this.def.restraint.loadFull, gate: this.allStocksInBand });
	}

	/** Which stocks currently sit outside their band, so a Ledger can say *why* a world is not holding itself. */
	get outOfBand(): StockId[] {
		return STOCK_IDS.filter((id) => {
			const [lo, hi] = this.def.stock.bands[id];
			const shift = this.state.stockBaseline[id] - this.def.stock.neutral;
			return this.state.stocks[id] < lo + shift || this.state.stocks[id] > hi + shift;
		});
	}

	get selfBalancing(): boolean {
		return this.life.length > 0 && this.equilibriumFactor > this.def.restraint.minFactor;
	}

	// ── the web (author mode) ────────────────────────────────────────────────

	canWrite(id: string): boolean {
		const c = this.conditionById(id);
		if (!c || this.hasWritten(id)) return false;
		return this.state.essence >= c.cost;
	}

	writeCondition(id: string): boolean {
		const c = this.conditionById(id);
		if (!c || !this.canWrite(id)) return false;
		this.state.essence -= c.cost;
		this.state.writtenConditions = [...this.state.writtenConditions, id];
		this.state.knowing += 1;
		this.invalidate();
		return true;
	}

	// ── attention ────────────────────────────────────────────────────────────

	isAttending(lifeId: string): boolean {
		return isMember({ capacity: this.state.attentionCapacity, members: this.state.attending }, lifeId);
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
		const roster = { capacity: this.state.attentionCapacity, members: [...this.state.attending] };
		admit(roster, lifeId);
		this.state.attending = roster.members;
		return true;
	}

	unattend(lifeId: string): boolean {
		const roster = { capacity: this.state.attentionCapacity, members: [...this.state.attending] };
		if (!dismiss(roster, lifeId)) return false;
		this.state.attending = roster.members;
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
	 * a harness can drive a streak deterministically and an app can hand it a
	 * real timestamp.
	 */
	lookCloser(lifeId: string, now: number, into: WorldEvent[] = []): WorldEvent[] {
		if (!this.isAttending(lifeId)) return into;
		this.state.focusStreak = nextComboLevel(this.state.focusStreak, this.state.lastLookCloserAt, now, this.def.focus);
		this.state.lastLookCloserAt = now;
		const seconds = this.def.stage.lookCloserSeconds * (this.lifeById(lifeId)?.studyEase ?? 1) * this.focusMult;
		this.addStudy(lifeId, seconds, into);
		return into;
	}

	private addStudy(lifeId: string, seconds: number, into: WorldEvent[]): void {
		const banked = (this.state.study[lifeId] ?? 0) + seconds;
		this.state.study = { ...this.state.study, [lifeId]: banked };
		this.settleStages(lifeId, into);
	}

	/** Advance as many stages as the banked study-seconds allow. Shape E, Threshold Ladder. */
	private settleStages(lifeId: string, into: WorldEvent[]): number {
		const life = this.lifeById(lifeId);
		const notes = this.def.fieldNotes;
		const result = advanceLadder(
			this.stageOf(lifeId),
			this.state.study[lifeId] ?? 0,
			this.tuning.stageSeconds,
			STAGE_KNOWN,
			(stage) => {
				this.state.observation = { ...this.state.observation, [lifeId]: stage };
				this.state.knowing += 1;
				if (stage === STAGE_STUDIED) {
					this.state.essence += this.def.progress.essenceOnStudied;
					into.push({ kind: 'gain', resource: 'essence', amount: this.def.progress.essenceOnStudied });
				}
				if (stage === STAGE_KNOWN) {
					this.state.essence += this.def.progress.essenceOnKnown;
					into.push({ kind: 'gain', resource: 'essence', amount: this.def.progress.essenceOnKnown });
					// freshly Known is fully in mind; it fades from here
					this.state.recall = { ...this.state.recall, [lifeId]: 1 };
				}
				if (life) {
					const options = notes.byDomain[life.domain]?.[stage] ?? [];
					const line = pickLine(options, this.rng.next());
					into.push({
						kind: 'stage',
						lifeId,
						stage,
						note: line ? fillTemplate(line, life.name) : null
					});
					if (stage === STAGE_KNOWN) this.checkCategoryMastery(life.category, into);
				}
			}
		);
		this.state.study = { ...this.state.study, [lifeId]: result.banked };
		if (result.stage >= STAGE_KNOWN) {
			// fully known — it no longer needs watching; free the slot
			const roster = { capacity: this.state.attentionCapacity, members: [...this.state.attending] };
			dismiss(roster, lifeId);
			this.state.attending = roster.members;
		}
		return result.crossed;
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
			note: pickLine(this.def.fieldNotes.categoryMastery[category], this.rng.next())
		});
	}

	// ── interventions ────────────────────────────────────────────────────────

	hasIntervened(lifeId: string): boolean {
		return lifeId in this.state.interventionsDone;
	}

	interventionCostFor(lifeId: string): { insight: number; essence: number } {
		const life = this.lifeById(lifeId);
		return life ? this.def.interventions[life.domain].cost : { insight: 0, essence: 0 };
	}

	canIntervene(lifeId: string): boolean {
		if (this.stageOf(lifeId) < STAGE_KNOWN || this.hasIntervened(lifeId)) return false;
		// Shape J, Manual Conversion: affordability across both currencies at once.
		return canAffordAll({ insight: this.state.insight, essence: this.state.essence }, this.interventionCostFor(lifeId));
	}

	interventionLineFor(lifeId: string): string | null {
		const idx = this.state.interventionsDone[lifeId];
		const life = this.lifeById(lifeId);
		if (idx === undefined || !life) return null;
		return this.def.interventions[life.domain].lines[idx] ?? null;
	}

	intervene(lifeId: string, into: WorldEvent[] = []): WorldEvent[] {
		if (!this.canIntervene(lifeId)) return into;
		const life = this.lifeById(lifeId)!;
		const spec = this.def.interventions[life.domain];
		this.state.insight -= spec.cost.insight;
		this.state.essence -= spec.cost.essence;
		this.applyInterventionEffect(life);
		const idx = Math.floor(this.rng.next() * spec.lines.length);
		this.state.interventionsDone = { ...this.state.interventionsDone, [lifeId]: idx };
		this.state.interventionLoad += this.def.restraint.loadWeight[spec.permanence];
		into.push({
			kind: 'intervention',
			lifeId,
			line: spec.lines[idx],
			note: `${life.name}: "${spec.lines[idx]}"`
		});
		return into;
	}

	/**
	 * Each verb does its own thing, but none of the five is its own mechanism.
	 * Each just writes into a primitive that already exists elsewhere in this
	 * file, at one of four injection points:
	 *
	 *  - `tend`/`invoke` write straight into a stock's live *value* (shape C) —
	 *    temporary only because the tick's ordinary drift and leak already pull
	 *    it back once it lands outside the band; no new machinery required.
	 *  - `shape` writes into a capped, permanent tally that shifts a stock's
	 *    *band* instead of its value — one line, not worth its own primitive.
	 *  - `encourage` writes into a capped, permanent tally inside the stability
	 *    formula (shape M) — the same one-line shape as `shape`'s tally.
	 *  - `guide` sets a per-instance coefficient override (shape I) that scales
	 *    one life's future contribution to shape C's input sum; the one-shot
	 *    guard already lives in `canIntervene`/`hasIntervened`, so there's
	 *    nothing left for a `fireOnce` wrapper to add here.
	 */
	private applyInterventionEffect(life: Life): void {
		const focus = focusStock(life.metabolism, life.needs);
		const fx = this.def.interventionEffects;
		switch (life.domain) {
			case 'plant': {
				// tend: a small, temporary bump to the stock it lives by; drift fades it
				const s = { ...this.state.stocks };
				s[focus] = Math.min(100, s[focus] + fx.tendBump);
				this.state.stocks = s;
				break;
			}
			case 'weather': {
				// invoke: a broad, uncertain moisture push — asked, never commanded
				const s = { ...this.state.stocks };
				s.moisture = Math.min(100, s.moisture + fx.invokeBump * (0.6 + this.rng.next() * 0.8));
				this.state.stocks = s;
				break;
			}
			case 'geology': {
				// shape: move a stock's baseline for good — monumental, slow
				const b = { ...this.state.stockBaseline };
				b[focus] = Math.min(fx.shapeBaselineMax, b[focus] + fx.shapeBaselineRaise);
				this.state.stockBaseline = b;
				break;
			}
			case 'ecosystem': {
				// encourage: raise the floor under everything
				this.state.stabilityBonus = Math.min(fx.encourageStabilityMax, this.state.stabilityBonus + fx.encourageStability);
				break;
			}
			case 'animal': {
				// guide: ease what it draws from the world
				this.state.metabolismScale = {
					...this.state.metabolismScale,
					[life.id]: fx.guideMetabolismScale
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
		return this.state.insight >= this.def.insightSinks.distillInsightCost;
	}

	distillEssence(into: WorldEvent[] = []): WorldEvent[] {
		if (!this.canDistill()) return into;
		this.state.insight -= this.def.insightSinks.distillInsightCost;
		this.state.essence += this.def.insightSinks.distillEssenceGain;
		into.push({ kind: 'gain', resource: 'essence', amount: this.def.insightSinks.distillEssenceGain });
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
		const next = restorePrimary({ primary: this.recallOf(lifeId), companion: this.fluencyOf(lifeId) }, dt, this.def.recall);
		this.state.recall = { ...this.state.recall, [lifeId]: next.primary };
		this.state.fluency = { ...this.state.fluency, [lifeId]: next.companion };
	}

	/** It slips, slower the more fluent it's held. Exponential, dt-stable. */
	private fadeRecall(lifeId: string, dt: number): void {
		const next = decayPrimary({ primary: this.recallOf(lifeId), companion: this.fluencyOf(lifeId) }, dt, this.def.recall);
		this.state.recall = { ...this.state.recall, [lifeId]: next.primary };
	}

	// ── the idle tick ────────────────────────────────────────────────────────

	/**
	 * One step of the world's clock. The order here is load-bearing: rates are
	 * gathered from the stages held at the *start* of the tick, study lands
	 * next, and Favor eases last against the insight the tick already paid out.
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
			const v = nextVitality(this.vitalityOf(l.id), this.severityOf(l), dt, this.def.vitality);
			nextVit[l.id] = v;
			stress += 1 - v;
			const scale = s.metabolismScale[l.id] ?? 1;
			const r = lifeStockRate(l.metabolism, (this.def.stage.activity[this.stageOf(l.id)] ?? 0) * scale, v);
			for (const id of STOCK_IDS) rate[id] += r[id] ?? 0;
		}
		s.vitality = nextVit;

		// 2) attended life either deepens or is returned to. Study is slowed when
		//    a life is suffering; recall is not — attention can always be brought
		//    to mind, however badly the world is treating it.
		const attendedNow = new Set(s.attending);
		for (const id of [...s.attending]) {
			if (!presentIds.has(id)) continue;
			const life = this.lifeById(id);
			if (!life) continue;
			if (this.stageOf(id) >= STAGE_KNOWN) {
				this.restoreRecall(id, dt);
			} else {
				this.addStudy(id, dt * life.studyEase * this.vitalityOf(id), into);
			}
		}

		// 2b) everything Known that isn't being held in mind slips a little.
		//     Storage never decays — it stays Known — only retrieval does.
		for (const l of present) {
			if (attendedNow.has(l.id) || this.stageOf(l.id) < STAGE_KNOWN) continue;
			this.fadeRecall(l.id, dt);
		}

		// 3) stocks move by metabolism, then get pulled back only if they have
		//    left their band — inside it the world is free to settle wherever
		//    its life holds it. Shape C, Banded Stock: `stepStock` is drift, leak
		//    and the clamp in one call. `stockDriftPerSec`/`stockLeak` come from
		//    `this.tuning` rather than `this.def.stock` — that's the sweep lever
		//    `WorldTuning` exists for.
		const stocks = { ...s.stocks };
		for (const id of STOCK_IDS) {
			const shift = s.stockBaseline[id] - this.def.stock.neutral;
			const band = this.def.stock.bands[id];
			stocks[id] = stepStock(stocks[id], { lo: band[0] + shift, hi: band[1] + shift }, rate[id], dt, {
				driftPerSec: this.tuning.stockDriftPerSec,
				leakPerSec: this.tuning.stockLeak[id],
				min: 0,
				max: 100
			});
		}
		s.stocks = stocks;

		// 4) the world yields Insight every second it is witnessed. Batched into
		//    an occasional whole number rather than announced every frame.
		const gained = this.insightPerSec * dt;
		s.insight += gained;
		if (!this.quietAnnouncements) {
			s.trickleAccum += gained;
			s.trickleTimer += dt;
			if (s.trickleTimer >= this.def.progress.insightTrickleAnnounceSec) {
				s.trickleTimer = 0;
				const whole = Math.floor(s.trickleAccum);
				if (whole > 0) {
					s.trickleAccum -= whole;
					into.push({ kind: 'trickle', amount: whole });
				}
			}
		}

		// 5) a balanced world that isn't being propped up banks the equilibrium
		//    dividend. Load does not decay. Banked *in proportion to* the
		//    factor, not gated on it — a binary threshold would mean any load
		//    short of it cost exactly nothing, so the lightest hand and a
		//    fairly heavy one would bank identically.
		const eq = this.equilibriumFactor;
		s.equilibriumSeconds = accrue(s.equilibriumSeconds, eq, dt, this.def.restraint.minFactor);

		// 6) a beat the first time this world settles into balance, or the first
		//    time it goes quiet — not a repeating alarm. Shape L, Edge Latch.
		if (risingEdge(this.selfBalancingLatch, this.selfBalancing)) {
			into.push({ kind: 'equilibrium', note: pickLine(this.def.fieldNotes.equilibrium, this.rng.next()) });
		}

		if (risingEdge(this.quietLatch, this.quiet)) {
			into.push({ kind: 'quiet', note: pickLine(this.def.fieldNotes.quiet, this.rng.next()) });
		}

		// 7) Favor eases toward a target set by how much is Known, pulled down
		//    by the world's stress and lifted when it holds itself. Shape B,
		//    Eased Stat, the same shape as vitality — here with a live formula
		//    for the target instead of a binary one.
		const { baseTarget, perKnown, stressPenalty, equilibriumBonus, driftPerSec } = this.def.favor;
		const target = Math.max(0, baseTarget + perKnown * this.knownCount - stressPenalty * stress + equilibriumBonus * eq);
		s.favor = ease(s.favor, target, dt, { up: driftPerSec, floor: 0, ceiling: 100 });
		return into;
	}
}
