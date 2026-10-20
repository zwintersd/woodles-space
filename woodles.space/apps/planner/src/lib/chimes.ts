import type { BellMark, BellSoundSettings, Block, PlannerSettings } from './types';
import { isBellVoice, type BellVoiceId } from './bellVoices';
import { isQuietMinute } from './reminders';
import { timeToMinutes } from './utils';

/**
 * Which bell rings when. Pure: the store's clock calls `dueChime` and plays
 * what comes back, so every rule here is testable without audio or timers.
 * Bell settings arrive from storage and from other devices running other
 * versions, so every field is validated here, on read, and never rewritten.
 */

export type MarkSound = { voice: BellVoiceId; volume: number };

export const BELL_MARKS: { id: BellMark; name: string; minutes: string }[] = [
	{ id: 'hour', name: 'on the hour', minutes: ':00' },
	{ id: 'half', name: 'half past', minutes: ':30' },
	{ id: 'quarter', name: 'quarters', minutes: ':15 :45' },
	{ id: 'sample', name: 'other samples', minutes: '' },
	{ id: 'blockStart', name: 'block starts', minutes: 'when a planned block begins' },
	{ id: 'leadTime', name: 'before a block', minutes: 'lead time before a block' },
	{ id: 'reminder', name: 'loop reminders', minutes: 'when a reminder you set comes due' }
];

export const CLOCK_MARKS = ['hour', 'half', 'quarter', 'sample'] as const;
export type ClockMark = (typeof CLOCK_MARKS)[number];

/**
 * Classic is how Carillon has always sounded: the same bell at every mark,
 * the lead-time bell a little lower and quieter. Nobody's bells change until
 * they choose.
 */
export const DEFAULT_MARK_SOUNDS: Record<BellMark, MarkSound> = {
	hour: { voice: 'bell', volume: 1 },
	half: { voice: 'bell', volume: 1 },
	quarter: { voice: 'bell', volume: 1 },
	sample: { voice: 'bell', volume: 1 },
	blockStart: { voice: 'bell', volume: 1 },
	leadTime: { voice: 'soft-bell', volume: 0.9 },
	reminder: { voice: 'silent', volume: 1 }
};

export const BELL_PRESETS: { id: string; name: string; description: string; voices: Record<ClockMark, BellVoiceId> }[] = [
	{ id: 'classic', name: 'classic', description: 'one bell for every mark', voices: { hour: 'bell', half: 'bell', quarter: 'bell', sample: 'bell' } },
	{ id: 'clock', name: 'clock face', description: 'a bowl on the hour, a chime at half past', voices: { hour: 'bowl', half: 'chime', quarter: 'bell', sample: 'pip' } },
	{ id: 'westminster', name: 'westminster', description: 'the clock-tower tune, one phrase per quarter', voices: { hour: 'westminster', half: 'westminster', quarter: 'westminster', sample: 'pip' } }
];

export const INTERVAL_OPTIONS = [5, 10, 15, 30, 60];
export const DEFAULT_BELL_VOLUME = 0.8;

