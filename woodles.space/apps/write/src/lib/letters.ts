import { ISSUE_KEY, LETTERS_KEY, LEGACY_PUBLISHED_KEY } from './storage';
import type { PocketNote, MarginNote } from './types';

export interface StoredLetter {
	id: string;
	title: string;
	theme: string;
	motif: string;
	font: string;
	issue: number;
	publishedAt: string;
	layers: Record<string, { html: string; updatedAt: string }>;
	annotations: { pocketNotes: PocketNote[]; marginNotes: MarginNote[] };
	content: string;
	replyTo: string | null;
}

export function newLetterId(): string {
	return 'l-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

export function loadLettersList(): StoredLetter[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(LETTERS_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		}
		// Migration from legacy single-letter slot.
		const old = localStorage.getItem(LEGACY_PUBLISHED_KEY);
		if (old) {
			const lt = JSON.parse(old) as StoredLetter;
			lt.id = lt.id || newLetterId();
			lt.replyTo = lt.replyTo ?? null;
			const list: StoredLetter[] = [lt];
			localStorage.setItem(LETTERS_KEY, JSON.stringify(list));
			return list;
		}
	} catch {
		// ignore corrupt list
	}
	return [];
}

export function saveLettersList(list: StoredLetter[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(LETTERS_KEY, JSON.stringify(list));
	} catch {
		// ignore quota
	}
}

export function findLetter(list: StoredLetter[], id: string): StoredLetter | undefined {
	return list.find((l) => l.id === id);
}

// Atomically bump the global issue counter and return the new value.
// Treats missing or corrupt counters as 0, so a fresh-or-broken counter
// always yields 1.
export function incrementIssue(): number {
	if (typeof localStorage === 'undefined') return 1;
	const parsed = parseInt(localStorage.getItem(ISSUE_KEY) || '0', 10);
	const next = (Number.isFinite(parsed) ? parsed : 0) + 1;
	try {
		localStorage.setItem(ISSUE_KEY, String(next));
	} catch {
		// ignore quota
	}
	return next;
}

// Write-through to the legacy single-letter slot so older viewer code
// paths still see "the latest letter".
export function writePublishedLegacy(letter: Partial<StoredLetter>): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(LEGACY_PUBLISHED_KEY, JSON.stringify(letter));
	} catch {
		// ignore quota
	}
}
