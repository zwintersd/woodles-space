import { evaluateCondition } from './conditions.js';
import { curveAt, generatorBaseOutput, nextLevelCost } from './curves.js';
import { CRIT_MULTIPLIER, effectiveRate, prestigeMultiplier, resolveModifiers, type Modifiers } from './modifiers.js';
import { num } from './num.js';
import { createRng, type Rng } from './rng.js';
import {
	cloneState,
	gatedIds,
	initialState,
	isRevealed,
	type Action,
	type CurrencyState,
	type SeriesSample,
	type SimEvent,
	type SimResult,
	type SimState
} from './state.js';
import { restoreMilestoneTimes, restoreState, saveMatches, serializeState, SAVE_VERSION, type SaveGame } from './savegame.js';
import type { GameDef, Generator, Milestone, PrestigeLayer, Unlock, Upgrade } from './types.js';
import { hasErrors, validateGameDef } from './validate.js';

/** One tick of game time, in milliseconds. Fixed — never derived from a frame rate. */
export const TICK_MS = 100;
export const TICKS_PER_SECOND = 1000 / TICK_MS;
const TICK_SECONDS = TICK_MS / 1000;

/**
 * What a policy is allowed to ask the simulation. Costs are the reason this
 * exists: a `costScale` upgrade means the price of a thing isn't derivable from
 * the def alone, and a greedy shopper that guesses wrong buys the wrong thing.
 */
export interface PolicyContext {
	/** Cost of the next level, or null if maxed out. */
	nextCost(entityId: string): number | null;
	/** Revealed, gated conditions met, not maxed. Says nothing about affordability. */
	canBuyUpgrade(upgradeId: string): boolean;
	/** Units this layer would award right now. */
	prestigeGain(layerId: string): number;
	/** Whether an entity is visible yet. */
	isRevealed(entityId: string): boolean;
}

export interface PlayerPolicy {
	/** Human-readable name, used to label balance runs. */
	readonly name: string;
	/**
	 * Called once per tick after production. Returns purchases to attempt, in
	 * order. Must not mutate the state it is handed.
	 *
	 * The result is `readonly` so a policy that has nothing to do can hand back
	 * a shared frozen array instead of allocating one 360,000 times.
	 */
	decide(state: Readonly<SimState>, def: GameDef, ctx: PolicyContext): readonly Action[];
}

export interface SimOptions {
	/** How long to run, in game-seconds. */
	duration: number;
	/** Series resolution in game-seconds. */
	sampleEvery: number;
	seed: number;
}

/**
 * A running simulation. `simulate` is this driven to completion; the editor's
 * playtest dock drives the same object a frame at a time, so what you watch
 * live and what a balance run reports can't drift apart.
 */
export class Simulation {
	readonly def: GameDef;
	readonly policy: PlayerPolicy;

	private readonly rng: Rng;
	private readonly gated: Set<string>;
	private readonly generatorById = new Map<string, Generator>();
	private readonly upgradeById = new Map<string, Upgrade>();
	private readonly layerById = new Map<string, PrestigeLayer>();
	private readonly context: PolicyContext;
	private simState: SimState;
	private modifiers: Modifiers;
	private ticks = 0;
	/** Total game-seconds ever handed to `step`, including a partial tick's worth. */
	private requested = 0;
	private readonly milestoneTimes: Record<string, number | null> = {};
	private readonly prestigeCounts: Record<string, number> = {};

	/**
	 * Only the things that haven't fired yet. Once every unlock has triggered,
	 * this list is empty and the per-tick check costs nothing — as opposed to
	 * re-walking the full list and asking a Set whether each one is done.
	 */
	private pendingUnlocks: Unlock[];
	private pendingMilestones: Milestone[];

	/**
	 * Derived numbers, recomputed only when something that could change them
	 * happens. A rate is a function of the generator's level, the owned
	 * upgrades, and the prestige multiplier; a price is a function of the level
	 * and the owned upgrades. Nothing else moves either — so buying, and
	 * resetting, are the only invalidation points there are.
	 *
	 * This matters because a greedy policy prices every purchasable thing on
	 * every one of 360,000 ticks. Walking a geometric curve six times a tick is
	 * two million `Math.pow` calls to answer a question whose answer changed a
	 * few hundred times all run.
	 */
	private cachedRates: number[] = [];
	private cachedCrit: number[] = [];
	private readonly cachedCosts = new Map<string, number | null>();
	private derivedDirty = true;
	/** The currency each generator pays into. Stable objects, resolved once. */
	private readonly sinks: (CurrencyState | undefined)[] = [];

