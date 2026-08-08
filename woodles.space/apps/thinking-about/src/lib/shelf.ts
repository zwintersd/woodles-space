// The shelf — what Thinking About publishes for other apps to read.
//
// Derived from `entries` on every save, never stored as its own truth: the
// board is the source, this is a projection of it. That is what makes it safe
// to rebuild at any moment and what keeps a stale shelf from ever outliving
// the entries behind it.
//
// The shape and both keys live in @woodles/sync (crossAppBlobs.ts) so the
// reader — Carillon, today — depends on the contract rather than on this app.
// See REFERENCES.md §4.2.

import {
	THINKING_ABOUT_SHELF_STORAGE_KEY,
	THINKING_ABOUT_SHELF_VERSION,
	type ShelfEntry,
	type ThinkingAboutShelfBlob
} from '@woodles/sync';
import { latestSessionDate } from './entries';
import type { ThinkingAboutEntry } from './types';

/**
 * Active entries only, and only the fields another app can act on.
 *
 * An untitled entry is skipped rather than published as a blank chip — the
 * board sweeps those on close (`isUntouched`), but one can exist in the gap
 * while a detail panel is open, and a picker elsewhere should never offer it.
 */
export function buildShelf(
	entries: ThinkingAboutEntry[],
	publishedAt = new Date().toISOString()
): ThinkingAboutShelfBlob {
	const shelf: ShelfEntry[] = entries
		.filter((entry) => entry.status === 'active' && entry.title.trim() !== '')
		.map((entry) => ({
			id: entry.id,
			title: entry.title.trim(),
			columnKey: entry.columnKey,
			sectionKey: entry.sectionKey,
			color: entry.color,
			lastSessionDate: latestSessionDate(entry.sessions)
		}));

	return { version: THINKING_ABOUT_SHELF_VERSION, entries: shelf, publishedAt };
}

/**
 * Mirror the shelf into localStorage for same-origin readers. Never throws:
 * a full or disabled quota costs another app its picker, which is not worth
 * failing this app's own save over.
 */
export function saveShelfLocally(blob: ThinkingAboutShelfBlob): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(THINKING_ABOUT_SHELF_STORAGE_KEY, JSON.stringify(blob));
	} catch {
		// ignore quota / disabled storage
	}
}

/** True when the two shelves would read identically to a consumer. */
export function shelvesMatch(a: ThinkingAboutShelfBlob, b: ThinkingAboutShelfBlob): boolean {
	if (a.entries.length !== b.entries.length) return false;
	return a.entries.every((entry, index) => {
		const other = b.entries[index];
		return (
			entry.id === other.id &&
			entry.title === other.title &&
			entry.columnKey === other.columnKey &&
			entry.sectionKey === other.sectionKey &&
			entry.color === other.color &&
			entry.lastSessionDate === other.lastSessionDate
		);
	});
}
