// Capacity — a morning read of how much room today has, built from what's
// already true rather than a form to fill out. Three inputs, each optional:
// how last night's sleep went, how independently this morning's routines
// went (RoutinePractice.independence, already recorded for Routines), and
// what ongoing signals are active (signals.ts). The read is always shown
// beside its reasons — a hypothesis you can see the working for, never a
// black box, matching the stance Carillon already takes toward the plan
// itself ("a hypothesis shown beside data, not a compliance ledger").

import type { RoutinePractice, SignalEntry, SleepLog } from './types';
import { activeCustomSignals, cycleRead, illnessRead, signalLabel } from './signals';

export type CapacityLevel = 'low' | 'steady' | 'open';

export type CapacityReason = {
	label: string;
	direction: 'up' | 'down' | 'neutral';
};

export type CapacityRead = {
	level: CapacityLevel;
	score: number;
	reasons: CapacityReason[];
};

const ROUTINE_INDEPENDENT_THRESHOLD = 0.8;
const ROUTINE_STRUGGLED_THRESHOLD = 0.4;
const CYCLE_LOW_WINDOW_DAYS = 3;

/**
 * Every input is optional and additive — a day with no sleep log and no
 * routine practiced yet still gets a read from signals alone, and a day
 * with nothing at all reads as `steady` with no reasons, not an error.
 */
export function capacityRead(input: {
	today: string;
	routinePractices: RoutinePractice[];
	sleep: SleepLog | null;
	signals: SignalEntry[];
}): CapacityRead {
	let score = 0;
	let forceLow = false;
	const reasons: CapacityReason[] = [];

	if (input.sleep?.quality === 'good') {
		score += 1;
		reasons.push({ label: 'slept well', direction: 'up' });
	} else if (input.sleep?.quality === 'rough') {
		score -= 1;
		reasons.push({ label: 'a rough night', direction: 'down' });
	}

	const todaysPractices = input.routinePractices.filter(
		(practice) => practice.date === input.today
	);
	if (todaysPractices.length > 0) {
		const average =
			todaysPractices.reduce((sum, practice) => sum + practice.independence, 0) /
			todaysPractices.length;
		if (average >= ROUTINE_INDEPENDENT_THRESHOLD) {
			score += 1;
			reasons.push({ label: 'this morning went independently', direction: 'up' });
		} else if (average <= ROUTINE_STRUGGLED_THRESHOLD) {
			score -= 1;
			reasons.push({ label: 'this morning needed a lot of help', direction: 'down' });
		}
	}

	// An active illness overrides the level outright rather than just adding to
	// the score — it shouldn't take a rough night on top of it to read as low,
	// and a good one shouldn't be enough to wash it out.
	const illness = illnessRead(input.signals, input.today);
	if (illness) {
		forceLow = true;
		score -= 2;
		reasons.push({
			label: illness.daysSick === 1 ? 'unwell today' : `day ${illness.daysSick} of being unwell`,
			direction: 'down'
		});
	}

	const cycle = cycleRead(input.signals, input.today);
	if (cycle && cycle.dayOfCycle <= CYCLE_LOW_WINDOW_DAYS) {
		score -= 1;
		reasons.push({ label: `cycle day ${cycle.dayOfCycle}`, direction: 'down' });
	}

	// Custom signals never move the score — Carillon can't know their valence —
	// but they still belong in the "why" list, since they're part of what's true.
	for (const entry of activeCustomSignals(input.signals, input.today)) {
		reasons.push({ label: signalLabel(entry), direction: 'neutral' });
	}

	const level: CapacityLevel = forceLow
		? 'low'
		: score >= 2
			? 'open'
			: score <= -2
				? 'low'
				: 'steady';
	return { level, score, reasons };
}

export type CapacityNudge = {
	id: string;
	message: string;
	/** Every nudge either opens the task composer or is purely a framing suggestion. */
	action: 'compose' | 'none';
};

/** Open capacity nudges toward taking more on; low capacity nudges toward rest and catch-up. */
export function capacityNudges(level: CapacityLevel): CapacityNudge[] {
	if (level === 'open') {
		return [
			{
				id: 'errand',
				message: 'Room to spare — worth adding an errand to the afternoon?',
				action: 'compose'
			},
			{
				id: 'stretch',
				message: 'Could be a good evening for a dedicated stretch session.',
				action: 'compose'
			}
		];
	}
	if (level === 'low') {
		return [
			{
				id: 'rest',
				message: 'Lighter day — worth protecting some dedicated rest time.',
				action: 'compose'
			},
			{
				id: 'catch-up',
				message: 'A day to catch up on what’s already there, not take on more.',
				action: 'none'
			}
		];
	}
	return [];
}
