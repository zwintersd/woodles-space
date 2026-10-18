// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlannerStore } from './store.svelte';
import { activeContacts } from './openLoops';

describe('optional observations, loops, and Five Contacts persistence', () => {
	let store: PlannerStore;
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-18T14:07:23.456Z'));
		store = new PlannerStore();
	});
	afterEach(() => vi.useRealTimers());

	it('leaves untouched ratings absent and preserves historical measurements on a plain edit', () => {
		const input = { date: '2026-10-18', intervalStart: '10:05', kind: 'elsewhere' as const, label: 'Watching a video' };
		const plain = store.observeInterval(input);
		expect(plain.details).toBeUndefined();
		expect(plain.trackerAnswers).toBeUndefined();
		store.observeInterval({ ...input, details: { mood: 3, energy: 1, coping: 5 } });
		store.observeInterval({ ...input, label: 'Still watching' });
		expect(new PlannerStore().getObservation(input.date, input.intervalStart)?.details).toEqual({ mood: 3, energy: 1, coping: 5 });
	});

	it('persists unlinked sensations and explicit empty category choices without inventing loop links', () => {
		const input = { date: '2026-10-18', intervalStart: '10:05', kind: 'elsewhere' as const, label: 'At my desk' };
		const noticings = [{ channel: 'body' as const, note: ' tight shoulders ' }, { channel: 'attention' as const, note: '' }];
		store.observeInterval({ ...input, noticings });
		noticings[0].note = 'Draft change';
		const saved = new PlannerStore().getObservation(input.date, input.intervalStart)!;
		expect(saved.noticings).toEqual([{ channel: 'body', note: 'tight shoulders' }, { channel: 'attention', note: '' }]);
		expect(saved.linkedLoopIds).toBeUndefined();
		expect(store.openLoops).toEqual([]);
		store.observeInterval({ ...input, label: 'Still here' });
		expect(store.intervalObservations[0].noticings).toEqual(saved.noticings);
	});

	it('preserves and explicitly clears optional links independently from observation content', () => {
		const loop = store.createOpenLoop('Reply to Mom')!;
		const input = { date: '2026-10-18', intervalStart: '10:05', kind: 'care' as const, label: 'Reading' };
		store.observeInterval({ ...input, linkedLoopIds: [loop.id, loop.id] });
		store.observeInterval({ ...input, label: 'Reading more' });
		expect(new PlannerStore().intervalObservations[0].linkedLoopIds).toEqual([loop.id]);
		store.observeInterval({ ...input, linkedLoopIds: [] });
		expect(new PlannerStore().intervalObservations[0].linkedLoopIds).toEqual([]);
		expect(store.openLoops[0].status).toBe('open');
	});

	it('keeps pause, closure, release, and reopening distinct even within the same millisecond', () => {
		const loop = store.createOpenLoop('Reply to Mom')!;
		expect(store.loopEvents).toHaveLength(1);
		store.recordLoopEvent({ loopId: loop.id, type: 'related_action', note: 'Read the message' });
		expect(store.openLoops[0].status).toBe('open');
		store.recordLoopEvent({ loopId: loop.id, type: 'paused' });
		expect(store.openLoops[0].status).toBe('paused');
		store.recordLoopEvent({ loopId: loop.id, type: 'closed', occurredAt: '2026-10-18T14:06:01.000Z' });
		expect(store.openLoops[0]).toMatchObject({ status: 'resolved', resolution: 'completed', resolvedAt: '2026-10-18T14:06:01.000Z' });
		expect(store.recordLoopEvent({ loopId: loop.id, type: 'closed' })).toBeNull();
		store.recordLoopEvent({ loopId: loop.id, type: 'reopened' });
		expect(store.openLoops[0]).toMatchObject({ status: 'open', resolution: undefined, resolvedAt: undefined });
		store.recordLoopEvent({ loopId: loop.id, type: 'released' });
		expect(new PlannerStore().openLoops[0]).toMatchObject({ status: 'resolved', resolution: 'released' });
		expect(store.loopEvents.filter(event => event.type === 'closed')).toHaveLength(1);
	});

	it('records actual event times separately from sample windows and allows unattributed noticing', () => {
		store.observeInterval({ date: '2026-10-18', intervalStart: '10:05', kind: 'elsewhere', label: 'Noticing' });
		const event = store.recordLoopEvent({ type: 'noticed', note: 'Something unfinished came to mind' })!;
		expect(event.loopId).toBeUndefined();
		expect(event.occurredAt).toBe('2026-10-18T14:07:23.456Z');
		expect(event.recordedAt).toBe('2026-10-18T14:07:23.456Z');
		expect(store.recordLoopEvent({ type: 'closed' })).toBeNull();
		expect(store.recordLoopEvent({ type: 'noticed', occurredAt: 'invalid' })).toBeNull();
	});

	it('allows skipped, unchanged, and unpleasant reflections without creating another demand', () => {
		const loop = store.createOpenLoop('Cancel a subscription')!;
		const event = store.recordLoopEvent({ loopId: loop.id, type: 'closed' })!;
		expect(store.closureReflections).toEqual([]);
		expect(store.saveClosureReflection(event.id, { descriptors: [] })).toBeNull();
		store.saveClosureReflection(event.id, { descriptors: ['No noticeable change'], nextFeelsPossible: 'rest' });
		store.saveClosureReflection(event.id, { descriptors: ['More tense'], note: 'No relief yet', nextFeelsPossible: 'nothing' });
		const restored = new PlannerStore();
		expect(restored.closureReflections).toHaveLength(1);
		expect(restored.closureReflections[0]).toMatchObject({ descriptors: ['More tense'], note: 'No relief yet', nextFeelsPossible: 'nothing' });
		expect(restored.tasks).toEqual([]);
		expect(restored.fiveContactsRounds).toEqual([]);
	});

	it('stops at five contacts, supports switching and Undo, and never closes linked loops', () => {
		const loop = store.createOpenLoop('Laundry')!;
		const round = store.startFiveContactsRound();
		expect(store.startFiveContactsRound().id).toBe(round.id);
		for (let index = 0; index < 5; index++) {
			expect(store.countContact(round.id, { note: index < 2 ? `Laundry ${index + 1}` : `Kitchen ${index - 1}`, linkedLoopId: index < 2 ? loop.id : undefined })).toBe(true);
		}
		expect(store.countContact(round.id)).toBe(false);
		expect(store.fiveContactsRounds[0].status).toBe('completed');
		expect(activeContacts(store.fiveContactsRounds[0]).map(contact => contact.note)).toEqual(['Laundry 1', 'Laundry 2', 'Kitchen 1', 'Kitchen 2', 'Kitchen 3']);
		store.undoContact(round.id);
		expect(activeContacts(store.fiveContactsRounds[0])).toHaveLength(4);
		expect(store.fiveContactsRounds[0].status).toBe('active');
		expect(store.countContact(round.id, { note: 'A small different contact' })).toBe(true);
		store.reflectFiveContactsRound(round.id, ' Nothing different ');
		const restored = new PlannerStore();
		expect(activeContacts(restored.fiveContactsRounds[0])).toHaveLength(5);
		expect(restored.fiveContactsRounds[0].reflectionNote).toBe('Nothing different');
		expect(restored.openLoops[0].status).toBe('open');
		expect(restored.loopEvents).toHaveLength(1);
		expect(restored.tasks).toEqual([]);
	});

	it('records early exit faithfully and starts another round only by explicit action', () => {
		const round = store.startFiveContactsRound();
		store.countContact(round.id);
		store.stopFiveContactsRound(round.id);
		expect(store.countContact(round.id)).toBe(false);
		expect(new PlannerStore().fiveContactsRounds[0]).toMatchObject({ status: 'stopped', endedAt: '2026-10-18T14:07:23.456Z' });
		expect(store.fiveContactsRounds).toHaveLength(1);
		expect(store.startFiveContactsRound().id).not.toBe(round.id);
	});

	it('keeps overflow as uncounted evidence after Undo and admits only an explicit new contact', () => {
		const round = store.startFiveContactsRound();
		for (let index = 0; index < 5; index++) store.countContact(round.id);
		store.fiveContactsRounds = [{ ...store.fiveContactsRounds[0], contacts: [...store.fiveContactsRounds[0].contacts, { id: 'offline-contact', at: '2026-10-18T14:08:00.000Z' }] }];
		store.undoContact(round.id);
		expect(activeContacts(store.fiveContactsRounds[0])).toHaveLength(4);
		expect(store.fiveContactsRounds[0].status).toBe('active');
		expect(store.fiveContactsRounds[0].contacts.find(contact => contact.id === 'offline-contact')?.overflow).toBe(true);
		expect(store.countContact(round.id, { note: 'Explicit fifth contact' })).toBe(true);
		expect(activeContacts(store.fiveContactsRounds[0])).toHaveLength(5);
		expect(store.fiveContactsRounds[0].status).toBe('completed');
		expect(activeContacts(store.fiveContactsRounds[0]).some(contact => contact.id === 'offline-contact')).toBe(false);
	});

	it('persists deliberate clearing of a round reflection with its own update timestamp', () => {
		const round = store.startFiveContactsRound();
		store.reflectFiveContactsRound(round.id, 'A little different');
		vi.setSystemTime(new Date('2026-10-18T14:09:00.000Z'));
		store.reflectFiveContactsRound(round.id, '');
		const restored = new PlannerStore().fiveContactsRounds[0];
		expect(restored.reflectionNote).toBeUndefined();
		expect(restored.reflectionUpdatedAt).toBe('2026-10-18T14:09:00.000Z');
	});
});
