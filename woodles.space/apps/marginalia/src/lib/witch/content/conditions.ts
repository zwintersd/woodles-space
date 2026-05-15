// Tier 1 — the first choices.
// Brianna writes conditions, not creatures. She writes a constraint and the
// world figures out the rest. Each condition costs Essence to write.

export interface Condition {
	id: string;
	// the phrase she writes into the Book
	phrase: string;
	// the plain name used in the web's connective tissue
	name: string;
	// what the world does with it
	enables: string;
	cost: number; // essence
}

export const conditions: Condition[] = [
	{
		id: 'flow',
		phrase: 'let there be flow',
		name: 'flow',
		enables: 'cycles, currents, the exchange of one thing for another',
		cost: 1
	},
	{
		id: 'holding',
		phrase: 'let there be holding',
		name: 'holding',
		enables: 'containment, accumulation, the first kind of memory',
		cost: 1
	},
	{
		id: 'falling',
		phrase: 'let there be falling',
		name: 'falling',
		enables: 'gravity, gradients, the tendency of things toward',
		cost: 1
	},
	{
		id: 'reaching',
		phrase: 'let there be reaching',
		name: 'reaching',
		enables: 'growth, extension, hunger that has a direction',
		cost: 2
	},
	{
		id: 'returning',
		phrase: 'let there be returning',
		name: 'returning',
		enables: 'decay, nutrients carried back to their source',
		cost: 2
	},
	{
		id: 'boundary',
		phrase: 'let there be boundary',
		name: 'boundary',
		enables: 'self and other, membranes, the surfaces that hold a life apart',
		cost: 2
	},
	{
		id: 'touch',
		phrase: 'let there be change when touched',
		name: 'sensitivity',
		enables: 'reactivity, reflex, the beginning of response',
		cost: 3
	},
	{
		id: 'repeating',
		phrase: 'let there be repeating',
		name: 'repetition',
		enables: 'pattern, rhythm, reproduction',
		cost: 3
	}
];

export function conditionById(id: string): Condition | undefined {
	return conditions.find((c) => c.id === id);
}
