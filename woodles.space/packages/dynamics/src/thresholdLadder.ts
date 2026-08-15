/**
 * Shape E — Threshold Ladder. A meter that spends itself climbing a fixed
 * staircase: crossing a step subtracts that step's cost rather than
 * resetting to zero, so a big enough deposit clears two steps in one motion,
 * and each landing can run its own side effect.
 *
 * `thresholds[i]` is the cost to advance *from* stage `i - 1` *to* stage `i`;
 * index 0 is unused, since there's no threshold to reach the starting stage.
 */

export interface LadderResult {
	stage: number;
	banked: number;
	crossed: number;
}

export function advanceLadder(
	stage: number,
	banked: number,
	thresholds: readonly number[],
	maxStage: number,
	onCross?: (nextStage: number) => void
): LadderResult {
	let crossed = 0;
	while (stage < maxStage) {
		const threshold = thresholds[stage + 1];
		if (threshold === undefined || banked < threshold) break;
		banked -= threshold;
		stage += 1;
		crossed += 1;
		onCross?.(stage);
	}
	// At the top of the ladder there's nothing left to bank toward.
	if (stage >= maxStage) banked = 0;
	return { stage, banked, crossed };
}
