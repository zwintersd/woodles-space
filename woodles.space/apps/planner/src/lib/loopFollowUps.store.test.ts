// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlannerStore } from './store.svelte';

describe('recurrence, reminders, corrections, and finer attribution', () => {
	let store: PlannerStore;
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-18T14:07:23.456Z'));
		store = new PlannerStore();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('edits a loop’s name and recurrence on its own clock without touching lifecycle', () => {
		const loop = store.createOpenLoop('Shower')!;
		store.recordLoopEvent({ loopId: loop.id, type: 'closed' });
		vi.setSystemTime(new Date('2026-10-18T14:10:00.000Z'));
		const edited = store.updateOpenLoop(loop.id, { title: ' Showering ', recurring: true, rhythmDays: '2' })!;
		expect(edited).toMatchObject({ title: 'Showering', recurring: true, rhythmDays: 2, status: 'resolved', editedAt: '2026-10-18T14:10:00.000Z' });
		expect(store.updateOpenLoop(loop.id, { title: '  ' })).toBeNull();
		store.updateOpenLoop(loop.id, { recurring: false });
		const restored = new PlannerStore().openLoops[0];
		expect(restored.title).toBe('Showering');
		expect([restored.recurring, restored.rhythmDays, restored.remindAfterClosure]).toEqual([undefined, undefined, undefined]);
		expect(store.loopEvents.map(event => event.type)).toEqual(['noticed', 'closed']);
	});

	it('treats each closure of a recurring loop as one cycle and never reopens it by itself', () => {
		const loop = store.createOpenLoop('Shower')!;
		store.updateOpenLoop(loop.id, { recurring: true, rhythmDays: 1 });
		store.recordLoopEvent({ loopId: loop.id, type: 'closed' });
		vi.setSystemTime(new Date('2026-10-21T14:00:00.000Z'));
		store.tick();
		expect(store.openLoops[0].status).toBe('resolved');
		expect(store.loopReminders).toEqual([]);
		store.recordLoopEvent({ loopId: loop.id, type: 'reopened' });
		store.recordLoopEvent({ loopId: loop.id, type: 'closed' });
		expect(store.loopEvents.filter(event => event.type === 'closed')).toHaveLength(2);
		expect(store.openLoops[0]).toMatchObject({ status: 'resolved', resolution: 'completed' });
	});

	it('adds a between-cycles reminder only when asked, once per closure', () => {
		const loop = store.createOpenLoop('Shower')!;
		store.updateOpenLoop(loop.id, { recurring: true, rhythmDays: 2, remindAfterClosure: true });
		const closure = store.recordLoopEvent({ loopId: loop.id, type: 'closed', occurredAt: '2026-10-18T08:00:00.000Z' })!;
		expect(store.loopReminders).toEqual([expect.objectContaining({ id: `reminder-after-${closure.id}`, afterEventId: closure.id, dueAt: '2026-10-20T08:00:00.000Z' })]);
		store.updateOpenLoop(loop.id, { title: 'Showering' });
		expect(store.loopReminders).toHaveLength(1);
		expect(store.getDueReminders(new Date('2026-10-20T08:00:00.000Z')).map(reminder => reminder.id)).toEqual([`reminder-after-${closure.id}`]);
		// The need returning answers the reminder.
		store.recordLoopEvent({ loopId: loop.id, type: 'reopened' });
		expect(store.getDueReminders(new Date('2026-10-20T08:00:00.000Z'))).toEqual([]);
		store.updateOpenLoop(loop.id, { remindAfterClosure: false });
		store.recordLoopEvent({ loopId: loop.id, type: 'closed' });
		expect(store.loopReminders).toHaveLength(1);
	});

	it('corrects an event time while keeping entry time, first time, and lifecycle order', () => {
		const loop = store.createOpenLoop('Reply to Mom')!;
		const closure = store.recordLoopEvent({ loopId: loop.id, type: 'closed' })!;
		vi.setSystemTime(new Date('2026-10-18T15:00:00.000Z'));
		const corrected = store.updateLoopEvent(closure.id, { occurredAt: '2026-10-18T11:30:00.000Z', note: ' Sent a short reply ' })!;
		expect(corrected).toMatchObject({
			occurredAt: '2026-10-18T11:30:00.000Z', recordedAt: '2026-10-18T14:07:23.456Z', originalOccurredAt: '2026-10-18T14:07:23.456Z',
			updatedAt: '2026-10-18T15:00:00.000Z', note: 'Sent a short reply'
		});
		store.updateLoopEvent(closure.id, { occurredAt: '2026-10-18T11:45:00.000Z' });
		const restored = new PlannerStore();
		expect(restored.loopEvents.find(event => event.id === closure.id)?.originalOccurredAt).toBe('2026-10-18T14:07:23.456Z');
		// Moving the closure before the noticing doesn't reorder lifecycle: entry order decides.
		expect(restored.openLoops[0]).toMatchObject({ status: 'resolved', resolvedAt: '2026-10-18T11:45:00.000Z' });
		expect(store.updateLoopEvent(closure.id, { occurredAt: '2026-10-19T09:00:00.000Z' })).toBeNull();
		expect(store.updateLoopEvent(closure.id, { occurredAt: 'not a time' })).toBeNull();
		expect(store.updateLoopEvent('missing', { note: 'x' })).toBeNull();
	});

	it('re-attributes only observations, never lifecycle events', () => {
		const laundry = store.createOpenLoop('Laundry')!;
		const mom = store.createOpenLoop('Reply to Mom')!;
		const notice = store.recordLoopEvent({ type: 'noticed', note: 'Something unfinished' })!;
		expect(store.updateLoopEvent(notice.id, { loopId: laundry.id })?.loopId).toBe(laundry.id);
		expect(store.updateLoopEvent(notice.id, { loopId: null })?.loopId).toBeUndefined();
		expect(store.updateLoopEvent(notice.id, { loopId: 'missing' })).toBeNull();
		const pause = store.recordLoopEvent({ loopId: laundry.id, type: 'paused' })!;
		expect(store.updateLoopEvent(pause.id, { loopId: mom.id })).toBeNull();
		expect(store.updateLoopEvent(pause.id, { note: 'Waiting for the dryer' })?.loopId).toBe(laundry.id);
		expect(store.openLoops.find(loop => loop.id === laundry.id)?.status).toBe('paused');
	});

	it('moves a between-cycles reminder with its closure’s corrected time', () => {
		const loop = store.createOpenLoop('Water plants')!;
		store.updateOpenLoop(loop.id, { recurring: true, rhythmDays: 3, remindAfterClosure: true });
		const closure = store.recordLoopEvent({ loopId: loop.id, type: 'closed', occurredAt: '2026-10-18T09:00:00.000Z' })!;
		store.updateLoopEvent(closure.id, { occurredAt: '2026-10-17T09:00:00.000Z' });
		expect(store.loopReminders[0].dueAt).toBe('2026-10-20T09:00:00.000Z');
	});

	it('sets, moves, and finishes plain reminders that never repeat', () => {
		const loop = store.createOpenLoop('Reply to Mom')!;
		expect(store.createLoopReminder(loop.id, '2026-10-18T10:00:00.000Z')).toBeNull();
		expect(store.createLoopReminder('missing', '2026-10-18T18:00:00.000Z')).toBeNull();
		const reminder = store.createLoopReminder(loop.id, '2026-10-18T18:00:00.000Z', ' just say hi ')!;
		expect(reminder.note).toBe('just say hi');
		expect(store.getDueReminders(new Date('2026-10-18T17:59:00.000Z'))).toEqual([]);
		expect(store.getDueReminders(new Date('2026-10-18T18:00:00.000Z'))).toHaveLength(1);
		store.moveLoopReminder(reminder.id, new Date('2026-10-18T19:00:00.000Z'));
		expect(store.getDueReminders(new Date('2026-10-18T18:30:00.000Z'))).toEqual([]);
		store.endLoopReminder(reminder.id, 'acknowledged');
		const restored = new PlannerStore();
		expect(restored.loopReminders[0]).toMatchObject({ ending: 'acknowledged', dueAt: '2026-10-18T19:00:00.000Z' });
		expect(restored.getDueReminders(new Date('2026-10-25T00:00:00.000Z'))).toEqual([]);
		// Closing the loop answers any reminder that was waiting on it.
		const second = store.createLoopReminder(loop.id, '2026-10-18T20:00:00.000Z')!;
		store.recordLoopEvent({ loopId: loop.id, type: 'closed' });
		expect(store.getLiveReminders(loop.id).some(item => item.id === second.id)).toBe(false);
		expect(store.createLoopReminder(loop.id, '2026-10-18T21:00:00.000Z')).toBeNull();
	});

	it('uses browser notifications only when switched on, outside quiet hours, once per due time', () => {
		const shown: { title: string; body?: string }[] = [];
		class FakeNotification {
			static permission = 'granted';
			constructor(title: string, options?: { body?: string }) { shown.push({ title, body: options?.body }); }
		}
		vi.stubGlobal('Notification', FakeNotification);
		store.updateSettings({ quietHoursStart: '22:00', quietHoursEnd: '07:00' });
		const loop = store.createOpenLoop('Reply to Mom')!;
		const reminder = store.createLoopReminder(loop.id, new Date(2026, 9, 19, 6, 30).toISOString())!;
		vi.setSystemTime(new Date(2026, 9, 19, 6, 45));
		store.tick();
		expect(shown).toEqual([]);
		store.updateSettings({ reminderNotifications: true });
		store.tick();
		expect(shown).toEqual([]);
		vi.setSystemTime(new Date(2026, 9, 19, 7, 5));
		store.tick();
		store.tick();
		expect(shown).toEqual([{ title: 'Carillon', body: 'A reminder you asked for: Reply to Mom' }]);
		const updatedAt = store.loopReminders[0].updatedAt;
		expect(store.loopReminders[0]).toMatchObject({ notifiedFor: reminder.dueAt, updatedAt });
		store.moveLoopReminder(reminder.id, new Date(2026, 9, 19, 7, 6));
		vi.setSystemTime(new Date(2026, 9, 19, 7, 7));
		store.tick();
		expect(shown).toHaveLength(2);
	});

	it('remembers dismissed offers without duplicates', () => {
		store.dismissOffer('theme:laundry');
		store.dismissOffer('theme:laundry');
		expect(new PlannerStore().settings.dismissedOffers).toEqual(['theme:laundry']);
	});

	it('saves chosen links on single noticings, separately from the moment’s links', () => {
		const shoulders = store.createOpenLoop('Reply to Mom')!;
		const other = store.createOpenLoop('Laundry')!;
		const input = { date: '2026-10-18', intervalStart: '10:05', kind: 'elsewhere' as const, label: 'At my desk' };
		store.observeInterval({ ...input, linkedLoopIds: [other.id], noticings: [
			{ channel: 'body', note: ' pit in stomach ', linkedLoopIds: [shoulders.id, shoulders.id] },
			{ channel: 'attention', note: 'drifting', linkedLoopIds: [] }
		] });
		const saved = new PlannerStore().getObservation(input.date, input.intervalStart)!;
		expect(saved.noticings).toEqual([{ channel: 'body', note: 'pit in stomach', linkedLoopIds: [shoulders.id] }, { channel: 'attention', note: 'drifting' }]);
		expect(saved.linkedLoopIds).toEqual([other.id]);
		expect(store.loopEvents.filter(event => event.sourceMomentId)).toEqual([]);
	});
});
