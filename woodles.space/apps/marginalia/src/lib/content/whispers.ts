// Whispers — the ominous chat instructor in the top-right corner.
// "An unknown hand" speaks across milestones in the early game.
// Each whisper has a trigger that consults the game state. Once shown, the
// whisper is recorded in `game.whispersShown` and (unless `repeat: true`) won't
// fire again. Whispers are intentionally terse — one or two short lines.

import type { Game } from '../state/game.svelte';

export interface Whisper {
	id: string;
	text: string;
	from?: string; // defaults to "an unknown hand"
	// Lower = earlier in the queue when several are eligible at once.
	priority: number;
	// Predicate evaluated against the live game; return true to fire.
	when: (g: Game, ctx: WhisperContext) => boolean;
	// If true, the whisper can fire again after it has been dismissed/expired.
	repeat?: boolean;
	// Minimum seconds between repeat firings. Only used if repeat is true.
	repeatAfterSec?: number;
}

export interface WhisperContext {
	// seconds since the user's last interactive event (click/keyboard)
	idleSec: number;
	// seconds since this whisper last fired (for repeat whispers)
	sinceLastFireSec: number;
}

export const whispers: Whisper[] = [
	{
		id: 'open',
		text: 'begin. the page is waiting.',
		priority: 0,
		when: (g) => g.clicksEver === 0
	},
	{
		id: 'after_5',
		text: 'good. each mark is a gloss. each gloss accrues.',
		priority: 1,
		when: (g) => g.clicksEver >= 5
	},
	{
		id: 'after_15',
		text: 'the margin was not empty before you began. only quieter.',
		priority: 2,
		when: (g) => g.clicksEver >= 15
	},
	{
		id: 'asides_present',
		text: 'stray phrases drift through. catch them. they are not yours, but you may keep them.',
		priority: 3,
		when: (g) => g.clicksEver >= 8
	},
	{
		id: 'first_generator',
		text: 'yes. let it write itself a little. you cannot do this alone, and the page knows that.',
		priority: 4,
		when: (g) => Object.values(g.generators).some((n) => n > 0)
	},
	{
		id: 'first_charged',
		text: 'a heavier mark. some clicks weigh more than others. some readers do too.',
		priority: 5,
		when: (g) => g.totalGlossesEver >= 30 && g.clicksEver >= 12
	},
	{
		id: 'first_commentary',
		text: 'a commentary. you have written enough to be quoted, even by yourself.',
		priority: 6,
		when: (g) => g.commentaries >= 1
	},
	{
		id: 'first_upgrade',
		text: 'now you read by another method. the old click is a memory of itself.',
		priority: 7,
		when: (g) => Object.keys(g.upgrades).length > 0
	},
	{
		id: 'two_generators',
		text: 'two hands now. neither of them yours. this is how it begins.',
		priority: 8,
		when: (g) => {
			const owned = Object.values(g.generators).filter((n) => n > 0).length;
			return owned >= 2;
		}
	},
	{
		id: 'apparatus_first',
		text: 'apparatus. footnotes about footnotes. it does not stop.',
		priority: 9,
		when: (g) => g.apparatus >= 1
	},
	{
		id: 'recension_first',
		text: 'a recension. your reading has diverged. soon it will not be a reading at all.',
		priority: 10,
		when: (g) => g.recensions >= 1
	},
	{
		id: 'prestige_ready',
		text: 'soon you will lapse. that is part of reading too.',
		priority: 11,
		when: (g) => g.canPrestige()
	},
	// ── ambient / repeating whispers ──────────────────────────────────────
	{
		id: 'idle_short',
		text: 'i can see you have stopped.',
		priority: 50,
		repeat: true,
		repeatAfterSec: 90,
		when: (g, ctx) => ctx.idleSec > 25 && g.clicksEver > 5 && g.clicksEver < 80
	},
	{
		id: 'idle_long',
		text: 'you have not been reading. someone else has been reading you.',
		priority: 51,
		repeat: true,
		repeatAfterSec: 240,
		when: (g, ctx) => ctx.idleSec > 75 && g.clicksEver > 20
	},
	{
		id: 'watching',
		text: 'i was here before you opened the book.',
		priority: 52,
		repeat: true,
		repeatAfterSec: 360,
		when: (g) => g.clicksEver > 40 && Math.random() < 0.4
	}
];

export function pickNextWhisper(
	g: Game,
	ctx: { idleSec: number; lastFiredAtById: Record<string, number> }
): Whisper | null {
	let best: Whisper | null = null;
	for (const w of whispers) {
		const lastFiredAt = ctx.lastFiredAtById[w.id] ?? 0;
		const sinceLastFireSec = lastFiredAt === 0 ? Infinity : (Date.now() - lastFiredAt) / 1000;

		if (w.repeat) {
			if (lastFiredAt > 0 && sinceLastFireSec < (w.repeatAfterSec ?? 60)) continue;
		} else {
			if (g.whispersShown[w.id]) continue;
		}

		if (!w.when(g, { idleSec: ctx.idleSec, sinceLastFireSec })) continue;

		if (!best || w.priority < best.priority) best = w;
	}
	return best;
}
