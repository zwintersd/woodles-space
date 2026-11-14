// Rapid fire: a replenishing multi-select. A grid of candidates; each pick
// leaves and its slot refills from a hidden pool, until nothing left fits.
// Recognition over recall — the round is a sampled, paged endorsement
// inventory, so what it records is what was picked *and* how much was shown.
//
// Everything here is pure. `RapidFire.svelte` owns the motion; this owns which
// item is in which slot, so the slot a pick leaves is the slot its
// replacement arrives in.

import { createCollectionStore, type Collection } from '@woodles/collections';
import type { ShelfEntry } from '@woodles/sync';
import type { MomentEndorsement, RapidFireSettings } from './types';

export type RapidItem = { id: string; label: string; color?: string };
export type RapidSource = MomentEndorsement['source'] & { key: string; items: RapidItem[] };
export type RapidRound = {
	/** Fixed positions. Null is a slot the pool could no longer refill. */
	slots: (RapidItem | null)[];
	pool: RapidItem[];
	picks: RapidItem[];
	/** Ids that have reached the grid, so an undone pick is not counted twice. */
	seen: string[];
	total: number;
	/** False for a fixed page: picks leave their slots empty. */
	refill: boolean;
};

export type RapidOptions = Required<RapidFireSettings>;
export const RAPID_SIZES = [0, 6, 9, 12, 16, 20, 24, 30] as const;
export const RAPID_PICK_LIMITS = [0, 1, 2, 3, 5] as const;
export const DEFAULT_RAPID_OPTIONS: RapidOptions = { size: 0, refill: true, shuffle: true, maxPicks: 0, saveOnFinish: true, keepPassed: true };

/** Saved settings may be partial, older, or hand-edited; anything unusable falls back. */
export function rapidOptions(saved: RapidFireSettings | undefined): RapidOptions {
	const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
	const whole = (value: unknown, max: number) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : 0);
	return {
		size: whole(saved?.size, 60),
		maxPicks: whole(saved?.maxPicks, 60),
		refill: flag(saved?.refill, DEFAULT_RAPID_OPTIONS.refill),
		shuffle: flag(saved?.shuffle, DEFAULT_RAPID_OPTIONS.shuffle),
		saveOnFinish: flag(saved?.saveOnFinish, DEFAULT_RAPID_OPTIONS.saveOnFinish),
		keepPassed: flag(saved?.keepPassed, DEFAULT_RAPID_OPTIONS.keepPassed)
	};
}

export const RAPID_SLOTS = 20;
export const RAPID_SLOTS_NARROW = 12;
export const THINKING_ABOUT_SOURCE = 'thinking-about';

/** Trimmed, non-empty, one per label — two rows named the same are one candidate. */
export function cleanItems(items: readonly RapidItem[]): RapidItem[] {
	const labels = new Set<string>();
	return items.flatMap((item) => {
		const label = item.label.trim();
		const key = label.toLowerCase();
		if (!label || labels.has(key)) return [];
		labels.add(key);
		return [{ ...item, label }];
	});
}

export function shelfItems(entries: readonly ShelfEntry[]): RapidItem[] {
	return cleanItems(entries.map((entry) => ({ id: entry.id, label: entry.title, color: entry.color })));
}

/** A Collection's records by their Primary field; hidden rows stay out of the draw. */
export function collectionItems(collection: Collection): RapidItem[] {
	const primary = collection.fields.find((field) => field.primary);
	if (!primary) return [];
	const hidden = new Set(collection.views.table.hiddenRecords ?? []);
	return cleanItems(collection.records.filter((record) => !hidden.has(record.id)).map((record) => {
		const value = record.values[primary.id];
		return { id: record.id, label: typeof value === 'string' ? value : '' };
	}));
}

/**
 * Data's library, read without writing: the persistence layer saves on a
 * migrating load, and Carillon must never be a second writer of another app's
 * key. Collections reach a device through HomeSuite's sync, not Carillon's.
 */
