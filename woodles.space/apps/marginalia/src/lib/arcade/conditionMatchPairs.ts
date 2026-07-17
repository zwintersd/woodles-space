// Condition Match pairing logic - kept separate from ConditionMatch.svelte so
// round selection, tile shuffling, and pair validation stay unit-testable
// without mounting the component. See ARCADE_ROADMAP.md's "Condition Match"
// section for the design: flip tiles to pair the two conditions that give
// rise to a real emergence.

import { conditions } from '$lib/witch/content/conditions';
import { emergences, type Emergence } from '$lib/witch/content/emergences';

export interface ConditionMatchTile {
	tileId: string;
	conditionId: string;
	emergenceId: string;
}

export type RandomSource = () => number;

function shuffleWith<T>(items: readonly T[], rng: RandomSource): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

// Picks `pairCount` distinct emergences at random. Their source conditions
// may repeat across picks (e.g. two chosen emergences can both use "flow") -
// that's intentional: it keeps every round shaped a little differently and
// adds real memory pressure, since a repeated condition name has more than
// one valid partner on the board.
export function selectRoundEmergences(
	pairCount: number,
	source: readonly Emergence[] = emergences,
	rng: RandomSource = Math.random
): Emergence[] {
	const count = Math.max(1, Math.min(Math.floor(pairCount), source.length));
	return shuffleWith(source, rng).slice(0, count);
}

// Two tiles per selected emergence, shuffled into board order.
export function buildTilePool(
	selected: readonly Emergence[],
	rng: RandomSource = Math.random
): ConditionMatchTile[] {
	const tiles: ConditionMatchTile[] = [];
	selected.forEach((emergence, i) => {
		emergence.from.forEach((conditionId, slot) => {
			tiles.push({ tileId: `${emergence.id}-${slot}-${i}`, conditionId, emergenceId: emergence.id });
		});
	});
	return shuffleWith(tiles, rng);
}

// Do these two condition ids combine into a known emergence? Order-independent.
// Same-id flips are never valid: every emergence draws from two distinct conditions.
export function emergenceForPair(
	conditionIdA: string,
	conditionIdB: string,
	pool: readonly Emergence[] = emergences
): Emergence | null {
	if (conditionIdA === conditionIdB) return null;
	return (
		pool.find(
			(e) =>
				(e.from[0] === conditionIdA && e.from[1] === conditionIdB) ||
				(e.from[0] === conditionIdB && e.from[1] === conditionIdA)
		) ?? null
	);
}

export function conditionLabel(conditionId: string): string {
	return conditions.find((c) => c.id === conditionId)?.name ?? conditionId;
}
