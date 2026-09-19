// Achievements — first-time-only beats for the actions that actually move a
// world forward. Unlike titles.ts (her standing, always current) these are a
// lifetime log: once true, never revoked, reset only alongside everything
// else on resetIdleProgress(). Each one exists because it either introduces a
// mechanic she might not have found on her own, or reinforces the specific
// behaviours DESIGN.md calls the golden path — attention, restraint,
// breadth. None of them count anything; every trigger is a Book method or a
// WorldEvent's rising edge firing for the first time (see Book.absorb and the
// unlockAchievement call sites), so there is nothing here to grind toward.

export interface Achievement {
	id: string;
	title: string;
	note: string;
}

export const achievements: Achievement[] = [
	{
		id: 'first-written',
		title: 'First Words',
		note: 'she wrote her first condition into the Web.'
	},
	{
		id: 'first-attended',
		title: 'First Attention',
		note: 'she gave a life her attention for the first time.'
	},
	{
		id: 'noticed',
		title: 'Noticed',
		note: 'something she attended to became visible, for the first time.'
	},
	{
		id: 'known',
		title: 'Known',
		note: 'a life reached Known for the first time — intervention is open to her now.'
	},
	{
		id: 'light-touch',
		title: 'A Light Touch',
		note: 'she intervened for the first time: gently, at a cost, and only once.'
	},
	{
		id: 'held-itself',
		title: 'Held Itself',
		note: 'the world balanced on its own, without her hand on it.'
	},
	{
		id: 'distilled',
		title: 'Distilled',
		note: 'she turned insight into essence for the first time.'
	},
	{
		id: 'marked',
		title: 'Marked',
		note: 'she placed her first waymark — a spawn point of her own authorship.'
	},
	// category mastery — one id per category, sharing this shape rather than
	// a generic "mastery" achievement, so each says what was actually done.
	{
		id: 'mastery-aquatic',
		title: 'The Water, Known',
		note: 'every aquatic life in this world has reached Known.'
	},
	{
		id: 'mastery-terrestrial',
		title: 'The Land, Known',
		note: 'every terrestrial life in this world has reached Known.'
	},
	{
		id: 'mastery-atmospheric',
		title: 'The Sky, Known',
		note: 'every atmospheric life in this world has reached Known.'
	}
];

export function achievementById(id: string): Achievement | null {
	return achievements.find((a) => a.id === id) ?? null;
}
