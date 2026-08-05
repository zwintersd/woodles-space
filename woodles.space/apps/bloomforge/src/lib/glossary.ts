import type { EntityKind } from '@woodles/incremental-core';

/**
 * The plain-English half of every hover tooltip in the studio — what an
 * incremental-game term actually means, in one sentence, in the voice the
 * rest of the app already uses. Centralised so the same explanation shows up
 * wherever the same idea does, rather than drifting between call sites.
 */
export const ENTITY_KIND_GLOSSARY: Record<EntityKind, string> = {
	currency: 'A number the player watches go up — coins, energy, anything spendable.',
	generator: 'Owned, not clicked: makes currency on its own, and makes more of it the more levels you own.',
	upgrade: 'A one-time or repeatable buy that changes a rate somewhere else — output, cost, or odds.',
	prestige: 'Reset progress on purpose, in exchange for a permanent multiplier that makes the next run faster.',
	unlock: "Hidden by default. Reveals other nodes once a condition is met, so the graph doesn't open all at once.",
	milestone: 'A named point a balance run measures time-to — no mechanical effect of its own.'
};

export const GLOSSARY = {
	notation: 'How big numbers are written once they outgrow plain digits — 1.2K, 1.2e3, and so on.',
	costCurve: 'How much the next level costs, as a function of the level before it.',
	outputCurve: 'How much this produces per level, as a function of the level before it.',
	effectTarget:
		'What this changes (one generator, everything, or a currency), which stat — output, cost, or crit chance, the odds 0–1 of a bonus tick — and how.',
	repeatable: 'Buyable more than once, each purchase a level, instead of a single one-time toggle.',
	threshold: 'The lifetime amount of the source currency that earns exactly 1 unit of the prestige currency.',
	exponent: 'How much harder each extra unit is to earn — 1 is linear, above 1 gets steeper with progress.',
	multiplierPerUnit: 'The permanent bonus each owned unit adds to every run after this reset.',
	resets: 'Everything a prestige actually wipes — balances, levels, owned upgrades. Nothing else.',
	reveals: "What this unlock shows once it opens. Hidden nodes don't exist to the player until then.",
	opensWhen: 'The condition that flips this unlock from hidden to revealed.',
	reachedWhen: 'The condition a balance run checks time against to report this milestone.',
	requires: "A gate on top of cost — the upgrade can't be bought until this is also true.",
	populationBoost:
		'An extra multiplier driven by a live count instead of a level — e.g. "×1 + 0.1 per owned-but-unequipped upgrade." Composes with the curve above it.',
	populationPerUnit: 'The bonus each counted unit adds — 0.35 means +35% per unit, compounding additively with itself.'
} as const;
