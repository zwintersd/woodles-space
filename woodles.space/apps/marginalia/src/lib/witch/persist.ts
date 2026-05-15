// localStorage save/load for The Witch's Book.

import { ATTENTION_START } from './tuning';

const KEY = 'witch.book.save.v1';
const LEGACY_MARGINALIA_KEY = 'marginalia.save.v1';

export interface BookSave {
	v: 1;
	essence: number;
	knowing: number;
	insight: number;
	favor: number;
	attentionCapacity: number;
	attending: string[];
	study: Record<string, number>;
	writtenConditions: string[];
	observation: Record<string, number>;
	journalShown: string[];
	worldIndex: number;
	bookOpen: boolean;
	// reading room — "reading alongside Brianna"
	readingMsTowardNextPoint: number;
	readingStarPoints: number;
	readingCompletedStars: number;
	readingCumulativeMs: number;
	readingCumulativeWords: number;
	// wall-clock of the last save — drives offline progress
	lastSeen: number;
}

export function emptySave(): BookSave {
	return {
		v: 1,
		essence: 6,
		knowing: 0,
		insight: 0,
		favor: 60,
		attentionCapacity: ATTENTION_START,
		attending: [],
		study: {},
		writtenConditions: [],
		observation: {},
		journalShown: [],
		worldIndex: 0,
		bookOpen: false,
		readingMsTowardNextPoint: 0,
		readingStarPoints: 0,
		readingCompletedStars: 0,
		readingCumulativeMs: 0,
		readingCumulativeWords: 0,
		lastSeen: Date.now()
	};
}

// Carry the reading-for-stars progress out of the old Marginalia save so a
// returning reader keeps the stars they earned before the overhaul.
function inheritReadingFromLegacy(base: BookSave): BookSave {
	try {
		const raw = localStorage.getItem(LEGACY_MARGINALIA_KEY);
		if (!raw) return base;
		const old = JSON.parse(raw);
		return {
			...base,
			readingMsTowardNextPoint: old.readingMsTowardNextPoint ?? base.readingMsTowardNextPoint,
			readingStarPoints: old.readingStarPoints ?? base.readingStarPoints,
			readingCompletedStars: old.readingCompletedStars ?? base.readingCompletedStars,
			readingCumulativeMs: old.readingCumulativeMs ?? base.readingCumulativeMs,
			readingCumulativeWords: old.readingCumulativeWords ?? base.readingCumulativeWords
		};
	} catch {
		return base;
	}
}

export function load(): BookSave | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) {
			const legacy = inheritReadingFromLegacy(emptySave());
			return legacy.readingCompletedStars > 0 || legacy.readingMsTowardNextPoint > 0
				? legacy
				: null;
		}
		const parsed = JSON.parse(raw);
		if (parsed?.v !== 1) return null;
		return { ...emptySave(), ...parsed };
	} catch {
		return null;
	}
}

export function save(state: BookSave): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// ignore quota errors
	}
}

export function wipe(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(KEY);
}

export function exportSave(state: BookSave): string {
	return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(blob: string): BookSave | null {
	try {
		const json = decodeURIComponent(escape(atob(blob.trim())));
		const parsed = JSON.parse(json);
		if (parsed?.v !== 1) return null;
		return { ...emptySave(), ...parsed };
	} catch {
		return null;
	}
}
