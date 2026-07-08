// Pure logic over ThinkingAboutEntry arrays — no $state here, so it's fully
// testable without instantiating the rune store (see thinkingAbout.svelte.ts,
// which is a thin wrapper delegating to these functions).

import { DEFAULT_COLOR, normalizeColumnSection } from './constants';
import type { ColumnKey, EntryStatus, SectionKey, ThinkingAboutEntry } from './types';

export function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function nowIso(): string {
	return new Date().toISOString();
}

export function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function stringOr(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizedStatus(value: unknown): EntryStatus {
	return value === 'archived' ? 'archived' : 'active';
}

export function blankEntry(
	columnKey: ColumnKey,
	sectionKey: SectionKey,
	title = ''
): ThinkingAboutEntry {
	const stamp = nowIso();
	return {
		id: uid(),
		columnKey,
		sectionKey,
		title,
		color: DEFAULT_COLOR,
		dateStarted: today(),
		status: 'active',
		dateClosed: null,
		notes: '',
		sharedWith: null,
		schedule: null,
		createdAt: stamp,
		updatedAt: stamp
	};
}

// A freshly created entry nobody has typed a title into yet — safe to sweep
// away on close instead of littering the board with blanks.
export function isUntouched(entry: ThinkingAboutEntry): boolean {
	return entry.title.trim() === '';
}

export function addEntry(
	entries: ThinkingAboutEntry[],
	columnKey: ColumnKey,
	sectionKey: SectionKey,
	title = ''
): { entries: ThinkingAboutEntry[]; created: ThinkingAboutEntry } {
	const created = blankEntry(columnKey, sectionKey, title);
	return { entries: [created, ...entries], created };
}

export function updateEntry(
	entries: ThinkingAboutEntry[],
	id: string,
	patch: Partial<Omit<ThinkingAboutEntry, 'id' | 'createdAt'>>
): ThinkingAboutEntry[] {
	return entries.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: nowIso() } : e));
}

export function archiveEntry(entries: ThinkingAboutEntry[], id: string): ThinkingAboutEntry[] {
	return updateEntry(entries, id, { status: 'archived', dateClosed: today() });
}

export function reopenEntry(entries: ThinkingAboutEntry[], id: string): ThinkingAboutEntry[] {
	return updateEntry(entries, id, { status: 'active', dateClosed: null });
}

export function deleteEntry(entries: ThinkingAboutEntry[], id: string): ThinkingAboutEntry[] {
	return entries.filter((e) => e.id !== id);
}

// The active board only ever shows what's still open — closing a loop
// (archiving) is what keeps it from feeling cluttered.
export function entriesForSection(
	entries: ThinkingAboutEntry[],
	columnKey: ColumnKey,
	sectionKey: SectionKey
): ThinkingAboutEntry[] {
	return entries.filter(
		(e) => e.status === 'active' && e.columnKey === columnKey && e.sectionKey === sectionKey
	);
}

// The Completed view: same table, filtered to status = 'archived', newest
// closed first.
export function archivedEntries(entries: ThinkingAboutEntry[]): ThinkingAboutEntry[] {
	return entries
		.filter((e) => e.status === 'archived')
		.sort((a, b) => (b.dateClosed ?? '').localeCompare(a.dateClosed ?? ''));
}

export function latestEntryTimestamp(entries: ThinkingAboutEntry[] | undefined): string | null {
	let latest: string | null = null;
	for (const entry of entries ?? []) {
		const stamp = entry.updatedAt || entry.createdAt;
		if (stamp && (!latest || stamp > latest)) latest = stamp;
	}
	return latest;
}

// Defensive fill for a stored/synced entry missing fields a newer build
// added — keeps an older or hand-edited blob from crashing conditional
// rendering, and keeps malformed bucket keys visible somewhere real.
export function normalizeEntry(raw: Partial<ThinkingAboutEntry>): ThinkingAboutEntry {
	const { columnKey, sectionKey } = normalizeColumnSection(raw.columnKey, raw.sectionKey);
	const createdAt = stringOr(raw.createdAt, stringOr(raw.updatedAt, nowIso()));
	const updatedAt = stringOr(raw.updatedAt, createdAt);

	return {
		...raw,
		id: stringOr(raw.id, uid()),
		columnKey,
		sectionKey,
		title: stringOr(raw.title),
		color: raw.color || DEFAULT_COLOR,
		status: normalizedStatus(raw.status),
		notes: stringOr(raw.notes),
		dateStarted: nullableString(raw.dateStarted),
		dateClosed: nullableString(raw.dateClosed),
		sharedWith: nullableString(raw.sharedWith),
		schedule: nullableString(raw.schedule),
		createdAt,
		updatedAt
	};
}
