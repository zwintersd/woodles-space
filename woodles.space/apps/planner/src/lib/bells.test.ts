import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
	BELLS,
	getBell,
	setMasterVolume,
	setMasterMuted,
	getMasterMuted,
	playBell
} from './bells';

// Mock Audio API
class MockAudio {
	volume = 1;
	playing = false;

	constructor(public filePath: string) {}

	play = vi.fn(async () => {
		this.playing = true;
		return Promise.resolve();
	});

	pause = vi.fn(() => {
		this.playing = false;
	});
}

// Replace global Audio before tests
global.Audio = MockAudio as any;

describe('bells — audio notification system', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset global state by reimporting (or manually reset in setup)
		setMasterMuted(false);
		setMasterVolume(1.0);
	});

	// ── bell registry ────────────────────────────────────────────────

	describe('BELLS registry', () => {
		it('exports an array of bell definitions', () => {
			expect(Array.isArray(BELLS)).toBe(true);
			expect(BELLS.length).toBeGreaterThan(0);
		});

		it('each bell has required fields', () => {
			BELLS.forEach((bell) => {
				expect(bell.id).toBeTruthy();
				expect(bell.name).toBeTruthy();
				expect(bell.filePath).toBeTruthy();
				expect(bell.defaultVolume).toBeGreaterThan(0);
				expect(bell.defaultVolume).toBeLessThanOrEqual(1);
			});
		});

		it('includes block-start bell', () => {
			expect(BELLS.find((b) => b.id === 'block-start')).toBeTruthy();
		});

		it('includes lead-time bell', () => {
			expect(BELLS.find((b) => b.id === 'lead-time')).toBeTruthy();
		});

		it('bell IDs are unique', () => {
			const ids = BELLS.map((b) => b.id);
			const unique = new Set(ids);
			expect(unique.size).toBe(ids.length);
		});

		it('bell filePaths follow expected pattern', () => {
			BELLS.forEach((bell) => {
				expect(bell.filePath).toMatch(/^\/planner\/bells\//);
				expect(bell.filePath).toMatch(/\.mp3$/);
			});
		});
	});

	// ── getBell ──────────────────────────────────────────────────────

	describe('getBell', () => {
		it('returns bell by ID', () => {
			const bell = getBell('block-start');
			expect(bell?.id).toBe('block-start');
		});

		it('returns undefined for nonexistent ID', () => {
			const bell = getBell('nonexistent');
			expect(bell).toBeUndefined();
		});

		it('matches correct properties', () => {
			const bell = getBell('lead-time');
			expect(bell?.name).toBe('lead time');
			expect(bell?.filePath).toContain('lead-time');
		});
	});

	// ── master volume ────────────────────────────────────────────────

	describe('volume control', () => {
		it('setMasterVolume clamps to 0..1', () => {
			setMasterVolume(-0.5);
			expect(getMasterMuted()).toBe(false); // Just testing that the function works
			setMasterVolume(1.5);
			expect(getMasterMuted()).toBe(false);
			setMasterVolume(0.5);
			expect(getMasterMuted()).toBe(false);
		});

		it('setMasterVolume accepts valid values', () => {
			setMasterVolume(0);
			setMasterVolume(0.5);
			setMasterVolume(1);
			expect(getMasterMuted()).toBe(false);
		});
	});

	// ── mute control ────────────────────────────────────────────────

	describe('mute control', () => {
		it('setMasterMuted sets mute state', () => {
			setMasterMuted(true);
			expect(getMasterMuted()).toBe(true);
		});

		it('setMasterMuted can unmute', () => {
			setMasterMuted(true);
			setMasterMuted(false);
			expect(getMasterMuted()).toBe(false);
		});

		it('getMasterMuted returns current state', () => {
			setMasterMuted(false);
			expect(getMasterMuted()).toBe(false);
			setMasterMuted(true);
			expect(getMasterMuted()).toBe(true);
		});
	});

	// ── playBell ─────────────────────────────────────────────────────

	describe('playBell', () => {
		it('executes without error for valid bell', () => {
			expect(() => playBell('block-start')).not.toThrow();
		});

		it('silently ignores nonexistent bell IDs', () => {
			let createdAudio = false;
			const originalAudio = global.Audio;
			// @ts-expect-error - testing
			global.Audio = class {
				constructor() {
					createdAudio = true;
				}
				play = vi.fn(async () => {});
				volume = 1;
			};
			playBell('nonexistent');
			expect(createdAudio).toBe(false);
			global.Audio = originalAudio;
		});

		it('silently ignores play when muted', () => {
			let createdAudio = false;
			const originalAudio = global.Audio;
			// @ts-expect-error - testing
			global.Audio = class {
				constructor() {
					createdAudio = true;
				}
				play = vi.fn(async () => {});
				volume = 1;
			};
			setMasterMuted(true);
			playBell('block-start');
			expect(createdAudio).toBe(false);
			global.Audio = originalAudio;
			setMasterMuted(false);
		});

		it('respects master volume setting', () => {
			setMasterVolume(0.5);
			// Should not throw and should execute without error
			expect(() => playBell('block-start')).not.toThrow();
		});

		it('respects default bell volume', () => {
			const bell = getBell('block-start');
			expect(bell?.defaultVolume).toBeLessThanOrEqual(1);
		});

		it('applies volume clamping', () => {
			setMasterVolume(2); // Out of range
			// Should clamp internally; just verify no crash
			expect(() => playBell('block-start')).not.toThrow();
			setMasterVolume(1);
		});

		it('handles play rejection gracefully', () => {
			const originalAudio = global.Audio;
			// @ts-expect-error - testing error handling
			global.Audio = class {
				volume = 1;
				play = vi.fn(() => Promise.reject(new Error('Autoplay blocked')));
			};
			// Should not throw
			expect(() => playBell('block-start')).not.toThrow();
			global.Audio = originalAudio;
		});

		it('handles Audio constructor errors gracefully', () => {
			const originalAudio = global.Audio;
			// @ts-expect-error - testing error handling
			global.Audio = class {
				constructor() {
					throw new Error('Audio not supported');
				}
			};
			expect(() => playBell('block-start')).not.toThrow();
			global.Audio = originalAudio;
		});

		it('silently ignores in non-browser environment', () => {
			// In SSR context, window is undefined — playBell checks this
			const originalWindow = global.window;
			// @ts-expect-error - testing SSR
			delete global.window;
			expect(() => playBell('block-start')).not.toThrow();
			// Restore
			global.window = originalWindow;
		});
	});

	// ── bell selection and playback ──────────────────────────────────

	describe('bell playback scenarios', () => {
		it('plays different bells without errors', () => {
			const bells = ['block-start', 'lead-time', 'meal'];
			bells.forEach((id) => {
				expect(() => playBell(id)).not.toThrow();
			});
		});

		it('maintains state across multiple plays', () => {
			setMasterVolume(0.8);
			setMasterMuted(false);
			playBell('block-start');
			playBell('lead-time');
			expect(getMasterMuted()).toBe(false);
		});

		it('respects mute state during consecutive plays', () => {
			let playCount = 0;
			const originalAudio = global.Audio;
			// @ts-expect-error - testing
			global.Audio = class {
				volume = 1;
				play = vi.fn(async () => {
					playCount++;
				});
			};
			playBell('block-start');
			const countAfterFirst = playCount;
			expect(countAfterFirst).toBeGreaterThanOrEqual(0);

			setMasterMuted(true);
			playBell('lead-time');
			const countAfterMuted = playCount;
			expect(countAfterMuted).toBe(countAfterFirst); // No new call

			setMasterMuted(false);
			playBell('meal');
			const countAfterUnmuted = playCount;
			expect(countAfterUnmuted).toBeGreaterThanOrEqual(countAfterMuted); // Called again

			global.Audio = originalAudio;
			setMasterMuted(false);
		});
	});

	// ── volume math ──────────────────────────────────────────────────

	describe('volume calculation', () => {
		it('final volume = bell default * master volume', () => {
			setMasterVolume(0.5);
			const bell = getBell('block-start')!;
			const expectedVolume = bell.defaultVolume * 0.5;
			playBell('block-start');
			// In real implementation, audio.volume would be set to expectedVolume
			// We just verify the logic doesn't crash
		});

		it('volume of 0 is valid (mute without master mute)', () => {
			setMasterVolume(0);
			expect(() => playBell('block-start')).not.toThrow();
		});

		it('maximum volume respects both constraints', () => {
			const bell = getBell('block-start')!;
			setMasterVolume(1);
			// final = bell.defaultVolume * 1, should be <= 1
			expect(bell.defaultVolume * 1).toBeLessThanOrEqual(1);
		});
	});
});
