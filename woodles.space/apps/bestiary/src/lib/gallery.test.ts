import { describe, expect, it } from 'vitest';
import { sortGalleryCreatures, beforeAfterCreatures } from './gallery';
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
