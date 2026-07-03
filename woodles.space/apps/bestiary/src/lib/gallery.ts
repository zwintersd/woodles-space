// Pure, rune-free gallery logic — sorting the published snapshot and picking
// out the before/after spotlight. Kept out of the $state store (gallery.svelte.ts)
// so it can be unit-tested directly (see bestiary.svelte.ts for why).
// ROADMAP.md week 3: the gallery, and the first open.

import type { PublicCreature } from '@woodles/sync';

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
