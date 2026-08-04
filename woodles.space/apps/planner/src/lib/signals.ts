// Ongoing signals — the slower-moving context beside a single day: where in
// a cycle, how far to payday, whether an illness is still running, and
// anything else worth remembering that doesn't deserve its own schema.
// Everything here is derived from a flat log of dated entries, never stored
// as "current state" — the same stance the rest of Carillon takes toward
// observations and Echo's traits.

import type { SignalEntry, SignalKind } from './types';

export const SIGNAL_KIND_OPTIONS: ReadonlyArray<{
	kind: SignalKind;
	label: string;
	glyph: string;
	hint: string;
}> = [
	{ kind: 'cycle', label: 'cycle', glyph: '☾', hint: 'log the day a period starts' },
	{ kind: 'payday', label: 'payday', glyph: '◇', hint: 'log a known or upcoming pay date' },
	{
		kind: 'illness',
		label: 'sick / recovering',
		glyph: '♢',
		hint: 'mark a stretch of being unwell — leave the end open while it still is'
	},
	{
		kind: 'custom',
		label: 'something else',
		glyph: '…',
		hint: 'anything else ongoing worth remembering'
	}
];

export function signalKindLabel(kind: SignalKind): string {
	return SIGNAL_KIND_OPTIONS.find((option) => option.kind === kind)?.label ?? kind;
}

export function signalLabel(entry: SignalEntry): string {
	if (entry.kind === 'custom') return entry.label?.trim() || 'something noted';
	return entry.label?.trim() || signalKindLabel(entry.kind);
}

function parseDateKey(key: string): Date {
	const [year, month, day] = key.split('-').map(Number);
	return new Date(year, month - 1, day, 12);
}

function daysBetween(fromKey: string, toKey: string): number {
	return Math.round((parseDateKey(toKey).getTime() - parseDateKey(fromKey).getTime()) / 86_400_000);
}

function addDays(key: string, days: number): string {
	const date = parseDateKey(key);
	date.setDate(date.getDate() + days);
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

const DEFAULT_CYCLE_LENGTH_DAYS = 28;

export type CycleRead = {
	dayOfCycle: number;
	cycleLengthDays: number;
	/** True when only one start has ever been logged, so length is a default guess. */
	estimated: boolean;
	expectedNextStart: string;
};

/** The most recent cycle start on or before `today`, and what it implies. */
export function cycleRead(entries: SignalEntry[], today: string): CycleRead | null {
	const starts = entries
		.filter((entry) => entry.kind === 'cycle' && entry.date <= today)
		.map((entry) => entry.date)
		.sort();
	if (starts.length === 0) return null;

	const lastStart = starts[starts.length - 1];
	let cycleLengthDays = DEFAULT_CYCLE_LENGTH_DAYS;
	let estimated = true;
	if (starts.length >= 2) {
		const gaps = starts.slice(1).map((date, index) => daysBetween(starts[index], date));
		cycleLengthDays = Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
		estimated = false;
	}

	return {
		dayOfCycle: daysBetween(lastStart, today) + 1,
		cycleLengthDays,
		estimated,
		expectedNextStart: addDays(lastStart, cycleLengthDays)
	};
}

export type PaydayRead = {
	date: string;
	daysUntil: number;
};

/** The nearest logged payday on or after `today` — never inferred from a schedule. */
export function paydayRead(entries: SignalEntry[], today: string): PaydayRead | null {
	const upcoming = entries
		.filter((entry) => entry.kind === 'payday' && entry.date >= today)
		.map((entry) => entry.date)
		.sort();
	if (upcoming.length === 0) return null;
	return { date: upcoming[0], daysUntil: daysBetween(today, upcoming[0]) };
}

export type IllnessRead = {
	startedAt: string;
	daysSick: number;
};

/** The illness entry covering `today`, if any — an open end still counts as active. */
export function activeIllnessEntry(entries: SignalEntry[], today: string): SignalEntry | null {
	return (
		entries
			.filter((entry) => entry.kind === 'illness')
			.filter((entry) => entry.date <= today && (!entry.endDate || entry.endDate >= today))
			.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
	);
}

/** The illness span covering `today`, if any — an open end still counts as active. */
export function illnessRead(entries: SignalEntry[], today: string): IllnessRead | null {
	const covering = activeIllnessEntry(entries, today);
	if (!covering) return null;
	return { startedAt: covering.date, daysSick: daysBetween(covering.date, today) + 1 };
}

/**
 * Custom entries whose span covers `today`. Unlike illness, an unset
 * `endDate` here means a single-day note rather than "still ongoing" — most
 * custom entries are a point in time ("started new SSRI"), and a genuine
 * stretch ("guests visiting") is exactly what `endDate` is for.
 */
export function activeCustomSignals(entries: SignalEntry[], today: string): SignalEntry[] {
	return entries
		.filter((entry) => entry.kind === 'custom')
		.filter((entry) => {
			const end = entry.endDate ?? entry.date;
			return entry.date <= today && end >= today;
		});
}