	/** The seed this run was created with, so a save can replay it. */
	readonly seed: number;

	/** Where the random stream has got to, for a save that resumes it exactly. */
	get rngState(): number {
		return this.rng.state;
	}

	constructor(def: GameDef, policy: PlayerPolicy, seed: number, save?: SaveGame) {
		this.def = def;
		this.policy = policy;
		this.seed = seed;
		this.rng = createRng(seed, save && saveMatches(def, save) ? save.rngState : undefined);
		this.gated = gatedIds(def);
		// A save is reconciled against the current def rather than trusted: the
		// author keeps editing the game after people have started playing it.
		this.simState = save && saveMatches(def, save) ? restoreState(def, save) : initialState(def);
		this.modifiers = resolveModifiers(def, this.simState);

		// Built once. A `find` per lookup is invisible at ten entities and
		// ruinous at 360,000 ticks × a greedy shopper scanning all of them.
		for (const generator of def.generators) this.generatorById.set(generator.id, generator);
		for (const upgrade of def.upgrades) this.upgradeById.set(upgrade.id, upgrade);
		for (const layer of def.prestigeLayers) this.layerById.set(layer.id, layer);

		for (const milestone of def.milestones) this.milestoneTimes[milestone.id] = null;
		for (const layer of def.prestigeLayers) this.prestigeCounts[layer.id] = 0;
		for (const generator of def.generators) this.sinks.push(this.simState.currencies[generator.producesCurrencyId]);

		this.pendingUnlocks = [...def.unlocks];
		this.pendingMilestones = [...def.milestones];

		if (save && saveMatches(def, save)) {
			this.ticks = Math.round(this.simState.gameTime * TICKS_PER_SECOND);
			this.requested = this.simState.gameTime;
			Object.assign(this.milestoneTimes, restoreMilestoneTimes(def, save));
			for (const layer of def.prestigeLayers) {
				this.prestigeCounts[layer.id] = this.simState.prestige[layer.id]?.count ?? 0;
			}
			// An unlock whose reveals are all already showing has fired; re-arming
			// it would spam the log with openings the player saw sessions ago.
			this.pendingUnlocks = this.pendingUnlocks.filter(
				(unlock) => !unlock.reveals.length || !unlock.reveals.every((id) => this.simState.unlocked.has(id))
			);
			this.pendingMilestones = this.pendingMilestones.filter(
				(milestone) => this.milestoneTimes[milestone.id] === null
			);
		}

		// One object for the whole run, so the per-tick policy call allocates nothing.
		this.context = {
			nextCost: (id) => this.nextCost(id),
			canBuyUpgrade: (id) => {
				const upgrade = this.upgradeById.get(id);
				return upgrade ? this.canBuyUpgrade(upgrade) : false;
			},
			prestigeGain: (id) => {
				const layer = this.layerById.get(id);
				if (!layer) return 0;
				if (!isRevealed(id, this.gated, this.simState)) return 0;
				if (layer.availableWhen && !evaluateCondition(layer.availableWhen, this.simState)) return 0;
				return prestigeGain(layer, this.simState);
			},
			isRevealed: (id) => isRevealed(id, this.gated, this.simState)
		};
	}

	state(): SimState {
		return this.simState;
	}

	/** Current production per second, per currency, including every modifier. */
	rates(): Record<string, number> {
		if (this.derivedDirty) this.refreshDerived();
		const rates: Record<string, number> = {};
		for (const currency of this.def.currencies) rates[currency.id] = 0;
		for (const [i, generator] of this.def.generators.entries()) {
			const id = generator.producesCurrencyId;
			rates[id] = num.add(rates[id] ?? 0, this.cachedRates[i]);
		}
		return rates;
	}

