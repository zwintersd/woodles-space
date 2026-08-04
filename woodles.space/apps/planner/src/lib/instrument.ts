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
	/** The part of Echo's portrait this kind grows (EchoCreature.svelte). */
	echoPart: string;
}> = [
	// prettier-ignore-start
	{ kind: 'clinic',    label: 'clinic / sessions', shortLabel: 'clinic',    glyph: '◫', stat: 'attunement', echoPart: 'its ears' },
	{ kind: 'writing',   label: 'writing',           shortLabel: 'writing',   glyph: '✎', stat: 'voice',      echoPart: 'the bell it holds' },
	{ kind: 'build',     label: 'building',          shortLabel: 'build',     glyph: '⌁', stat: 'craft',      echoPart: 'the patch on its coat' },
	{ kind: 'movement',  label: 'moving',            shortLabel: 'movement',  glyph: '↗', stat: 'range',      echoPart: 'its tail' },
	{ kind: 'care',      label: 'care / life',       shortLabel: 'care',      glyph: '♡', stat: 'warmth',     echoPart: 'its belly and cheeks' },
	{ kind: 'rest',      label: 'resting',           shortLabel: 'rest',      glyph: '☾', stat: 'hush',       echoPart: 'the quiet rings around it' },
	{ kind: 'elsewhere', label: 'something else',    shortLabel: 'elsewhere', glyph: '…', stat: 'curiosity',  echoPart: 'its spore feelers' }
	// prettier-ignore-end
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
	/** The observation started in an earlier row and covers this one. */
	continuation?: boolean;
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

	const dayObservations = observations.filter((observation) => observation.date === day);
	const observationMap = new Map(
		dayObservations.map((observation) => [
			intervalKey(observation.date, observation.intervalStart),
			observation
		])
	);
	// Recall marks can cover a stretch longer than one row; keep their extent
	// so every row inside the stretch shows the same single sample.
	const spans = dayObservations.map((observation) => ({
		observation,
		start: timeToMinutes(observation.intervalStart),
		end: timeToMinutes(observation.intervalStart) + (observation.intervalMinutes ?? intervalMinutes)
	}));

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

		// An exact sample owns its row; otherwise the latest-starting stretch
		// that covers this row fills it in as a continuation.
		const cursorMod = ((cursor % 1440) + 1440) % 1440;
		let observation = observationMap.get(key) ?? null;
		let continuation = false;
		if (!observation) {
			let covering: (typeof spans)[number] | null = null;
			for (const span of spans) {
				if (cursorMod < span.start || cursorMod >= span.end) continue;
				if (!covering || span.start > covering.start) covering = span;
			}
			if (covering) {
				observation = covering.observation;
				continuation = covering.start !== cursorMod;
			}
		}

		rows.push({
			key,
			date: day,
			startTime: startLabel,
			endTime: endLabel,
			state,
			plannedBlock,
			observation,
			continuation
		});
	}

	return rows;
}

// ── catch-up: hollow stretches worth sketching after time away ────

export type CatchUpGap = {
	date: string;
	startTime: string;
	endTime: string;
	minutes: number;
	/** Interval boundaries inside the gap: each hollow row's start, then the gap's end. */
	boundaries: string[];
};

export function spanMinutes(startTime: string, endTime: string): number {
	return (timeToMinutes(endTime) - timeToMinutes(startTime) + 1440) % 1440;
}

/**
 * Contiguous runs of past, unobserved intervals — the shape of the day that
 * went by while Carillon was closed. Runs shorter than `minimumMinutes` are
 * ordinary pauses between samples, not absences, and are left alone. The
 * current and future intervals are never a gap: the live sampler owns now.
 */
export function findCatchUpGaps(intervals: DayInterval[], minimumMinutes = 60): CatchUpGap[] {
	const gaps: CatchUpGap[] = [];
	let run: DayInterval[] = [];

	const flush = () => {
		if (run.length === 0) return;
		const minutes = run.reduce((sum, row) => sum + spanMinutes(row.startTime, row.endTime), 0);
		const last = run[run.length - 1];
		if (minutes >= minimumMinutes) {
			gaps.push({
				date: run[0].date,
				startTime: run[0].startTime,
				endTime: last.endTime,
				minutes,
				boundaries: [...run.map((row) => row.startTime), last.endTime]
			});
		}
		run = [];
	};

	for (const row of intervals) {
		if (row.state === 'past' && !row.observation) run.push(row);
		else flush();
	}
	flush();
	return gaps;
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
