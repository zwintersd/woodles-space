// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlannerStore } from './store.svelte';
import { setAudioContextFactory } from './bells';
import { FakeAudioContext, fakeFactory } from './test-support/fakeAudio';

const at = (hours: number, minutes: number, seconds = 0) => new Date(2026, 9, 18, hours, minutes, seconds);
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

describe('the clock rings bells', () => {
	let context: FakeAudioContext;
	let heard: { mark: string; voice: string }[];
	const listen = (event: Event) => heard.push((event as CustomEvent).detail);

	function fresh(): PlannerStore {
		const store = new PlannerStore();
		store.updateSettings({ onboardingComplete: true, bellsEnabled: true, samplingIntervalMinutes: 15, quietHoursStart: '22:00', quietHoursEnd: '07:00' });
		return store;
	}

	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
		vi.setSystemTime(at(14, 59, 30));
		context = new FakeAudioContext({ running: true });
		setAudioContextFactory(fakeFactory(context));
		heard = [];
		window.addEventListener('carillon:bell', listen);
	});
	afterEach(() => {
		window.removeEventListener('carillon:bell', listen);
		setAudioContextFactory(undefined);
		vi.useRealTimers();
	});

	it('stamps every deliberate settings change for sync', () => {
		const store = fresh();
		vi.setSystemTime(at(15, 0));
		store.updateSettings({ tone: 'wry' });
		expect(store.settings.settingsStamps?.tone).toBe(at(15, 0).toISOString());
		expect(new PlannerStore().settings.settingsStamps?.tone).toBe(at(15, 0).toISOString());
	});

	it('rings the classic bell by default, and a preset’s voices once chosen', async () => {
		const store = fresh();
		store.tick(at(15, 0, 10)); await settle();
		expect(heard).toEqual([{ mark: 'hour', voice: 'bell', at: at(15, 0).toISOString() }]);
		expect(context.oscillators).toHaveLength(2);
		store.applyBellPreset('clock');
		store.tick(at(15, 30, 5)); await settle();
		expect(heard.at(-1)).toMatchObject({ mark: 'half', voice: 'chime' });
		store.tick(at(16, 0, 5)); await settle();
		expect(heard.at(-1)).toMatchObject({ mark: 'hour', voice: 'bowl' });
		expect(store.lastChime).toEqual({ mark: 'hour', at: at(16, 0).toISOString() });
		// The preset changed voices only, and they persist.
		expect(new PlannerStore().settings.bellSounds?.marks?.quarter).toEqual({ voice: 'bell' });
	});

	it('never takes a minute it couldn’t sound, so another tab can ring it, and never rings it twice', async () => {
		const locked = new FakeAudioContext({ running: false, allowResume: false });
		setAudioContextFactory(fakeFactory(locked));
		const lockedTab = fresh();
		lockedTab.tick(at(15, 0, 10)); await settle();
		expect(locked.oscillators).toHaveLength(0);
		expect(heard).toEqual([]);
		setAudioContextFactory(fakeFactory(context));
		const otherTab = new PlannerStore();
		otherTab.tick(at(15, 0, 40)); await settle();
		expect(heard).toHaveLength(1);
		// A reload in the same minute finds it rung.
		const reloaded = new PlannerStore();
		reloaded.tick(at(15, 0, 50)); await settle();
		expect(heard).toHaveLength(1);
	});

	it('plays a block’s bell after the chime it shares a minute with, in one sequence, and counts the hour', async () => {
		const store = fresh();
		store.updateBellSounds({ countHours: true });
		const today = store.getDayShape(at(15, 0));
		store.saveDayPlan('2026-10-18', [{ id: 'b', startTime: '15:00', endTime: '16:00', title: 'Walk', bellId: 'meal' }], today?.name);
		store.tick(at(15, 0, 5)); await settle();
		const starts = context.oscillators.map(oscillator => oscillator.startedAt!);
		// Bell (2), three strikes (6 partials each), then the meal bell (2) after them.
		expect(context.oscillators).toHaveLength(2 + 3 * 6 + 2);
		const meal = context.oscillators.slice(-2);
		expect(meal.map(oscillator => oscillator.frequency.events[0].value)).toEqual([523.25, 659.25]);
		expect(Math.min(...meal.map(oscillator => oscillator.startedAt!))).toBeGreaterThan(Math.max(...starts.slice(0, -2)));
	});

	it('keeps volume and pause on this device, and rests while paused', async () => {
		const store = fresh();
		store.setBellVolume(0.35);
		store.pauseBells(at(15, 30, 45));
		expect(store.bellPausedUntil).toBe(at(15, 30).toISOString());
		const restored = new PlannerStore();
		expect(restored.bellVolume).toBe(0.35);
		expect(restored.bellPausedUntil).toBe(at(15, 30).toISOString());
		expect('bellVolume' in restored.settings).toBe(false);
		store.tick(at(15, 15, 5)); await settle();
		expect(heard).toEqual([]);
		// The minute the pause ends rings.
		store.tick(at(15, 30, 5)); await settle();
		expect(heard).toHaveLength(1);
		store.pauseBells(null);
		expect(new PlannerStore().bellPausedUntil).toBeNull();
		store.setBellVolume(Number.NaN);
		expect(store.bellVolume).toBe(0.35);
	});

	it('follows another tab’s pause and volume on this device', () => {
		const store = fresh();
		const stop = store.startClock();
		localStorage.setItem('planner.bellPause.v1', JSON.stringify(at(16, 0).toISOString()));
		window.dispatchEvent(new StorageEvent('storage', { key: 'planner.bellPause.v1' }));
		localStorage.setItem('planner.bellVolume.v1', JSON.stringify(0.2));
		window.dispatchEvent(new StorageEvent('storage', { key: 'planner.bellVolume.v1' }));
		expect(store.bellPausedUntil).toBe(at(16, 0).toISOString());
		expect(store.bellVolume).toBe(0.2);
		stop();
	});

	it('sounds a due reminder only if a sound was chosen, once per device, even across a reload', async () => {
		const store = fresh();
		const loop = store.createOpenLoop('Reply to Mom')!;
		store.createLoopReminder(loop.id, at(15, 7).toISOString());
		store.tick(at(15, 7, 10)); await settle();
		expect(heard).toEqual([]);
		store.setMarkSound('reminder', { voice: 'pip' });
		const second = store.createLoopReminder(loop.id, at(15, 8).toISOString())!;
		store.tick(at(15, 8, 10)); await settle();
		expect(heard).toEqual([{ mark: 'reminder', voice: 'pip', at: at(15, 8, 10).toISOString() }]);
		const reloaded = new PlannerStore();
		reloaded.tick(at(15, 8, 40)); await settle();
		expect(heard).toHaveLength(1);
		expect(localStorage.getItem('planner.reminderRung.v1')).toContain(second.id);
	});

	it('previews a mark on request, ignoring quiet hours and pauses', async () => {
		const store = fresh();
		store.pauseBells(at(23, 0));
		vi.setSystemTime(at(23, 30));
		store.applyBellPreset('westminster');
		await expect(store.previewMark('half')).resolves.toBe('scheduled');
		// Two phrases at half past.
		expect(context.oscillators).toHaveLength(2 * 4 * 6);
		store.setMarkSound('sample', { voice: 'silent' });
		await expect(store.previewMark('sample')).resolves.toBe('silent');
	});
});
