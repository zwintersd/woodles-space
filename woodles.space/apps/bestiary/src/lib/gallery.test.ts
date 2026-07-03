import { describe, expect, it } from 'vitest';
import { sortGalleryCreatures, beforeAfterCreatures, buildAdoptedCreature, ADOPTED_LINEAGE } from './gallery';
import { statsAreDefault } from './collection';
import type { PublicCreature } from '@woodles/sync';

function make(over: Partial<PublicCreature>): PublicCreature {
	return {
		id: 'x',
		name: '',
		domain: 'unspecified',
		kind: '',
		cost: 1,
		rarity: 'common',
		power: 1,
		toughness: 1,
		abilities: '',
		flavor: '',
		foundIn: '',
		cardImage: 'data:card',
		isolatedSprite: null,
		publishedAt: '2026-07-02T00:00:00.000Z',
		...over
	};
}

describe('sortGalleryCreatures', () => {
	it('sorts alphabetically by name', () => {
		const a = make({ id: 'a', name: 'Zephyr' });
		const b = make({ id: 'b', name: 'Amoebe' });
		const c = make({ id: 'c', name: 'Mossback' });
		expect(sortGalleryCreatures([a, b, c]).map((x) => x.id)).toEqual(['b', 'c', 'a']);
	});

	it('falls back to "~" for an unnamed creature, matching sortCreatures\' comparator', () => {
		const named = make({ id: 'named', name: 'Amoebe' });
		const unnamed = make({ id: 'unnamed', name: '' });
		// '~'.localeCompare(any letter) is negative, so the fallback sorts first.
		expect(sortGalleryCreatures([named, unnamed]).map((x) => x.id)).toEqual(['unnamed', 'named']);
	});

	it('does not mutate the input array', () => {
		const list = [make({ id: 'b', name: 'B' }), make({ id: 'a', name: 'A' })];
		const copy = [...list];
		sortGalleryCreatures(list);
		expect(list).toEqual(copy);
	});
});

describe('beforeAfterCreatures', () => {
	it('keeps only creatures with a sourceImage', () => {
		const withSource = make({ id: 'with', sourceImage: 'data:raw' });
		const without = make({ id: 'without' });
		expect(beforeAfterCreatures([withSource, without]).map((x) => x.id)).toEqual(['with']);
	});

	it('is empty when nothing opted in', () => {
		expect(beforeAfterCreatures([make({})])).toEqual([]);
	});

	it('treats a null sourceImage the same as absent', () => {
		expect(beforeAfterCreatures([make({ sourceImage: null })])).toEqual([]);
	});
});

describe('buildAdoptedCreature', () => {
	it('carries over the published descriptive fields', () => {
		const pub = make({
			id: 'pub1',
			name: 'Hourling',
			domain: 'temporal',
			kind: 'Spirit Wisp',
			cost: 3,
			rarity: 'rare',
			power: 2,
			toughness: 4,
			abilities: 'ticks',
			flavor: 'a small clock',
			foundIn: 'the margin'
		});
		const c = buildAdoptedCreature(pub);
		expect(c.name).toBe('Hourling');
		expect(c.domain).toBe('temporal');
		expect(c.kind).toBe('Spirit Wisp');
		expect(c.cost).toBe(3);
		expect(c.rarity).toBe('rare');
		expect(c.power).toBe(2);
		expect(c.toughness).toBe(4);
		expect(c.abilities).toBe('ticks');
		expect(c.flavor).toBe('a small clock');
		expect(c.foundIn).toBe('the margin');
	});

	it('mints a fresh id, distinct from the published one', () => {
		const pub = make({ id: 'pub1' });
		const c = buildAdoptedCreature(pub);
		expect(c.id).not.toBe('pub1');
		expect(c.id).toBeTruthy();
	});

	it('uses the isolated sprite as the starting art, not the before/after source', () => {
		const pub = make({ isolatedSprite: 'data:isolated', sourceImage: 'data:raw' });
		const c = buildAdoptedCreature(pub);
		expect(c.sprite).toBe('data:isolated');
		expect(c.isolatedSprite).toBe('data:isolated');
	});

	it('is null-arted when the published creature had no isolated sprite', () => {
		const pub = make({ isolatedSprite: null });
		const c = buildAdoptedCreature(pub);
		expect(c.sprite).toBeNull();
		expect(c.isolatedSprite).toBeNull();
	});

	it('starts with no composition or card style — neither was ever published', () => {
		const c = buildAdoptedCreature(make({}));
		expect(c.composition).toBeNull();
		expect(c.cardStyle).toBeNull();
	});

	it('starts with a blank stat block — stats were never published', () => {
		const c = buildAdoptedCreature(make({}));
		expect(statsAreDefault(c.stats)).toBe(true);
	});

	it('is marked with its lineage, and is not itself published', () => {
		const c = buildAdoptedCreature(make({}));
		expect(c.lineage).toBe(ADOPTED_LINEAGE);
		expect(c.published).toBe(false);
		expect(c.publishSource).toBe(false);
	});
});
