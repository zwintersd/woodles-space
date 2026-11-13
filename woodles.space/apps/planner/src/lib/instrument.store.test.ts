// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlannerStore } from './store.svelte';
import type { DayShape } from './types';

const localStorageMock = (() => {
	let values: Record<string, string> = {};
	return {
		getItem: (key: string) => values[key] ?? null,
		setItem: (key: string, value: string) => {
			values[key] = value;
		},
		removeItem: (key: string) => {
			delete values[key];
		},
		clear: () => {
			values = {};
		},
		get length() {
			return Object.keys(values).length;
		}
	};
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Carillon instrument persistence', () => {
	let store: PlannerStore;

	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-30T13:00:00.000Z'));
		store = new PlannerStore();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('corrects a sampled interval in place', () => {
		const first = store.observeInterval({
			date: '2026-07-30',
			intervalStart: '09:15',
			kind: 'writing',
			label: 'drafting'
		});

		vi.setSystemTime(new Date('2026-07-30T13:20:00.000Z'));
		const corrected = store.observeInterval({
			date: '2026-07-30',
			intervalStart: '09:15',
			kind: 'movement',
			label: 'walked outside'
		});

		expect(corrected.id).toBe(first.id);
		expect(corrected.capturedAt).toBe(first.capturedAt);
		expect(corrected.updatedAt).not.toBe(first.updatedAt);
		expect(store.intervalObservations).toHaveLength(1);
		expect(store.intervalObservations[0]).toMatchObject({
			kind: 'movement',
			label: 'walked outside'
		});
	});

	it('records a recalled stretch as one sample', () => {
		const stretch = store.observeInterval({
			date: '2026-07-30',
			intervalStart: '09:00',
			kind: 'care',
			label: 'a slow morning',
			source: 'recall',
			intervalMinutes: 150
		});

		expect(stretch).toMatchObject({
			source: 'recall',
			intervalMinutes: 150,
			label: 'a slow morning'
		});
		expect(store.intervalObservations).toHaveLength(1);

		const corrected = store.observeInterval({
			date: '2026-07-30',
			intervalStart: '09:00',
			kind: 'rest',
			label: 'mostly resting'
		});

		expect(corrected).toMatchObject({ source: 'recall', intervalMinutes: 150 });
		expect(store.intervalObservations).toHaveLength(1);
	});

	it('round-trips paper provenance without changing the plan it annotates', () => {
		const clinicDay: DayShape = {
			id: 'clinic-day',
			name: 'clinic day',
			blocks: [
				{
					id: 'morning-clinic',
					startTime: '09:00',
					endTime: '10:00',
					title: 'morning sessions'
				}
			]
		};
		store.setDayShapes([clinicDay]);
		store.setWeekPattern({
			days: [
				'clinic-day',
				'clinic-day',
				'clinic-day',
				'clinic-day',
				'clinic-day',
				'clinic-day',
				'clinic-day'
			]
		});

		store.observeInterval({
			date: '2026-07-30',
			intervalStart: '09:15',
			kind: 'care',
			label: 'helped with a transition',
			source: 'paper'
		});

		const reloaded = new PlannerStore();
		expect(reloaded.getObservation('2026-07-30', '09:15')).toMatchObject({
			source: 'paper',
			kind: 'care',
			label: 'helped with a transition',
			plannedLabel: 'morning sessions'
		});
		expect(reloaded.dayShapes[0]?.blocks).toEqual(clinicDay.blocks);

		reloaded.setDayShapes([
			{
				...clinicDay,
				blocks: clinicDay.blocks.map((block) => ({
					...block,
					title: 'a plan changed later'
				}))
			}
		]);
		reloaded.observeInterval({
			date: '2026-07-30',
			intervalStart: '09:15',
			kind: 'writing',
			label: 'corrected from the paper sheet'
		});
		expect(reloaded.getObservation('2026-07-30', '09:15')).toMatchObject({
			source: 'paper',
			kind: 'writing',
			plannedLabel: 'morning sessions'
		});
	});

	it('keeps an originally open interval open in history after the plan changes', () => {
		const openDay: DayShape = { id: 'open-day', name: 'open day', blocks: [] };
		store.setDayShapes([openDay]);
		store.setWeekPattern({
			days: ['open-day', 'open-day', 'open-day', 'open-day', 'open-day', 'open-day', 'open-day']
		});
		store.observeInterval({
			date: '2026-07-30',
			intervalStart: '09:15',
			kind: 'rest'
		});

		store.setDayShapes([
			{
				...openDay,
				blocks: [
					{
						id: 'later-block',
						startTime: '09:00',
						endTime: '10:00',
						title: 'added after the sample'
					}
				]
			}
		]);
		store.observeInterval({
			date: '2026-07-30',
			intervalStart: '09:15',
			kind: 'movement'
		});

		expect(store.getObservation('2026-07-30', '09:15')).toMatchObject({
			kind: 'movement',
			plannedLabel: undefined
		});
	});
});

describe('Ideas explicit review', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('keeps archived drafts recoverable without touching the plan', () => {
		const captureSession = new PlannerStore();
		const draft = captureSession.addSurgeDraft(
			'build a second moon',
			'Captured here without becoming a commitment.'
		);

		captureSession.discardSurgeDraft(draft!.id);
		expect(captureSession.surgeDrafts[0]).toMatchObject({
			id: draft!.id,
			status: 'discarded'
		});
		expect(captureSession.surgeDrafts[0]?.discardedAt).toBeTruthy();
		expect(captureSession.tasks).toHaveLength(0);

		const reloaded = new PlannerStore();
		reloaded.restoreSurgeDraft(draft!.id);
		expect(reloaded.surgeDrafts[0]).toMatchObject({
			id: draft!.id,
			status: 'captured',
			discardedAt: undefined
		});
		expect(reloaded.tasks).toHaveLength(0);
	});
});
