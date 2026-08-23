/// <reference lib="webworker" />

// The balance harness, off the main thread.
//
// `simulate` is a single synchronous loop by design — a fixed timestep with
// integer tick counting, so a run never depends on how fast the machine is
// (see the package's sim.ts). That makes it unchunkable without restructuring
// the harness itself, and a 24h comparison is tens of millions of ticks: on
// the main thread it freezes the tab outright.
//
// So the whole run moves here instead, and the engine stays untouched. This
// works only because `MarginaliaDef` is deliberately plain, serializable data
// — the reason favor's multiplier is `{base, perPoint}` rather than a
// function. A def with a closure in it could not make this trip.

import { compare, witnessOnly, interventionist } from '@woodles/witch-engine';
import type { BalanceRequest, BalanceResponse } from './balanceTypes';

self.addEventListener('message', (event: MessageEvent<BalanceRequest>) => {
	const { id, def, duration, worldspace } = event.data;

	// The same two bracketing policies BALANCE.md reads every number against:
	// restraint against meddling, which is the axis World 1 claims to reward.
	const results = compare(def, [witnessOnly(), interventionist()], { duration, worldspace });

	const response: BalanceResponse = {
		id,
		duration,
		worldspace,
		rows: results.map((r) => ({
			policy: r.summary.policy,
			timeToAllKnown: r.summary.timeToAllKnown,
			equilibriumShare: r.summary.equilibriumShare,
			stressedShare: r.summary.stressedShare,
			finalFavor: r.summary.finalFavor,
			interventions: r.summary.interventions,
			concepts: r.summary.concepts
		}))
	};

	self.postMessage(response);
});
