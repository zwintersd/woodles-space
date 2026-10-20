// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	BELL_PRESETS, audible, bellMinuteClaimed, bellsResting, chimeAt, chimeMark, claimBellMinute, cleanInterval, cleanTime,
	dueChime, markReminderRung, markSound, matchingPreset, nextWake, onSamplingGrid, reachableMarks, reminderRung,
	sampleMinutes, skippedQuarters, upcomingChimes
} from './chimes';
import type { BellSoundSettings, Block, PlannerSettings } from './types';

const base: PlannerSettings = {
	flourishEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '07:00', leadTimeMinutes: 5,
	samplingIntervalMinutes: 15, bellsEnabled: true, dayCycleEnabled: true, fixedPaletteMode: null,
	onboardingComplete: true, wakeAnchor: '07:00', sleepAnchor: '22:30', tone: 'minimal'
};
const settings = (patch: Partial<PlannerSettings> = {}): PlannerSettings => ({ ...base, ...patch });
const voices = (marks: BellSoundSettings['marks'], extra: Partial<BellSoundSettings> = {}) => settings({ bellSounds: { marks, ...extra } });
const clockFace = voices({ hour: { voice: 'bowl' }, half: { voice: 'chime' }, quarter: { voice: 'bell' }, sample: { voice: 'pip' } });
const at = (hours: number, minutes: number, seconds = 0, day = 18) => new Date(2026, 9, day, hours, minutes, seconds);
const block = (startTime: string, extra: Partial<Block> = {}): Block => ({ id: startTime, startTime, endTime: '23:00', title: 'Block', ...extra });
const none = () => [];
const blocks = (...list: Block[]) => () => list;
const parts = (event: ReturnType<typeof chimeAt>) => event?.parts.map(part => part.mark) ?? [];

