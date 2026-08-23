// The wire format between the page and `balance.worker.ts`.
//
// Kept in its own module rather than exported from the worker entry so
// importing the types never risks pulling the worker into the main bundle.
//
// Only plain data crosses: a `SimResult` carries `final: World` (a class
// instance, not structured-cloneable) and a `series` of several hundred
// samples, so the worker projects what the table actually shows and posts
// that back instead of the whole result.

import type { MarginaliaDef, Worldspace } from '@woodles/witch-engine';

export interface BalanceRequest {
	/** Discards a response whose run has been superseded — see BalancePanel. */
	id: number;
	def: MarginaliaDef;
	/**
	 * World 1's shipped numbers, to run alongside for comparison. Null when
	 * the panel already has that baseline cached for this duration and
	 * worldspace, or when nothing has been edited and the two runs would be
	 * the same run.
	 */
	baselineDef: MarginaliaDef | null;
	duration: number;
	worldspace: Worldspace;
}

export interface BalanceRow {
	policy: string;
	/** Game-seconds to Knowing every life visible from this worldspace, or null if never. */
	timeToAllKnown: number | null;
	equilibriumShare: number;
	stressedShare: number;
	finalFavor: number;
	interventions: number;
	concepts: number;
}

export interface BalanceResponse {
	id: number;
	duration: number;
	worldspace: Worldspace;
	rows: BalanceRow[];
	/** Present only when the request asked for a baseline run. */
	baselineRows: BalanceRow[] | null;
}