export function cleanVolume(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function marksOf(sounds: BellSoundSettings | undefined): Partial<Record<BellMark, { voice?: unknown; volume?: unknown }>> {
	const marks = sounds?.marks;
	return marks && typeof marks === 'object' && !Array.isArray(marks) ? marks : {};
}

export function markSound(sounds: BellSoundSettings | undefined, mark: BellMark): MarkSound {
	const chosen = marksOf(sounds)[mark];
	const entry = chosen && typeof chosen === 'object' ? chosen : {};
	const fallback = DEFAULT_MARK_SOUNDS[mark];
	return { voice: isBellVoice(entry.voice) ? entry.voice : fallback.voice, volume: cleanVolume(entry.volume, fallback.volume) };
}

/** A mark sounds only with a voice and some level; 0% is as silent as Silent. */
export function audible(sound: MarkSound): boolean {
	return sound.voice !== 'silent' && sound.volume > 0;
}

export function countsHours(sounds: BellSoundSettings | undefined): boolean {
	return sounds?.countHours === true;
}

export function chimesBetweenSamples(sounds: BellSoundSettings | undefined): boolean {
	return sounds?.chimeBetweenSamples === true;
}

/** Which preset the clock marks currently match, if any. */
export function matchingPreset(sounds: BellSoundSettings | undefined): string | null {
	return BELL_PRESETS.find(preset => CLOCK_MARKS.every(mark => markSound(sounds, mark).voice === preset.voices[mark]))?.id ?? null;
}

/** "HH:MM" or the fallback — a garbled quiet hour must not mean "never quiet". */
export function cleanTime(value: unknown, fallback: string): string {
	return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

/** A whole number of minutes from 1 to a day; anything else reads as fifteen. */
export function cleanInterval(value: unknown): number {
	const minutes = typeof value === 'number' ? Math.round(value) : NaN;
	return Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440 ? minutes : 15;
}

/**
 * Sampling bells follow Today's rows, which start at the wake anchor and
 * step by the interval; the clock face names the ones that land on it.
 */
export function onSamplingGrid(minuteOfDay: number, interval: number, wakeAnchor: string): boolean {
	const step = cleanInterval(interval);
	const wake = timeToMinutes(cleanTime(wakeAnchor, '00:00'));
	return (((minuteOfDay - wake) % step) + step) % step === 0;
}

/** The clock-face mark for a minute of the day, if a chime belongs there. */
export function chimeMark(minuteOfDay: number, interval: number, chimeBetweenSamples = false, wakeAnchor = '00:00'): ClockMark | null {
	const sampling = onSamplingGrid(minuteOfDay, interval, wakeAnchor);
	const quarter = minuteOfDay % 15 === 0;
	if (!sampling && !(chimeBetweenSamples && quarter)) return null;
	if (minuteOfDay % 60 === 0) return 'hour';
	if (minuteOfDay % 30 === 0) return 'half';
	if (quarter) return 'quarter';
	return 'sample';
}

function markFor(minuteOfDay: number, settings: PlannerSettings): ClockMark | null {
	return chimeMark(minuteOfDay, settings.samplingIntervalMinutes, chimesBetweenSamples(settings.bellSounds), settings.wakeAnchor);
}

/** Which clock marks can ring at all with these settings — the panel shows only those. */
export function reachableMarks(settings: PlannerSettings): Set<ClockMark> {
	const found = new Set<ClockMark>();
	for (let minute = 0; minute < 1440 && found.size < 4; minute++) {
		const mark = markFor(minute, settings);
		if (mark) found.add(mark);
	}
	return found;
}

/** The quarter-hour minutes the sampling grid skips, e.g. [":15", ":45"]. */
export function skippedQuarters(settings: PlannerSettings): string[] {
	const skipped = new Set<string>();
	for (let minute = 0; minute < 1440; minute += 15) {
		if (!onSamplingGrid(minute, settings.samplingIntervalMinutes, settings.wakeAnchor)) skipped.add(`:${String(minute % 60).padStart(2, '0')}`);
	}
	return [':00', ':15', ':30', ':45'].filter(label => skipped.has(label));
}

/** Minutes past the hour that are samples but not quarters, e.g. ":05 :10 :20". */
export function sampleMinutes(settings: PlannerSettings): string[] {
	const found = new Set<number>();
	for (let minute = 0; minute < 1440; minute++) {
		if (markFor(minute, settings) === 'sample') found.add(minute % 60);
	}
	return [...found].sort((a, b) => a - b).map(minute => `:${String(minute).padStart(2, '0')}`);
}

export type ChimePart = {
	mark: BellMark;
	sound: MarkSound;
	/** A block's own registry bell (e.g. `meal`), heard while block starts use the default bell. */
	blockBellId?: string;
	/** Hours to strike after the voice, when counting the hour. */
	strikeHour?: number;
};

export type ChimeEvent = {
	/** The minute it belongs to. */
	at: Date;
	/** The first part's mark, for status lines. */
	mark: BellMark;
	/** The clock chime first, then a block's bell after it. */
	parts: ChimePart[];
};

function clockPart(minute: Date, settings: PlannerSettings): ChimePart | null {
	const mark = markFor(minute.getHours() * 60 + minute.getMinutes(), settings);
	if (!mark) return null;
	const sound = markSound(settings.bellSounds, mark);
	const strikeHour = mark === 'hour' && countsHours(settings.bellSounds) && sound.volume > 0 ? minute.getHours() : undefined;
	if (!audible(sound) && strikeHour === undefined) return null;
	return { mark, sound, strikeHour };
}

/**
 * A block start, or else a bell `leadTimeMinutes` before one — looked up on
 * the day the block is on, so a just-after-midnight block still gets its
 * warning the evening before. The person's choice decides: Silent silences
 * every block, a chosen voice rings for every block, and a block's own bell
 * (meal, wind-down) is heard only while block starts use the default bell.
 */
function blockPart(minute: Date, settings: PlannerSettings, blocksFor: (date: Date) => Block[]): ChimePart | null {
	const sounds = settings.bellSounds;
	const minuteOfDay = minute.getHours() * 60 + minute.getMinutes();
	const starting = blocksFor(minute).find(block => timeToMinutes(block.startTime) === minuteOfDay);
	if (starting) {
		const sound = markSound(sounds, 'blockStart');
		if (audible(sound)) return { mark: 'blockStart', sound, blockBellId: sound.voice === DEFAULT_MARK_SOUNDS.blockStart.voice ? starting.bellId : undefined };
	}
	const lead = Math.round(settings.leadTimeMinutes);
	if (!Number.isFinite(lead) || lead <= 0) return null;
	const target = new Date(minute.getTime() + lead * 60_000);
	const targetMinute = target.getHours() * 60 + target.getMinutes();
	if (!blocksFor(target).some(block => timeToMinutes(block.startTime) === targetMinute)) return null;
	const sound = markSound(sounds, 'leadTime');
	return audible(sound) ? { mark: 'leadTime', sound } : null;
}

/** Every bell for one wall-clock minute: the clock chime, then any block bell. */
export function chimeAt(minute: Date, settings: PlannerSettings, blocksFor: (date: Date) => Block[]): ChimeEvent | null {
	const parts = [clockPart(minute, settings), blockPart(minute, settings, blocksFor)].filter((part): part is ChimePart => part !== null);
	return parts.length ? { at: minute, mark: parts[0].mark, parts } : null;
}

/**
 * Off, paused on this device, or quiet hours. A pause more than a day ahead
 * (a skewed clock) is treated as a day.
 */
export function bellsResting(settings: PlannerSettings, now: Date, pausedUntil: Date | null = null): 'off' | 'paused' | 'quiet' | null {
	if (settings.bellsEnabled !== true) return 'off';
	if (pausedUntil && Number.isFinite(pausedUntil.getTime()) && pausedUntil.getTime() > now.getTime() && pausedUntil.getTime() - now.getTime() <= 36 * 60 * 60_000) return 'paused';
	const minute = now.getHours() * 60 + now.getMinutes();
	if (isQuietMinute(minute, cleanTime(settings.quietHoursStart, '22:00'), cleanTime(settings.quietHoursEnd, '07:00'))) return 'quiet';
	return null;
}

export function startOfMinute(date: Date): Date {
	const minute = new Date(date);
	minute.setSeconds(0, 0);
	return minute;
}

/** "Until morning" is the next wake time after now, never more than a day away. */
export function nextWake(now: Date, wakeAnchor: string): Date {
	const minutes = timeToMinutes(cleanTime(wakeAnchor, '07:00'));
	const wake = new Date(now);
	wake.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
	if (wake.getTime() <= now.getTime()) wake.setDate(wake.getDate() + 1);
	return wake;
}

export const CHIME_GRACE_MINUTES = 2;

type Plan = { settings: PlannerSettings; blocksFor: (date: Date) => Block[]; pausedUntil?: Date | null };

/**
 * Background tabs may tick late, so look back over every minute since the
 * last check — but never further than a short grace window, so waking a
 * laptop doesn't ring an hour-old bell. Only the latest bell in the window
 * rings; a minute is never rung twice.
 */
export function dueChime(input: Plan & { lastChecked: Date | null; now: Date }): ChimeEvent | null {
	const current = startOfMinute(input.now);
	const earliest = new Date(current.getTime() - CHIME_GRACE_MINUTES * 60_000);
	const after = input.lastChecked ? startOfMinute(input.lastChecked) : new Date(current.getTime() - 60_000);
	let cursor = new Date(Math.max(after.getTime() + 60_000, earliest.getTime()));
	let found: ChimeEvent | null = null;
	while (cursor.getTime() <= current.getTime()) {
		if (!bellsResting(input.settings, cursor, input.pausedUntil ?? null)) found = chimeAt(cursor, input.settings, input.blocksFor) ?? found;
		cursor = new Date(cursor.getTime() + 60_000);
	}
	return found;
}

/**
 * The next few bells that will actually ring, for the panel and the Today
 * status line — the same rules as the clock, read forward.
 */
export function upcomingChimes(input: Plan & { now: Date; count?: number; horizonMinutes?: number }): ChimeEvent[] {
	const found: ChimeEvent[] = [];
	const count = input.count ?? 4;
	const cache = new Map<string, Block[]>();
	const blocksFor = (date: Date) => {
		const key = date.toDateString();
		if (!cache.has(key)) cache.set(key, input.blocksFor(date));
		return cache.get(key)!;
	};
	let cursor = new Date(startOfMinute(input.now).getTime() + 60_000);
	const end = cursor.getTime() + (input.horizonMinutes ?? 24 * 60) * 60_000;
	while (found.length < count && cursor.getTime() < end) {
		if (!bellsResting(input.settings, cursor, input.pausedUntil ?? null)) {
			const event = chimeAt(cursor, input.settings, blocksFor);
			if (event) found.push(event);
		}
		cursor = new Date(cursor.getTime() + 60_000);
	}
	return found;
}

export const CHIME_CLAIM = 'planner.bellRungMinute.v1';

/**
 * One ring per minute per device: a second tab, or a reload inside the same
 * minute, finds the minute already claimed. Keyed by the absolute instant,
 * so the repeated hour when clocks fall back is still two minutes. Claimed
 * only after the bell actually sounded, so a locked tab never blocks one
 * that can play.
 */
export function bellMinuteClaimed(minute: Date, key = CHIME_CLAIM): boolean {
	try {
		return typeof localStorage !== 'undefined' && localStorage.getItem(key) === startOfMinute(minute).toISOString();
	} catch {
		return false;
	}
}

export function claimBellMinute(minute: Date, key = CHIME_CLAIM): void {
	try {
		if (typeof localStorage !== 'undefined') localStorage.setItem(key, startOfMinute(minute).toISOString());
	} catch {
		// Storage unavailable: nothing to share with other tabs.
	}
}

const REMINDER_RUNG = 'planner.reminderRung.v1';

/** Reminder sounds already played on this device, by `id@dueAt`; bounded, never synced. */
export function reminderRung(key: string): boolean {
	try {
		const rung = JSON.parse(localStorage.getItem(REMINDER_RUNG) ?? '[]');
		return Array.isArray(rung) && rung.includes(key);
	} catch {
		return false;
	}
}

export function markReminderRung(keys: string[]): void {
	try {
		const rung = JSON.parse(localStorage.getItem(REMINDER_RUNG) ?? '[]');
		const list = Array.isArray(rung) ? rung.filter((item): item is string => typeof item === 'string') : [];
		localStorage.setItem(REMINDER_RUNG, JSON.stringify([...list.filter(item => !keys.includes(item)), ...keys].slice(-200)));
	} catch {
		// Storage unavailable.
	}
}