	/** Per-generator production per second, for the playtest readout. */
	generatorRates(): Record<string, number> {
		if (this.derivedDirty) this.refreshDerived();
		const rates: Record<string, number> = {};
		for (const [i, generator] of this.def.generators.entries()) rates[generator.id] = this.cachedRates[i];
		return rates;
	}

	/**
	 * Rebuilds the rate and price tables. Called on the tick after anything that
	 * could have changed them — never speculatively, and never on the common
	 * tick where the world only produces.
	 */
	private refreshDerived(): void {
		const prestige = prestigeMultiplier(this.def, this.simState);
		for (const [i, generator] of this.def.generators.entries()) {
			const level = this.simState.generators[generator.id]?.level ?? 0;
			const base = generatorBaseOutput(generator.baseRate, generator.rateCurve, level);
			this.cachedRates[i] = effectiveRate(generator, level, this.modifiers, prestige, base);
			this.cachedCrit[i] = this.modifiers.crit[generator.id] ?? 0;

			this.cachedCosts.set(
				generator.id,
				generator.maxLevel !== undefined && level >= generator.maxLevel ? null : this.generatorCost(generator, level)
			);
		}

		for (const upgrade of this.def.upgrades) {
			const level = this.simState.upgrades[upgrade.id]?.level ?? 0;
			this.cachedCosts.set(upgrade.id, level >= upgradeMaxLevel(upgrade) ? null : this.upgradeCost(upgrade, level));
		}
		this.derivedDirty = false;
	}

	/** The production multiplier every prestige layer is currently contributing. */
	prestigeMultiplier(): number {
		return prestigeMultiplier(this.def, this.simState);
	}

	/** Cost of the next level of a generator or upgrade, or null if it can't be bought again. */
	nextCost(entityId: string): number | null {
		if (this.derivedDirty) this.refreshDerived();
		return this.cachedCosts.get(entityId) ?? null;
	}

	/**
	 * Advance by `gameSeconds`. Time that doesn't fill a whole tick is carried
	 * to the next call rather than dropped, so stepping 0.05s twenty times and
	 * stepping 1s once land in the same place.
	 */
	step(gameSeconds: number): SimEvent[] {
		const events: SimEvent[] = [];
		// Guard against a negative or non-finite step from a stalled rAF clock.
		if (!Number.isFinite(gameSeconds) || gameSeconds <= 0) return events;
		this.requested = num.add(this.requested, gameSeconds);

		// The tick count is *derived* from the running total, never decremented
		// from a remainder. Subtracting 0.1 from a float three hundred times
		// loses a whole tick — which is how `step(30)` came to run 29.9 seconds.
		// The epsilon covers a total that lands a hair under a whole tick.
		const target = Math.floor(this.requested * TICKS_PER_SECOND + 1e-9);
		for (let i = this.ticks; i < target; i += 1) this.tick(events);
		return events;
	}

	/** Advance an exact number of ticks. Used by `simulate`, where duration is known up front. */
	runTicks(count: number, into: SimEvent[]): void {
		for (let i = 0; i < count; i += 1) this.tick(into);
		// Keep the `step` clock in step, so mixing the two never replays a tick.
		this.requested = this.ticks / TICKS_PER_SECOND;
	}

	get elapsedTicks(): number {
		return this.ticks;
	}

	get milestoneTimeline(): Record<string, number | null> {
		return this.milestoneTimes;
	}

	get prestigeTotals(): Record<string, number> {
		return this.prestigeCounts;
	}

	sample(): SeriesSample {
		const currencies: Record<string, number> = {};
		for (const currency of this.def.currencies) currencies[currency.id] = this.simState.currencies[currency.id].amount;
		return { t: this.simState.gameTime, currencies, rates: this.rates() };
	}

	private tick(events: SimEvent[]): void {
		this.ticks += 1;
		// Derived from an integer tick count rather than accumulated by addition:
		// 360,000 float additions of 0.1 drift, and a drifting clock makes two
		// runs of the same seed disagree.
		this.simState.gameTime = this.ticks / TICKS_PER_SECOND;

		this.produce();
		this.checkUnlocks(events);
		this.checkMilestones(events);
		this.runPolicy(events);
	}

