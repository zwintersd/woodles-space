import { describe, expect, it } from 'vitest';
import { contentWords, cycleGapsDays, loopCandidate, median, recurringOffers, repeatedThemes, rhythmOffers, stem, suggestLoopLinks } from './loopInference';
import type { IntervalObservation, LoopEvent, OpenLoop } from './types';

const loop = (id: string, title: string, extra: Partial<OpenLoop> = {}): OpenLoop => ({
	id, title, status: 'open', createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z', ...extra
});
const event = (id: string, type: LoopEvent['type'], occurredAt: string, extra: Partial<LoopEvent> = {}): LoopEvent => ({
	id, type, occurredAt, recordedAt: occurredAt, ...extra
});
const moment = (date: string, start: string, label: string, extra: Partial<IntervalObservation> = {}): IntervalObservation => ({
	id: `observation-${date}@${start}`, date, intervalStart: start, source: 'live', kind: 'elsewhere', label,
	capturedAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z`, ...extra
});

describe('reading words without claiming meaning', () => {
	it('stems lightly so related forms meet', () => {
		expect(stem('replied')).toBe('reply');
		expect(stem('replying')).toBe('reply');
		expect(stem('dishes')).toBe('dish');
		expect(stem('dish')).toBe('dish');
		expect(stem('glass')).toBe('glass');
		expect(contentWords('I really need to reply to Mom’s text')).toEqual(['reply', 'mom', 'text']);
	});

	it('offers loops that share words with the moment, and never resolved one-off loops', () => {
		const loops = [loop('mom', 'Reply to Mom'), loop('sub', 'Cancel subscription', { status: 'resolved', resolution: 'completed' }), loop('shower', 'Shower', { status: 'resolved', recurring: true })];
		expect(suggestLoopLinks('Thinking about replying to mom', loops).map(item => item.id)).toEqual(['mom']);
		expect(suggestLoopLinks('Cancelled the subscription', loops)).toEqual([]);
		expect(suggestLoopLinks('Want a shower', loops).map(item => item.id)).toEqual(['shower']);
		expect(suggestLoopLinks('Thinking about replying to mom', loops, ['mom'])).toEqual([]);
		expect(suggestLoopLinks('watching a video', loops)).toEqual([]);
		expect(suggestLoopLinks('', loops)).toEqual([]);
	});

	it('only offers a loop name when the words already name an unfinished intention', () => {
		expect(loopCandidate('I still need to reply to Mom, but later', [])).toBe('Reply to Mom');
		expect(loopCandidate('should cancel the gym subscription', [])).toBe('Cancel the gym subscription');
		expect(loopCandidate('Watching a video', [])).toBeNull();
		expect(loopCandidate('tight shoulders', [])).toBeNull();
		expect(loopCandidate('It should be fine', [])).toBeNull();
		expect(loopCandidate('need to reply to mom', [loop('mom', 'Reply to Mom')])).toBeNull();
	});
});

describe('possible patterns as offers', () => {
	const now = new Date('2026-10-18T15:00:00.000Z');

	it('names words that recur in unlinked notes across days, above a threshold', () => {
		const observations = [
			moment('2026-10-15', '09:00', 'Folding laundry'),
			moment('2026-10-16', '09:00', 'Laundry pile on the chair'),
			moment('2026-10-16', '10:00', 'At my desk', { noticings: [{ channel: 'attention', note: 'thinking about laundry' }] }),
			moment('2026-10-17', '10:00', 'Laundry again', { linkedLoopIds: ['x'] })
		];
		const themes = repeatedThemes({ observations, events: [], loops: [], now });
		expect(themes[0]).toMatchObject({ key: 'theme:laundry', word: 'laundry', notes: 3, days: 2 });
		expect(repeatedThemes({ observations, events: [], loops: [loop('l', 'Laundry')], now })).toEqual([]);
		expect(repeatedThemes({ observations, events: [], loops: [], now, dismissed: ['theme:laundry'] }).some(theme => theme.word === 'laundry')).toBe(false);
		expect(repeatedThemes({ observations: observations.slice(0, 2), events: [], loops: [], now })).toEqual([]);
	});

	it('counts unattributed loop notes but not linked ones', () => {
		const events = [
			event('a', 'noticed', '2026-10-14T10:00:00.000Z', { note: 'dentist appointment' }),
			event('b', 'noticed', '2026-10-15T10:00:00.000Z', { note: 'the dentist' }),
			event('c', 'noticed', '2026-10-16T10:00:00.000Z', { note: 'dentist again' }),
			event('d', 'noticed', '2026-10-16T11:00:00.000Z', { note: 'dentist', loopId: 'x' })
		];
		expect(repeatedThemes({ observations: [], events, loops: [], now })[0]).toMatchObject({ word: 'dentist', notes: 3 });
	});

	it('suggests recurrence after repeated closures and a rhythm from observed cycles', () => {
		const loops = [loop('s', 'Shower'), loop('w', 'Water plants', { recurring: true, rhythmDays: 3 })];
		const events = [
			event('s1', 'closed', '2026-10-10T08:00:00.000Z', { loopId: 's' }),
			event('s2', 'reopened', '2026-10-11T08:00:00.000Z', { loopId: 's' }),
			event('s3', 'closed', '2026-10-12T08:00:00.000Z', { loopId: 's' }),
			event('w1', 'closed', '2026-10-01T08:00:00.000Z', { loopId: 'w' }),
			event('w2', 'closed', '2026-10-03T08:00:00.000Z', { loopId: 'w' }),
			event('w3', 'closed', '2026-10-05T20:00:00.000Z', { loopId: 'w' }),
			event('w4', 'closed', '2026-10-07T08:00:00.000Z', { loopId: 'w' })
		];
		expect(recurringOffers(loops, events)).toEqual([{ key: 'recurring:s', loopId: 's', closures: 2 }]);
		expect(recurringOffers(loops, events, ['recurring:s'])).toEqual([]);
		expect(cycleGapsDays('w', events)).toEqual([2, 2.5, 1.5]);
		expect(rhythmOffers(loops, events)).toEqual([{ key: 'rhythm:w:2', loopId: 'w', days: 2, cycles: 4 }]);
		expect(rhythmOffers([{ ...loops[1], rhythmDays: 2 }], events)).toEqual([]);
		expect(median([])).toBeUndefined();
		expect(median([1, 3, 2, 10])).toBe(2.5);
	});
});