describe('which mark a minute belongs to', () => {
	it('names the hour, half, quarters, and other samples on the sampling grid', () => {
		expect([0, 15, 30, 45, 5].map(minute => chimeMark(9 * 60 + minute, 5))).toEqual(['hour', 'quarter', 'half', 'quarter', 'sample']);
		expect([0, 10, 15, 30].map(minute => chimeMark(9 * 60 + minute, 10))).toEqual(['hour', 'sample', null, 'half']);
		expect([0, 15, 30, 45].map(minute => chimeMark(9 * 60 + minute, 30))).toEqual(['hour', null, 'half', null]);
		expect([0, 15, 30].map(minute => chimeMark(9 * 60 + minute, 60))).toEqual(['hour', null, null]);
	});

	it('follows Today’s rows, which start at the wake time', () => {
		expect(onSamplingGrid(7 * 60 + 5, 15, '06:50')).toBe(true);
		expect(onSamplingGrid(7 * 60, 15, '06:50')).toBe(false);
		expect(chimeMark(7 * 60 + 5, 15, false, '06:50')).toBe('sample');
		expect(chimeMark(7 * 60, 15, false, '06:50')).toBeNull();
		// An hourly grid from a 6:30 wake rings at half past, where Today's rows turn over.
		expect(chimeMark(9 * 60 + 30, 60, false, '06:30')).toBe('half');
		expect(chimeMark(9 * 60, 60, false, '06:30')).toBeNull();
		// Rows continue across midnight on the same step.
		expect(onSamplingGrid(15, 45, '07:00')).toBe(true);
		expect(onSamplingGrid(0, 45, '07:00')).toBe(false);
		expect(chimeMark(7 * 60 + 45, 45, false, '07:00')).toBe('quarter');
	});

	it('can ring the clock face between samples when asked', () => {
		expect([0, 15, 30, 45, 20].map(minute => chimeMark(9 * 60 + minute, 60, true))).toEqual(['hour', 'quarter', 'half', 'quarter', null]);
		expect(chimeMark(9 * 60 + 15, 10, true)).toBe('quarter');
		expect(chimeMark(7 * 60, 15, true, '06:50')).toBe('hour');
	});

	it('reads garbled intervals and times safely', () => {
		expect([0, -5, Number.NaN, 2000, 7.6].map(cleanInterval)).toEqual([15, 15, 15, 15, 8]);
		expect(chimeMark(9 * 60 + 15, 0)).toBe('quarter');
		expect(chimeMark(9 * 60 + 1, -5)).toBeNull();
		expect([cleanTime('07:30', 'x'), cleanTime('', '07:00'), cleanTime('garbage', '22:00'), cleanTime('24:00', '22:00'), cleanTime(9, '22:00')]).toEqual(['07:30', '07:00', '22:00', '22:00', '22:00']);
		// A garbled quiet hour falls back to the default rather than meaning "never quiet".
		expect(bellsResting(settings({ quietHoursStart: 'garbage' }), at(23, 0))).toBe('quiet');
	});

	it('knows which marks can ring, which quarters the grid skips, and which minutes are other samples', () => {
		expect([...reachableMarks(settings({ samplingIntervalMinutes: 15 }))].sort()).toEqual(['half', 'hour', 'quarter']);
		expect([...reachableMarks(settings({ samplingIntervalMinutes: 10 }))].sort()).toEqual(['half', 'hour', 'sample']);
		expect([...reachableMarks(settings({ samplingIntervalMinutes: 60 }))]).toEqual(['hour']);
		expect([...reachableMarks(voices({}, { chimeBetweenSamples: true, ...{} }))].sort()).toEqual(['half', 'hour', 'quarter']);
		expect(skippedQuarters(settings({ samplingIntervalMinutes: 15 }))).toEqual([]);
		expect(skippedQuarters(settings({ samplingIntervalMinutes: 30 }))).toEqual([':15', ':45']);
		expect(skippedQuarters(settings({ samplingIntervalMinutes: 60 }))).toEqual([':15', ':30', ':45']);
		expect(skippedQuarters(settings({ samplingIntervalMinutes: 15, wakeAnchor: '06:50' }))).toEqual([':00', ':15', ':30', ':45']);
		expect(sampleMinutes(settings({ samplingIntervalMinutes: 10 }))).toEqual([':10', ':20', ':40', ':50']);
		expect(sampleMinutes(settings({ samplingIntervalMinutes: 15 }))).toEqual([]);
	});
});

describe('sounds for each mark', () => {
	it('keeps Carillon’s classic bells until someone chooses otherwise', () => {
		for (const mark of ['hour', 'half', 'quarter', 'sample', 'blockStart'] as const) expect(markSound(undefined, mark)).toEqual({ voice: 'bell', volume: 1 });
		expect(markSound(undefined, 'leadTime')).toEqual({ voice: 'soft-bell', volume: 0.9 });
		expect(markSound(undefined, 'reminder').voice).toBe('silent');
		expect(matchingPreset(undefined)).toBe('classic');
	});

	it('reads values from other devices and versions without trusting them', () => {
		const odd = { marks: { hour: { voice: 'harp', volume: 7 }, half: { voice: 'wood', volume: Number.NaN }, quarter: null, sample: 'pip' } } as unknown as BellSoundSettings;
		expect(markSound(odd, 'hour')).toEqual({ voice: 'bell', volume: 1 });
		expect(markSound(odd, 'half')).toEqual({ voice: 'wood', volume: 1 });
		expect(markSound(odd, 'quarter')).toEqual({ voice: 'bell', volume: 1 });
		expect(markSound(odd, 'sample')).toEqual({ voice: 'bell', volume: 1 });
		expect(markSound({ marks: [] } as unknown as BellSoundSettings, 'hour').voice).toBe('bell');
		expect(markSound({ marks: { hour: { voice: 'chime', volume: -1 } } }, 'hour')).toEqual({ voice: 'chime', volume: 0 });
	});

	it('treats a level of zero as silent, and matches presets by voice', () => {
		expect(audible({ voice: 'bell', volume: 0 })).toBe(false);
		expect(audible({ voice: 'silent', volume: 1 })).toBe(false);
		expect(audible({ voice: 'pip', volume: 0.05 })).toBe(true);
		expect(matchingPreset(clockFace.bellSounds)).toBe('clock');
		expect(BELL_PRESETS.map(preset => preset.id)).toEqual(['classic', 'clock', 'westminster']);
		expect(matchingPreset({ marks: { hour: { voice: 'wood' } } })).toBeNull();
	});
});

