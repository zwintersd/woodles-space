import { describe, expect, it } from 'vitest';
import {
	activeCustomSignals,
	cycleRead,
	illnessRead,
	paydayRead,
	signalLabel
} from './signals';
import type { SignalEntry } from './types';

function entry(partial: Partial<SignalEntry> & Pick<SignalEntry, 'kind' | 'date'>): SignalEntry {
	return {
		id: `signal-${partial.kind}-${partial.date}`,
		createdAt: `${partial.date}T08:00:00.000Z`,
		...partial
	};
}

describe('cycleRead', () => {
	it('is null with no logged starts', () => {
		expect(cycleRead([], '2026-08-04')).toBeNull();
	});

	it('estimates a default length from a single logged start', () => {
		const read = cycleRead([entry({ kind: 'cycle', date: '2026-08-01' })], '2026-08-04');
		expect(read).toEqual({
			dayOfCycle: 4,
			cycleLengthDays: 28,
			estimated: true,
			expectedNextStart: '2026-08-29'
		});
	});

	it('derives length from the gap between two logged starts', () => {
		const entries = [
			entry({ kind: 'cycle', date: '2026-06-05' }),
			entry({ kind: 'cycle', date: '2026-07-03' })
		];
		const read = cycleRead(entries, '2026-07-10');
		expect(read?.estimated).toBe(false);
		expect(read?.cycleLengthDays).toBe(28);
		expect(read?.dayOfCycle).toBe(8);
		expect(read?.expectedNextStart).toBe('2026-07-31');
	});

	it('ignores a start logged in the future', () => {
		const entries = [
			entry({ kind: 'cycle', date: '2026-08-01' }),
			entry({ kind: 'cycle', date: '2026-08-29' })
		];
		const read = cycleRead(entries, '2026-08-04');
		expect(read?.dayOfCycle).toBe(4);
		expect(read?.estimated).toBe(true);
	});
});

describe('paydayRead', () => {
	it('is null with nothing logged for today or later', () => {
		const entries = [entry({ kind: 'payday', date: '2026-07-01' })];
		expect(paydayRead(entries, '2026-08-04')).toBeNull();
	});

	it('finds the nearest upcoming payday', () => {
		const entries = [
			entry({ kind: 'payday', date: '2026-08-15' }),
			entry({ kind: 'payday', date: '2026-09-01' })
		];
		expect(paydayRead(entries, '2026-08-04')).toEqual({ date: '2026-08-15', daysUntil: 11 });
	});

	it('counts today itself as zero days away', () => {
		const entries = [entry({ kind: 'payday', date: '2026-08-04' })];
		expect(paydayRead(entries, '2026-08-04')).toEqual({ date: '2026-08-04', daysUntil: 0 });
	});
});

describe('illnessRead', () => {
	it('is null when nothing covers today', () => {
		const entries = [entry({ kind: 'illness', date: '2026-07-01', endDate: '2026-07-03' })];
		expect(illnessRead(entries, '2026-08-04')).toBeNull();
	});

	it('reads an open-ended span as still active', () => {
		const entries = [entry({ kind: 'illness', date: '2026-08-02' })];
		expect(illnessRead(entries, '2026-08-04')).toEqual({ startedAt: '2026-08-02', daysSick: 3 });
	});

	it('stops counting once an end date has passed', () => {
		const entries = [entry({ kind: 'illness', date: '2026-08-01', endDate: '2026-08-02' })];
		expect(illnessRead(entries, '2026-08-04')).toBeNull();
	});
});

describe('activeCustomSignals', () => {
	it('includes a single-day custom entry only on its own date', () => {
		const entries = [entry({ kind: 'custom', date: '2026-08-04', label: 'started new SSRI' })];
		expect(activeCustomSignals(entries, '2026-08-04')).toHaveLength(1);
		expect(activeCustomSignals(entries, '2026-08-05')).toHaveLength(0);
	});

	it('includes a spanning custom entry across its whole range', () => {
		const entries = [
			entry({ kind: 'custom', date: '2026-08-01', endDate: '2026-08-10', label: 'guests visiting' })
		];
		expect(activeCustomSignals(entries, '2026-08-04')).toHaveLength(1);
		expect(activeCustomSignals(entries, '2026-08-11')).toHaveLength(0);
	});
});

describe('signalLabel', () => {
	it('uses the fixed label for built-in kinds', () => {
		expect(signalLabel(entry({ kind: 'cycle', date: '2026-08-04' }))).toBe('cycle');
	});

	it('falls back to a generic label for an unnamed custom entry', () => {
		expect(signalLabel(entry({ kind: 'custom', date: '2026-08-04' }))).toBe('something noted');
	});

	it('uses the given label for a named custom entry', () => {
		expect(signalLabel(entry({ kind: 'custom', date: '2026-08-04', label: 'travel' }))).toBe(
			'travel'
		);
	});
});
