import type { IntervalObservation, MomentTracker, TrackerAnswer } from './types';
import { timeToMinutes } from './utils';

export function trackerOffer(trackers: MomentTracker[], answers: TrackerAnswer[], text: string, date: string, start: string, previous: IntervalObservation[], dismissed: string[]) {
	if (!text.trim()) return undefined;
	for (const tracker of trackers) {
		if (answers.some(a => a.tracker.id === tracker.id) || dismissed.includes(tracker.id)) continue;
		const cue = tracker.cue.split(',').map(s => s.trim().toLocaleLowerCase()).filter(Boolean).find(word => text.toLocaleLowerCase().includes(word));
		if (cue) return { tracker, reason: `Your entry includes “${cue}”, a cue you chose.` };
		const last = previous.filter(o => o.date === date && o.intervalStart < start && o.trackerAnswers?.some(a => a.tracker.id === tracker.id)).sort((a,b) => b.intervalStart.localeCompare(a.intervalStart))[0];
		if (last && tracker.type === 'rating' && timeToMinutes(start) - timeToMinutes(last.intervalStart) >= 120) return { tracker, reason: `You rated this at ${last.intervalStart}. Add another point if useful.` };
	}
	return undefined;
}

export function cleanTrackerAnswers(answers: TrackerAnswer[]) {
	return answers.filter(a => a.tracker.type === 'rating' ? typeof a.value === 'number' && Number.isInteger(a.value) && a.value >= 1 && a.value <= 5 : a.tracker.type === 'check' ? typeof a.value === 'boolean' : typeof a.value === 'string' && Boolean(a.value.trim())).map(a => ({ tracker: { ...a.tracker }, value: typeof a.value === 'string' ? a.value.trim() : a.value }));
}

export function ratingChanges(observations: IntervalObservation[]) {
	return (['mood', 'energy', 'coping'] as const).flatMap(key => {
		const points = observations.filter(o => typeof o.details?.[key] === 'number').sort((a,b) => a.intervalStart.localeCompare(b.intervalStart));
		if (points.length < 2) return [];
		const first = points[0], last = points[points.length - 1];
		return [{ key, first: first.details![key]!, last: last.details![key]!, from: first.intervalStart, to: last.intervalStart, count: points.length }];
	});
}
