import { describe, expect, it } from 'vitest';
import {
	buildDayIntervals,
	intervalKey,
	routineScaffoldLevel
} from './instrument';
import type {
	Block,
	IntervalObservation,
	RoutinePractice
} from './types';

describe('Carillon day intervals', () => {
	it('builds one momentary-sampling row per 15-minute interval', () => {
		const date = new Date(2026, 6, 30);
		const blocks: Block[] = [
			{
				id: 'writing',
				startTime: '09:00',
				endTime: '09:30',
				title: 'write the difficult paragraph'
			},
			{
				id: 'walk',
				startTime: '09:30',
				endTime: '10:00',
				title: 'walk'
			}
		];
		const observations: IntervalObservation[] = [
			{
				id: `observation-${intervalKey('2026-07-30', '09:15')}`,
				date: '2026-07-30',
				intervalStart: '09:15',
				source: 'live',
				kind: 'rest',
				label: 'staring out the window',
				capturedAt: '2026-07-30T13:15:00.000Z',
				updatedAt: '2026-07-30T13:15:00.000Z'
			}
		];

		const rows = buildDayIntervals(
			date,
			blocks,
			observations,
			'09:00',
			'10:00',
			15,
			new Date(2026, 6, 30, 9, 22)
		);

		expect(rows.map(({ startTime, endTime }) => [startTime, endTime])).toEqual([
			['09:00', '09:15'],
			['09:15', '09:30'],
			['09:30', '09:45'],
			['09:45', '10:00']
		]);
		expect(rows.map((row) => row.state)).toEqual(['past', 'current', 'future', 'future']);
		expect(rows.map((row) => row.plannedBlock?.id)).toEqual([
			'writing',
			'writing',
			'walk',
			'walk'
		]);
		expect(rows[1]?.observation).toBe(observations[0]);
		expect(rows[0]?.key).toBe('2026-07-30@09:00');
	});
});

describe('prompt-fading thresholds', () => {
	const practice = (
		date: string,
		independence: number,
		routineId = 'morning'
	): RoutinePractice => ({
		id: `practice-${routineId}-${date}`,
		routineId,
		date,
		results: {},
		independence,
		recordedAt: `${date}T12:00:00.000Z`
	});

	it('keeps the full task analysis below 80% across the latest three days', () => {
		const practices = [
			practice('2026-07-28', 0.8),
			practice('2026-07-29', 0.8),
			practice('2026-07-30', 0.79)
		];

		expect(routineScaffoldLevel('morning', practices)).toBe('full');
	});

	it('requires the criterion on each day instead of averaging a low day away', () => {
		const practices = [
			practice('2026-07-28', 1),
			practice('2026-07-29', 1),
			practice('2026-07-30', 0.4)
		];

		expect(routineScaffoldLevel('morning', practices)).toBe('full');
	});

	it('fades after three days at the 80% criterion', () => {
		const practices = [
			practice('2026-07-28', 0.8),
			practice('2026-07-29', 0.8),
			practice('2026-07-30', 0.8)
		];

		expect(routineScaffoldLevel('morning', practices)).toBe('faded');
	});

	it('masters after a second three-day set at the same criterion', () => {
		const practices = [
			practice('2026-07-25', 0.8),
			practice('2026-07-26', 0.8),
			practice('2026-07-27', 0.8),
			practice('2026-07-28', 0.8),
			practice('2026-07-29', 0.8),
			practice('2026-07-30', 0.8)
		];

		expect(routineScaffoldLevel('morning', practices)).toBe('mastered');
	});

	it('does not count another routine toward the threshold', () => {
		const practices = [
			practice('2026-07-28', 1),
			practice('2026-07-29', 1),
			practice('2026-07-30', 1),
			practice('2026-07-28', 0.8, 'evening'),
			practice('2026-07-29', 0.8, 'evening'),
			practice('2026-07-30', 0.8, 'evening')
		];

		expect(routineScaffoldLevel('evening', practices)).toBe('faded');
		expect(routineScaffoldLevel('missing', practices)).toBe('full');
	});
});