	private produce(): void {
		if (this.derivedDirty) this.refreshDerived();

		for (let i = 0; i < this.cachedRates.length; i += 1) {
			let rate = this.cachedRates[i];
			if (rate <= 0) continue;

			const crit = this.cachedCrit[i];
			// Only roll when a crit is actually possible: it keeps the RNG stream
			// short, and a def with no crit upgrades consumes no randomness at all.
			if (crit > 0 && this.rng.next() < crit) rate = num.mul(rate, CRIT_MULTIPLIER);

			const produced = num.mul(rate, TICK_SECONDS);
			const currency = this.sinks[i];
			if (!currency) continue;
			currency.amount = num.add(currency.amount, produced);
			currency.lifetime = num.add(currency.lifetime, produced);
		}
	}

	private checkUnlocks(events: SimEvent[]): void {
		const pending = this.pendingUnlocks;
		if (!pending.length) return;

		// Compacted in place, forwards, so events still arrive in def order and
		// no array is allocated on a tick where nothing fires.
		let keep = 0;
		for (let i = 0; i < pending.length; i += 1) {
			const unlock = pending[i];
			if (!evaluateCondition(unlock.when, this.simState)) {
				pending[keep] = unlock;
				keep += 1;
				continue;
			}
			for (const id of unlock.reveals) this.simState.unlocked.add(id);
			events.push({
				t: this.simState.gameTime,
				kind: 'unlock',
				id: unlock.id,
				message: `${unlock.name} unlocked`
			});
		}
		pending.length = keep;
	}

	private checkMilestones(events: SimEvent[]): void {
		const pending = this.pendingMilestones;
		if (!pending.length) return;

		let keep = 0;
		for (let i = 0; i < pending.length; i += 1) {
			const milestone = pending[i];
			if (!evaluateCondition(milestone.when, this.simState)) {
				pending[keep] = milestone;
				keep += 1;
				continue;
			}
			// The timeline keeps the *first* crossing; a milestone re-armed by a
			// prestige logs again but doesn't overwrite when it was first met.
			if (this.milestoneTimes[milestone.id] === null) this.milestoneTimes[milestone.id] = this.simState.gameTime;
			events.push({
				t: this.simState.gameTime,
				kind: 'milestone',
				id: milestone.id,
				message: `Milestone reached: ${milestone.name}`
			});
		}
		pending.length = keep;
	}

	private runPolicy(events: SimEvent[]): void {
		const actions = this.policy.decide(this.simState, this.def, this.context);
		if (!actions.length) return;
		for (const action of actions) this.apply(action, events);
	}

	/** Attempts an action. Returns whether it happened — an unaffordable buy is a no-op, not an error. */
	apply(action: Action, events: SimEvent[]): boolean {
		switch (action.type) {
			case 'buyGenerator':
				return this.buyGenerator(action.id, action.count ?? 1, events);
			case 'buyUpgrade':
				return this.buyUpgrade(action.id, events);
			case 'prestige':
				return this.doPrestige(action.layerId, events);
		}
	}

	private buyGenerator(id: string, count: number, events: SimEvent[]): boolean {
		const generator = this.generatorById.get(id);
		if (!generator) return false;
		if (!isRevealed(id, this.gated, this.simState)) return false;

		let bought = 0;
		for (let i = 0; i < count; i += 1) {
			const level = this.simState.generators[id].level;
			if (generator.maxLevel !== undefined && level >= generator.maxLevel) break;

			const cost = this.generatorCost(generator, level);
			const wallet = this.simState.currencies[generator.cost.currencyId];
			if (!wallet || !num.gte(wallet.amount, cost)) break;

			wallet.amount = num.sub(wallet.amount, cost);
			this.simState.generators[id].level = level + 1;
			this.derivedDirty = true;
			bought += 1;
			events.push({
				t: this.simState.gameTime,
				kind: 'levelUp',
				id,
				level: level + 1,
				cost,
				costCurrencyId: generator.cost.currencyId,
				message: `${generator.name} levelled up (${level} → ${level + 1})`
			});
		}
		return bought > 0;
	}