describe('resolving one minute', () => {
	it('gives each clock-face mark its own sound and counts the hour when asked', () => {
		const chosen = settings({ bellSounds: { ...clockFace.bellSounds, countHours: true } });
		expect(chimeAt(at(15, 0), chosen, none)?.parts).toEqual([{ mark: 'hour', sound: { voice: 'bowl', volume: 1 }, strikeHour: 15 }]);
		expect(chimeAt(at(15, 30), chosen, none)?.parts[0]).toMatchObject({ mark: 'half', sound: { voice: 'chime' }, strikeHour: undefined });
		expect(chimeAt(at(15, 45), chosen, none)?.parts[0]).toMatchObject({ mark: 'quarter', sound: { voice: 'bell' } });
		expect(chimeAt(at(15, 7), chosen, none)).toBeNull();
		expect(chimeAt(at(15, 0), settings({ bellSounds: { marks: {}, countHours: 'yes' as unknown as boolean } }), none)?.parts[0].strikeHour).toBeUndefined();
	});

	it('still counts the hour when the hour’s own sound is silent, but not at zero level', () => {
		expect(chimeAt(at(15, 0), voices({ hour: { voice: 'silent' } }, { countHours: true }), none)?.parts[0]).toMatchObject({ mark: 'hour', sound: { voice: 'silent' }, strikeHour: 15 });
		expect(chimeAt(at(15, 0), voices({ hour: { voice: 'silent' } }), none)).toBeNull();
		expect(chimeAt(at(15, 0), voices({ hour: { voice: 'bowl', volume: 0 } }, { countHours: true }), none)).toBeNull();
	});

	it('rings a block’s bell after the chime it shares a minute with', () => {
		expect(parts(chimeAt(at(12, 0), settings(), blocks(block('12:00', { bellId: 'meal' }))))).toEqual(['hour', 'blockStart']);
		expect(chimeAt(at(12, 0), settings(), blocks(block('12:00', { bellId: 'meal' })))?.parts[1].blockBellId).toBe('meal');
		expect(parts(chimeAt(at(12, 7), settings(), blocks(block('12:07'))))).toEqual(['blockStart']);
		expect(parts(chimeAt(at(12, 10), settings(), blocks(block('12:15'))))).toEqual(['leadTime']);
		expect(parts(chimeAt(at(9, 55), settings({ samplingIntervalMinutes: 5 }), blocks(block('10:00'))))).toEqual(['sample', 'leadTime']);
		expect(parts(chimeAt(at(10, 0), settings({ samplingIntervalMinutes: 5 }), blocks(block('10:00'))))).toEqual(['hour', 'blockStart']);
	});

	it('lets the person’s choice for block starts win over a block’s own bell', () => {
		const meal = blocks(block('12:07', { bellId: 'meal' }));
		expect(chimeAt(at(12, 7), voices({ blockStart: { voice: 'silent' } }), meal)).toBeNull();
		expect(chimeAt(at(12, 7), voices({ blockStart: { voice: 'bell', volume: 0 } }), meal)).toBeNull();
		expect(chimeAt(at(12, 7), voices({ blockStart: { voice: 'wood' } }), meal)?.parts[0]).toMatchObject({ sound: { voice: 'wood' }, blockBellId: undefined });
		expect(chimeAt(at(12, 7), settings(), meal)?.parts[0].blockBellId).toBe('meal');
	});

	it('prefers a block start over another block’s lead time, and skips a lead time of zero', () => {
		expect(parts(chimeAt(at(12, 7), settings(), blocks(block('12:07'), block('12:12'))))).toEqual(['blockStart']);
		expect(chimeAt(at(12, 7), voices({ blockStart: { voice: 'silent' }, leadTime: { voice: 'silent' } }), blocks(block('12:07')))).toBeNull();
		expect(parts(chimeAt(at(12, 10), settings({ leadTimeMinutes: 0 }), blocks(block('12:10'))))).toEqual(['blockStart']);
	});

	it('warns before a just-after-midnight block from the evening before', () => {
		const byDay = (date: Date) => (date.getDate() === 19 ? [block('00:02')] : []);
		expect(parts(chimeAt(at(23, 57, 0, 18), settings({ samplingIntervalMinutes: 60 }), byDay))).toEqual(['leadTime']);
		expect(parts(chimeAt(at(0, 2, 0, 19), settings({ samplingIntervalMinutes: 60 }), byDay))).toEqual(['blockStart']);
	});
});

