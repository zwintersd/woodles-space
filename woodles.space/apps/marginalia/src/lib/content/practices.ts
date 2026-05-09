// reading practices — timed active abilities.

export interface Practice {
	id: string;
	name: string;
	cost: number; // glosses
	cooldown: number; // seconds
	duration: number; // seconds (0 = instant)
	description: string;
}

export const practices: Practice[] = [
	{
		id: 'close_reading',
		name: 'close reading',
		cost: 50,
		cooldown: 8,
		duration: 6,
		description: 'next 10 clicks produce 5×. (active 6s)'
	},
	{
		id: 'marginal_seance',
		name: 'marginal séance',
		cost: 300,
		cooldown: 45,
		duration: 15,
		description: 'summons a passage from a previous prestige into the feed for 15s.'
	},
	{
		id: 'unname',
		name: 'unname something',
		cost: 800,
		cooldown: 90,
		duration: 0,
		description: 'delete one entry from the feed; gain glosses equal to its cost.'
	}
];