	private buyUpgrade(id: string, events: SimEvent[]): boolean {
		const upgrade = this.upgradeById.get(id);
		if (!upgrade) return false;
		if (!this.canBuyUpgrade(upgrade)) return false;

		const level = this.simState.upgrades[id].level;
		const cost = this.upgradeCost(upgrade, level);
		const wallet = this.simState.currencies[upgrade.cost.currencyId];
		if (!wallet || !num.gte(wallet.amount, cost)) return false;

		wallet.amount = num.sub(wallet.amount, cost);
		this.simState.upgrades[id].level = level + 1;
		// Only upgrades change the resolved modifier table, so this is the one
		// place that has to invalidate it — and every rate derives from it.
		this.modifiers = resolveModifiers(this.def, this.simState);
		this.derivedDirty = true;
		events.push({
			t: this.simState.gameTime,
			kind: 'purchase',
			id,
			level: level + 1,
			cost,
			costCurrencyId: upgrade.cost.currencyId,
			message: `Purchased ${upgrade.name}${upgrade.repeatable ? ` (Lv. ${level + 1})` : ''}`
		});
		return true;
	}

	/** Visible, gated conditions met, and not already maxed. Affordability is checked separately. */
	canBuyUpgrade(upgrade: Upgrade): boolean {
		if (!isRevealed(upgrade.id, this.gated, this.simState)) return false;
		if ((this.simState.upgrades[upgrade.id]?.level ?? 0) >= upgradeMaxLevel(upgrade)) return false;
		if (upgrade.visibleWhen && !evaluateCondition(upgrade.visibleWhen, this.simState)) return false;
		if (upgrade.purchasableWhen && !evaluateCondition(upgrade.purchasableWhen, this.simState)) return false;
		return true;
	}

	private doPrestige(layerId: string, events: SimEvent[]): boolean {
		const layer = this.layerById.get(layerId);
		if (!layer) return false;
		if (!isRevealed(layerId, this.gated, this.simState)) return false;
		if (layer.availableWhen && !evaluateCondition(layer.availableWhen, this.simState)) return false;

		const gain = prestigeGain(layer, this.simState);
		if (gain < 1) return false;

		const wallet = this.simState.currencies[layer.currencyId];
		if (wallet) {
			wallet.amount = num.add(wallet.amount, gain);
			wallet.lifetime = num.add(wallet.lifetime, gain);
		}

		const record = this.simState.prestige[layerId];
		record.count += 1;
		record.currencyAmount = num.add(record.currencyAmount, gain);
		this.prestigeCounts[layerId] = record.count;

		this.applyResets(layer);
		// A reset changes owned levels and the prestige multiplier, so both the
		// upgrade-derived table and every cached rate are stale.
		this.modifiers = resolveModifiers(this.def, this.simState);
		this.derivedDirty = true;
		// Milestones are per-run measuring posts. The timeline keeps the *first*
		// time each was reached; re-arming lets the log celebrate them again on
		// the next run through.
		this.pendingMilestones = [...this.def.milestones];

		events.push({
			t: this.simState.gameTime,
			kind: 'prestige',
			id: layerId,
			gain,
			message: `${layer.name} — gained ${gain} (reset #${record.count})`
		});
		return true;
	}

	/**
	 * Wipes exactly the ids in `resets` and nothing else. A currency in the list
	 * loses its lifetime counter along with its balance — "wiped" has to mean
	 * wiped, or the gain formula would keep paying out for earnings the player
	 * no longer has. A currency *not* in the list keeps both, which is how the
	 * prestige currency itself survives its own reset.
	 */
	private applyResets(layer: PrestigeLayer): void {
		for (const id of layer.resets) {
			const currency = this.simState.currencies[id];
			if (currency) {
				currency.amount = 0;
				currency.lifetime = 0;
				continue;
			}
			const generator = this.generatorById.get(id);
			if (generator) {
				this.simState.generators[id].level = generator.startsOwned ?? 0;
				continue;
			}
			if (this.simState.upgrades[id]) this.simState.upgrades[id].level = 0;
		}
	}

	private generatorCost(generator: Generator, level: number): number {
		const scale = this.modifiers.generatorCostScale[generator.id] ?? 1;
		return num.mul(nextLevelCost(generator.cost, level), num.max(0, scale));
	}

