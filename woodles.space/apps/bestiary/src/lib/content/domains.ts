// A creature's Domain is its color identity — the kind of condition it
// emerged from, back in Marginalia, when the witch wrote the world into being.
// The four true domains mirror Marginalia's assumption groups; "unspecified"
// is the wandering creature, found before its domain was ever named.

export type Domain = 'temporal' | 'spatial' | 'biochemical' | 'relational' | 'unspecified';

export interface DomainDef {
	id: Domain;
	// the field-guide label
	name: string;
	// Marginalia's phrasing — "on time", "on space", …
	aspect: string;
	// the rune stamped on the cost pip / domain badge
	glyph: string;
	// CSS custom property that carries this domain's color
	colorVar: string;
	// a one-line evocation, shown when picking a domain
	note: string;
}

export const domains: DomainDef[] = [
	{
		id: 'temporal',
		name: 'Temporal',
		aspect: 'on time',
		glyph: '☽',
		colorVar: '--b-temporal',
		note: 'born of flow, decay, return — things that keep a clock'
	},
	{
		id: 'spatial',
		name: 'Spatial',
		aspect: 'on space',
		glyph: '◆',
		colorVar: '--b-spatial',
		note: 'born of falling, boundary, distance — things that hold a shape'
	},
	{
		id: 'biochemical',
		name: 'Biochemical',
		aspect: 'on substance',
		glyph: '❀',
		colorVar: '--b-biochemical',
		note: 'born of reaching, holding, water — things that grow and feed'
	},
	{
		id: 'relational',
		name: 'Relational',
		aspect: 'on meaning',
		glyph: '∞',
		colorVar: '--b-relational',
		note: 'born of touch, repeating, bond — things that answer and remember'
	},
	{
		id: 'unspecified',
		name: 'Unspecified',
		aspect: 'unwritten',
		glyph: '✶',
		colorVar: '--b-unspecified',
		note: 'a wanderer, discovered before its domain was named'
	}
];

const domainMap = new Map(domains.map((d) => [d.id, d]));

export function domainDef(id: Domain): DomainDef {
	return domainMap.get(id) ?? domains[domains.length - 1];
}

// ── rarity ──────────────────────────────────────────────────────────
// How often the world lets this creature be found. Drives the set-symbol
// color and the gem on the card, exactly like a trading card's rarity.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic';

export interface RarityDef {
	id: Rarity;
	name: string;
	colorVar: string;
	// the symbol stamped in the card's type line
	symbol: string;
	note: string;
}

export const rarities: RarityDef[] = [
	{ id: 'common',   name: 'Common',   colorVar: '--b-common',   symbol: '◦', note: 'seen often, once you know to look' },
	{ id: 'uncommon', name: 'Uncommon', colorVar: '--b-uncommon', symbol: '◈', note: 'a good day in the margins' },
	{ id: 'rare',     name: 'Rare',     colorVar: '--b-rare',     symbol: '✦', note: 'the world parts for it rarely' },
	{ id: 'mythic',   name: 'Mythic',   colorVar: '--b-mythic',   symbol: '✸', note: 'written once, perhaps never again' }
];

const rarityMap = new Map(rarities.map((r) => [r.id, r]));

export function rarityDef(id: Rarity): RarityDef {
	return rarityMap.get(id) ?? rarities[0];
}
