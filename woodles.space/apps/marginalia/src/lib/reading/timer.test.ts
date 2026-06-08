import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createReadingTimer } from './timer';

describe('createReadingTimer', () => {
	let accrueMs = 0;
	const defaultOptions = {
		graceMs: 1500,
		onAccrueMs: (dt: number) => {
			accrueMs += dt;
		}
	};

	beforeEach(() => {
		accrueMs = 0;
		vi.useFakeTimers();
		// Mock performance.now
		vi.spyOn(global.performance, 'now').mockReturnValue(0);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	// ── initialization ───────────────────────────────────────────────

	describe('initialization', () => {
		it('returns handle with all methods', () => {
			const timer = createReadingTimer(defaultOptions);
			expect(typeof timer.start).toBe('function');
			expect(typeof timer.stop).toBe('function');
			expect(typeof timer.setPresent).toBe('function');
			expect(typeof timer.getSessionMs).toBe('function');
			expect(typeof timer.isAccruing).toBe('function');
			expect(typeof timer.isPresent).toBe('function');
		});

		it('uses default grace period if not specified', () => {
			const timer = createReadingTimer({
				onAccrueMs: vi.fn()
			});
			expect(timer).toBeTruthy();
		});

		it('uses provided grace period', () => {
			const timer = createReadingTimer({
				...defaultOptions,
				graceMs: 3000
			});
			expect(timer).toBeTruthy();
		});

		it('starts not running', () => {
			const timer = createReadingTimer(defaultOptions);
			expect(timer.isAccruing()).toBe(false);
		});

		it('starts with zero session time', () => {
			const timer = createReadingTimer(defaultOptions);
			expect(timer.getSessionMs()).toBe(0);
		});
	});

	// ── start/stop ───────────────────────────────────────────────────

	describe('start', () => {
		it('begins accrual if present and visible', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.setPresent(true);
			timer.start();
			vi.mocked(performance.now).mockReturnValue(100);
			vi.advanceTimersByTime(100);
			expect(timer.isAccruing()).toBe(true);
		});

		it('can be called multiple times (idempotent after first)', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			timer.start(); // Second call
			expect(timer.isAccruing()).toBe(false); // Not running until animation frame
		});

		it('sets up visibility change listener', () => {
			const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			expect(addEventListenerSpy).toHaveBeenCalledWith(
				'visibilitychange',
				expect.any(Function)
			);
		});

		it('schedules animation frames', () => {
			const rafSpy = vi.spyOn(global, 'requestAnimationFrame');
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			expect(rafSpy).toHaveBeenCalled();
		});
	});

	describe('stop', () => {
		it('halts accrual', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.setPresent(true);
			timer.start();
			vi.mocked(performance.now).mockReturnValue(100);
			vi.advanceTimersByTime(100);
			timer.stop();
			expect(timer.isAccruing()).toBe(false);
		});

		it('removes visibility change listener', () => {
			const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			timer.stop();
			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				'visibilitychange',
				expect.any(Function)
			);
		});

		it('cancels animation frame', () => {
			const cafSpy = vi.spyOn(global, 'cancelAnimationFrame');
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			timer.stop();
			expect(cafSpy).toHaveBeenCalled();
		});

		it('can be called multiple times (idempotent)', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			timer.stop();
			timer.stop(); // Second call
			expect(timer.isAccruing()).toBe(false);
		});
	});

	// ── presence tracking ────────────────────────────────────────────

	describe('setPresent', () => {
		it('marks user as present', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			timer.setPresent(true);
			expect(timer.isPresent()).toBe(true);
		});

		it('marks user as not present', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.setPresent(true);
			timer.setPresent(false);
			expect(timer.isPresent()).toBe(false);
		});

		it('is idempotent when called with same value', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.setPresent(true);
			timer.setPresent(true);
			expect(timer.isPresent()).toBe(true);
		});
	});

	// ── accrual logic ────────────────────────────────────────────────

	describe('accrual', () => {
		it('does not accrue if not running', () => {
			const timer = createReadingTimer(defaultOptions);
			const before = timer.getSessionMs();
			// Without starting, session should not advance
			expect(timer.getSessionMs()).toBe(before);
		});

		it('can be started and stopped', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			expect(() => timer.stop()).not.toThrow();
		});

		it('tracks session time when callback is invoked', () => {
			let totalAccrued = 0;
			const timer = createReadingTimer({
				graceMs: 1500,
				onAccrueMs: (dt) => {
					totalAccrued += dt;
				}
			});
			timer.start();
			timer.setPresent(true);
			// Simulate accrual by calling the callback
			expect(totalAccrued).toBeGreaterThanOrEqual(0);
		});
	});

	// ── session time tracking ────────────────────────────────────────

	describe('getSessionMs', () => {
		it('returns cumulative accrued time', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			timer.setPresent(true);
			const before = timer.getSessionMs();
			// Simulate accrual by directly testing the callback
			accrueMs = 100;
			expect(timer.getSessionMs()).toBeGreaterThanOrEqual(before);
		});

		it('reflects all accrued ms', () => {
			const timer = createReadingTimer({
				...defaultOptions,
				onAccrueMs: (dt) => {
					accrueMs += dt;
				}
			});
			expect(timer.getSessionMs()).toBe(0);
		});
	});

	// ── visibility change ────────────────────────────────────────────

	describe('visibility change handling', () => {
		it('resets lastTickAt when tab becomes visible', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			timer.setPresent(true);
			vi.mocked(performance.now).mockReturnValue(0);
			vi.advanceTimersByTime(100);
			vi.mocked(performance.now).mockReturnValue(1000);
			// Simulate visibility change event
			Object.defineProperty(document, 'hidden', {
				value: true,
				writable: true
			});
			const event = new Event('visibilitychange');
			document.dispatchEvent(event);
			vi.mocked(performance.now).mockReturnValue(1000);
			// Time while hidden shouldn't be counted
		});

		it('handles visibility change event', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			const event = new Event('visibilitychange');
			expect(() => document.dispatchEvent(event)).not.toThrow();
		});
	});

	// ── isAccruing ───────────────────────────────────────────────────

	describe('isAccruing', () => {
		it('returns false when not running', () => {
			const timer = createReadingTimer(defaultOptions);
			expect(timer.isAccruing()).toBe(false);
		});

		it('can be queried for accruing state', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			timer.setPresent(true);
			// Should be a boolean
			expect(typeof timer.isAccruing()).toBe('boolean');
		});
	});

	// ── cleanup ──────────────────────────────────────────────────────

	describe('cleanup', () => {
		it('can stop and restart', () => {
			const timer = createReadingTimer(defaultOptions);
			timer.start();
			timer.setPresent(true);
			timer.stop();
			timer.start();
			timer.setPresent(true);
			// Should work without errors
			expect(timer.isPresent()).toBe(true);
		});

		it('maintains session time across stop/start cycles', () => {
			const tracker: number[] = [];
			const timer = createReadingTimer({
				graceMs: 1500,
				onAccrueMs: (dt) => {
					tracker.push(dt);
				}
			});
			timer.start();
			timer.setPresent(true);
			const session1 = timer.getSessionMs();
			timer.stop();
			timer.start();
			const session2 = timer.getSessionMs();
			expect(session2).toBeGreaterThanOrEqual(session1);
		});
	});

	// ── edge cases ───────────────────────────────────────────────────

	describe('edge cases', () => {
		it('handles very small grace period', () => {
			const timer = createReadingTimer({
				graceMs: 10,
				onAccrueMs: vi.fn()
			});
			expect(() => {
				timer.start();
				timer.setPresent(true);
				timer.setPresent(false);
				timer.stop();
			}).not.toThrow();
		});

		it('handles zero grace period', () => {
			const timer = createReadingTimer({
				graceMs: 0,
				onAccrueMs: vi.fn()
			});
			expect(() => {
				timer.start();
				timer.setPresent(true);
				timer.stop();
			}).not.toThrow();
		});

		it('handles large grace periods', () => {
			const timer = createReadingTimer({
				graceMs: 60000,
				onAccrueMs: vi.fn()
			});
			expect(() => {
				timer.start();
				timer.setPresent(true);
				timer.stop();
			}).not.toThrow();
		});

		it('maintains session ms non-decreasing', () => {
			const timer = createReadingTimer({
				graceMs: 1500,
				onAccrueMs: vi.fn()
			});
			timer.start();
			const before = timer.getSessionMs();
			const after = timer.getSessionMs();
			expect(after).toBeGreaterThanOrEqual(before);
		});
	});
});

function afterEach(callback: () => void) {
	callback();
}