	private upgradeCost(upgrade: Upgrade, level: number): number {
		const base = upgrade.repeatable
			? curveAt(upgrade.repeatable.costCurve, upgrade.cost.amount, level + 1)
			: upgrade.cost.amount;
		const scale = this.modifiers.upgradeCostScale[upgrade.id] ?? 1;
		return num.mul(base, num.max(0, scale));
	}
}

/** Units the layer would award right now: `floor((lifetime / threshold) ^ exponent)`. */
export function prestigeGain(layer: PrestigeLayer, state: SimState): number {
	const lifetime = state.currencies[layer.gainFormula.sourceCurrencyId]?.lifetime ?? 0;
	if (lifetime <= 0 || layer.gainFormula.threshold <= 0) return 0;
	const ratio = num.div(lifetime, layer.gainFormula.threshold);
	// Below the threshold the ratio is under 1, and any positive exponent leaves
	// it under 1, so the floor is 0. Validation guarantees the exponent is
	// positive — and a greedy policy asks this question every single tick.
	if (ratio < 1) return 0;
	const raw = num.pow(ratio, layer.gainFormula.exponent);
	return Number.isFinite(raw) ? num.floor(raw) : 0;
}

export function upgradeMaxLevel(upgrade: Upgrade): number {
	return upgrade.repeatable ? upgrade.repeatable.maxLevel : 1;
}

/**
 * Runs a def to completion. Same def + same policy + same seed always produces
 * the same result — that is what makes a balance comparison mean anything, and
 * it is why the engine refuses an invalid def rather than limping along on
 * dangling references.
 */
export function simulate(def: GameDef, policy: PlayerPolicy, opts: SimOptions): SimResult {
	const issues = validateGameDef(def);
	if (hasErrors(issues)) {
		const first = issues.find((issue) => issue.severity === 'error');
		throw new Error(`cannot simulate an invalid GameDef: ${first?.message ?? 'unknown error'}`);
	}

	const sim = new Simulation(def, policy, opts.seed);
	const events: SimEvent[] = [];
	const series: SeriesSample[] = [sim.sample()];

	const totalTicks = Math.max(0, Math.round(opts.duration * TICKS_PER_SECOND));
	const sampleTicks = Math.max(1, Math.round(Math.max(opts.sampleEvery, TICK_SECONDS) * TICKS_PER_SECOND));

	let remaining = totalTicks;
	while (remaining > 0) {
		const chunk = Math.min(sampleTicks, remaining);
		sim.runTicks(chunk, events);
		remaining -= chunk;
		series.push(sim.sample());
	}

	const lifetime: Record<string, number> = {};
	for (const currency of def.currencies) lifetime[currency.id] = sim.state().currencies[currency.id].lifetime;

	return {
		finalState: cloneState(sim.state()),
		series,
		events,
		summary: {
			timeToMilestone: { ...sim.milestoneTimeline },
			totalPrestiges: { ...sim.prestigeTotals },
			lifetime
		}
	};
}

/**
 * Incremental variant, for the live playtest dock and for the player runtime.
 * Pass a `save` to resume where somebody left off.
 */
export function createSim(def: GameDef, policy: PlayerPolicy, seed: number, save?: SaveGame): Simulation {
	return new Simulation(def, policy, seed, save);
}

/** Snapshots a running game into something JSON can hold. */
export function captureSave(sim: Simulation): SaveGame {
	return {
		version: SAVE_VERSION,
		gameId: sim.def.meta.id,
		savedAt: new Date().toISOString(),
		seed: sim.seed,
		rngState: sim.rngState,
		state: serializeState(sim.state()),
		milestoneTimes: { ...sim.milestoneTimeline }
	};
}

/**
 * A sampling interval that keeps a series chart-sized whatever the duration.
 * Ten hours at one sample a second is 36,000 points nobody can see; this keeps
 * it near `maxPoints` instead.
 */
export function sampleIntervalFor(duration: number, maxPoints = 2000): number {
	if (duration <= 0) return TICK_SECONDS;
	return Math.max(TICK_SECONDS, Math.ceil((duration / maxPoints) * TICKS_PER_SECOND) / TICKS_PER_SECOND);
}
