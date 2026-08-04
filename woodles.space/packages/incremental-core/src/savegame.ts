import { initialState, type SimState } from './state.js';
import type { GameDef } from './types.js';

/**
 * A player's progress through a game, as JSON.
 *
 * The hard part isn't the serializing — it's that a save outlives the design.
 * An author keeps editing the game after people have started playing it, so
 * every restore has to be **reconciled against the current def**: entities the
 * save knows about that no longer exist are dropped, entities the def has
 * gained that the save has never heard of start fresh. A save is a record of
 * what a player did, not a description of the game.
 */

export const SAVE_VERSION = 1;

/** `SimState` with the Set flattened, since JSON has no Set. */
export interface SerializedSimState {
	gameTime: number;
	currencies: Record<string, { amount: number; lifetime: number }>;
	generators: Record<string, { level: number }>;
	upgrades: Record<string, { level: number }>;
	prestige: Record<string, { count: number; currencyAmount: number }>;
	unlocked: string[];
}

export interface SaveGame {
	version: typeof SAVE_VERSION;
	/** `def.meta.id`, so a save can't be loaded into a different game by accident. */
	gameId: string;
	savedAt: string;
	/** The seed the run was created with, so crit rolls replay identically. */
	seed: number;
	/**
	 * Where the random stream had got to. Without it a reload replays the rolls
	 * the run made in its first second, which turns save-and-reload into a way
	 * to reroll a crit. Optional so a save written before this existed still
	 * loads — it just starts the stream over.
	 */
	rngState?: number;
	state: SerializedSimState;
	/** First time each milestone was reached, preserved across sessions. */
	milestoneTimes: Record<string, number | null>;
}

export function serializeState(state: SimState): SerializedSimState {
	return {
		gameTime: state.gameTime,
		currencies: cloneRecord(state.currencies),
		generators: cloneRecord(state.generators),
		upgrades: cloneRecord(state.upgrades),
		prestige: cloneRecord(state.prestige),
		unlocked: [...state.unlocked]
	};
}

/**
 * Rebuilds a `SimState` for `def` from a save. Starts from a fresh state — so
 * everything the def declares is present and correctly shaped — then lays the
 * saved numbers over the top wherever both agree. Anything the save mentions
 * that the def no longer has is silently dropped, which is the only sane
 * answer: the entity is gone, and the player's progress in it has nowhere to
 * live.
 */
export function restoreState(def: GameDef, save: SaveGame): SimState {
	const state = initialState(def);
	const saved = save.state;

	state.gameTime = Number.isFinite(saved.gameTime) && saved.gameTime > 0 ? saved.gameTime : 0;

	for (const currency of def.currencies) {
		const entry = saved.currencies?.[currency.id];
		if (!entry) continue;
		state.currencies[currency.id] = {
			amount: safe(entry.amount),
			lifetime: safe(entry.lifetime)
		};
	}

	for (const generator of def.generators) {
		const entry = saved.generators?.[generator.id];
		if (!entry) continue;
		// Clamped to the def's current ceiling: an author who lowered maxLevel
		// shouldn't leave old saves holding levels the game says are impossible.
		const ceiling = generator.maxLevel ?? Number.POSITIVE_INFINITY;
		state.generators[generator.id] = { level: Math.min(Math.max(0, Math.floor(safe(entry.level))), ceiling) };
	}

	for (const upgrade of def.upgrades) {
		const entry = saved.upgrades?.[upgrade.id];
		if (!entry) continue;
		const ceiling = upgrade.repeatable ? upgrade.repeatable.maxLevel : 1;
		state.upgrades[upgrade.id] = { level: Math.min(Math.max(0, Math.floor(safe(entry.level))), ceiling) };
	}

	for (const layer of def.prestigeLayers) {
		const entry = saved.prestige?.[layer.id];
		if (!entry) continue;
		state.prestige[layer.id] = {
			count: Math.max(0, Math.floor(safe(entry.count))),
			currencyAmount: safe(entry.currencyAmount)
		};
	}

	// Only ids the def still knows about — a stale reveal would otherwise
	// permanently unhide something that no longer exists.
	const known = new Set([
		...def.currencies.map((entry) => entry.id),
		...def.generators.map((entry) => entry.id),
		...def.upgrades.map((entry) => entry.id),
		...def.prestigeLayers.map((entry) => entry.id),
		...def.unlocks.map((entry) => entry.id),
		...def.milestones.map((entry) => entry.id)
	]);
	for (const id of saved.unlocked ?? []) if (known.has(id)) state.unlocked.add(id);

	return state;
}

/** Milestone timings from a save, restricted to milestones the def still has. */
export function restoreMilestoneTimes(def: GameDef, save: SaveGame): Record<string, number | null> {
	const times: Record<string, number | null> = {};
	for (const milestone of def.milestones) {
		const saved = save.milestoneTimes?.[milestone.id];
		times[milestone.id] = typeof saved === 'number' && Number.isFinite(saved) ? saved : null;
	}
	return times;
}

/** Whether a save belongs to this game at all. */
export function saveMatches(def: GameDef, save: SaveGame): boolean {
	return save.version === SAVE_VERSION && save.gameId === def.meta.id;
}

/** Shape check for something arriving from storage or a file. */
export function isSaveGame(value: unknown): value is SaveGame {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<SaveGame>;
	return (
		candidate.version === SAVE_VERSION &&
		typeof candidate.gameId === 'string' &&
		!!candidate.state &&
		typeof candidate.state === 'object'
	);
}

function cloneRecord<T extends object>(source: Record<string, T>): Record<string, T> {
	const out: Record<string, T> = {};
	for (const key of Object.keys(source)) out[key] = { ...source[key] };
	return out;
}

/** Anything non-finite becomes 0 rather than poisoning the run with NaN. */
function safe(value: number): number {
	return Number.isFinite(value) ? value : 0;
}
