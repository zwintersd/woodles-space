import { describe, expect, it } from 'vitest';
import { nextFocusStreak, focusMultiplier } from './focus';
import { FOCUS_STREAK_MAX, FOCUS_STREAK_STEP, FOCUS_STREAK_WINDOW_SEC } from './tuning';

describe('nextFocusStreak', () => {
	it('starts a fresh streak at 1 when there was no prior click', () => {
		expect(nextFocusStreak(0, 0, 1000)).toBe(1);
	});

	it('continues the streak when the click lands inside the window', () => {
		const last = 10_000;
		const now = last + FOCUS_STREAK_WINDOW_SEC * 1000 - 1;
		expect(nextFocusStreak(3, last, now)).toBe(4);
	});

	it('resets to 1 when the click lands outside the window', () => {
		const last = 10_000;
		const now = last + FOCUS_STREAK_WINDOW_SEC * 1000 + 1;
		expect(nextFocusStreak(5, last, now)).toBe(1);
	});

	it('caps at FOCUS_STREAK_MAX', () => {
		const last = 10_000;
		const now = last + 1;
		expect(nextFocusStreak(FOCUS_STREAK_MAX, last, now)).toBe(FOCUS_STREAK_MAX);
	});
});

describe('focusMultiplier', () => {
	it('is 1.0 at streak 1 — a lone click gets no bonus', () => {
		expect(focusMultiplier(1)).toBe(1);
	});

	it('rises by one step per streak level beyond the first', () => {
		expect(focusMultiplier(2)).toBeCloseTo(1 + FOCUS_STREAK_STEP, 6);
		expect(focusMultiplier(3)).toBeCloseTo(1 + 2 * FOCUS_STREAK_STEP, 6);
	});

	it('caps at FOCUS_STREAK_MAX', () => {
		const atCap = focusMultiplier(FOCUS_STREAK_MAX);
		expect(focusMultiplier(FOCUS_STREAK_MAX + 10)).toBeCloseTo(atCap, 6);
	});

	it('treats streak 0 the same as streak 1 (no bonus)', () => {
		expect(focusMultiplier(0)).toBe(1);
	});
});
