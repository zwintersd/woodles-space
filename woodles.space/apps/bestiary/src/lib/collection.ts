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
		created: ts,
		updated: ts
	};
}

// A card the user never wrote anything into — no name, no art, no text. We sweep
// these when the editor closes so an abandoned "new" doesn't litter the shelf.
export function isUntouched(c: Creature): boolean {
	return (
		c.name.trim() === '' &&
		c.sprite === null &&
		c.kind.trim() === '' &&
		c.abilities.trim() === '' &&
		c.flavor.trim() === '' &&
		c.foundIn.trim() === ''
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
