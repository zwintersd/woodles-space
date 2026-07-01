// Focus — the streak "look closer" clicks build when they land close
// together. Pure and rune-free so it can be unit-tested directly, same as
// vitals.ts; the Book (book.svelte.ts) holds the $state and calls into this.

import { FOCUS_STREAK_WINDOW_SEC, FOCUS_STREAK_STEP, FOCUS_STREAK_MAX } from './tuning';

// The next streak level for a click landing at `now`, given the streak and
// timestamp (ms epoch) of the last one. A click inside the window continues
// the streak (capped); outside it, the streak restarts at one.
export function nextFocusStreak(streak: number, lastClickAt: number, now: number): number {
	const withinWindow = lastClickAt > 0 && (now - lastClickAt) / 1000 <= FOCUS_STREAK_WINDOW_SEC;
	if (!withinWindow) return 1;
	return Math.min(FOCUS_STREAK_MAX, streak + 1);
}

// 1.0 at streak 1 (no bonus for a lone click), rising by one step per streak
// level beyond that, capped at FOCUS_STREAK_MAX.
export function focusMultiplier(streak: number): number {
	const level = Math.max(1, Math.min(FOCUS_STREAK_MAX, streak));
	return 1 + (level - 1) * FOCUS_STREAK_STEP;
}
