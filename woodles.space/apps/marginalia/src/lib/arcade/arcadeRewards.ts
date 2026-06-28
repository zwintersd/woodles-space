import { book } from '$lib/witch/book.svelte';
import { cappedReward } from './arcadeMath';

export interface ArcadeRewardEvent {
	gameId: string;
	amount: number;
	creditedAt: string;
}

let lastReward: ArcadeRewardEvent | null = null;

export function previewArcadeReward(raw: number, max: number): number {
	return cappedReward(raw, max);
}

export function creditInsight(gameId: string, amount: number): number {
	if (amount <= 0) return 0;

	book.insight += amount;
	book.persist();
	lastReward = {
		gameId,
		amount,
		creditedAt: new Date().toISOString()
	};
	return amount;
}

export function awardArcadeReward(gameId: string, raw: number, max: number): number {
	return creditInsight(gameId, previewArcadeReward(raw, max));
}

export function getLastArcadeReward(): ArcadeRewardEvent | null {
	return lastReward;
}
