import { describe, expect, it } from 'vitest';
import { capacityNudges, capacityRead } from './capacity';
import type { RoutinePractice, SignalEntry, SleepLog } from './types';

const today = '2026-08-04';

function practice(independence: number, date = today): RoutinePractice {
	return {
		id: `practice-morning-${date}`,
		routineId: 'routine-morning-launch',
		date,
		results: {},
		independence,
		recordedAt: `${date}T08:00:00.000Z`
	};
}

function sleep(quality: SleepLog['quality']): SleepLog {
	return { id: `sleep-${today}`, date: today, quality, recordedAt: `${today}T07:00:00.000Z` };
}

describe('capacityRead', () => {
	it('reads steady with nothing logged and gives no reasons', () => {
		const read = capacityRead({ today, routinePractices: [], sleep: null, signals: [] });
		expect(read).toEqual({ level: 'steady', score: 0, reasons: [] });
	});

	it('reads open on good sleep plus an independent morning', () => {
		const read = capacityRead({
			today,
			routinePractices: [practice(1)],
			sleep: sleep('good'),
			signals: []
		});
		expect(read.level).toBe('open');
		expect(read.reasons.map((r) => r.direction)).toEqual(['up', 'up']);
	});

	it('reads low on a rough night plus a struggled morning', () => {
		const read = capacityRead({
			today,
			routinePractices: [practice(0.2)],
			sleep: sleep('rough'),
			signals: []
		});
		expect(read.level).toBe('low');
		expect(read.reasons.map((r) => r.direction)).toEqual(['down', 'down']);
	});

	it('averages independence across every routine practiced today', () => {
		const read = capacityRead({
			today,
			routinePractices: [practice(1), { ...practice(0.6), id: 'practice-other', routineId: 'other' }],
			sleep: null,
			signals: []
		});
		// average 0.8 clears the independent threshold
		expect(read.reasons).toEqual([{ label: 'this morning went independently', direction: 'up' }]);
	});

	it('ignores a practice recorded on a different day', () => {
		const read = capacityRead({
			today,
			routinePractices: [practice(1, '2026-08-01')],
			sleep: null,
			signals: []
		});
		expect(read.reasons).toEqual([]);
	});

	it('forces capacity low while an illness is active, regardless of sleep', () => {
		const signals: SignalEntry[] = [
			{ id: 'sig-1', kind: 'illness', date: '2026-08-03', createdAt: '2026-08-03T08:00:00.000Z' }
		];
		const read = capacityRead({ today, routinePractices: [], sleep: sleep('good'), signals });
		expect(read.level).toBe('low');
		expect(read.reasons.map((r) => r.label)).toContain('day 2 of being unwell');
	});

	it('lowers capacity in the first few days of a cycle', () => {
		const signals: SignalEntry[] = [
			{ id: 'sig-1', kind: 'cycle', date: '2026-08-03', createdAt: '2026-08-03T08:00:00.000Z' }
		];
		const read = capacityRead({ today, routinePractices: [], sleep: null, signals });
		expect(read.reasons).toEqual([{ label: 'cycle day 2', direction: 'down' }]);
	});

	it('lists a custom signal as a neutral reason without moving the score', () => {
		const signals: SignalEntry[] = [
			{
				id: 'sig-1',
				kind: 'custom',
				date: today,
				label: 'guests visiting',
				createdAt: `${today}T08:00:00.000Z`
			}
		];
		const read = capacityRead({ today, routinePractices: [], sleep: null, signals });
		expect(read.score).toBe(0);
		expect(read.reasons).toEqual([{ label: 'guests visiting', direction: 'neutral' }]);
	});
});

describe('capacityNudges', () => {
	it('offers nothing when steady', () => {
		expect(capacityNudges('steady')).toEqual([]);
	});

	it('nudges toward taking more on when open', () => {
		const nudges = capacityNudges('open');
		expect(nudges.map((n) => n.id)).toEqual(['errand', 'stretch']);
		expect(nudges.every((n) => n.action === 'compose')).toBe(true);
	});

	it('nudges toward rest and catch-up when low', () => {
		const nudges = capacityNudges('low');
		expect(nudges.map((n) => n.id)).toEqual(['rest', 'catch-up']);
		expect(nudges.find((n) => n.id === 'catch-up')?.action).toBe('none');
	});
});
