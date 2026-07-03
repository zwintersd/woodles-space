import { describe, expect, it } from 'vitest';
import type { Creature } from '@bestiary/types';
import type { PublicCreature } from '@woodles/sync';
import { mergeWorldCreatures, type BestiaryCreature } from './bestiaryDb';

// A hand-built fixture rather than bestiary's own blankCreature() — pulling
// that in would import bestiary's runtime code into marginalia's test build,
// which needs bestiary's own `svelte-kit sync` to have already run. Local,
// self-contained fixtures keep `pnpm --filter marginalia test` working from a
// clean checkout, matching every other app in the workspace.
function local(over: Partial<Creature>): BestiaryCreature {
	return {
		id: 'l1',
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
		stats: { body: 0, mind: 0, grace: 0, heart: 0, will: 0, spark: 0, substats: {} },
		created: '2026-01-01T00:00:00.000Z',
		updated: '2026-01-01T00:00:00.000Z',
		...over
	};
}

function published(over: Partial<PublicCreature>): PublicCreature {
	return {
		id: 'p1',
		name: 'Driftling',
		domain: 'spatial',
		kind: 'Wisp',
		cost: 2,
		rarity: 'common',
		power: 1,
		toughness: 1,
		abilities: '',
		flavor: '',
		foundIn: '',
		cardImage: 'data:card',
		isolatedSprite: 'data:isolated',
		publishedAt: '2026-07-02T00:00:00.000Z',
		...over
	};
}

describe('mergeWorldCreatures', () => {
	it('is empty when both sources are empty — the unbound-placeholder tier', () => {
		expect(mergeWorldCreatures([], [])).toEqual([]);
	});

	it('tags local creatures "local", carrying sprite fields through as-is', () => {
		const c = local({ id: 'l1', name: 'Mine', sprite: 'data:flat', isolatedSprite: 'data:cut', pixelated: true });
		const [out] = mergeWorldCreatures([c], []);
		expect(out).toEqual({
			id: 'l1',
			name: 'Mine',
			sprite: 'data:flat',
			isolatedSprite: 'data:cut',
			pixelated: true,
			source: 'local'
		});
	});

	it('falls back to the published snapshot when local is empty', () => {
		const p = published({ id: 'p1', name: 'Driftling' });
		const [out] = mergeWorldCreatures([], [p]);
		expect(out.source).toBe('published');
		expect(out.name).toBe('Driftling');
		// the public blob pre-resolves isolatedSprite ?? sprite at publish time —
		// there's no separate raw sprite left to carry.
		expect(out.sprite).toBeNull();
		expect(out.isolatedSprite).toBe('data:isolated');
	});

	it('lists local creatures before published ones', () => {
		const l = local({ id: 'l1', name: 'Mine' });
		const p = published({ id: 'p1', name: 'Theirs' });
		const out = mergeWorldCreatures([l], [p]);
		expect(out.map((c) => c.id)).toEqual(['l1', 'p1']);
	});

	it("drops a published entry whose id is already local — no duplicate on Z's own device", () => {
		const l = local({ id: 'shared', name: 'Local copy' });
		const p = published({ id: 'shared', name: 'Published copy' });
		const out = mergeWorldCreatures([l], [p]);
		expect(out).toHaveLength(1);
		expect(out[0].source).toBe('local');
		expect(out[0].name).toBe('Local copy');
	});

	it('defaults a published creature with no pixelated flag to smooth (pre-existing snapshots)', () => {
		const p = published({ id: 'p1' });
		delete (p as Partial<PublicCreature>).pixelated;
		const [out] = mergeWorldCreatures([], [p]);
		expect(out.pixelated).toBe(false);
	});

	it("carries a published creature's pixelated flag through when present", () => {
		const p = published({ id: 'p1', pixelated: true });
		const [out] = mergeWorldCreatures([], [p]);
		expect(out.pixelated).toBe(true);
	});
});
