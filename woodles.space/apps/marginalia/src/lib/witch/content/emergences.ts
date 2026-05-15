// Tier 2 — emergent conditions.
// These are not written. They appear, on their own, once the conditions that
// imply them are both present. The web revealing its own depth.

export interface Emergence {
	id: string;
	name: string;
	// both conditions must be written for this to surface
	from: [string, string];
	note: string;
}

export const emergences: Emergence[] = [
	{
		id: 'metabolism',
		name: 'metabolism',
		from: ['flow', 'holding'],
		note: 'something began keeping what passed through it.'
	},
	{
		id: 'dispersal',
		name: 'dispersal',
		from: ['flow', 'reaching'],
		note: 'the currents learned to carry things outward.'
	},
	{
		id: 'structure',
		name: 'structure',
		from: ['holding', 'reaching'],
		note: 'holding and reaching agreed on a shape. roots. spires.'
	},
	{
		id: 'sediment',
		name: 'sediment',
		from: ['falling', 'holding'],
		note: 'what fell was kept. the ground began to remember.'
	},
	{
		id: 'life_cycle',
		name: 'the life cycle',
		from: ['reaching', 'returning'],
		note: 'a thing reached, and ended, and its ending fed the next reach.'
	},
	{
		id: 'weather',
		name: 'weather',
		from: ['returning', 'flow'],
		note: 'water rose, gathered, and came back down. she had not asked for rain.'
	},
	{
		id: 'sensation',
		name: 'sensation',
		from: ['boundary', 'touch'],
		note: 'a boundary that flinches. the first faint idea of a nerve.'
	},
	{
		id: 'evolution',
		name: 'iteration',
		from: ['repeating', 'reaching'],
		note: 'each repetition reached a little further than the last.'
	},
	{
		id: 'cell',
		name: 'the enclosed life',
		from: ['boundary', 'flow'],
		note: 'a boundary with a current inside it. the smallest possible world.'
	}
];

// which emergences are unlocked by a given set of written conditions
export function revealedEmergences(written: ReadonlySet<string>): Emergence[] {
	return emergences.filter((e) => written.has(e.from[0]) && written.has(e.from[1]));
}
