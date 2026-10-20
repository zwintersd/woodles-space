import { describe, expect, it } from 'vitest';
import { daysLabel, momentLabel, share, summarizeLoopPatterns } from './loopAnalysis';
import type { ClosureReflection, FiveContactsRound, IntervalObservation, LoopEvent, OpenLoop } from './types';

/** Local wall-clock times, so the comparison windows don't depend on the test machine's zone. */
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 9, day, hours, minutes).toISOString();
const loop = (id: string, title: string, extra: Partial<OpenLoop> = {}): OpenLoop => ({
	id, title, status: 'open', createdAt: at(1, 9), updatedAt: at(1, 9), ...extra
});
const event = (id: string, type: LoopEvent['type'], occurredAt: string, loopId?: string): LoopEvent => ({ id, type, occurredAt, recordedAt: occurredAt, loopId });
const moment = (day: number, start: string, tag: string | null, extra: Partial<IntervalObservation> = {}): IntervalObservation => ({
	id: `observation-2026-10-${day}@${start}`, date: `2026-10-${String(day).padStart(2, '0')}`, intervalStart: start, source: 'live', kind: 'care', label: 'moment',
	sampleTag: tag === null ? null : { id: tag, name: tag, color: '#000', kind: 'care' }, capturedAt: at(day, 9), updatedAt: at(day, 9), ...extra
});

