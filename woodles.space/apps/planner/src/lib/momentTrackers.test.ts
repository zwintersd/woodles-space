import { describe, expect, it } from 'vitest';
import { trackerOffer, cleanTrackerAnswers, ratingChanges } from './momentTrackers';
import type { MomentTracker, IntervalObservation } from './types';
const tracker: MomentTracker = { id: 'focus', name: 'Focus', type: 'rating', cue: 'reading, writing', low: 'Scattered', high: 'Absorbed' };
const observation: IntervalObservation = { id: 'old', date: '2026-09-20', intervalStart: '09:00', source: 'live', kind: 'elsewhere', label: 'Reading', capturedAt: '', updatedAt: '', trackerAnswers: [{ tracker, value: 2 }], details: { mood: 2 } };
describe('personal moment trackers', () => {
	it('offers user-chosen cues without adding an answer', () => {
		const answers: [] = [];
		expect(trackerOffer([tracker], answers, 'Writing notes', observation.date, '12:00', [], [])?.tracker.id).toBe('focus');
		expect(answers).toEqual([]);
		expect(trackerOffer([tracker], [], '', observation.date, '12:00', [observation], [])).toBeUndefined();
	});
	it('respects dismissal, answered fields, and time between follow-ups', () => {
		expect(trackerOffer([tracker], [], 'Reading', observation.date, '12:00', [], ['focus'])).toBeUndefined();
		expect(trackerOffer([tracker], observation.trackerAnswers!, 'Reading', observation.date, '12:00', [], [])).toBeUndefined();
		expect(trackerOffer([tracker], [], 'Lunch', observation.date, '10:00', [observation], [])).toBeUndefined();
		expect(trackerOffer([tracker], [], 'Lunch', observation.date, '12:00', [observation], [])?.reason).toContain('09:00');
		expect(trackerOffer([tracker], [], 'Lunch', '2026-09-21', '12:00', [observation], [])).toBeUndefined();
	});
	it('keeps explicit no answers and drops blanks and invalid ratings', () => {
		expect(cleanTrackerAnswers([{ tracker: { ...tracker, type: 'check' }, value: false }, { tracker, value: 0 }, { tracker: { ...tracker, type: 'text' }, value: '  ' }])).toHaveLength(1);
	});
	it('compares actual recorded ratings without filling missing values', () => {
		const last = { ...observation, id: 'later', intervalStart: '12:00', details: { mood: 4, energy: 3 } };
		expect(ratingChanges([last, observation])).toEqual([{ key: 'mood', first: 2, last: 4, from: '09:00', to: '12:00', count: 2 }]);
	});
});
