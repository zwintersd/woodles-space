import type { GameDef } from './types.js';

/**
 * Everything a run knows about itself. Deliberately plain data: it crosses a
 * Web Worker boundary via structured clone, and it has to be deep-comparable
 * for the determinism tests.
 */
export interface SimState {
	/** Game-seconds elapsed. Never wall-clock. */
	gameTime: number;
	currencies: Record<string, CurrencyState>;
	generators: Record<string, { level: number }>;
	/**
	 * `equipped` gates whether an owned upgrade's effects apply — see the
	 * `Upgrade` effects doc. Defaults to `true` at purchase, so a def that
	 * never calls `equipUpgrade` / `unequipUpgrade` behaves exactly as if the
	 * flag didn't exist.
	 */
	upgrades: Record<string, { level: number; equipped: boolean }>;
	prestige: Record<string, { count: number; currencyAmount: number }>;
	/** Ids revealed so far. Revealing is sticky; a prestige reset can't re-hide. */
	unlocked: Set<string>;
}

export interface CurrencyState {
	amount: number;
	/**
	 * Total ever earned, never decremented by spending and never cleared by a
	 * prestige reset. Prestige gain is measured against this so that playing
	 * well — spending — doesn't cost you the reset.
	 */
	lifetime: number;
}

export type Action =
	| { type: 'buyGenerator'; id: string; count?: number }
	| { type: 'buyUpgrade'; id: string }
	| { type: 'equipUpgrade'; id: string }
	| { type: 'unequipUpgrade'; id: string }
	| { type: 'prestige'; layerId: string };

export type SimEventKind = 'purchase' | 'levelUp' | 'unlock' | 'milestone' | 'prestige' | 'equip' | 'unequip';

export interface SimEvent {
	/** Game-seconds at which it happened. */
	t: number;
	kind: SimEventKind;
	/** Entity id the event is about. */
	id: string;
	/** Ready-to-render line for the log tab. */
	message: string;
	/** Level reached, for purchases. */
	level?: number;
	cost?: number;
	costCurrencyId?: string;
	/** Prestige units awarded. */
	gain?: number;
}

export interface SeriesSample {
	t: number;
	currencies: Record<string, number>;
	/** Production per second, per currency, at the moment of sampling. */
	rates: Record<string, number>;
}

export interface SimSummary {
	/** Game-seconds at which each milestone first held; null if never. */
	timeToMilestone: Record<string, number | null>;
	totalPrestiges: Record<string, number>;
	/** Lifetime earnings per currency at the end of the run. */
	lifetime: Record<string, number>;
}

export interface SimResult {
	finalState: SimState;
	series: SeriesSample[];
	events: SimEvent[];
	summary: SimSummary;
}

/**
 * The state a def starts a fresh run in. Generators begin at `startsOwned`
 * (usually 0, though the first generator is often 1) and everything an unlock
 * doesn't gate begins revealed.
 */
export function initialState(def: GameDef): SimState {
	const state: SimState = {
		gameTime: 0,
		currencies: {},
		generators: {},
		upgrades: {},
		prestige: {},
		unlocked: new Set()
	};

	for (const currency of def.currencies) state.currencies[currency.id] = { amount: 0, lifetime: 0 };
	for (const generator of def.generators) state.generators[generator.id] = { level: generator.startsOwned ?? 0 };
	for (const upgrade of def.upgrades) state.upgrades[upgrade.id] = { level: 0, equipped: true };
	for (const layer of def.prestigeLayers) state.prestige[layer.id] = { count: 0, currencyAmount: 0 };

	// An id nobody hides is visible from the start; only ids some unlock claims
	// begin hidden. That keeps `reveals` opt-in rather than making every author
	// write an unlock for every entity.
	return state;
}

/** Ids that begin hidden — i.e. ones some unlock takes responsibility for revealing. */
export function gatedIds(def: GameDef): Set<string> {
	const gated = new Set<string>();
	for (const unlock of def.unlocks) for (const id of unlock.reveals) gated.add(id);
	return gated;
}

/** True when the entity is currently visible to the player. */
export function isRevealed(id: string, gated: Set<string>, state: SimState): boolean {
	return !gated.has(id) || state.unlocked.has(id);
}

/**
 * Owned upgrades currently sitting unequipped — "flowers" in the Apiary sample,
 * a hoarding score in any def that reads it. Reads state and nothing else, the
 * same way every metric here does, so it costs nothing to check every tick.
 */
export function countUnequippedUpgrades(state: SimState): number {
	let count = 0;
	for (const upgrade of Object.values(state.upgrades)) {
		if (upgrade.level > 0 && !upgrade.equipped) count += 1;
	}
	return count;
}

/** Deep copy that survives the `unlocked` Set, for snapshots and comparisons. */
export function cloneState(state: SimState): SimState {
	return {
		gameTime: state.gameTime,
		currencies: mapValues(state.currencies, (value) => ({ ...value })),
		generators: mapValues(state.generators, (value) => ({ ...value })),
		upgrades: mapValues(state.upgrades, (value) => ({ ...value })),
		prestige: mapValues(state.prestige, (value) => ({ ...value })),
		unlocked: new Set(state.unlocked)
	};
}

function mapValues<T>(source: Record<string, T>, fn: (value: T) => T): Record<string, T> {
	const out: Record<string, T> = {};
	for (const key of Object.keys(source)) out[key] = fn(source[key]);
	return out;
}
