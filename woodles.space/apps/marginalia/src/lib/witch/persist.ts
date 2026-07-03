// localStorage save/load for The Witch's Book.
//
// ── save discipline (ROADMAP.md week 6) ─────────────────────────────────────
// Any visitor who starts playing during the public-facing arc is a save we
// must not break — there's no account and no server copy, so a broken load
// is unrecoverable for them. The rule: BookSave.v never changes on its own;
// a shape change is additive (a new optional-in-practice field with a
// sensible default) and lands through `{ ...emptySave(), ...parsed }` below
// (load() and importSave() both use it), which already fills in anything an
// older save is missing. That covers a genuinely new field for free. It does
// NOT cover a renamed field, a changed type, or a default that depends on
// other saved values — those need an explicit migration step here (see
// inheritReadingFromLegacy for the shape of one) plus a persist.test.ts case
// loading an old-shaped blob to prove the migration runs. Only bump `v` (and
// decide what happens to existing v:1 saves) for a break too large to migrate.

import { ATTENTION_START } from './tuning';
import { neutralStocks, type Stocks } from './vitals';

const KEY = 'witch.book.save.v1';
const LEGACY_MARGINALIA_KEY = 'marginalia.save.v1';

export interface BookSave {
	v: 1;
	essence: number;
	knowing: number;
	insight: number;
	favor: number;
	// vital signs — the world's metabolism
	stocks: Stocks;
	vitality: Record<string, number>; // lifeId -> 0..1 health
	// interventions — the Known endgame
	stockBaseline: Stocks;
	stabilityBonus: number;
	metabolismScale: Record<string, number>;
	interventionsDone: Record<string, number>; // lifeId -> spoken line index
	interventionLoad: number;
	equilibriumSeconds: number;
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
	// bestiary bindings: maps Marginalia life ID → Bestiary creature ID.
	// when a bound creature is deleted from the Bestiary, the binding is
	// dropped on next load so dead entries don't accumulate.
	spriteBindings: Record<string, string>;
	// the live observation log — short, timestamped, auto-generated entries
	// distinct from the scripted journalSeeds milestones.
	fieldNotes: FieldNote[];
	// categories (aquatic/terrestrial/atmospheric) whose every emerged life
	// has reached Known at least once — sticky, never revoked.
	categoryMastered: Record<string, boolean>;
	// wall-clock of the last save — drives offline progress
	lastSeen: number;
}

export interface FieldNote {
	id: string;
	t: number; // ms epoch, when it was written
	text: string;
}

export function emptySave(): BookSave {
	return {
		v: 1,
		essence: 6,
		knowing: 0,
		insight: 0,
		favor: 60,
		stocks: neutralStocks(),
		vitality: {},
		stockBaseline: neutralStocks(),
		stabilityBonus: 0,
		metabolismScale: {},
		interventionsDone: {},
		interventionLoad: 0,
		equilibriumSeconds: 0,
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
		spriteBindings: {},
		fieldNotes: [],
		categoryMastered: {},
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
