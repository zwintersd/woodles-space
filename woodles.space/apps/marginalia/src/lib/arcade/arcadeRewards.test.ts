import { beforeEach, describe, expect, it } from 'vitest';
import { book } from '$lib/witch/book.svelte';
import {
	SCORE_ONLY_ARCADE_GAMES,
	creditInsight,
	payReward,
	previewMasteredReward,
	previewReward,
	scoreOnlyReason
} from './arcadeRewards';

describe('arcadeRewards', () => {
	beforeEach(() => {
		book.insight = 0;
	});

	describe('previewReward', () => {
		it('clamps a raw reward into [0, max]', () => {
			expect(previewReward(5, 10)).toBe(5);
			expect(previewReward(-3, 10)).toBe(0);
			expect(previewReward(99, 10)).toBe(10);
		});
	});

	describe('creditInsight', () => {
		it('adds positive amounts to the book and returns the credited amount', () => {
			expect(creditInsight(7)).toBe(7);
			expect(book.insight).toBe(7);
		});

		it('ignores non-positive amounts without touching the book', () => {
			book.insight = 3;
			expect(creditInsight(0)).toBe(0);
			expect(creditInsight(-5)).toBe(0);
			expect(book.insight).toBe(3);
		});
	});

	describe('payReward', () => {
		it('clamps the raw reward, credits it once, and returns the awarded amount', () => {
			const awarded = payReward(50, 20);
			expect(awarded).toBe(20);
			expect(book.insight).toBe(20);
		});

		it('awards nothing for a non-positive raw reward', () => {
			const awarded = payReward(-4, 20);
			expect(awarded).toBe(0);
			expect(book.insight).toBe(0);
		});
	});

	describe('previewMasteredReward', () => {
		it('scales both the raw reward and its cap by the multiplier', () => {
			expect(previewMasteredReward(10, 20, 1.1)).toBeCloseTo(11);
			expect(previewMasteredReward(19, 20, 1.5)).toBe(28.5);
		});

		it('raises the ceiling itself rather than just filling faster', () => {
			// unmastered, this would clamp at 20; at 1.5x mastery the same raw
			// score-derived value clears the old ceiling instead of stalling on it.
			expect(previewMasteredReward(15, 20, 1.5)).toBeCloseTo(22.5);
			expect(previewMasteredReward(30, 20, 1.5)).toBe(30);
		});

		it('treats a non-finite or non-positive multiplier as 1x', () => {
			expect(previewMasteredReward(10, 20, 0)).toBe(10);
			expect(previewMasteredReward(10, 20, -2)).toBe(10);
			expect(previewMasteredReward(10, 20, Number.NaN)).toBe(10);
		});
	});

	describe('scoreOnlyReason', () => {
		it('flags 2048 as a deliberate score-only pet-training toy', () => {
			expect(scoreOnlyReason('stack-2048')).toBe(SCORE_ONLY_ARCADE_GAMES['stack-2048']);
		});

		it('returns null for paying games', () => {
			expect(scoreOnlyReason('color-pop')).toBeNull();
			expect(scoreOnlyReason('margin-miner')).toBeNull();
		});
	});
});
