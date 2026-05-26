import type { Block, DayShape, WeekPattern } from './types';
import { timeToMinutes, nowMinutes } from './utils';

// ── Starter shapes ────────────────────────────────────────────────
// Neutral defaults seeded on first load so the app is usable before
// onboarding. Onboarding will replace these with the user's own shapes.

const WORKING_DAY_BLOCKS: Block[] = [
	{ id: 'starter-morning',    startTime: '07:00', endTime: '09:00', title: 'Morning',     bellId: 'block-start', flourishEligible: true },
	{ id: 'starter-work',       startTime: '09:00', endTime: '12:30', title: 'Work',        bellId: 'block-start' },
	{ id: 'starter-midday',     startTime: '12:30', endTime: '13:30', title: 'Midday',      bellId: 'meal', flourishEligible: true },
	{ id: 'starter-afternoon',  startTime: '13:30', endTime: '17:30', title: 'Afternoon',   bellId: 'block-start' },
	{ id: 'starter-open',       startTime: '17:30', endTime: '19:30', title: 'Open',        bellId: 'block-start', flourishEligible: true },
	{ id: 'starter-evening',    startTime: '19:30', endTime: '21:30', title: 'Evening',     bellId: 'block-start', flourishEligible: true },
	{ id: 'starter-wind-down',  startTime: '21:30', endTime: '23:59', title: 'Wind-down',   bellId: 'wind-down' }
];

const QUIET_DAY_BLOCKS: Block[] = [
	{ id: 'starter-q-morning',   startTime: '08:00', endTime: '11:00', title: 'Morning',     bellId: 'block-start', flourishEligible: true },
	{ id: 'starter-q-midday',    startTime: '11:00', endTime: '14:00', title: 'Midday',      bellId: 'block-start', flourishEligible: true },
	{ id: 'starter-q-afternoon', startTime: '14:00', endTime: '18:00', title: 'Afternoon',   bellId: 'block-start', flourishEligible: true },
	{ id: 'starter-q-evening',   startTime: '18:00', endTime: '21:30', title: 'Evening',     bellId: 'meal',        flourishEligible: true },
	{ id: 'starter-q-wind-down', startTime: '21:30', endTime: '23:59', title: 'Wind-down',   bellId: 'wind-down' }
];

export const STARTER_WORKING_DAY: DayShape = {
	id: 'starter-working',
	name: 'a working day',
	blocks: WORKING_DAY_BLOCKS
};

export const STARTER_QUIET_DAY: DayShape = {
	id: 'starter-quiet',
	name: 'a quiet day',
	blocks: QUIET_DAY_BLOCKS,
	restful: true
};

export const STARTER_SHAPES: DayShape[] = [STARTER_WORKING_DAY, STARTER_QUIET_DAY];

// Mon–Fri → working, Sat–Sun → quiet. Indexed by Date.getDay() (0=Sun..6=Sat).
export const STARTER_WEEK_PATTERN: WeekPattern = {
	days: [
		STARTER_QUIET_DAY.id,   // Sun
		STARTER_WORKING_DAY.id, // Mon
		STARTER_WORKING_DAY.id, // Tue
		STARTER_WORKING_DAY.id, // Wed
		STARTER_WORKING_DAY.id, // Thu
		STARTER_WORKING_DAY.id, // Fri
		STARTER_QUIET_DAY.id    // Sat
	]
};

// ── Pure time helpers (operate on any Block / Block[]) ────────────

export function getCurrentBlock(blocks: Block[], date: Date): Block | null {
	const mins = nowMinutes(date);
	for (const block of blocks) {
		const start = timeToMinutes(block.startTime);
		const end = timeToMinutes(block.endTime);
		if (mins >= start && mins < end) return block;
	}
	return null;
}

export function getNextBlock(blocks: Block[], date: Date): Block | null {
	const mins = nowMinutes(date);
	for (const block of blocks) {
		const start = timeToMinutes(block.startTime);
		if (start > mins) return block;
	}
	return null;
}

export function minutesRemaining(block: Block, date: Date): number {
	return Math.max(0, timeToMinutes(block.endTime) - nowMinutes(date));
}

export function minutesUntilBlock(block: Block, date: Date): number {
	return Math.max(0, timeToMinutes(block.startTime) - nowMinutes(date));
}

export function blockDurationMinutes(block: Block): number {
	return timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
}
