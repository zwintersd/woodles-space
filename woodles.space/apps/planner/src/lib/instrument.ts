import type {
	Block,
	IntervalKind,
	IntervalObservation,
	Routine,
	RoutinePractice,
	RoutineScaffoldLevel,
	RoutineStepResult,
	SporeEvent
} from './types';
import { dateKey, timeToMinutes } from './utils';

export const INTERVAL_KIND_OPTIONS: ReadonlyArray<{
	kind: IntervalKind;
	label: string;
	shortLabel: string;
	glyph: string;
	stat: string;
}> = [
	{ kind: 'clinic', label: 'clinic / sessions', shortLabel: 'clinic', glyph: '◫', stat: 'attunement' },
	{ kind: 'writing', label: 'writing', shortLabel: 'writing', glyph: '✎', stat: 'voice' },
	{ kind: 'build', label: 'building', shortLabel: 'build', glyph: '⌁', stat: 'craft' },
	{ kind: 'movement', label: 'moving', shortLabel: 'movement', glyph: '↗', stat: 'range' },
	{ kind: 'care', label: 'care / life', shortLabel: 'care', glyph: '♡', stat: 'warmth' },
	{ kind: 'rest', label: 'resting', shortLabel: 'rest', glyph: '☾', stat: 'hush' },
	{ kind: 'elsewhere', label: 'something else', shortLabel: 'elsewhere', glyph: '…', stat: 'curiosity' }
];

export const STARTER_ROUTINES: Routine[] = [
	{
		id: 'routine-morning-launch',
		name: 'morning launch',
		cue: 'after the first bell',
		createdAt: 'starter',
		steps: [
			{ id: 'morning-water', label: 'water + medication' },
			{ id: 'morning-wash', label: 'wash up' },
			{ id: 'morning-dress', label: 'get dressed' },
			{ id: 'morning-bag', label: 'bag, keys, food' },
			{ id: 'morning-door', label: 'leave through the door' }
		]
	},
	{
		id: 'routine-close-clinic',
		name: 'close the clinic day',
		cue: 'after the last note',
		createdAt: 'starter',
		steps: [
			{ id: 'close-note', label: 'finish the live note' },
			{ id: 'close-desk', label: 'reset the desk' },
			{ id: 'close-tomorrow', label: 'name tomorrow’s first thing' },
			{ id: 'close-leave', label: 'leave work at work' }
		]
	}
];

export type IntervalState = 'past' | 'current' | 'future';

export type DayInterval = {
	key: string;
	date: string;
	startTime: string;
	endTime: string;
	state: IntervalState;
	plannedBlock: Block | null;
	observation: IntervalObservation | null;
};

export function intervalKey(date: string, intervalStart: string): string {
	return `${date}@${intervalStart}`;
}

export function kindLabel(kind: IntervalKind): string {
	return INTERVAL_KIND_OPTIONS.find((option) => option.kind === kind)?.shortLabel ?? kind;
}

export function timeForMinutes(total: number): string {
	const safe = ((total % 1440) + 1440) % 1440;
	const hours = Math.floor(safe / 60);
	const minutes = safe % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function currentIntervalStart(date: Date, intervalMinutes = 15): string {
	const minutes = date.getHours() * 60 + date.getMinutes();
	return timeForMinutes(Math.floor(minutes / intervalMinutes) * intervalMinutes);
}

export function buildDayIntervals(
	date: Date,
	blocks: Block[],
	observations: IntervalObservation[],
	startTime: string,
	endTime: string,
	intervalMinutes = 15,
	reference: Date = new Date()
): DayInterval[] {
	const day = dateKey(date);
	const start = timeToMinutes(startTime);
	let end = timeToMinutes(endTime);
	if (end <= start) end += 1440;

	const observationMap = new Map(
		observations
			.filter((observation) => observation.date === day)
			.map((observation) => [intervalKey(observation.date, observation.intervalStart), observation])
	);

	const referenceDay = dateKey(reference);
	const referenceMinutes = reference.getHours() * 60 + reference.getMinutes();
	const rows: DayInterval[] = [];

	for (let cursor = start; cursor < end; cursor += intervalMinutes) {
		const startLabel = timeForMinutes(cursor);
		const endLabel = timeForMinutes(Math.min(cursor + intervalMinutes, end));
		const key = intervalKey(day, startLabel);
		const matchingBlocks = blocks.filter((block) => {
			const blockStart = timeToMinutes(block.startTime);
			let blockEnd = timeToMinutes(block.endTime);
			if (blockEnd <= blockStart) blockEnd += 1440;
			return cursor >= blockStart && cursor < blockEnd;
		});
		const plannedBlock = matchingBlocks[matchingBlocks.length - 1] ?? null;

		let state: IntervalState;
		if (day < referenceDay) state = 'past';
		else if (day > referenceDay) state = 'future';
		else if (referenceMinutes >= cursor && referenceMinutes < cursor + intervalMinutes) state = 'current';
		else state = cursor < referenceMinutes ? 'past' : 'future';

		rows.push({
			key,
			date: day,
			startTime: startLabel,
			endTime: endLabel,
			state,
			plannedBlock,
			observation: observationMap.get(key) ?? null
		});
	}

	return rows;
}

export function routineIndependence(
	routine: Routine,
	results: Record<string, RoutineStepResult>
): number {
	if (routine.steps.length === 0) return 0;
	const independent = routine.steps.filter((step) => results[step.id] === 'independent').length;
	return independent / routine.steps.length;
}

function meetsFadeCriterion(practices: RoutinePractice[]): boolean {
	return practices.length === 3 && practices.every((practice) => practice.independence >= 0.8);
}

/**
 * Three days at 80% fades the full task analysis. A second three-day set at
 * the same criterion masters it into a quiet chip. Data can always be expanded.
 */
export function routineScaffoldLevel(
	routineId: string,
	practices: RoutinePractice[]
): RoutineScaffoldLevel {
	const recent = practices
		.filter((practice) => practice.routineId === routineId)
		.sort((a, b) => b.date.localeCompare(a.date))
		.slice(0, 6);

	if (recent.length >= 6) {
		const newest = recent.slice(0, 3);
		const prior = recent.slice(3, 6);
		if (meetsFadeCriterion(newest) && meetsFadeCriterion(prior)) {
			return 'mastered';
		}
	}

	if (recent.length >= 3 && meetsFadeCriterion(recent.slice(0, 3))) {
		return 'faded';
	}

	return 'full';
}

export function sporeStats(events: SporeEvent[]): Record<IntervalKind, number> {
	const totals: Record<IntervalKind, number> = {
		clinic: 0,
		writing: 0,
		build: 0,
		movement: 0,
		care: 0,
		rest: 0,
		elsewhere: 0
	};
	for (const event of events) totals[event.kind] += event.amount;
	return totals;
}

export function sporesSince(events: SporeEvent[], sinceDate: string): SporeEvent[] {
	return events.filter((event) => event.date >= sinceDate);
}

export function buildEchoesExport(events: SporeEvent[], generatedAt = new Date().toISOString()) {
	return {
		format: 'carillon-spores',
		version: 1,
		generatedAt,
		events: events.map(({ id, observationId, date, kind, amount, createdAt }) => ({
			id,
			observationId,
			date,
			kind,
			amount,
			createdAt
		}))
	};
}
