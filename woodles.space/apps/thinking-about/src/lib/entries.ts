// Pure logic over ThinkingAboutEntry arrays — no $state here, so it's fully
// testable without instantiating the rune store (see thinkingAbout.svelte.ts,
// which is a thin wrapper delegating to these functions).

import { DEFAULT_COLOR } from './constants';
import type { ColumnKey, SectionKey, ThinkingAboutEntry } from './types';

export function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function nowIso(): string {
	return new Date().toISOString();
}

export function today(): string {
	return new Date().toISOString().slice(0, 10);
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

// Defensive fill for a stored/synced entry missing fields a newer build
// added — keeps an older or hand-edited blob from crashing conditional
// rendering that expects these to at least be null rather than undefined.
export function normalizeEntry(raw: ThinkingAboutEntry): ThinkingAboutEntry {
	return {
		...raw,
		color: raw.color || DEFAULT_COLOR,
		status: raw.status ?? 'active',
		notes: raw.notes ?? '',
		dateClosed: raw.dateClosed ?? null,
		sharedWith: raw.sharedWith ?? null,
		schedule: raw.schedule ?? null
	};
}
