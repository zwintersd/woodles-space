// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { audioReadiness, installAudioUnlock, isSounding, playNotes, playVoice, setAudioContextFactory, stopBells, unlockAudio, watchAudioReadiness, watchSounding } from './bells';
import { voiceNotes } from './bellVoices';
import { FakeAudioContext, fakeFactory } from './test-support/fakeAudio';

function use(context: FakeAudioContext | null) {
	setAudioContextFactory(context ? fakeFactory(context) : () => null);
	return context;
}

describe('the bell engine on Web Audio', () => {
	afterEach(() => setAudioContextFactory(undefined));

	it('schedules every note with a finite, positive envelope on a running context', async () => {
		const context = use(new FakeAudioContext({ running: true }))!;
		await expect(playVoice('westminster', { volume: 1, minute: 0, strikeHour: 13 })).resolves.toBe('scheduled');
		// Four phrases of four struck notes (six partials each), then one strike for 1 pm.
		expect(context.oscillators).toHaveLength(4 * 4 * 6 + 6);
		for (const oscillator of context.oscillators) {
			expect(oscillator.peak).toBeGreaterThan(0);
			expect(Number.isFinite(oscillator.peak)).toBe(true);
			expect(oscillator.stoppedAt!).toBeGreaterThan(oscillator.startedAt!);
		}
		const starts = context.oscillators.map(oscillator => oscillator.startedAt!);
		expect(starts).toEqual([...starts].sort((a, b) => a - b));
	});

	it('never queues a bell on a locked context, so nothing bursts out on the first tap', async () => {
		const context = use(new FakeAudioContext({ running: false, allowResume: false }))!;
		await expect(playVoice('bowl', { volume: 1 })).resolves.toBe('locked');
		await expect(playVoice('chime', { volume: 1 })).resolves.toBe('locked');
		expect(context.oscillators).toHaveLength(0);
		// The first gesture unlocks; still nothing stale plays.
		context.allowResume = true;
		await expect(unlockAudio()).resolves.toBe('running');
		expect(context.oscillators).toHaveLength(0);
		expect(context.silentBuffersPlayed).toBe(1);
	});

	it('plays when a context that the page may resume wakes at once', async () => {
		const context = use(new FakeAudioContext({ running: false, allowResume: true }))!;
		await expect(playVoice('bell', { volume: 1 })).resolves.toBe('scheduled');
		expect(context.oscillators).toHaveLength(2);
	});

	it('treats zero or nonsense volume as silence, and no Web Audio as unavailable', async () => {
		const context = use(new FakeAudioContext({ running: true }))!;
		await expect(playNotes(voiceNotes('bell'), 0)).resolves.toBe('silent');
		await expect(playNotes(voiceNotes('bell'), Number.NaN)).resolves.toBe('silent');
		await expect(playNotes([], 1)).resolves.toBe('silent');
		expect(context.oscillators).toHaveLength(0);
		use(null);
		expect(audioReadiness()).toBe('suspended');
		await expect(playVoice('bell', { volume: 1 })).resolves.toBe('unavailable');
	});

	it('plays one sequence at a time, fading the last instead of cutting it', async () => {
		const context = use(new FakeAudioContext({ running: true }))!;
		const sounding: (string | null)[] = [];
		const stop = watchSounding(kind => sounding.push(kind));
		await playVoice('bowl', { volume: 1, kind: 'preview' });
		const bowl = [...context.oscillators];
		context.currentTime = 1;
		await playVoice('chime', { volume: 1, kind: 'preview' });
		const fade = context.gains.find(gain => gain.gain.events.some(event => event.kind === 'target'));
		expect(fade?.gain.events.find(event => event.kind === 'target')).toMatchObject({ value: 0, time: 1 });
		for (const oscillator of bowl) expect(oscillator.stoppedAt!).toBeLessThanOrEqual(1.11);
		expect(isSounding()).toBe(true);
		stopBells();
		expect(isSounding()).toBe(false);
		// Fading the bowl for the chime never reported a gap.
		expect(sounding).toEqual([null, 'preview', 'preview', null]);
		stop();
	});

	it('lets an automatic bell wait for another rather than cut it off, and replace a preview', async () => {
		const context = use(new FakeAudioContext({ running: true }))!;
		const sounding: (string | null)[] = [];
		const stop = watchSounding(kind => sounding.push(kind));
		await playVoice('bell', { volume: 1, minute: 0, strikeHour: 12 });
		const hour = [...context.oscillators];
		const lastStrike = Math.max(...hour.map(oscillator => oscillator.startedAt!));
		context.currentTime = 10;
		await playVoice('pip', { volume: 1 });
		// The counted hour keeps every strike — nothing still ringing at 10 s is cut — and the pip follows it.
		expect(hour.filter(oscillator => oscillator.startedAt! > 10).every(oscillator => oscillator.stoppedAt! > oscillator.startedAt! + 0.5)).toBe(true);
		expect(hour.filter(oscillator => oscillator.startedAt! > 10).length).toBeGreaterThan(0);
		expect(context.oscillators.at(-1)!.startedAt!).toBeGreaterThan(lastStrike);
		// A preview takes over at once, and an automatic bell then replaces the preview.
		await playVoice('chime', { volume: 1, kind: 'preview' });
		expect(hour.every(oscillator => oscillator.stoppedAt! <= 10.11)).toBe(true);
		expect(sounding.at(-1)).toBe('preview');
		await playVoice('bell', { volume: 1 });
		expect(sounding.at(-1)).toBe('auto');
		stop();
	});

	it('lets a sequence go if the context stops running partway', async () => {
		const context = use(new FakeAudioContext({ running: true }))!;
		await playVoice('westminster', { volume: 1, minute: 0 });
		expect(isSounding()).toBe(true);
		context.setState('suspended');
		expect(isSounding()).toBe(false);
	});

	it('reports readiness as it changes and keeps listening for gestures for the life of the page', async () => {
		const context = use(new FakeAudioContext({ running: false, allowResume: true }))!;
		const seen: string[] = [];
		const unwatch = watchAudioReadiness(state => seen.push(state));
		const target = new EventTarget();
		let wanted = true;
		const remove = installAudioUnlock(() => wanted, target as unknown as Window);
		target.dispatchEvent(new Event('pointerup'));
		await Promise.resolve(); await Promise.resolve();
		expect(context.state).toBe('running');
		// An interruption (a phone call) suspends it again; the next tap still wakes it.
		context.setState('interrupted' as AudioContextState);
		expect(audioReadiness()).toBe('suspended');
		target.dispatchEvent(new Event('touchend'));
		await Promise.resolve(); await Promise.resolve();
		expect(context.state).toBe('running');
		// With bells off, a tap leaves the audio device alone.
		context.setState('suspended');
		wanted = false;
		target.dispatchEvent(new Event('keydown'));
		await Promise.resolve();
		expect(context.state).toBe('suspended');
		expect(seen).toContain('running');
		expect(seen).toContain('suspended');
		remove(); unwatch();
	});
});

describe('a browser that names Web Audio but can’t make it', () => {
	afterEach(() => setAudioContextFactory(undefined));
	it('reports bells as unavailable rather than waiting for a tap', async () => {
		setAudioContextFactory(() => { throw new Error('blocked'); });
		const seen: string[] = [];
		const unwatch = watchAudioReadiness(state => seen.push(state));
		await expect(playVoice('bell', { volume: 1 })).resolves.toBe('unavailable');
		expect(audioReadiness()).toBe('unavailable');
		expect(seen.at(-1)).toBe('unavailable');
		unwatch();
	});
});
