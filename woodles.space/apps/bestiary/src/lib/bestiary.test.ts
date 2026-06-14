import { describe, expect, it } from 'vitest';
import { clampInt } from './utils';
import { domainDef, rarityDef, domains, rarities } from './content/domains';
import {
	blankCreature,
	isUntouched,
	filterCreatures,
	sortCreatures,
	rarityCounts,
	defaultStats,
	effectiveSubstat,
	isSubstatOverridden
} from './collection';
import type { Creature } from './types';

// Note: the $state store (bestiary.svelte.ts) can't be instantiated in a plain
// test context, so we exercise the pure collection logic it delegates to.

function make(over: Partial<Creature>): Creature {
	return { ...blankCreature(), ...over };
}

describe('clampInt', () => {
	it('rounds and clamps into range', () => {
		expect(clampInt(5, 0, 10)).toBe(5);
		expect(clampInt(-3, 0, 10)).toBe(0);
		expect(clampInt(99, 0, 10)).toBe(10);
		expect(clampInt(4.6, 0, 10)).toBe(5);
	});
	it('coerces NaN / Infinity to the minimum', () => {
		expect(clampInt(NaN, 1, 9)).toBe(1);
		expect(clampInt(Infinity, 1, 9)).toBe(9);
	});
});

describe('domain & rarity lookups', () => {
	it('has five domains and four rarities', () => {
		expect(domains).toHaveLength(5);
		expect(rarities).toHaveLength(4);
	});
	it('resolves a known domain', () => {
		expect(domainDef('temporal').name).toBe('Temporal');
		expect(domainDef('relational').aspect).toBe('on meaning');
	});
	it('falls back to unspecified for an unknown domain', () => {
		// @ts-expect-error — deliberately passing an invalid id
		expect(domainDef('nonsense').id).toBe('unspecified');
	});
	it('resolves a known rarity and its symbol', () => {
		expect(rarityDef('mythic').name).toBe('Mythic');
		expect(rarityDef('common').symbol).toBeTruthy();
	});
});

describe('blankCreature', () => {
	it('starts unspecified, common, 1/1, cost 1, no art', () => {
		const c = blankCreature();
		expect(c.domain).toBe('unspecified');
		expect(c.rarity).toBe('common');
		expect(c.power).toBe(1);
		expect(c.toughness).toBe(1);
		expect(c.cost).toBe(1);
		expect(c.sprite).toBeNull();
		expect(c.created).toBe(c.updated);
	});
	it('mints a unique id each time', () => {
		expect(blankCreature().id).not.toBe(blankCreature().id);
	});
});

describe('isUntouched', () => {
	it('is true for a fresh blank', () => {
		expect(isUntouched(blankCreature())).toBe(true);
	});
	it('is false once a name is written', () => {
		expect(isUntouched(make({ name: 'Inkling' }))).toBe(false);
	});
	it('is false once a sprite is attached', () => {
		expect(isUntouched(make({ sprite: 'data:image/png;base64,xxx' }))).toBe(false);
	});
	it('ignores stat changes alone — stats are not authored content', () => {
		expect(isUntouched(make({ power: 7, toughness: 7, cost: 9 }))).toBe(true);
	});
	it('ignores stat-block changes alone — same logic as cost/power/toughness', () => {
		expect(isUntouched(make({ stats: { ...defaultStats(), body: 8, grace: 9 } }))).toBe(true);
	});
});

describe('defaultStats', () => {
	it('starts all six cores at 1 with no substat overrides', () => {
		const s = defaultStats();
		expect(s.body).toBe(1);
		expect(s.spark).toBe(1);
		expect(s.substats).toEqual({});
	});
});

describe('effectiveSubstat', () => {
	it('falls back to parent core when no override', () => {
		const s = { ...defaultStats(), body: 7 };
		expect(effectiveSubstat(s, 'stamina')).toBe(7);
	});
	it('uses the override when one is set', () => {
		const s = { ...defaultStats(), body: 7, substats: { stamina: 2 } };
		expect(effectiveSubstat(s, 'stamina')).toBe(2);
	});
});

describe('isSubstatOverridden', () => {
	it('is false by default and true after authoring', () => {
		const s = defaultStats();
		expect(isSubstatOverridden(s, 'empathy')).toBe(false);
		s.substats.empathy = 5;
		expect(isSubstatOverridden(s, 'empathy')).toBe(true);
	});
});

describe('filterCreatures', () => {
	const list = [
		make({ name: 'Hourling', domain: 'temporal', rarity: 'rare', kind: 'Spirit' }),
		make({ name: 'Mossback', domain: 'biochemical', rarity: 'common', kind: 'Beast' }),
		make({ name: 'Echo', domain: 'relational', rarity: 'mythic', flavor: 'it answers' })
	];
	const base = { search: '', rarityFilter: 'all', domainFilter: 'all' } as const;

	it('returns everything with no filters', () => {
		expect(filterCreatures(list, base)).toHaveLength(3);
	});
	it('filters by rarity', () => {
		expect(filterCreatures(list, { ...base, rarityFilter: 'mythic' }).map((c) => c.name)).toEqual([
			'Echo'
		]);
	});
	it('filters by domain', () => {
		expect(filterCreatures(list, { ...base, domainFilter: 'temporal' })).toHaveLength(1);
	});
	it('searches across name, kind and flavor, case-insensitively', () => {
		expect(filterCreatures(list, { ...base, search: 'BEAST' }).map((c) => c.name)).toEqual([
			'Mossback'
		]);
		expect(filterCreatures(list, { ...base, search: 'answers' }).map((c) => c.name)).toEqual([
			'Echo'
		]);
	});
});

describe('sortCreatures', () => {
	const a = make({ name: 'Zelibeth', cost: 3, rarity: 'common', updated: '2026-01-01T00:00:00Z' });
	const b = make({ name: 'Auric', cost: 1, rarity: 'mythic', updated: '2026-03-01T00:00:00Z' });
	const c = make({ name: 'Mire', cost: 5, rarity: 'uncommon', updated: '2026-02-01T00:00:00Z' });
	const list = [a, b, c];

	it('sorts by name A→Z', () => {
		expect(sortCreatures(list, 'name').map((x) => x.name)).toEqual(['Auric', 'Mire', 'Zelibeth']);
	});
	it('sorts by cost ascending', () => {
		expect(sortCreatures(list, 'cost').map((x) => x.cost)).toEqual([1, 3, 5]);
	});
	it('sorts by rarity, most precious first', () => {
		expect(sortCreatures(list, 'rarity').map((x) => x.rarity)).toEqual([
			'mythic',
			'uncommon',
			'common'
		]);
	});
	it('sorts by recency, newest first', () => {
		expect(sortCreatures(list, 'recent').map((x) => x.name)).toEqual(['Auric', 'Mire', 'Zelibeth']);
	});
	it('does not mutate the input list', () => {
		const before = list.map((x) => x.name);
		sortCreatures(list, 'name');
		expect(list.map((x) => x.name)).toEqual(before);
	});
});

describe('rarityCounts', () => {
	it('tallies each tier', () => {
		const list = [
			make({ rarity: 'common' }),
			make({ rarity: 'common' }),
			make({ rarity: 'rare' }),
			make({ rarity: 'mythic' })
		];
		expect(rarityCounts(list)).toEqual({ common: 2, uncommon: 0, rare: 1, mythic: 1 });
	});
});
