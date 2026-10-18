// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mergePlannerBlobs } from './sync.svelte';
import type {
	IntervalKind,
	IntervalObservation,
	PlannerBlob,
	SporeEvent,
	OpenLoop,
	LoopEvent,
	FiveContactsRound
} from './types';
import { activeContacts } from './openLoops';

function observation(
	intervalStart: string,
	kind: IntervalKind,
	updatedAt: string
): IntervalObservation {
	const id = `observation-2026-07-30@${intervalStart}`;
	return {
		id,
		date: '2026-07-30',
		intervalStart,
		source: 'live',
		kind,
		label: kind,
		capturedAt: '2026-07-30T12:00:00.000Z',
		updatedAt
	};
}

function spore(item: IntervalObservation): SporeEvent {
	return {
		id: `carillon-spore-${item.id}`,
		observationId: item.id,
		date: item.date,
		kind: item.kind,
		amount: 1,
		createdAt: item.capturedAt
	};
}

function blob(overrides: Partial<PlannerBlob> = {}): PlannerBlob {
	return {
		shapes: [],
		weekPattern: { days: ['', '', '', '', '', '', ''] },
		days: {},
		obligations: [],
		rituals: [],
		tasks: [],
		settings: {
			flourishEnabled: true,
			quietHoursStart: '22:00',
			quietHoursEnd: '07:00',
			leadTimeMinutes: 5,
			samplingIntervalMinutes: 15,
			bellsEnabled: true,
			dayCycleEnabled: true,
			fixedPaletteMode: null,
			onboardingComplete: true,
			wakeAnchor: '07:00',
			sleepAnchor: '22:30',
			tone: 'gentle'
		},
		domains: [],
		...overrides
	};
}

