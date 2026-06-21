// World 1 — the stuff in the world.
// Each entry emerges once its required conditions are written. Brianna cannot
// touch a thing until she has witnessed it: notice, observe, study, know.

import type { StockVector, Needs } from '../vitals';

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
	// idle tuning ──────────────────────────────────────────────────────────
	// insightWeight: how much Insight this life yields once witnessed. The
	//   per-second yield scales with how deeply it has been observed.
	// studyEase: how quickly attention deepens here. >1 is quick to know,
	//   <1 is slow but usually richer — the core min/max tension.
	insightWeight: number;
	studyEase: number;
	// vital signs ────────────────────────────────────────────────────────────
	// metabolism: per-second effect on each stock at full activity (Known and
	//   healthy), positive produces / negative consumes. Scaled by stage and
	//   vitality at runtime. Omitted = metabolically inert.
	// needs: healthy bands on the stocks this life depends on. Out of band, the
	//   life is stressed: it yields less, deepens slower, and its vitality drains.
	metabolism?: StockVector;
	needs?: Needs;
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
		insightWeight: 0.5,
		studyEase: 1.4,
		metabolism: { nutrients: 0.03 },
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
		insightWeight: 1.2,
		studyEase: 1.0,
		metabolism: { oxygen: 0.2, nutrients: -0.06 },
		needs: { nutrients: [30, 100] },
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
		insightWeight: 1.7,
		studyEase: 0.7,
		metabolism: { oxygen: 0.02, nutrients: 0.02 },
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
		insightWeight: 1.4,
		studyEase: 0.9,
		metabolism: { oxygen: -0.1 },
		needs: { oxygen: [45, 100] },
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
		insightWeight: 0.7,
		studyEase: 1.3,
		metabolism: { oxygen: 0.05, nutrients: 0.02, moisture: -0.02 },
		needs: { moisture: [15, 100] },
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
		insightWeight: 0.9,
		studyEase: 1.1,
		metabolism: { oxygen: 0.1, nutrients: -0.04, moisture: -0.05 },
		needs: { moisture: [40, 100], nutrients: [25, 100] },
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
		insightWeight: 1.9,
		studyEase: 0.6,
		metabolism: { nutrients: 0.15, oxygen: -0.03 },
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
		insightWeight: 0.6,
		studyEase: 1.3,
		metabolism: { moisture: 0.06 },
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
		insightWeight: 1.0,
		studyEase: 1.0,
		metabolism: { moisture: 0.05 },
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
		insightWeight: 1.5,
		studyEase: 0.8,
		metabolism: { moisture: 0.18 },
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
		insightWeight: 0.8,
		studyEase: 1.2,
		metabolism: { moisture: 0.07 },
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
