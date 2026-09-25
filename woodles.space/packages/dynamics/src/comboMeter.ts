/**
 * Shape K — Combo Meter. Short memory, on purpose: it only rewards manual
 * actions landing close together in wall-clock time, and forgets completely
 * the moment the player pauses. `now`/`lastAt` are passed in rather than read
 * from the clock so a harness can drive a streak deterministically.
 */

export interface ComboOptions {
	windowSeconds: number;
	stepBonus: number;
	maxLevel: number;
}

/** The next level for an action landing at `now`, given the level and timestamp (ms epoch) of the last one. */
export function nextComboLevel(level: number, lastAt: number, now: number, opts: ComboOptions): number {
	const withinWindow = lastAt > 0 && (now - lastAt) / 1000 <= opts.windowSeconds;
	if (!withinWindow) return 1;
	return Math.min(opts.maxLevel, level + 1);
}

/** 1.0 at level 1 — no bonus for a lone action — rising by one step per level beyond that. */
export function comboMultiplier(level: number, opts: ComboOptions): number {
	const clamped = Math.max(1, Math.min(opts.maxLevel, level));
	return 1 + (clamped - 1) * opts.stepBonus;
}
