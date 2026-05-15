// Tier 0 — the unspoken assumptions.
// Brianna doesn't choose these. They are simply true — for now. The first
// prestige reveals that they *were* assumptions all along.

export type AssumptionGroup = 'temporal' | 'spatial' | 'biochemical' | 'relational';

export interface Assumption {
	id: string;
	group: AssumptionGroup;
	text: string;
}

export const assumptionGroupLabel: Record<AssumptionGroup, string> = {
	temporal: 'on time',
	spatial: 'on space',
	biochemical: 'on substance',
	relational: 'on meaning'
};

export const assumptions: Assumption[] = [
	{ id: 'time_direction', group: 'temporal', text: 'time has a direction' },
	{ id: 'endings', group: 'temporal', text: 'things can end — death exists' },
	{ id: 'continuity', group: 'temporal', text: 'change is continuous' },

	{ id: 'separation', group: 'spatial', text: 'separation exists — this is not that' },
	{ id: 'three_dimensions', group: 'spatial', text: 'there are three dimensions to move through' },
	{ id: 'locality', group: 'spatial', text: 'locality matters — here is not there' },
	{ id: 'gravity', group: 'spatial', text: 'things fall toward what is heavy' },

	{ id: 'water_solvent', group: 'biochemical', text: 'water is the solvent everything happens in' },
	{ id: 'carbon_backbone', group: 'biochemical', text: 'carbon is the backbone life is built on' },
	{ id: 'star_energy', group: 'biochemical', text: 'energy arrives from a star' },
	{ id: 'chirality', group: 'biochemical', text: 'handedness is fixed — molecules choose a side' },
	{ id: 'chemical_memory', group: 'biochemical', text: 'memory is stored in chemistry' },

	{ id: 'causality', group: 'relational', text: 'cause comes before effect' },
	{ id: 'identity', group: 'relational', text: 'a thing stays itself over time' },
	{ id: 'scarcity', group: 'relational', text: 'there is never quite enough' },
	{ id: 'loss', group: 'relational', text: 'information can be lost' }
];
