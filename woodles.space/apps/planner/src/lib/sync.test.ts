// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mergePlannerBlobs } from './sync.svelte';
import type {
	IntervalKind,
	IntervalObservation,
	PlannerBlob,
	SporeEvent
} from './types';

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
