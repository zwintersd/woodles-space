// Brianna's titles. Earned through creation milestones; they track her
// changing relationship with what she makes.

export interface Title {
	id: string;
	name: string;
	earnedNote: string;
}

export const titles: Title[] = [
	{
		id: 'witch',
		name: 'The Witch',
		earnedNote: 'what she calls herself when she does not know what else to be.'
	},
	{
		id: 'dreamer',
		name: 'The Dreamer',
		earnedNote: 'she imagined a world before she wrote it.'
	},
	{
		id: 'gardener',
		name: 'The Gardener',
		earnedNote: 'something grew, and she chose to tend it rather than only make it.'
	},
	{
		id: 'mother',
		name: 'The Mother',
		earnedNote: 'she made something that can look back at her. (not yet — not in this world.)'
	},
	{
		id: 'witness',
		name: 'The Witness',
		earnedNote: 'what she always was. (the golden ending.)'
	}
];

export function titleById(id: string): Title {
	return titles.find((t) => t.id === id) ?? titles[0];
}