describe('resting', () => {
	it('rests when off, paused on this device, or in quiet hours across midnight', () => {
		expect(bellsResting(settings({ bellsEnabled: false }), at(12, 0))).toBe('off');
		expect(bellsResting(settings(), at(12, 0), at(13, 0))).toBe('paused');
		expect(bellsResting(settings(), at(13, 0), at(13, 0))).toBeNull();
		expect(bellsResting(settings(), at(12, 0), at(11, 0))).toBeNull();
		expect(bellsResting(settings(), at(12, 0), new Date('garbage'))).toBeNull();
		// A pause from a clock far ahead can't silence bells for good.
		expect(bellsResting(settings(), at(12, 0), at(12, 0, 0, 25))).toBeNull();
		expect(bellsResting(settings(), at(23, 0))).toBe('quiet');
		expect(bellsResting(settings(), at(6, 59))).toBe('quiet');
		expect(bellsResting(settings(), at(7, 0))).toBeNull();
	});

	it('pauses until morning means the next wake time, never more than a day away', () => {
		expect(nextWake(at(0, 30), '07:00')).toEqual(at(7, 0));
		expect(nextWake(at(13, 0), '07:00')).toEqual(at(7, 0, 0, 19));
		expect(nextWake(at(7, 0), '07:00')).toEqual(at(7, 0, 0, 19));
	});
});

describe('catching up on a late tick', () => {
	it('rings a bell a throttled tick stepped over, but nothing older than the grace window', () => {
		expect(dueChime({ lastChecked: at(14, 59, 50), now: at(15, 1, 5), settings: settings(), blocksFor: none })).toMatchObject({ mark: 'hour' });
		expect(dueChime({ lastChecked: at(14, 50), now: at(15, 4), settings: settings(), blocksFor: none })).toBeNull();
		expect(dueChime({ lastChecked: at(14, 50), now: at(15, 2), settings: settings(), blocksFor: none })).toMatchObject({ mark: 'hour' });
	});

	it('never rings the same minute twice and starts fresh on the first tick', () => {
		expect(dueChime({ lastChecked: at(15, 0, 10), now: at(15, 0, 40), settings: settings(), blocksFor: none })).toBeNull();
		expect(dueChime({ lastChecked: null, now: at(15, 0, 40), settings: settings(), blocksFor: none })).toMatchObject({ mark: 'hour' });
		expect(dueChime({ lastChecked: null, now: at(15, 1, 0), settings: settings(), blocksFor: none })).toBeNull();
	});

	it('rings only the latest bell in one late tick, across midnight, and skips resting minutes', () => {
		const leadOnly = dueChime({ lastChecked: at(14, 57), now: at(14, 59, 30), settings: settings({ samplingIntervalMinutes: 60 }), blocksFor: blocks(block('15:04')) });
		expect(leadOnly).toMatchObject({ mark: 'leadTime' });
		expect(dueChime({ lastChecked: at(14, 58), now: at(15, 0), settings: settings(), blocksFor: blocks(block('15:04')) })).toMatchObject({ mark: 'hour' });
		expect(dueChime({ lastChecked: at(21, 59), now: at(22, 0), settings: settings(), blocksFor: none })).toBeNull();
		expect(dueChime({ lastChecked: at(14, 59), now: at(15, 0), settings: settings(), blocksFor: none, pausedUntil: at(15, 30) })).toBeNull();
		const lateNight = settings({ quietHoursStart: '02:00', quietHoursEnd: '05:00' });
		expect(dueChime({ lastChecked: at(23, 59, 0, 18), now: at(0, 0, 30, 19), settings: lateNight, blocksFor: none })?.at).toEqual(at(0, 0, 0, 19));
	});
});

