import { describe, expect, it } from 'vitest';
import { emergences } from '$lib/witch/content/emergences';
import {
	buildTilePool,
	conditionLabel,
	emergenceForPair,
	selectRoundEmergences
} from './conditionMatchPairs';

// deterministic "shuffle" - always returns 0, so shuffleWith becomes a no-op
// swap-with-self loop and array order is preserved.
const noShuffle = () => 0;

describe('selectRoundEmergences', () => {
	it('returns the requested number of distinct emergences', () => {
		const picked = selectRoundEmergences(4, emergences, noShuffle);
		expect(picked).toHaveLength(4);
		expect(new Set(picked.map((e) => e.id)).size).toBe(4);
	});

	it('clamps below 1 and above the available pool size', () => {
		expect(selectRoundEmergences(0, emergences, noShuffle)).toHaveLength(1);
		expect(selectRoundEmergences(-3, emergences, noShuffle)).toHaveLength(1);
		expect(selectRoundEmergences(999, emergences, noShuffle)).toHaveLength(emergences.length);
	});

	it('truncates a fractional count', () => {
		expect(selectRoundEmergences(3.9, emergences, noShuffle)).toHaveLength(3);
	});
});

describe('buildTilePool', () => {
	it('makes exactly two tiles per selected emergence', () => {
		const selected = selectRoundEmergences(3, emergences, noShuffle);
		const tiles = buildTilePool(selected, noShuffle);
		expect(tiles).toHaveLength(6);
	});

	it('gives each tile a unique tileId even when conditions repeat', () => {
		const selected = emergences.filter((e) => e.from.includes('flow'));
		expect(selected.length).toBeGreaterThan(1);
		const tiles = buildTilePool(selected, noShuffle);
		expect(new Set(tiles.map((t) => t.tileId)).size).toBe(tiles.length);
	});

	it('tags each tile with the emergence it belongs to', () => {
		const selected = selectRoundEmergences(2, emergences, noShuffle);
		const tiles = buildTilePool(selected, noShuffle);
		for (const emergence of selected) {
			const forThisEmergence = tiles.filter((t) => t.emergenceId === emergence.id);
			expect(forThisEmergence.map((t) => t.conditionId).sort()).toEqual([...emergence.from].sort());
		}
	});
});

describe('emergenceForPair', () => {
	it('finds a match regardless of argument order', () => {
		const metabolism = emergences.find((e) => e.id === 'metabolism')!;
		expect(emergenceForPair('flow', 'holding')?.id).toBe('metabolism');
		expect(emergenceForPair('holding', 'flow')?.id).toBe('metabolism');
		expect(emergenceForPair('flow', 'holding')).toEqual(metabolism);
	});

	it('returns null for a pair with no known emergence', () => {
		expect(emergenceForPair('touch', 'falling')).toBeNull();
	});

	it('never matches a condition against itself', () => {
		expect(emergenceForPair('flow', 'flow')).toBeNull();
	});

	it('every emergence is reachable by its own from-pair', () => {
		for (const emergence of emergences) {
			expect(emergenceForPair(emergence.from[0], emergence.from[1])?.id).toBe(emergence.id);
		}
	});
});

describe('conditionLabel', () => {
	it('resolves a known condition id to its name', () => {
		expect(conditionLabel('flow')).toBe('flow');
		expect(conditionLabel('touch')).toBe('sensitivity');
	});

	it('falls back to the raw id for an unknown condition', () => {
		expect(conditionLabel('not-a-real-condition')).toBe('not-a-real-condition');
	});
});
