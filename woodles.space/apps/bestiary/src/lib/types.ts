import type { Domain, Rarity } from './content/domains';
import type { Substat } from './content/stats';
import type { Composition } from './composer';
import type { CardStyle } from './cardstyle';

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
	// the card's chosen look. absent/null = the house default frame.
	cardStyle?: CardStyle | null;
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

// How large the specimen sits on the workshop stage.
export type CardSize = 'snug' | 'roomy' | 'grand';

// How the workshop is arranged, and how loud it feels. Kept across sessions so
// the bench is always how you left it — predictability is a feature, not a
// nicety, for the senses these knobs are here to serve.
export type WorkshopPrefs = {
	// the tool rail folded down to its glyphs
	railCollapsed: boolean;
	// the controls panel tucked away — the specimen gets the room
	panelCollapsed: boolean;
	// how large the card sits on the stage
	cardSize: CardSize;
	// the little whispered notes & inline descriptions (off = less to read)
	showHints: boolean;
	// still backgrounds, softer glow — fewer things competing for attention
	calm: boolean;
	// hold all drifting, hovering, springing motion
	reduceMotion: boolean;
};

export type BestiarySettings = {
	// the collection's preferred sort, kept across sessions and devices
	sort?: SortKey;
	// how the workshop is laid out & how quiet it feels
	workshop?: Partial<WorkshopPrefs>;
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
