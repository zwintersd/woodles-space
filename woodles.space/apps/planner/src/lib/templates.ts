import type { Block, WeekPattern } from './types';
import { timeToMinutes, nowMinutes } from './utils';
import {
	STARTER_SHAPES_V2,
	STARTER_OFFICE_DAY,
	STARTER_RECOVERY_DAY
} from './onboarding.copy';

export { STARTER_SHAPES_V2 as STARTER_SHAPES } from './onboarding.copy';

// Mon–Fri → office, Sat–Sun → recovery. Indexed by Date.getDay() (0=Sun..6=Sat).
export const STARTER_WEEK_PATTERN: WeekPattern = {
	days: [
		STARTER_RECOVERY_DAY.id, // Sun
		STARTER_OFFICE_DAY.id,   // Mon
		STARTER_OFFICE_DAY.id,   // Tue
		STARTER_OFFICE_DAY.id,   // Wed
		STARTER_OFFICE_DAY.id,   // Thu
		STARTER_OFFICE_DAY.id,   // Fri
		STARTER_RECOVERY_DAY.id  // Sat
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

// ── Helpers used by store / views ────────────────────────────────

// Merge a base block list with overlay blocks (obligations + rituals), sorted by start.
export function mergeBlocks(base: Block[], overlays: Block[]): Block[] {
	return [...base, ...overlays].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// Make sure we re-export the shape constants used elsewhere
export { STARTER_OFFICE_DAY, STARTER_MAKER_DAY, STARTER_OUT_DAY, STARTER_RECOVERY_DAY } from './onboarding.copy';
