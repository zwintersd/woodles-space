// Pure, rune-free collection logic — the sorting, filtering and bookkeeping the
// shelf does over a list of creatures. Kept out of the $state store so it can be
// unit-tested directly (Svelte 5 runes can't be instantiated in a plain test).

import type { Creature, Stats, SortKey, RarityFilter, DomainFilter } from './types';
import type { Rarity } from './content/domains';
import type { Substat } from './content/stats';
import { substatDef } from './content/stats';
import { uid, now } from './utils';

export const RARITY_ORDER: Record<Rarity, number> = {
	common: 0,
	uncommon: 1,
	rare: 2,
	mythic: 3
};

// All cores start at 1, matching the blank's power/toughness baseline.
export function defaultStats(): Stats {
	return {
		body: 1, mind: 1, grace: 1, heart: 1, will: 1, spark: 1,
		substats: {}
	};
}

// Read the effective value of a substat — its override if set, else its
// parent core. Used by editor and card-display alike.
export function effectiveSubstat(stats: Stats, sub: Substat): number {
	const override = stats.substats[sub];
	if (override !== undefined) return override;
	return stats[substatDef(sub).parent];
}

// True if this substat has been authored away from its parent's value.
export function isSubstatOverridden(stats: Stats, sub: Substat): boolean {
	return stats.substats[sub] !== undefined;
}

// An evocative one-line reading of the creature's shape — the numbers reflected
// back as character. This is the inverse of a preset: it never invents values,
// it only glosses what was authored, and it shifts live as the cores change.
export function statProfile(stats: Stats): string {
	const caps = [stats.body, stats.mind, stats.grace, stats.heart];
	const top = Math.max(...caps);
	const { will, spark } = stats;

	// Barely there yet — Will decides whether it's a seed or just a faint outline.
	if (top <= 2) {
		return will >= 6
			? 'a seed — little yet, but a long way up'
			: 'barely sketched — still mostly potential';
	}

	// A clear leader among the four capacities, ahead of the rest by a margin.
	const reads = [
		'a creature of the body — it meets the world by doing',
		'a creature of the mind — it meets the world by knowing',
		'a creature of grace — it meets the world through others',
		'a creature of the heart — it stays, and keeps caring'
	];
	let lead = 0;
	for (let i = 1; i < caps.length; i++) if (caps[i] > caps[lead]) lead = i;
	const rest = caps.filter((_, i) => i !== lead);
	if (caps[lead] >= 5 && caps[lead] - Math.max(...rest) >= 2) return reads[lead];

	// No single way it meets the world — let the arc colour the reading.
	if (spark >= 8) return 'the world keeps finding it — coincidence runs high';
	if (will >= 7) return 'still climbing — already much, and becoming more';
	return 'evenly made — no single way it meets the world';
}

// A fresh, unwritten card. New creatures start here; the editor binds straight
// to the stored record and saves as you type.
export function blankCreature(): Creature {
	const ts = now();
	return {
		id: uid(),
		name: '',
		sprite: null,
		pixelated: false,
		domain: 'unspecified',
		kind: '',
		cost: 1,
		rarity: 'common',
		power: 1,
		toughness: 1,
		abilities: '',
		flavor: '',
		foundIn: '',
		stats: defaultStats(),
		status: {},
		created: ts,
		updated: ts
	};
}

// A pristine stat block — all six cores at their summon baseline of 1, with no
// substat overrides. Used to tell an untouched card from a shaped one.
export function statsAreDefault(stats: Stats): boolean {
	return (
		stats.body === 1 &&
		stats.mind === 1 &&
		stats.grace === 1 &&
		stats.heart === 1 &&
		stats.will === 1 &&
		stats.spark === 1 &&
		Object.keys(stats.substats).length === 0
	);
}

// A card the user never shaped — exactly as it was summoned: no identity, no
// art, no text, and every number still at its blank default. We sweep these
// when the editor closes so an abandoned "new" doesn't litter the shelf. The
// moment anything is changed — a stat, the cost, the rarity, the domain, the
// P/T — the card counts as authored and is kept, even before it has a name.
export function isUntouched(c: Creature): boolean {
	return (
		c.name.trim() === '' &&
		c.sprite === null &&
		!c.composition &&
		c.kind.trim() === '' &&
		c.abilities.trim() === '' &&
		c.flavor.trim() === '' &&
		c.foundIn.trim() === '' &&
		c.domain === 'unspecified' &&
		c.rarity === 'common' &&
		c.cost === 1 &&
		c.power === 1 &&
		c.toughness === 1 &&
		statsAreDefault(c.stats ?? defaultStats())
	);
}

export type Filters = {
	search: string;
	rarityFilter: RarityFilter;
	domainFilter: DomainFilter;
};

export function filterCreatures(list: Creature[], filters: Filters): Creature[] {
	const q = filters.search.trim().toLowerCase();
	return list.filter((c) => {
		if (filters.rarityFilter !== 'all' && c.rarity !== filters.rarityFilter) return false;
		if (filters.domainFilter !== 'all' && c.domain !== filters.domainFilter) return false;
		if (q) {
			const hay = `${c.name} ${c.kind} ${c.abilities} ${c.flavor}`.toLowerCase();
			if (!hay.includes(q)) return false;
		}
		return true;
	});
}

export function sortCreatures(list: Creature[], sort: SortKey): Creature[] {
	return [...list].sort((a, b) => {
		switch (sort) {
			case 'name':
				return (a.name || '~').localeCompare(b.name || '~');
			case 'cost':
				return a.cost - b.cost || a.name.localeCompare(b.name);
			case 'rarity':
				return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || a.cost - b.cost;
			case 'recent':
			default:
				return b.updated.localeCompare(a.updated);
		}
	});
}

export function rarityCounts(list: Creature[]): Record<Rarity, number> {
	const counts = { common: 0, uncommon: 0, rare: 0, mythic: 0 } as Record<Rarity, number>;
	for (const c of list) counts[c.rarity]++;
	return counts;
}
