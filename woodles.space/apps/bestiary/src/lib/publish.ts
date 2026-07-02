// Pure, rune-free publish logic — assembling a BestiaryPublicBlob and
// updating the local "published" markers. Kept out of the $state store so it
// can be unit-tested directly (see bestiary.svelte.ts for why). ROADMAP.md
// week 2: the bestiary publish flow.

import type { PublicCreature } from '@woodles/sync';
import type { Creature } from './types';
import type { ImageLayer } from './composer';

// The slug bestiary publishes its curated gallery snapshot under.
export const BESTIARY_PUBLIC_SLUG = 'gallery';

// The raw art before any studio polish: the pre-studio upload itself, or —
// for a studio-built card — the first creature-flagged layer's source,
// before outline/tint/finish were baked on. Feeds the before/after gallery
// spots (ROADMAP.md week 3, the "show the source" opt-in). null when the
// creature has no art to show at all.
export function rawSourceFor(creature: Creature): string | null {
	const creatureLayer = creature.composition?.layers.find(
		(l): l is ImageLayer => l.kind === 'image' && l.isCreature === true
	);
	return creatureLayer?.src ?? creature.sprite ?? null;
}

// The second published asset (ROADMAP.md week 1): the studio's isolated
// cutout when there is one, else the plain flat sprite as a fallback —
// resolved once, here, at publish time, so the published blob carries the
// same `isolatedSprite ?? sprite` value marginalia's diorama already applies
// locally and needs no further fallback downstream.
export function resolvedSpriteFor(creature: Creature): string | null {
	return creature.isolatedSprite ?? creature.sprite ?? null;
}

// True when the creature has art but no true isolated cutout — its diorama
// presence will be the flat sprite (which may carry a background), not a
// clean studio crop. Surfaced in the publish preview (ROADMAP.md week 2) so
// it's obvious which published creatures got the studio's isolation pass.
export function isCardOnly(creature: Creature): boolean {
	return !!creature.sprite && !creature.isolatedSprite;
}

// Assemble one creature's published snapshot entry. `cardImage` is the
// rasterised compact card (produced by the caller via cardImage.ts's
// renderCardDataUrl — this module stays DOM-free so it's plain-testable).
export function buildPublicCreature(
	creature: Creature,
	cardImage: string,
	publishedAt: string
): PublicCreature {
	const source = creature.publishSource ? rawSourceFor(creature) : null;
	return {
		id: creature.id,
		name: creature.name,
		domain: creature.domain,
		kind: creature.kind,
		cost: creature.cost,
		rarity: creature.rarity,
		power: creature.power,
		toughness: creature.toughness,
		abilities: creature.abilities,
		flavor: creature.flavor,
		foundIn: creature.foundIn,
		cardImage,
		isolatedSprite: resolvedSpriteFor(creature),
		...(source ? { sourceImage: source } : {}),
		publishedAt
	};
}

// After a successful publish, the local `published` marker should mirror
// exactly which creatures made it into this snapshot — republishing is a
// whole-snapshot upsert, so anything not re-selected this time is no longer
// public, even if it was before. Returns a new array; creatures whose flag
// doesn't change keep their original object (cheap no-op for the common case
// of a large, mostly-unpublished collection).
export function applyPublishedFlags(
	creatures: Creature[],
	publishedIds: ReadonlySet<string>
): Creature[] {
	return creatures.map((c) => {
		const shouldBePublished = publishedIds.has(c.id);
		if (!!c.published === shouldBePublished) return c;
		return { ...c, published: shouldBePublished };
	});
}
