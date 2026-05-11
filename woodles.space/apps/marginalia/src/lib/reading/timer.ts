// Mouse-presence reading timer. Time only accumulates while the user's pointer
// is inside the reader pane and the tab is visible. A short grace period
// absorbs cursor jitter so brief leaves don't constantly toggle the timer.
//
// This module is deliberately presentation-agnostic — the caller wires up
// pointerenter/pointerleave on whatever element counts as "the pane" and
// hands the booleans in.

export interface ReadingTimerOptions {
	graceMs?: number;
	onAccrueMs: (dtMs: number) => void;
}

export interface ReadingTimerHandle {
	start: () => void;
	stop: () => void;
	setPresent: (present: boolean) => void;
	getSessionMs: () => number;
	isAccruing: () => boolean;
	isPresent: () => boolean;
}

export function createReadingTimer(opts: ReadingTimerOptions): ReadingTimerHandle {
	const graceMs = opts.graceMs ?? 1500;

	let present = false;
	let visible = typeof document === 'undefined' ? true : !document.hidden;
	let running = false;
	let lastTickAt = 0;
	let absenceStartedAt = 0; // performance.now() when present went false
	let sessionMs = 0;
	let rafId: number | null = null;

	function accruing(): boolean {
		if (!running || !visible) return false;
		if (present) return true;
		// still accruing during the grace window after leaving
		return absenceStartedAt > 0 && performance.now() - absenceStartedAt < graceMs;
	}

	function tick() {
		if (!running) return;
		const now = performance.now();
		const dt = now - lastTickAt;
		lastTickAt = now;
		if (accruing() && dt > 0) {
			sessionMs += dt;
			opts.onAccrueMs(dt);
		}
		rafId = requestAnimationFrame(tick);
	}

	function onVisibility() {
		visible = !document.hidden;
		// reset the lastTickAt so any time the tab was hidden isn't counted
		lastTickAt = performance.now();
	}

	function start() {
		if (running) return;
		running = true;
		lastTickAt = performance.now();
		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', onVisibility);
		}
		rafId = requestAnimationFrame(tick);
	}

	function stop() {
		running = false;
		if (rafId !== null) cancelAnimationFrame(rafId);
		rafId = null;
		if (typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', onVisibility);
		}
	}

	function setPresent(p: boolean) {
		if (p === present) return;
		present = p;
		absenceStartedAt = p ? 0 : performance.now();
	}

	return {
		start,
		stop,
		setPresent,
		getSessionMs: () => sessionMs,
		isAccruing: accruing,
		isPresent: () => present
	};
}
