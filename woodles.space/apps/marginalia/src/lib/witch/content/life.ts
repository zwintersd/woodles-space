// World 1 — the stuff in the world.
// Each entry emerges once its required conditions are written. Brianna cannot
// touch a thing until she has witnessed it: notice, observe, study, know.

export type LifeCategory = 'aquatic' | 'terrestrial' | 'atmospheric';
export type LifeDomain = 'plant' | 'animal' | 'ecosystem' | 'geology' | 'weather';

// the language of care varies by domain
export const domainVerb: Record<LifeDomain, string> = {
	plant: 'tend',
	animal: 'guide',
	ecosystem: 'encourage',
	geology: 'shape',
	weather: 'invoke'
};

export interface Life {
	id: string;
	name: string;
	scientificName: string;
	category: LifeCategory;
	domain: LifeDomain;
	// every required condition must be written for this to emerge
	requires: string[];
	// the four observation stages — the description fills in as she watches
	notice: string; // greyed-out, before she has looked
	observe: string; // first sustained look
	study: string; // patterns over time
	know: string; // enough to know what help would mean
}

export const world1Life: Life[] = [
	// ── aquatic ──────────────────────────────────────────────────────────────
	{
		id: 'salt_deposit',
		name: 'salt deposits',
		scientificName: 'Halite cristata',
		category: 'aquatic',
		domain: 'geology',
		requires: ['holding'],
		notice: 'something white gathering at the tide line.',
		observe: 'crystals. they grow where the water is allowed to leave but the salt is not.',
		study: 'they keep the shape of the last wave. the sea writes itself down here.',
		know: 'a slow ledger of every tide. she could shape where they form, and the coast would remember differently.'
	},
	{
		id: 'algae_bloom',
		name: 'the algae bloom',
		scientificName: 'Prima viridis',
		category: 'aquatic',
		domain: 'plant',
		requires: ['flow', 'reaching'],
		notice: 'something green in the shallows.',
		observe: 'it pulses, faintly, with the light. the first thing here that eats the sun.',
		study: 'it spreads toward nutrients and dies when the water warms. it keeps the light cycle better than a clock.',
		know: 'she knows what it wants now. she could tend it — and tending it would mean knowing when to stop.'
	},
	{
		id: 'tidal_pool',
		name: 'the tidal pools',
		scientificName: 'Refugium litoris',
		category: 'aquatic',
		domain: 'ecosystem',
		requires: ['flow', 'holding'],
		notice: 'small held waters along the rock.',
		observe: 'each pool is its own argument. cut off twice a day, and richer for it.',
		study: 'the crowded ones diverge fastest. scarcity, doing its patient work.',
		know: 'every pool a small experiment. she could encourage them — but the pools are already trying everything.'
	},
	{
		id: 'soft_swimmer',
		name: 'the soft-bodied swimmers',
		scientificName: 'Mollis natans',
		category: 'aquatic',
		domain: 'animal',
		requires: ['boundary', 'flow'],
		notice: 'a drifting translucence in the deeper water.',
		observe: 'a boundary that moves itself. it has no plan, only a pulse.',
		study: 'it follows warmth and flinches from shadow. the first life here that decides anything.',
		know: 'it can be guided, gently, the way you guide something that does not know it is being guided.'
	},

	// ── terrestrial ──────────────────────────────────────────────────────────
	{
		id: 'lichen',
		name: 'the lichens',
		scientificName: 'Foedus saxi',
		category: 'terrestrial',
		domain: 'plant',
		requires: ['reaching', 'holding'],
		notice: 'a grey-gold crust on the bare rock.',
		observe: 'two lives agreeing to be one. it asks the stone for almost nothing.',
		study: 'it advances a hair each year and unmakes the rock as it goes. the first soil is its leavings.',
		know: 'patience made visible. to tend it is mostly to wait, and to not undo its waiting.'
	},
	{
		id: 'moss',
		name: 'the moss carpets',
		scientificName: 'Tapes humilis',
		category: 'terrestrial',
		domain: 'plant',
		requires: ['reaching', 'returning'],
		notice: 'a low green softening the hollows.',
		observe: 'it has no roots. it drinks the whole sky at once and holds the rain in place.',
		study: 'where it spreads, the ground stops leaving. it keeps the water for everything that comes after.',
		know: 'it asks for shade and damp. she could tend it toward the dry places — kindly, or not.'
	},
	{
		id: 'fungal_net',
		name: 'the fungal network',
		scientificName: 'Filum subterra',
		category: 'terrestrial',
		domain: 'ecosystem',
		requires: ['returning', 'holding'],
		notice: 'pale threads under the moss, where she had not thought to look.',
		observe: 'it is the part of returning that no one sees. it eats what has ended.',
		study: 'every separate plant is, underground, not separate at all. it carries word between them.',
		know: 'the world is more connected than it looks. to encourage it is to trust a thing she cannot see working.'
	},
	{
		id: 'spring',
		name: 'the freshwater springs',
		scientificName: 'Fons dulcis',
		category: 'terrestrial',
		domain: 'geology',
		requires: ['falling', 'flow'],
		notice: 'a dark seam in the rock that stays wet.',
		observe: 'water arriving from inside the land, having fallen somewhere else first.',
		study: 'it is the same rain, kept and slowly given back. the land breathes out where it is lowest.',
		know: 'she could shape the stone and move the spring. monumental, slow work — the sculptor kind of care.'
	},

	// ── atmospheric ──────────────────────────────────────────────────────────
	{
		id: 'cloud',
		name: 'the clouds',
		scientificName: 'Nimbus primus',
		category: 'atmospheric',
		domain: 'weather',
		requires: ['flow', 'falling'],
		notice: 'the sky is no longer empty.',
		observe: 'water, gone up, gathered, made visible. the cycle showing its work.',
		study: 'they thicken over the warm sea and break against the cold land. weather is just water with somewhere to be.',
		know: 'she cannot command a cloud. she can only invoke — ask, and wait to see if it answers.'
	},
	{
		id: 'rain',
		name: 'the rain',
		scientificName: 'Pluvia reditus',
		category: 'atmospheric',
		domain: 'weather',
		requires: ['flow', 'falling', 'returning'],
		notice: 'the clouds are letting go of something.',
		observe: 'freshwater, carried inland and set down where nothing could reach before.',
		study: 'it decides where the land turns green. everything terrestrial waits on its schedule.',
		know: 'the most she can do is petition the sky. rain is the world deciding to be generous.'
	},
	{
		id: 'mist',
		name: 'the coastal mist',
		scientificName: 'Nebula litoris',
		category: 'atmospheric',
		domain: 'weather',
		requires: ['flow', 'boundary'],
		notice: 'the shoreline blurs in the early light.',
		observe: 'a soft, low water that never quite becomes rain.',
		study: 'it makes a narrow band of damp the moss and lichen never have to leave. a microhabitat, hand-width thin.',
		know: 'invoked, never commanded — but she has learned where the mist wants to be.'
	}
];

export function revealedLife(written: ReadonlySet<string>): Life[] {
	return world1Life.filter((l) => l.requires.every((r) => written.has(r)));
}

export function lifeById(id: string): Life | undefined {
	return world1Life.find((l) => l.id === id);
}