describe('mergePlannerBlobs', () => {
	it('unions loop history and derives resolution from events instead of a stale loop snapshot', () => {
		const loop: OpenLoop = { id: 'loop-1', title: 'Reply to Mom', status: 'open', createdAt: '2026-10-18T13:00:00.000Z', updatedAt: '2026-10-18T13:00:00.000Z' };
		const closed: LoopEvent = { id: 'closed', loopId: loop.id, type: 'closed', occurredAt: '2026-10-18T13:03:01.000Z', recordedAt: '2026-10-18T13:03:02.000Z', sequence: 2 };
		const unrelated: LoopEvent = { id: 'body-note', type: 'noticed', note: 'Tight shoulders', occurredAt: '2026-10-18T13:04:00.000Z', recordedAt: '2026-10-18T13:04:00.000Z', sequence: 3 };
		const local = blob({ openLoops: [loop], loopEvents: [closed] });
		const stale = blob({ openLoops: [{ ...loop, updatedAt: '2026-10-18T14:00:00.000Z' }], loopEvents: [unrelated] });
		const merged = mergePlannerBlobs(local, stale);
		expect(merged.loopEvents).toHaveLength(2);
		expect(merged.openLoops?.[0]).toMatchObject({ status: 'resolved', resolution: 'completed', resolvedAt: closed.occurredAt });
		expect(mergePlannerBlobs(stale, local).openLoops).toEqual(merged.openLoops);
		const reopened: LoopEvent = { ...closed, id: 'reopened', type: 'reopened', sequence: 4 };
		expect(mergePlannerBlobs(merged, blob({ openLoops: [loop], loopEvents: [reopened] })).openLoops?.[0]).toMatchObject({ status: 'open', resolvedAt: undefined, resolution: undefined });
	});

	it('preserves optional notebook collections when a device still has an older blob shape', () => {
		const old = observation('09:00', 'rest', '2026-07-30T13:00:00.000Z');
		old.details = { mood: 3, energy: 2, coping: 4 };
		const local = blob({
			observations: [old],
			openLoops: [{ id: 'loop-1', title: 'A wanted feature', status: 'open', createdAt: '2026-10-18T13:00:00.000Z', updatedAt: '2026-10-18T13:00:00.000Z' }],
			closureReflections: [{ id: 'reflection-1', loopEventId: 'closed-1', descriptors: ['No noticeable change'], recordedAt: '2026-10-18T14:00:00.000Z' }],
			fiveContactsRounds: [{ id: 'round-1', startedAt: '2026-10-18T14:00:00.000Z', updatedAt: '2026-10-18T14:00:00.000Z', status: 'active', contacts: [] }]
		});
		const merged = mergePlannerBlobs(local, blob());
		expect(merged.observations).toEqual([old]);
		expect(merged.openLoops).toEqual(local.openLoops);
		expect(merged.closureReflections).toEqual(local.closureReflections);
		expect(merged.fiveContactsRounds).toEqual(local.fiveContactsRounds);
	});

	it('unions contacts inside a shared round and retains Undo against a newer stale snapshot', () => {
		const round: FiveContactsRound = { id: 'round-1', startedAt: '2026-10-18T13:00:00.000Z', updatedAt: '2026-10-18T13:01:00.000Z', status: 'active', contacts: [{ id: 'contact-1', at: '2026-10-18T13:01:00.000Z' }] };
		const remote = { ...round, updatedAt: '2026-10-18T13:02:00.000Z', contacts: [{ id: 'contact-2', at: '2026-10-18T13:02:00.000Z' }] };
		const merged = mergePlannerBlobs(blob({ fiveContactsRounds: [round] }), blob({ fiveContactsRounds: [remote] }));
		expect(activeContacts(merged.fiveContactsRounds![0]).map(contact => contact.id)).toEqual(['contact-1', 'contact-2']);
		const undone = { ...round, contacts: [{ ...round.contacts[0], removedAt: '2026-10-18T13:03:00.000Z' }] };
		const stale = { ...round, updatedAt: '2026-10-18T14:00:00.000Z' };
		const withUndo = mergePlannerBlobs(blob({ fiveContactsRounds: [undone] }), blob({ fiveContactsRounds: [stale] }));
		expect(activeContacts(withUndo.fiveContactsRounds![0])).toHaveLength(0);
		expect(withUndo.fiveContactsRounds![0].contacts[0].removedAt).toBe('2026-10-18T13:03:00.000Z');
	});

	it('retains concurrent offline overflow as evidence while admitting five and respecting early exit', () => {
		const round: FiveContactsRound = { id: 'round-1', startedAt: '2026-10-18T13:00:00.000Z', updatedAt: '2026-10-18T13:03:00.000Z', status: 'active', contacts: [] };
		const first = { ...round, contacts: [1, 2, 3].map(index => ({ id: `contact-${index}`, at: `2026-10-18T13:0${index}:00.000Z` })) };
		const second = { ...round, contacts: [4, 5, 6].map(index => ({ id: `contact-${index}`, at: `2026-10-18T13:0${index}:00.000Z` })) };
		const merged = mergePlannerBlobs(blob({ fiveContactsRounds: [first] }), blob({ fiveContactsRounds: [second] }));
		expect(merged.fiveContactsRounds![0].contacts).toHaveLength(6);
		expect(activeContacts(merged.fiveContactsRounds![0])).toHaveLength(5);
		expect(merged.fiveContactsRounds![0].status).toBe('completed');
		expect(merged.fiveContactsRounds![0].contacts.find(contact => contact.id === 'contact-6')?.overflow).toBe(true);
		const undone: FiveContactsRound = {
			...merged.fiveContactsRounds![0], status: 'active', updatedAt: '2026-10-18T13:07:00.000Z',
			contacts: merged.fiveContactsRounds![0].contacts.map(contact => contact.id === 'contact-5' ? { ...contact, removedAt: '2026-10-18T13:07:00.000Z' } : contact)
		};
		for (const result of [mergePlannerBlobs(blob({ fiveContactsRounds: [undone] }), blob({ fiveContactsRounds: [second] })), mergePlannerBlobs(blob({ fiveContactsRounds: [second] }), blob({ fiveContactsRounds: [undone] }))]) {
			expect(activeContacts(result.fiveContactsRounds![0])).toHaveLength(4);
			expect(result.fiveContactsRounds![0].status).toBe('active');
			expect(result.fiveContactsRounds![0].contacts.find(contact => contact.id === 'contact-6')?.overflow).toBe(true);
		}
		const stopped: FiveContactsRound = { ...round, status: 'stopped', endedAt: '2026-10-18T13:02:00.000Z' };
		expect(mergePlannerBlobs(merged, blob({ fiveContactsRounds: [stopped] })).fiveContactsRounds![0].status).toBe('stopped');
	});

	it('merges reflection changes and explicit clearing independently from later round activity in either direction', () => {
		const round: FiveContactsRound = { id: 'round-1', startedAt: '2026-10-18T13:00:00.000Z', updatedAt: '2026-10-18T13:01:00.000Z', status: 'active', contacts: [] };
		const reflection: FiveContactsRound = { ...round, reflectionNote: 'A little lighter', reflectionUpdatedAt: '2026-10-18T13:01:00.000Z' };
		const staleActivity: FiveContactsRound = { ...round, updatedAt: '2026-10-18T13:03:00.000Z', status: 'stopped', endedAt: '2026-10-18T13:03:00.000Z' };
		for (const [first, second] of [[reflection, staleActivity], [staleActivity, reflection]]) {
			const result = mergePlannerBlobs(blob({ fiveContactsRounds: [first] }), blob({ fiveContactsRounds: [second] })).fiveContactsRounds![0];
			expect(result.reflectionNote).toBe('A little lighter');
			expect(result.reflectionUpdatedAt).toBe('2026-10-18T13:01:00.000Z');
			expect(result.status).toBe('stopped');
		}
		const cleared: FiveContactsRound = { ...reflection, reflectionNote: undefined, reflectionUpdatedAt: '2026-10-18T13:02:00.000Z', updatedAt: '2026-10-18T13:02:00.000Z' };
		const staleReflection = { ...reflection, updatedAt: '2026-10-18T14:00:00.000Z' };
		for (const [first, second] of [[cleared, staleReflection], [staleReflection, cleared]]) {
			const result = mergePlannerBlobs(blob({ fiveContactsRounds: [first] }), blob({ fiveContactsRounds: [second] })).fiveContactsRounds![0];
			expect(result.reflectionNote).toBeUndefined();
			expect(result.reflectionUpdatedAt).toBe('2026-10-18T13:02:00.000Z');
		}
	});
	it('preserves observations captured concurrently on two devices', () => {
		const phoneMark = observation('09:00', 'clinic', '2026-07-30T13:00:00.000Z');
		const desktopMark = observation('09:15', 'writing', '2026-07-30T13:15:00.000Z');

		const merged = mergePlannerBlobs(
			blob({ observations: [phoneMark], spores: [spore(phoneMark)] }),
			blob({ observations: [desktopMark], spores: [spore(desktopMark)] })
		);

		expect(merged.observations?.map((item) => item.id).sort()).toEqual(
			[phoneMark.id, desktopMark.id].sort()
		);
		expect(merged.spores?.map((item) => item.observationId).sort()).toEqual(
			[phoneMark.id, desktopMark.id].sort()
		);
	});

	it('takes the latest correction and reconciles its single Spore category', () => {
		const original = observation('09:30', 'writing', '2026-07-30T13:30:00.000Z');
		const correction: IntervalObservation = {
			...original,
			source: 'paper',
			kind: 'movement',
			label: 'walked to the next building',
			updatedAt: '2026-07-30T18:00:00.000Z'
		};

		const merged = mergePlannerBlobs(
			blob({ observations: [original], spores: [spore(original)] }),
			blob({ observations: [correction], spores: [spore(correction)] })
		);

		expect(merged.observations).toEqual([correction]);
		expect(merged.spores).toHaveLength(1);
		expect(merged.spores?.[0]).toMatchObject({
			observationId: correction.id,
			kind: 'movement',
			amount: 1
		});
	});

	it('keeps newer task, pile choice, and discarded Surge tombstones', () => {
		const local = blob({
			tasks: [
				{
					id: 'task-1',
					title: 'promoted plan',
					status: 'done',
					createdAt: '2026-07-29T12:00:00.000Z',
					updatedAt: '2026-07-30T15:00:00.000Z'
				}
			],
			days: {
				'2026-07-30': {
					date: '2026-07-30',
					dayShapeId: 'starter-writing',
					updatedAt: '2026-07-30T14:00:00.000Z'
				}
			},
			surgeDrafts: [
				{
					id: 'surge-1',
					title: 'large plan',
					body: '',
					status: 'discarded',
					createdAt: '2026-07-29T23:00:00.000Z',
					updatedAt: '2026-07-30T16:00:00.000Z',
					discardedAt: '2026-07-30T16:00:00.000Z',
					createdSessionId: 'phone'
				}
			]
		});
		const remote = blob({
			tasks: [
				{
					id: 'task-1',
					title: 'promoted plan',
					status: 'open',
					createdAt: '2026-07-29T12:00:00.000Z',
					updatedAt: '2026-07-30T13:00:00.000Z'
				}
			],
			days: {
				'2026-07-30': {
					date: '2026-07-30',
					dayShapeId: 'starter-office',
					updatedAt: '2026-07-30T12:00:00.000Z'
				}
			},
			surgeDrafts: [
				{
					id: 'surge-1',
					title: 'large plan',
					body: '',
					status: 'captured',
					createdAt: '2026-07-29T23:00:00.000Z',
					updatedAt: '2026-07-29T23:00:00.000Z',
					createdSessionId: 'phone'
				}
			]
		});

		const merged = mergePlannerBlobs(local, remote);

		expect(merged.tasks[0]?.status).toBe('done');
		expect(merged.days['2026-07-30']?.dayShapeId).toBe('starter-writing');
		expect(merged.surgeDrafts?.[0]?.status).toBe('discarded');
	});

	it('carries a Thinking About reference through the merge', () => {
		// The link rides `latestMutable`, which takes the whole newer task — so
		// this is really asserting that a device without the field can't blank
		// it on a device that has it, which is how an optional field usually
		// gets lost.
		const linked = blob({
			tasks: [
				{
					id: 'task-1',
					title: 'read a chapter',
					status: 'open',
					thinkingAboutEntryId: 'entry-piranesi',
					createdAt: '2026-08-08T12:00:00.000Z',
					updatedAt: '2026-08-09T15:00:00.000Z'
				}
			]
		});
		const older = blob({
			tasks: [
				{
					id: 'task-1',
					title: 'read a chapter',
					status: 'open',
					createdAt: '2026-08-08T12:00:00.000Z',
					updatedAt: '2026-08-08T12:00:00.000Z'
				}
			]
		});

		expect(mergePlannerBlobs(linked, older).tasks[0]?.thinkingAboutEntryId).toBe(
			'entry-piranesi'
		);
		expect(mergePlannerBlobs(older, linked).tasks[0]?.thinkingAboutEntryId).toBe(
			'entry-piranesi'
		);
	});

	it('hydrates a blob written before the reference existed', () => {
		// Every planner blob in the wild predates this field.
		const legacy = blob({
			tasks: [
				{
					id: 'task-1',
					title: 'an older task',
					status: 'open',
					createdAt: '2026-07-01T12:00:00.000Z'
				}
			]
		});

		const merged = mergePlannerBlobs(legacy, legacy);
		expect(merged.tasks[0]?.thinkingAboutEntryId).toBeUndefined();
		expect(merged.tasks[0]?.title).toBe('an older task');
	});

	it('unions sleep logs from two devices and keeps the newer correction', () => {
		const local = blob({
			sleepLogs: [
				{
					id: 'sleep-2026-07-29',
					date: '2026-07-29',
					quality: 'okay',
					recordedAt: '2026-07-29T07:00:00.000Z',
					updatedAt: '2026-07-29T07:00:00.000Z'
				},
				{
					id: 'sleep-2026-07-30',
					date: '2026-07-30',
					quality: 'rough',
					recordedAt: '2026-07-30T07:00:00.000Z',
					updatedAt: '2026-07-30T07:00:00.000Z'
				}
			]
		});
		const remote = blob({
			sleepLogs: [
				{
					id: 'sleep-2026-07-30',
					date: '2026-07-30',
					quality: 'good',
					recordedAt: '2026-07-30T07:00:00.000Z',
					updatedAt: '2026-07-30T09:00:00.000Z'
				}
			]
		});

		const merged = mergePlannerBlobs(local, remote);

		expect(merged.sleepLogs?.map((log) => log.id).sort()).toEqual([
			'sleep-2026-07-29',
			'sleep-2026-07-30'
		]);
		expect(merged.sleepLogs?.find((log) => log.id === 'sleep-2026-07-30')?.quality).toBe('good');
	});

	it('unions ongoing signals and keeps the newer end-date correction', () => {
		const local = blob({
			signals: [
				{
					id: 'signal-1',
					kind: 'illness',
					date: '2026-07-28',
					createdAt: '2026-07-28T08:00:00.000Z',
					updatedAt: '2026-07-28T08:00:00.000Z'
				}
			]
		});
		const remote = blob({
			signals: [
				{
					id: 'signal-1',
					kind: 'illness',
					date: '2026-07-28',
					endDate: '2026-07-30',
					createdAt: '2026-07-28T08:00:00.000Z',
					updatedAt: '2026-07-30T18:00:00.000Z'
				},
				{
					id: 'signal-2',
					kind: 'payday',
					date: '2026-08-15',
					createdAt: '2026-07-30T08:00:00.000Z',
					updatedAt: '2026-07-30T08:00:00.000Z'
				}
			]
		});

		const merged = mergePlannerBlobs(local, remote);

		expect(merged.signals?.map((entry) => entry.id).sort()).toEqual(['signal-1', 'signal-2']);
		expect(merged.signals?.find((entry) => entry.id === 'signal-1')?.endDate).toBe('2026-07-30');
	});
});