describe('describing loop records without explaining them', () => {
	const now = new Date(2026, 9, 18, 20, 0);
	const loops = [
		loop('mom', 'Reply to Mom', { status: 'resolved', resolution: 'completed', resolvedAt: at(16, 10) }),
		loop('feature', 'Woodles feature', { status: 'resolved', resolution: 'released', resolvedAt: at(17, 14) }),
		loop('sub', 'Cancel subscription', { status: 'resolved', resolution: 'completed', resolvedAt: at(18, 9) }),
		loop('shower', 'Shower', { recurring: true, rhythmDays: 2, status: 'resolved', resolution: 'completed' })
	];
	const events = [
		event('n1', 'noticed', at(15, 9), 'mom'), event('a1', 'approached', at(15, 18), 'mom'), event('c1', 'closed', at(16, 10), 'mom'),
		event('n2', 'noticed', at(16, 9), 'feature'), event('r2', 'released', at(17, 14), 'feature'),
		event('n3', 'noticed', at(17, 9), 'sub'), event('c3', 'closed', at(18, 9), 'sub'),
		event('u1', 'noticed', at(18, 11)),
		event('s1', 'closed', at(12, 8), 'shower'), event('s2', 'closed', at(14, 8), 'shower'), event('s3', 'closed', at(17, 8), 'shower'),
		event('old', 'closed', at(1, 8), 'mom')
	];
	const reflections: ClosureReflection[] = [
		{ id: 'r-c1', loopEventId: 'c1', descriptors: ['Lighter'], nextFeelsPossible: 'something', recordedAt: at(16, 10) },
		{ id: 'r-r2', loopEventId: 'r2', descriptors: ['Lighter', 'Less comfortable'], nextFeelsPossible: 'rest', recordedAt: at(17, 14) }
	];
	const observations = [
		moment(16, '10:30', 'Cleaning', { noticings: [{ channel: 'body', note: 'loose shoulders' }] }),
		moment(16, '13:00', 'Rest'),
		moment(17, '15:00', 'Cleaning'),
		moment(17, '17:00', null, { noticings: [{ channel: 'body', note: 'tight', linkedLoopIds: ['sub'] }, { channel: 'attention', note: '' }] }),
		moment(18, '09:15', 'Rest', { linkedLoopIds: ['sub'] })
	];
	const rounds: FiveContactsRound[] = [
		{ id: 'round-1', startedAt: at(16, 10, 20), updatedAt: at(16, 10, 30), status: 'completed', contacts: [{ id: 'k1', at: at(16, 10, 21), linkedLoopId: 'mom' }] },
		{ id: 'round-2', startedAt: at(17, 18), updatedAt: at(17, 18), status: 'stopped', contacts: [] }
	];

	it('counts resolutions, reflections, and neighbours within a window', () => {
		const summary = summarizeLoopPatterns({ loops, events, reflections, observations, rounds, now, rangeDays: 7, windowMinutes: 120 });
		expect(summary.resolutions).toEqual({ closed: 5, released: 1 });
		expect(summary.enough).toBe(true);
		expect(summary.descriptors).toEqual([
			{ descriptor: 'Lighter', closed: 1, released: 1 },
			{ descriptor: 'Less comfortable', closed: 0, released: 1 }
		]);
		expect(summary.nextFeelsPossible).toEqual({ something: 1, rest: 1, nothing: 0, unanswered: 4 });
		expect(summary.momentsAfter).toBe(3);
		expect(summary.momentsOther).toBe(2);
		expect(summary.labels.find(row => row.name === 'Cleaning')).toEqual({ name: 'Cleaning', after: 2, other: 0 });
		expect(summary.labels.find(row => row.name === 'No label')).toEqual({ name: 'No label', after: 0, other: 1 });
		expect(summary.noticingsAfter.body).toBe(1);
		expect(summary.noticingsOther).toEqual({ body: 1, attention: 1, behavior: 0 });
		expect(summary.roundsAfter).toBe(1);
		expect(summary.roundsTotal).toBe(2);
		expect(summary.unattributedEvents).toBe(1);
	});

	it('withholds comparisons below three resolutions and respects the range', () => {
		const summary = summarizeLoopPatterns({ loops, events, reflections, observations, rounds, now, rangeDays: 1 });
		expect(summary.resolutions).toEqual({ closed: 1, released: 0 });
		expect(summary.enough).toBe(false);
		const all = summarizeLoopPatterns({ loops, events, reflections, observations, rounds, now, rangeDays: 0 });
		expect(all.from).toBeNull();
		expect(all.resolutions.closed).toBe(6);
	});

	it('reports only chosen links, per loop and per noticing', () => {
		const summary = summarizeLoopPatterns({ loops, events, reflections, observations, rounds, now, rangeDays: 7 });
		expect(summary.attribution).toEqual([
			{ channel: 'body', linked: 1, unlinked: 1 },
			{ channel: 'attention', linked: 0, unlinked: 1 },
			{ channel: 'behavior', linked: 0, unlinked: 0 }
		]);
		const sub = summary.loops.find(item => item.loopId === 'sub')!;
		expect(sub).toMatchObject({ linkedMoments: 1, linkedNoticings: 1, counts: { noticed: 1, closed: 1 } });
		expect(sub.daysToResolution).toBeCloseTo(1);
		const mom = summary.loops.find(item => item.loopId === 'mom')!;
		expect(mom.contacts).toBe(1);
		expect(mom.counts).toEqual({ noticed: 1, approached: 1, closed: 1 });
		expect(summary.loops.find(item => item.loopId === 'shower')!.daysToResolution).toBeUndefined();
	});

	it('describes recurring rhythms from all cycles', () => {
		const [shower] = summarizeLoopPatterns({ loops, events, reflections, observations, rounds, now, rangeDays: 7 }).rhythms;
		expect(shower).toMatchObject({ loopId: 'shower', closures: 3, typicalGapDays: 2.5, lastGapDays: 3, rhythmDays: 2, lastClosedAt: at(17, 8) });
	});

	it('formats shares with their counts and durations plainly', () => {
		expect(share(1, 3)).toBe('1 of 3 (33%)');
		expect(share(0, 0)).toBe('—');
		expect(daysLabel(0.25)).toBe('6 hours');
		expect(daysLabel(1)).toBe('1 day');
		expect(daysLabel(2.46)).toBe('2.5 days');
		expect(momentLabel(moment(1, '09:00', null))).toBe('No label');
		expect(momentLabel({ ...moment(1, '09:00', null), sampleTag: undefined, kind: 'writing' })).toBe('writing');
	});
});
