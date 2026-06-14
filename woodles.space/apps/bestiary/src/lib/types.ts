import type { Domain, Rarity } from './content/domains';
import type { Substat } from './content/stats';
import type { Composition } from './composer';

// Six axes describing the creature beneath its P/T. Cores are 0–10 integers,
// authored directly. Substats default to their parent core; only authored
// overrides land in the substats record. Empty record = no overrides.
export type Stats = {
	body: number;
	mind: number;
	grace: number;
	heart: number;
	will: number;
	spark: number;
	substats: Partial<Record<Substat, number>>;
};

// A Creature is one card in the bestiary — a sprite the witch's world grew,
// pinned to vellum with its stats, cost, and rarity, as if it were yours to play.
export type Creature = {
	id: string;
	name: string;
	// the uploaded sprite, downscaled to a data URL (see image.ts). null = no art yet.
	// when art is built in the studio this holds the flattened composite.
	sprite: string | null;
	// pixel-art sprites read best un-smoothed; photos read better smoothed.
	pixelated: boolean;
	// the editable layer stack behind the sprite, when it was built in the studio.
	// absent for plain uploads and pre-studio cards — sprite is then the whole art.
	composition?: Composition | null;
	// color identity — which kind of condition it emerged from
	domain: Domain;
	// the type line subtype, e.g. "Beast", "Spirit Wisp", "Construct"
	kind: string;
	// essence to call it forth — Marginalia's currency
	cost: number;
	rarity: Rarity;
	// the iconic P/T box
	power: number;
	toughness: number;
	// rules text — what it does
	abilities: string;
	// italic flavour text
	flavor: string;
	// where in the margins it was first seen (flavour, optional)
	foundIn: string;
	// the six-axis interior — who this creature is beneath the battle math
	stats: Stats;
	created: string;
	updated: string;
};

export type BestiarySettings = {
	// the collection's preferred sort, kept across sessions and devices
	sort?: SortKey;
};

export type BestiaryBlob = {
	creatures: Creature[];
	settings: BestiarySettings;
};

export type BestiaryView = 'collection' | 'editor';

// What the collection is sorted/filtered by.
export type SortKey = 'recent' | 'name' | 'cost' | 'rarity';
export type RarityFilter = Rarity | 'all';
export type DomainFilter = Domain | 'all';