export function readCollections(): Collection[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		return createCollectionStore({ getItem: (key) => localStorage.getItem(key), setItem: () => {}, removeItem: () => {} }).load().collections;
	} catch {
		return [];
	}
}

/** Every source with something to show, Thinking About first. */
export function rapidSources(shelf: readonly ShelfEntry[], collections: readonly Collection[]): RapidSource[] {
	const sources: RapidSource[] = [
		{ key: THINKING_ABOUT_SOURCE, kind: 'thinking-about', title: 'Thinking About', items: shelfItems(shelf) },
		...collections.map((collection): RapidSource => ({ key: `collection:${collection.id}`, kind: 'collection', id: collection.id, title: collection.title, items: collectionItems(collection) }))
	];
	return sources.filter((source) => source.items.length > 0);
}

export function startRound(items: readonly RapidItem[], size = RAPID_SLOTS, random: () => number = Math.random, deal: { shuffle?: boolean; refill?: boolean } = {}): RapidRound {
	const deck = cleanItems(items);
	for (let i = deck.length - 1; i > 0 && deal.shuffle !== false; i--) {
		const j = Math.floor(random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
	const slots = deck.slice(0, Math.max(1, size));
	return { slots, pool: deck.slice(slots.length), picks: [], seen: slots.map((item) => item.id), total: deck.length, refill: deal.refill !== false };
}

/** Endorse the item in a slot; the next from the pool takes that same slot. */
export function pick(round: RapidRound, slot: number): RapidRound {
	const item = round.slots[slot];
	if (!item) return round;
	if (!round.refill) return { ...round, slots: round.slots.map((current, index) => (index === slot ? null : current)), picks: [...round.picks, item] };
	const [next = null, ...pool] = round.pool;
	return {
		...round,
		slots: round.slots.map((current, index) => (index === slot ? next : current)),
		pool,
		picks: [...round.picks, item],
		seen: next && !round.seen.includes(next.id) ? [...round.seen, next.id] : round.seen
	};
}

/** A mis-tap comes back: into the first empty slot, else the front of the pool. */
export function unpick(round: RapidRound, id: string): RapidRound {
	const item = round.picks.find((entry) => entry.id === id);
	if (!item) return round;
	const picks = round.picks.filter((entry) => entry.id !== id);
	const empty = round.slots.indexOf(null);
	if (empty === -1) return { ...round, picks, pool: [item, ...round.pool] };
	return { ...round, picks, slots: round.slots.map((current, index) => (index === empty ? item : current)) };
}

export function remaining(round: RapidRound): number {
	return round.slots.filter(Boolean).length + (round.refill ? round.pool.length : 0);
}

/** True once a pick limit is met; 0 never is. */
export function atLimit(round: RapidRound, maxPicks: number): boolean {
	return maxPicks > 0 && round.picks.length >= maxPicks;
}

export function toEndorsement(round: RapidRound, source: MomentEndorsement['source'], keepPassed = false): MomentEndorsement {
	// Seen and unpicked is whatever still sits in a slot, plus an undone pick waiting in the pool.
	const seen = new Set(round.seen);
	const passed = [...round.slots, ...round.pool].flatMap((item) => (item && seen.has(item.id) ? [{ id: item.id, label: item.label }] : []));
	return {
		source: { kind: source.kind, title: source.title, ...(source.id ? { id: source.id } : {}) },
		picks: round.picks.map(({ id, label }) => ({ id, label })),
		shown: round.seen.length,
		pool: round.total,
		...(keepPassed ? { passed } : {})
	};
}

/** The moment's words when none were written: the picks themselves. */
export function endorsementLabel(endorsement: MomentEndorsement): string {
	return endorsement.picks.length ? endorsement.picks.map((entry) => entry.label).join(', ') : `Nothing fit · ${endorsement.source.title}`;
}

export function endorsementSummary(endorsement: MomentEndorsement): string {
	return `${endorsement.picks.length} of ${endorsement.shown} shown · ${endorsement.source.title}`;
}
