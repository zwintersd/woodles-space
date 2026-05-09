// upgrades — discrete unlocks. each adds a new reading practice.

export interface Upgrade {
	id: string;
	name: string;
	description: string;
	cost: { commentaries?: number; apparatus?: number; recensions?: number };
	requires?: { glossators?: number };
}

export const upgrades: Upgrade[] = [
	{
		id: 'reading_pass',
		name: 'the reading pass',
		description: 'words drift through a seam. click in time to annotate. tight timing gives 5×; luminous words give 25×.',
		cost: { commentaries: 1 }
	},
	{
		id: 'collation',
		name: 'collation',
		description: 'every 100th gloss is worth 10×.',
		cost: { commentaries: 5 }
	},
	{
		id: 'emendation',
		name: 'emendation',
		description: 'clicks have a 5% chance to also produce a commentary.',
		cost: { commentaries: 25 }
	},
	{
		id: 'ductus',
		name: 'ductus',
		description: 'rapid successive clicks build a combo. each weighs heavier than the last.',
		cost: { commentaries: 80 }
	},
	{
		id: 'stemma',
		name: 'stemma',
		description: 'visualizes your tradition’s branching as ascii in the side panel.',
		cost: { commentaries: 250 }
	},
	{
		id: 'codex_disclosure',
		name: 'codex disclosure',
		description: 'generators occasionally narrate their own existence into the feed.',
		cost: { commentaries: 600 }
	},
	{
		id: 'missing_leaf',
		name: 'the missing leaf',
		description: 'a random generator goes dark for 30s. when it returns, twice as productive (briefly).',
		cost: { apparatus: 3 }
	},
	{
		id: 'palinode',
		name: 'palinode',
		description: 'once per run, retract everything you have written this run for a 10× burst.',
		cost: { apparatus: 12 }
	},
	{
		id: 'confluence',
		name: 'confluence',
		description: 'commentaries are produced 50% faster.',
		cost: { apparatus: 40 }
	},
	{
		id: 'dispute',
		name: 'the dispute',
		description: 'two reading tracks. click in agreement, disagreement, or counterpoint with a previous reader\'s hand. produces commentaries, apparatus, and recensions.',
		cost: { apparatus: 2 }
	}
];
