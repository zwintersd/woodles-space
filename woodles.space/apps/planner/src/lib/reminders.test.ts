import { describe, expect, it } from 'vitest';
import { cleanRhythmDays, dueReminders, isQuietMinute, laterTime, liveReminders, mergeLoopReminder, reminderIsLive, rhythmDueAt } from './reminders';
import type { LoopEvent, LoopReminder, OpenLoop } from './types';

const loop = (status: OpenLoop['status'], extra: Partial<OpenLoop> = {}): OpenLoop => ({
	id: 'loop', title: 'Reply to Mom', status, createdAt: '2026-10-18T09:00:00.000Z', updatedAt: '2026-10-18T09:00:00.000Z', ...extra
});
const reminder = (extra: Partial<LoopReminder> = {}): LoopReminder => ({
	id: 'reminder', loopId: 'loop', dueAt: '2026-10-18T12:00:00.000Z', createdAt: '2026-10-18T10:00:00.000Z', updatedAt: '2026-10-18T10:00:00.000Z', ...extra
});
const event = (id: string, type: LoopEvent['type'], recordedAt: string): LoopEvent => ({ id, loopId: 'loop', type, occurredAt: recordedAt, recordedAt });

describe('reminders only about what is still unresolved', () => {
	it('keeps a plain reminder live while the loop is open, and lets it lapse once resolved', () => {
		expect(reminderIsLive(reminder(), [loop('open')], [])).toBe(true);
		expect(reminderIsLive(reminder(), [loop('paused')], [])).toBe(true);
		expect(reminderIsLive(reminder(), [loop('resolved')], [event('c', 'closed', '2026-10-18T11:00:00.000Z')])).toBe(false);
		// Reopening later doesn't revive a reminder the closure already answered.
		const reopened = [event('c', 'closed', '2026-10-18T11:00:00.000Z'), event('o', 'reopened', '2026-10-18T13:00:00.000Z')];
		expect(reminderIsLive(reminder(), [loop('open')], reopened)).toBe(false);
		expect(reminderIsLive(reminder({ endedAt: '2026-10-18T12:01:00.000Z', ending: 'acknowledged' }), [loop('open')], [])).toBe(false);
		expect(reminderIsLive(reminder(), [], [])).toBe(false);
	});

	it('keeps a between-cycles reminder only while that closure still stands', () => {
		const closure = event('c', 'closed', '2026-10-18T11:00:00.000Z');
		const between = reminder({ afterEventId: 'c' });
		const shower = loop('resolved', { recurring: true });
		expect(reminderIsLive(between, [shower], [closure])).toBe(true);
		expect(reminderIsLive(between, [loop('open', { recurring: true })], [closure, event('o', 'reopened', '2026-10-18T13:00:00.000Z')])).toBe(false);
	});

	it('lists due reminders in time order', () => {
		const reminders = [reminder({ id: 'b', dueAt: '2026-10-18T13:00:00.000Z' }), reminder({ id: 'a' }), reminder({ id: 'c', dueAt: '2026-10-19T09:00:00.000Z' })];
		expect(liveReminders(reminders, [loop('open')], []).map(item => item.id)).toEqual(['a', 'b', 'c']);
		expect(dueReminders(reminders, [loop('open')], [], new Date('2026-10-18T13:00:00.000Z')).map(item => item.id)).toEqual(['a', 'b']);
	});
});

describe('times and rhythms', () => {
	it('names later as a specific time', () => {
		const now = new Date(2026, 9, 18, 14, 20);
		expect(laterTime('hour', now).getTime() - now.getTime()).toBe(60 * 60 * 1000);
		expect(laterTime('day', now).getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
		expect(laterTime('evening', now)).toEqual(new Date(2026, 9, 18, 18, 0));
		expect(laterTime('evening', new Date(2026, 9, 18, 17, 45))).toEqual(new Date(2026, 9, 18, 18, 45));
		expect(laterTime('tomorrow', now, '07:30')).toEqual(new Date(2026, 9, 19, 7, 30));
	});

	it('handles quiet hours across midnight', () => {
		expect(isQuietMinute(23 * 60, '22:00', '07:00')).toBe(true);
		expect(isQuietMinute(6 * 60 + 59, '22:00', '07:00')).toBe(true);
		expect(isQuietMinute(7 * 60, '22:00', '07:00')).toBe(false);
		expect(isQuietMinute(13 * 60, '12:00', '14:00')).toBe(true);
		expect(isQuietMinute(14 * 60, '12:00', '14:00')).toBe(false);
	});

	it('accepts half-day rhythms and nothing nonsensical', () => {
		expect(cleanRhythmDays('2')).toBe(2);
		expect(cleanRhythmDays(1.3)).toBe(1.5);
		expect(cleanRhythmDays('')).toBeUndefined();
		expect(cleanRhythmDays(0)).toBeUndefined();
		expect(cleanRhythmDays(400)).toBeUndefined();
		expect(cleanRhythmDays('soon')).toBeUndefined();
		expect(rhythmDueAt('2026-10-18T08:00:00.000Z', 1.5)).toBe('2026-10-19T20:00:00.000Z');
	});
});

describe('merging reminders between devices', () => {
	it('keeps an ended reminder ended against a later stale edit', () => {
		const ended = reminder({ endedAt: '2026-10-18T12:05:00.000Z', ending: 'acknowledged', updatedAt: '2026-10-18T12:05:00.000Z' });
		const moved = reminder({ dueAt: '2026-10-18T15:00:00.000Z', updatedAt: '2026-10-18T12:10:00.000Z' });
		expect(mergeLoopReminder(moved, ended).endedAt).toBe('2026-10-18T12:05:00.000Z');
		expect(mergeLoopReminder(ended, moved).endedAt).toBe('2026-10-18T12:05:00.000Z');
	});

	it('takes the later edit and never notifies twice for the same time', () => {
		const notified = reminder({ notifiedFor: '2026-10-18T12:00:00.000Z' });
		const edited = reminder({ note: 'Just say hi', updatedAt: '2026-10-18T11:00:00.000Z' });
		expect(mergeLoopReminder(notified, edited)).toMatchObject({ note: 'Just say hi', notifiedFor: '2026-10-18T12:00:00.000Z' });
		const snoozed = reminder({ dueAt: '2026-10-18T13:00:00.000Z', updatedAt: '2026-10-18T12:01:00.000Z' });
		expect(mergeLoopReminder(notified, snoozed).notifiedFor).toBeUndefined();
	});
});
