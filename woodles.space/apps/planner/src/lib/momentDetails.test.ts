import { describe, expect, it } from 'vitest';
import { cleanDetails, suggestMomentDetails } from './momentDetails';
import type { IntervalObservation, MomentDetails } from './types';

const prior = (time: string, details: MomentDetails, date = '2026-09-19'): IntervalObservation => ({ id: time, date, intervalStart: time, source: 'live', kind: 'elsewhere', label: 'An earlier moment', details, capturedAt: '', updatedAt: '' });
const base = { text: 'Working on notes', details: {}, date: '2026-09-19', start: '12:00', previous: [] as IntervalObservation[] };

describe('moment detail offers', () => {
	it('offers no prompts before writing and never fills answers', () => {
		const details = {};
		expect(suggestMomentDetails({ ...base, text: '', details })).toEqual([]);
		expect(suggestMomentDetails({ ...base, text: 'I am exhausted and stressed and sad', details })).toHaveLength(2);
		expect(details).toEqual({});
	});
	it('responds to a rating already supplied in this moment', () => {
		expect(suggestMomentDetails({ ...base, details: { energy: 1 } }).map(o => o.key)).toContain('body');
		expect(suggestMomentDetails({ ...base, details: { coping: 2 } }).map(o => o.key)).toContain('helped');
	});
	it('uses only earlier samples on this date', () => {
		const offers = suggestMomentDetails({ ...base, previous: [prior('11:00', { energy: 1 }), prior('13:00', { coping: 1 }), prior('10:00', { mood: 1 }, '2026-09-18')] });
		expect(offers).toEqual([{ key: 'energy', reason: expect.stringContaining('11:00') }]);
	});
	it('avoids repeatedly requesting a recent rating but allows a new explicit cue', () => {
		const previous = [prior('11:45', { energy: 1 })];
		expect(suggestMomentDetails({ ...base, previous })).toEqual([]);
		expect(suggestMomentDetails({ ...base, previous, text: 'Now feeling exhausted' }).map(o => o.key)).toContain('energy');
	});
	it('does not follow up an old low rating once a newer one supersedes it', () => {
		expect(suggestMomentDetails({ ...base, previous: [prior('09:00', { energy: 1 }), prior('10:00', { energy: 4 })] })).toEqual([]);
	});
	it('honors dismissal and never asks for an already answered field', () => {
		const offers = suggestMomentDetails({ ...base, text: 'Tired and stressed', dismissed: ['energy'], details: { coping: 4 }, previous: [prior('09:00', {})] });
		expect(offers).toEqual([]);
	});
	it('uses editable label names, not their old compatibility bucket', () => {
		expect(suggestMomentDetails({ ...base, tagName: 'Movement', previous: [prior('09:00', {})] })[0]?.key).toBe('energy');
	});
	it('omits blank and invalid answers without treating them as zero', () => {
		expect(cleanDetails({ mood: 0, energy: 2, coping: 6, helped: '  A walk  ', body: '  ' })).toEqual({ energy: 2, helped: 'A walk' });
	});
});
