// The published-snapshot shapes served by /api/public — defined in ROADMAP.md
// week 1 so later weeks (the bestiary publish flow, the gallery, echoes) have
// a shared contract to build against. Each is deliberately smaller than its
// private counterpart: only what a visitor's gallery / diorama / reading room
// needs, never editor-only state (compositions, layer stacks, workshop prefs).

// ── bestiary ────────────────────────────────────────────────────────────
//
// exactly two assets per published creature (decided in ROADMAP.md week 1):
// the rendered card image, and the isolated sprite that lets the creature
// live in marginalia's diorama. `domain` / `rarity` mirror bestiary's own
// `Domain` / `Rarity` unions (apps/bestiary/src/lib/content/domains.ts) as
// plain strings, so this package doesn't import app-local types.

// The slug bestiary publishes its curated gallery snapshot under — shared so
// any consumer (bestiary's own publish flow, marginalia's diorama in week 5)
// pulls the same `pullPublic('bestiary', BESTIARY_PUBLIC_SLUG)` rather than
// each hardcoding the string separately.
export const BESTIARY_PUBLIC_SLUG = 'gallery';

export type PublicCreature = {
	id: string;
	name: string;
	domain: string;
	kind: string;
	cost: number;
	rarity: string;
	power: number;
	toughness: number;
	abilities: string;
	flavor: string;
	foundIn: string;
	// the finished compact card (cardImage.ts / render.ts output)
	cardImage: string;
	// the studio's "S" layer when there is one, else the plain flat sprite —
	// resolved once at publish time (bestiary's `isolatedSprite ?? sprite`, the
	// same fallback marginalia's diorama already applies locally), so this
	// field needs no further fallback downstream. null only when the creature
	// has no art at all.
	isolatedSprite: string | null;
	// pixel-art sprites read best un-smoothed (mirrors Creature.pixelated) —
	// carried along so a visitor's world renders published sprites the same
	// way Z's own device does. optional: blobs published before this field
	// existed simply read as smoothed.
	pixelated?: boolean;
	// "show the source" opt-in (week 2): the raw dropped png, for the
	// before/after gallery spots. off by default — absent unless chosen.
	sourceImage?: string | null;
	publishedAt: string;
};

export type BestiaryPublicBlob = {
	creatures: PublicCreature[];
};

// ── echoes ──────────────────────────────────────────────────────────────
//
// mirrors write's StoredLetter (apps/write/src/lib/letters.ts) minus
// anything editor-only. only letters Z marks public ever land in this blob;
// drafts and private letters stay in the (password-gated) sync table.

export type PublicPocketNote = {
	id: string;
	html: string;
	layer: string;
	createdAt: string;
	updatedAt: string;
};

export type PublicMarginNote = {
	id: string;
	anchorId: string;
	html: string;
	createdAt: string;
	updatedAt: string;
};

export type PublicLetter = {
	id: string;
	title: string;
	theme: string;
	motif: string;
	font: string;
	issue: number;
	publishedAt: string;
	layers: Record<string, { html: string; updatedAt: string }>;
	annotations: { pocketNotes: PublicPocketNote[]; marginNotes: PublicMarginNote[] };
	content: string;
	replyTo: string | null;
};

export type EchoesPublicBlob = {
	letters: PublicLetter[];
};