describe('reading ahead', () => {
	it('lists the next bells that will actually ring, past quiet hours and pauses', () => {
		const upcoming = upcomingChimes({ now: at(11, 50), settings: settings(), blocksFor: blocks(block('12:22')), count: 4 });
		expect(upcoming.map(event => [event.at.getHours(), event.at.getMinutes(), event.mark])).toEqual([[12, 0, 'hour'], [12, 15, 'quarter'], [12, 17, 'leadTime'], [12, 22, 'blockStart']]);
		expect(upcomingChimes({ now: at(21, 40), settings: settings(), blocksFor: none, count: 2 }).map(event => event.at.getHours())).toEqual([21, 7]);
		expect(upcomingChimes({ now: at(12, 0), settings: settings(), blocksFor: none, count: 1, pausedUntil: at(13, 5) })[0].at).toEqual(at(13, 15));
		expect(upcomingChimes({ now: at(12, 0), settings: settings({ bellsEnabled: false }), blocksFor: none })).toEqual([]);
	});

	it('agrees with the clock at every minute of a day', () => {
		const chosen = settings({ samplingIntervalMinutes: 10, bellSounds: { marks: {}, chimeBetweenSamples: true } });
		const plan = blocks(block('09:05'), block('13:42', { bellId: 'meal' }));
		const ahead = upcomingChimes({ now: at(6, 59), settings: chosen, blocksFor: plan, count: 1000, horizonMinutes: 15 * 60 });
		const rung = [];
		for (let minute = 7 * 60; minute < 22 * 60; minute++) {
			const now = at(Math.floor(minute / 60), minute % 60, 20);
			const event = dueChime({ lastChecked: new Date(now.getTime() - 60_000), now, settings: chosen, blocksFor: plan });
			if (event) rung.push(event);
		}
		expect(rung.map(event => event.at.toISOString())).toEqual(ahead.map(event => event.at.toISOString()));
	});
});

describe('one ring per device', () => {
	beforeEach(() => localStorage.clear());
	it('records a minute’s claim only when asked, and per key', () => {
		expect(bellMinuteClaimed(at(15, 0, 5))).toBe(false);
		claimBellMinute(at(15, 0, 5));
		expect(bellMinuteClaimed(at(15, 0, 40))).toBe(true);
		expect(bellMinuteClaimed(at(15, 15))).toBe(false);
		expect(bellMinuteClaimed(at(15, 0, 40), 'other')).toBe(false);
	});

	it('remembers sounded reminders across reloads, keeping only the latest two hundred', () => {
		expect(reminderRung('r1@x')).toBe(false);
		markReminderRung(['r1@x']);
		expect(reminderRung('r1@x')).toBe(true);
		markReminderRung(Array.from({ length: 205 }, (_, index) => `r${index + 2}@x`));
		expect(reminderRung('r1@x')).toBe(false);
		expect(reminderRung('r206@x')).toBe(true);
		localStorage.setItem('planner.reminderRung.v1', 'not json');
		expect(reminderRung('r1@x')).toBe(false);
		expect(() => markReminderRung(['r1@x'])).not.toThrow();
	});
});
