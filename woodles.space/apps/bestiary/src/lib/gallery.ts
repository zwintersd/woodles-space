// Pure, rune-free gallery logic — sorting the published snapshot and picking
// out the before/after spotlight. Kept out of the $state store (gallery.svelte.ts)
// so it can be unit-tested directly (see bestiary.svelte.ts for why).
// ROADMAP.md week 3: the gallery, and the first open.

import type { PublicCreature } from '@woodles/sync';
import type { Creature } from './types';
import { defaultStats } from './collection';
import { uid, now } from './utils';

// A stable reading order independent of publish-time ordering — alphabetical,
// mirroring collection.ts's sortCreatures('name') comparator so the gallery
// and a designer's own shelf sort the same way.
export function sortGalleryCreatures(creatures: PublicCreature[]): PublicCreature[] {
	return [...creatures].sort((a, b) => (a.name || '~').localeCompare(b.name || '~'));
}

// Creatures Z opted into "show the source" for (ROADMAP.md week 2's per-card
// toggle) — the before/after spotlight, the clearest way to say "your art is
// enough." Order follows whatever order it's given (the gallery store passes
// the already-sorted list through). The return type narrows sourceImage to a
// plain string, so callers don't need their own null check to bind it as an
// <img src>.
export function beforeAfterCreatures(
	creatures: PublicCreature[]
): (PublicCreature & { sourceImage: string })[] {
	return creatures.filter(
		(c): c is PublicCreature & { sourceImage: string } => !!c.sourceImage
	);
}

// "Adopt a card" (ROADMAP.md week 4): copy a published creature into the
// visitor's own local bestiary as a starting point to remix. Only what was
// actually published carries over — the six-axis stat block, compositions,
// and card styles were never public (ROADMAP.md week 1's "exactly two
// assets" decision) — so the adopted card starts with a blank stat block and
// the house default look, same as any freshly summoned creature, and its
// art is the isolated cutout (the clean, studio-finished crop), not the
// before/after spotlight's raw source. Marked with its lineage per
// ROADMAP.md week 4; wording is Z's to revise.
export const ADOPTED_LINEAGE = 'after a card by Z';

export function buildAdoptedCreature(pub: PublicCreature): Creature {
	const ts = now();
	return {
		id: uid(),
		name: pub.name,
		sprite: pub.isolatedSprite,
		isolatedSprite: pub.isolatedSprite,
		pixelated: false,
		composition: null,
		cardStyle: null,
		domain: pub.domain as Creature['domain'],
		kind: pub.kind,
		cost: pub.cost,
		rarity: pub.rarity as Creature['rarity'],
		power: pub.power,
		toughness: pub.toughness,
		abilities: pub.abilities,
		flavor: pub.flavor,
		foundIn: pub.foundIn,
		stats: defaultStats(),
		status: {},
		published: false,
		publishSource: false,
		lineage: ADOPTED_LINEAGE,
		created: ts,
		updated: ts
	};
}
