import type { LoopEvent, LoopReminder, OpenLoop } from './types';
import { latestLifecycleEvent } from './openLoops';
import { timeToMinutes } from './utils';

const DAY = 24 * 60 * 60 * 1000;

/**
 * A reminder only matters while what it is about is still unresolved.
 *
 * A between-cycles reminder (after a recurring loop closed) lapses once the
 * need is back or the loop changes again. A plain reminder lapses once the
 * loop resolves after the reminder was set — reopening later doesn't bring
 * back a reminder for a time that has passed.
 */
export function reminderIsLive(reminder: LoopReminder, loops: OpenLoop[], events: LoopEvent[]): boolean {
	if (reminder.endedAt) return false;
	const loop = loops.find(item => item.id === reminder.loopId);
	if (!loop) return false;
	if (reminder.afterEventId) {
		return loop.status === 'resolved' && latestLifecycleEvent(loop.id, events)?.id === reminder.afterEventId;
	}
	if (loop.status === 'resolved') return false;
	return !events.some(event => event.loopId === loop.id && (event.type === 'closed' || event.type === 'released') && event.recordedAt > reminder.createdAt);
}

export function liveReminders(reminders: LoopReminder[], loops: OpenLoop[], events: LoopEvent[]): LoopReminder[] {
	return reminders.filter(reminder => reminderIsLive(reminder, loops, events)).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
}

export function dueReminders(reminders: LoopReminder[], loops: OpenLoop[], events: LoopEvent[], now: Date): LoopReminder[] {
	return liveReminders(reminders, loops, events).filter(reminder => new Date(reminder.dueAt).getTime() <= now.getTime());
}

export function rhythmDueAt(occurredAt: string, rhythmDays: number): string {
	return new Date(new Date(occurredAt).getTime() + rhythmDays * DAY).toISOString();
}

/** Accepts half-day steps from half a day to a year; anything else is no rhythm. */
export function cleanRhythmDays(value: unknown): number | undefined {
	const days = typeof value === 'string' ? Number(value) : value;
	if (typeof days !== 'number' || !Number.isFinite(days)) return undefined;
	const rounded = Math.round(days * 2) / 2;
	return rounded >= 0.5 && rounded <= 365 ? rounded : undefined;
}

export type LaterChoice = 'hour' | 'evening' | 'tomorrow' | 'day';

/** "Later" is always a specific, visible time — never a vague nag. */
export function laterTime(choice: LaterChoice, now: Date, wakeAnchor = '08:00'): Date {
	const next = new Date(now);
	if (choice === 'hour') return new Date(now.getTime() + 60 * 60 * 1000);
	if (choice === 'day') return new Date(now.getTime() + DAY);
	if (choice === 'evening') {
		next.setHours(18, 0, 0, 0);
		return next.getTime() > now.getTime() + 30 * 60 * 1000 ? next : new Date(now.getTime() + 60 * 60 * 1000);
	}
	const minutes = timeToMinutes(wakeAnchor);
	next.setDate(next.getDate() + 1);
	next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
	return next;
}

export function isQuietMinute(minutes: number, quietStart: string, quietEnd: string): boolean {
	const start = timeToMinutes(quietStart);
	const end = timeToMinutes(quietEnd);
	return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/**
 * An ended reminder stays ended (like a deletion), otherwise the later edit
 * wins. Notification state is kept from whichever copy showed one for the
 * winning due time, so a merge never makes the same reminder ping twice.
 */
export function mergeLoopReminder(local: LoopReminder, remote: LoopReminder): LoopReminder {
	const winner = local.endedAt && !remote.endedAt ? local
		: remote.endedAt && !local.endedAt ? remote
		: local.updatedAt > remote.updatedAt ? local : remote;
	const other = winner === local ? remote : local;
	if (winner.notifiedFor !== winner.dueAt && other.notifiedFor === winner.dueAt) return { ...winner, notifiedFor: other.notifiedFor };
	return winner;
}
