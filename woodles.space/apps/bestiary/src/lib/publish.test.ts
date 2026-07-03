import { describe, expect, it } from 'vitest';
import { blankCreature } from './collection';
import { createImageLayer, emptyComposition } from './composer';
import {
	applyPublishedFlags,
	buildPublicCreature,
	isCardOnly,
	rawSourceFor,
	resolvedSpriteFor
} from './publish';
import type { Creature } from './types';

function make(over: Partial<Creature>): Creature {
	return { ...blankCreature(), ...over };
}

describe('rawSourceFor', () => {
	it('is null for a creature with no art at all', () => {
		expect(rawSourceFor(make({}))).toBeNull();
	});

	it('is the plain sprite for a pre-studio upload', () => {
		const c = make({ sprite: 'data:plain' });
		expect(rawSourceFor(c)).toBe('data:plain');
	});

	it('is the creature layer\'s pre-FX src for a studio composition', () => {
		const creatureLayer = createImageLayer({ src: 'data:raw', naturalW: 10, naturalH: 10, isCreature: true });
		const backdrop = createImageLayer({ src: 'data:backdrop', naturalW: 10, naturalH: 10, isCreature: false });
		const c = make({
			sprite: 'data:flattened',
			composition: { ...emptyComposition(), layers: [backdrop, creatureLayer] }
		});
		expect(rawSourceFor(c)).toBe('data:raw');
	});

	it('falls back to the flattened sprite when no layer is flagged as the creature', () => {
		const backdrop = createImageLayer({ src: 'data:backdrop', naturalW: 10, naturalH: 10, isCreature: false });
		const c = make({
			sprite: 'data:flattened',
			composition: { ...emptyComposition(), layers: [backdrop] }
		});
		expect(rawSourceFor(c)).toBe('data:flattened');
	});

	it('skips a hidden creature layer, matching renderIsolatedCreature\'s own layer predicate', () => {
		const hiddenCreatureLayer = {
			...createImageLayer({ src: 'data:raw', naturalW: 10, naturalH: 10, isCreature: true }),
			hidden: true
		};
		const c = make({
			sprite: 'data:flattened',
			composition: { ...emptyComposition(), layers: [hiddenCreatureLayer] }
		});
		expect(rawSourceFor(c)).toBe('data:flattened');
	});
});

describe('resolvedSpriteFor', () => {
	it('prefers the isolated sprite over the plain one', () => {
		const c = make({ sprite: 'data:plain', isolatedSprite: 'data:isolated' });
		expect(resolvedSpriteFor(c)).toBe('data:isolated');
	});

	it('falls back to the plain sprite when there is no isolated crop', () => {
		const c = make({ sprite: 'data:plain', isolatedSprite: null });
		expect(resolvedSpriteFor(c)).toBe('data:plain');
	});

	it('is null when the creature has neither', () => {
		expect(resolvedSpriteFor(make({}))).toBeNull();
	});
});

describe('isCardOnly', () => {
	it('is true for a plain upload with no isolated crop', () => {
		expect(isCardOnly(make({ sprite: 'data:plain', isolatedSprite: null }))).toBe(true);
	});
	it('is false once the studio has produced an isolated crop', () => {
		expect(isCardOnly(make({ sprite: 'data:plain', isolatedSprite: 'data:isolated' }))).toBe(false);
	});
	it('is false for a creature with no art (nothing to flag as "card-only")', () => {
		expect(isCardOnly(make({}))).toBe(false);
	});
});

describe('buildPublicCreature', () => {
	it('carries the card fields, the resolved sprite, and no source by default', () => {
		const c = make({
			name: 'Hourling',
			domain: 'temporal',
			kind: 'Spirit',
			cost: 3,
			rarity: 'rare',
			power: 2,
			toughness: 4,
			abilities: 'ticks',
			flavor: 'a small clock',
			foundIn: 'the margin',
			sprite: 'data:plain'
		});

		const out = buildPublicCreature(c, 'data:card-image', '2026-07-02T00:00:00.000Z');

		expect(out).toEqual({
			id: c.id,
			name: 'Hourling',
			domain: 'temporal',
			kind: 'Spirit',
			cost: 3,
			rarity: 'rare',
			power: 2,
			toughness: 4,
			abilities: 'ticks',
			flavor: 'a small clock',
			foundIn: 'the margin',
			cardImage: 'data:card-image',
			isolatedSprite: 'data:plain',
			pixelated: false,
			publishedAt: '2026-07-02T00:00:00.000Z'
		});
		expect(out).not.toHaveProperty('sourceImage');
	});

	it('carries pixelated through so a visitor sees pixel art unsmoothed', () => {
		const c = make({ sprite: 'data:plain', pixelated: true });
		const out = buildPublicCreature(c, 'data:card-image', '2026-07-02T00:00:00.000Z');
		expect(out.pixelated).toBe(true);
	});

	it('includes sourceImage only when publishSource is opted in', () => {
		const c = make({ sprite: 'data:plain', publishSource: true });
		const out = buildPublicCreature(c, 'data:card-image', '2026-07-02T00:00:00.000Z');
		expect(out.sourceImage).toBe('data:plain');
	});

	it('omits sourceImage when publishSource is off, even with art to show', () => {
		const c = make({ sprite: 'data:plain', publishSource: false });
		const out = buildPublicCreature(c, 'data:card-image', '2026-07-02T00:00:00.000Z');
		expect(out).not.toHaveProperty('sourceImage');
	});

	it('trims free-text fields, matching what the publish preview itself displays', () => {
		const c = make({
			name: '  Dragon ',
			kind: ' Beast ',
			abilities: ' breathes fire ',
			flavor: ' ancient ',
			foundIn: ' a cave '
		});
		const out = buildPublicCreature(c, 'data:card-image', '2026-07-02T00:00:00.000Z');
		expect(out.name).toBe('Dragon');
		expect(out.kind).toBe('Beast');
		expect(out.abilities).toBe('breathes fire');
		expect(out.flavor).toBe('ancient');
		expect(out.foundIn).toBe('a cave');
	});
});

describe('applyPublishedFlags', () => {
	it('marks selected creatures published and clears everyone else', () => {
		const a = make({ id: 'a', published: true });
		const b = make({ id: 'b', published: false });
		const c = make({ id: 'c' }); // never set — falsy today

		const result = applyPublishedFlags([a, b, c], new Set(['b', 'c']));

		expect(result.find((x) => x.id === 'a')?.published).toBe(false);
		expect(result.find((x) => x.id === 'b')?.published).toBe(true);
		expect(result.find((x) => x.id === 'c')?.published).toBe(true);
	});

	it('returns the same object reference for creatures whose flag is unchanged', () => {
		const a = make({ id: 'a', published: true });
		const b = make({ id: 'b', published: false });

		const result = applyPublishedFlags([a, b], new Set(['a']));

		expect(result[0]).toBe(a); // still published, untouched
		expect(result[1]).toBe(b); // still unpublished, untouched
	});

	it('an empty selection unpublishes everything', () => {
		const a = make({ id: 'a', published: true });
		const result = applyPublishedFlags([a], new Set());
		expect(result[0].published).toBe(false);
	});
});
