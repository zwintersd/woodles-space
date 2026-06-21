// The five interventions — the language of care, one verb per domain. Unlocked
// on a life once she has come to Know it: she may act, gently and at a cost, or
// witness and leave it be.
//
// The mechanics arrive in Phase C (see DESIGN.md §2); the voice is captured here
// now. `reach` / `permanence` / `uncertain` record the cost↔reach character each
// verb will carry — cheap interventions are broad and low-magnitude, dear ones
// narrow and lasting. `lines` are flavor; one is chosen when she acts.

import type { LifeDomain } from './life';

export interface Intervention {
	domain: LifeDomain;
	verb: string;
	reach: 'broad' | 'targeted' | 'narrow';
	permanence: 'temporary' | 'lasting' | 'permanent';
	uncertain?: boolean; // invoke: asked, not commanded — the outcome varies
	lines: string[];
}

export const interventions: Record<LifeDomain, Intervention> = {
	plant: {
		domain: 'plant',
		verb: 'tend',
		reach: 'broad',
		permanence: 'temporary',
		lines: [
			"I don't know if it needs me. I come anyway.",
			'Patience is the only tool that works here.',
			'I keep my hands light. The wanting to help is the thing to watch.',
			"It knows what it's doing. I'm just making sure nothing undoes it."
		]
	},
	animal: {
		domain: 'animal',
		verb: 'guide',
		reach: 'targeted',
		permanence: 'lasting',
		lines: [
			"I don't tell it where to go. I just make going somewhere feel safer.",
			"It doesn't know I'm here. That's probably how it should be.",
			'A suggestion. Not a command. The difference matters.',
			'I nudge. The rest is up to it.'
		]
	},
	ecosystem: {
		domain: 'ecosystem',
		verb: 'encourage',
		reach: 'broad',
		permanence: 'lasting',
		lines: [
			"I can't see it working. I have to trust that it is.",
			"This one doesn't need direction. It needs permission.",
			"The system already knows. I'm just saying: yes. Keep going.",
			'Some things only need to be witnessed to continue.'
		]
	},
	geology: {
		domain: 'geology',
		verb: 'shape',
		reach: 'narrow',
		permanence: 'permanent',
		lines: [
			"This is slow work. Centuries-slow, if I'm honest with myself.",
			"I'm not making something. I'm making conditions for something.",
			"The stone doesn't resist. It just takes time.",
			'Whatever I change here, everything downstream changes with it.'
		]
	},
	weather: {
		domain: 'weather',
		verb: 'invoke',
		reach: 'broad',
		permanence: 'temporary',
		uncertain: true,
		lines: [
			"I ask. That's all I can do. I try to ask well.",
			"There's no guarantee. That's what makes it an invocation and not a command.",
			'She might answer. She might not. Both are reasonable.',
			"I've learned the difference between petitioning and controlling. This is petitioning."
		]
	}
};
