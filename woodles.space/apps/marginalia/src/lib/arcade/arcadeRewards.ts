// Shared arcade payout — the single point where a game's reward touches the
// Book economy.
//
// Every game that rewards the player credits insight through `creditInsight`,
// so the `book.insight += …; book.persist()` mutation lives in exactly one
// place instead of being copy-pasted into each game's `finish`. That also makes
// this the natural (and only) home for arcade-wide economy policy later — e.g.
// a per-day insight cap to bound farming — without editing every game's loop.
// See ARCADE_REVIEW.md findings #1–#3.

import { book } from '$lib/witch/book.svelte';
import { cappedReward } from './arcadeMath';

export type ScoreOnlyArcadeGameId = 'stack-2048' | 'color-pop' | 'margin-miner';

export const SCORE_ONLY_ARCADE_GAMES: Record<ScoreOnlyArcadeGameId, string> = {
	'stack-2048': 'score-only training toy during the economy pass',
	'color-pop': 'score-only until the physics payout policy lands',
	'margin-miner': 'score-only until the timed-claw payout policy lands'
};

// Credit a positive insight reward to the Book and persist. Non-positive
// amounts are ignored (no spurious save). Returns the amount actually credited.
export function creditInsight(amount: number): number {
	if (amount > 0) {
		book.insight += amount;
		book.persist();
		return amount;
	}
	return 0;
}

export function previewReward(raw: number, max: number): number {
	return cappedReward(raw, max);
}

// Clamp a raw, score-derived reward to [0, max] and credit it. The common case
// for games whose reward floors at zero; returns the amount awarded.
export function payReward(raw: number, max: number): number {
	const awarded = previewReward(raw, max);
	creditInsight(awarded);
	return awarded;
}

export function scoreOnlyReason(gameId: string): string | null {
	return gameId in SCORE_ONLY_ARCADE_GAMES
		? SCORE_ONLY_ARCADE_GAMES[gameId as ScoreOnlyArcadeGameId]
		: null;
}
