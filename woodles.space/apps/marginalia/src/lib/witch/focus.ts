// Focus — the streak "look closer" clicks build when they land close
// together. A named instance of @woodles/dynamics's Combo Meter (shape K):
// see packages/dynamics/README.md for the shape this generalizes from.
//
// Pure and rune-free so it can be unit-tested directly, same as vitals.ts;
// the Book (book.svelte.ts) holds the $state and calls into this.

import { comboMultiplier, nextComboLevel, type ComboOptions } from '@woodles/dynamics';
import { FOCUS_STREAK_WINDOW_SEC, FOCUS_STREAK_STEP, FOCUS_STREAK_MAX } from './tuning';

const FOCUS_COMBO: ComboOptions = {
	windowSeconds: FOCUS_STREAK_WINDOW_SEC,
	stepBonus: FOCUS_STREAK_STEP,
	maxLevel: FOCUS_STREAK_MAX
};

// The next streak level for a click landing at `now`, given the streak and
// timestamp (ms epoch) of the last one. A click inside the window continues
// the streak (capped); outside it, the streak restarts at one.
export function nextFocusStreak(streak: number, lastClickAt: number, now: number): number {
	return nextComboLevel(streak, lastClickAt, now, FOCUS_COMBO);
}

// 1.0 at streak 1 (no bonus for a lone click), rising by one step per streak
// level beyond that, capped at FOCUS_STREAK_MAX.
export function focusMultiplier(streak: number): number {
	return comboMultiplier(streak, FOCUS_COMBO);
}
