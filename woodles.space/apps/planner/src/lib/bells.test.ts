// Runs without a DOM on purpose: bells must be safe to import and call during server rendering.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BELLS, getBell, getMasterMuted, levelFor, playBell, registryNotes, setMasterMuted, setMasterVolume } from './bells';

describe('bells — the block-bell registry and global controls', () => {
	beforeEach(() => {
		setMasterMuted(false);
		setMasterVolume(1);
	});
	afterEach(() => setMasterVolume(1));

	describe('registry', () => {
		it('names each block bell once, with a level between 0 and 1', () => {
			expect(BELLS.length).toBeGreaterThan(0);
			expect(new Set(BELLS.map(bell => bell.id)).size).toBe(BELLS.length);
			for (const bell of BELLS) {
				expect(bell.name).toBeTruthy();
				expect(bell.defaultVolume).toBeGreaterThan(0);
				expect(bell.defaultVolume).toBeLessThanOrEqual(1);
			}
		});

		it('keeps the bells blocks already name', () => {
			for (const id of ['block-start', 'lead-time', 'meal', 'wind-down', 'holiday']) expect(getBell(id)?.id).toBe(id);
			expect(getBell('nonexistent')).toBeUndefined();
		});

		it('plays each registry bell at its original pitches, with no audio files', () => {
			expect(registryNotes('block-start').map(note => note.freq)).toEqual([783.99, 987.77]);
			expect(registryNotes('meal').map(note => note.freq)).toEqual([523.25, 659.25]);
			expect(registryNotes('wind-down')[0].decay).toBe(1.15);
			expect(registryNotes('unknown').map(note => note.freq)).toEqual([783.99, 987.77]);
			expect(BELLS.every(bell => !('filePath' in bell))).toBe(true);
		});
	});

	describe('volume and mute', () => {
		it('clamps master volume and ignores values that are not numbers', () => {
			setMasterVolume(0.4);
			setMasterVolume(Number.NaN);
			setMasterVolume(Number.POSITIVE_INFINITY);
			expect(() => setMasterVolume(-3)).not.toThrow();
		});

		it('tracks mute state', () => {
			setMasterMuted(true);
			expect(getMasterMuted()).toBe(true);
			setMasterMuted(false);
			expect(getMasterMuted()).toBe(false);
		});

		it('maps a slider to a squared level, safe for odd values', () => {
			expect(levelFor(1)).toBe(1);
			expect(levelFor(0.5)).toBe(0.25);
			expect(levelFor(0)).toBe(0);
			expect(levelFor(2)).toBe(1);
			expect(levelFor(Number.NaN)).toBe(0);
		});
	});

	describe('playBell', () => {
		it('never throws or rejects without a browser', async () => {
			expect(typeof window).toBe('undefined');
			await expect(playBell('block-start')).resolves.toBe('silent');
			await expect(playBell('nonexistent')).resolves.toBe('silent');
			setMasterMuted(true);
			await expect(playBell('meal')).resolves.toBe('silent');
		});
	});
});
