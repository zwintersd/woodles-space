// generator definitions. ten tiers, text-only.
// rate is glosses/sec at level 1. cost scales 1.15x per purchase.

export interface Generator {
	id: string;
	name: string;
	baseCost: number;
	rate: number;
	flavor: string;
	narration: string;
	// optional special hooks evaluated by the tick loop
	clickPowerBonus?: number;       // +X per level multiplied into click power
	commentaryRateBonus?: number;   // +X per level into commentary autocollect speed
	enablesCommentaryAutocollect?: boolean;
	doublesWhileActive?: boolean;   // doubles total production while feed is active
	occasionalApparatus?: boolean;
	occasionalRecension?: boolean;
}

export const generators: Generator[] = [
	{
		id: 'corner',
		name: 'the dog-eared corner',
		baseCost: 15,
		rate: 0.1,
		flavor: 'a corner is folded down. you do not remember folding it.',
		narration: 'a corner is folded down.'
	},
	{
		id: 'underline',
		name: 'the underline',
		baseCost: 100,
		rate: 1,
		flavor: 'a line is underlined twice. emphasis disagreeing with itself.',
		narration: 'a line is underlined twice.'
	},
	{
		id: 'bracket',
		name: 'the bracket',
		baseCost: 1_100,
		rate: 5,
		flavor: 'a bracket opens. nothing closes it for three pages.',
		narration: 'a bracket opens.'
	},
	{
		id: 'dispute',
		name: 'the dispute',
		baseCost: 12_000,
		rate: 25,
		clickPowerBonus: 0.01,
		flavor: 'a previous reader disagrees with you in the margin. you disagree back.',
		narration: 'a dispute thickens in the margin.'
	},
	{
		id: 'glossator',
		name: 'the glossator',
		baseCost: 130_000,
		rate: 100,
		enablesCommentaryAutocollect: true,
		flavor: 'someone is making a fair copy of your notes.',
		narration: 'the glossator copies your notes.'
	},
	{
		id: 'scholiast',
		name: 'the scholiast',
		baseCost: 1_400_000,
		rate: 500,
		commentaryRateBonus: 0.05,
		flavor: 'the scholiast cites you. you have not yet written the cited passage.',
		narration: 'the scholiast cites a passage you have not yet written.'
	},
	{
		id: 'unknown_hand',
		name: 'the hand of an unknown reader',
		baseCost: 20_000_000,
		rate: 2_500,
		flavor: 'a different hand. a different century, possibly.',
		narration: 'a different hand appears in the margin.'
	},
	{
		id: 'second_hand',
		name: 'the second hand',
		baseCost: 330_000_000,
		rate: 12_000,
		doublesWhileActive: true,
		flavor: 'someone is reading along behind you, faster than you.',
		narration: 'the second hand catches up, briefly.'
	},
	{
		id: 'contradiction',
		name: 'the contradiction',
		baseCost: 5_100_000_000,
		rate: 60_000,
		occasionalApparatus: true,
		flavor: 'a footnote references a footnote that references this footnote.',
		narration: 'a footnote folds in on itself.'
	},
	{
		id: 'misattribution',
		name: 'the misattributed citation',
		baseCost: 75_000_000_000,
		rate: 300_000,
		occasionalRecension: true,
		flavor: 'this is being quoted somewhere as if you wrote something you did not write.',
		narration: 'a quotation is attributed to you that you did not write.'
	}
];

export const COST_GROWTH = 1.15;

export function generatorCost(g: Generator, owned: number): number {
	return Math.ceil(g.baseCost * Math.pow(COST_GROWTH, owned));
}
