// The journal. Brianna writes entries as the world changes; their tone
// answers to Favor — how the world feels about how she has treated it.
// Foundations: a small seed set, picked by milestone + favor band.

export type FavorBand = 'low' | 'even' | 'high';

export interface JournalSeed {
	id: string;
	// shown when the player has reached this many written conditions
	atConditions: number;
	band: FavorBand;
	text: string;
}

export const journalSeeds: JournalSeed[] = [
	{
		id: 'open_even',
		atConditions: 0,
		band: 'even',
		text: 'The planet is empty. I have a Book. I do not know why either of those things is true, only that they are, and that the Book is warm and the planet is not.'
	},
	{
		id: 'first_even',
		atConditions: 1,
		band: 'even',
		text: 'I wrote one line. I did not write a river — I wrote *flow* — and the world made a river out of it without asking me how. I think I am going to like it here.'
	},
	{
		id: 'few_high',
		atConditions: 3,
		band: 'high',
		text: 'It keeps giving me more than I asked for. I wrote four conditions and the shallows answered with forty greens. I am trying to learn all their names. It feels rude not to.'
	},
	{
		id: 'few_low',
		atConditions: 3,
		band: 'low',
		text: 'I took what I needed quickly. The world gave it. It also went a little quiet, the way a room goes quiet. I told myself I imagined that.'
	},
	{
		id: 'many_high',
		atConditions: 6,
		band: 'high',
		text: 'I watched a tidal pool for a long time today. Nothing happened, and then everything did, slowly. I did not write any of it. I only knew where to look. I do not know why I am crying.'
	}
];
