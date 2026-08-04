import {
	greedyPolicy,
	idlePolicy,
	sampleIntervalFor,
	simulate,
	type GameDef,
	type SimResult
} from '@woodles/incremental-core';

/**
 * Fast-forward runs live here so the canvas never stutters. Ten hours of game
 * time is ~150ms of arithmetic, which is short enough not to matter and long
 * enough to drop frames if it happened on the main thread — and a balance
 * sweep runs it once per policy.
 */

export type BalancePolicy = 'idle' | 'greedy';

export interface BalanceRequest {
	id: number;
	def: GameDef;
	/** Game-hours to fast-forward. */
	hours: number;
	seed: number;
	policies: BalancePolicy[];
}

export interface BalanceRun {
	policy: BalancePolicy;
	result: SimResult;
}

export type BalanceResponse =
	| { id: number; ok: true; runs: BalanceRun[]; elapsedMs: number }
	| { id: number; ok: false; error: string };

function policyFor(name: BalancePolicy) {
	return name === 'idle' ? idlePolicy : greedyPolicy();
}

self.addEventListener('message', (event: MessageEvent<BalanceRequest>) => {
	const request = event.data;
	const started = performance.now();

	try {
		const duration = Math.max(1, request.hours * 3600);
		// Scaled to the duration, so a ten-hour run comes back with a chartable
		// couple of thousand points rather than 360,000.
		const sampleEvery = sampleIntervalFor(duration);

		const runs: BalanceRun[] = request.policies.map((policy) => ({
			policy,
			result: simulate(request.def, policyFor(policy), { duration, sampleEvery, seed: request.seed })
		}));

		const response: BalanceResponse = { id: request.id, ok: true, runs, elapsedMs: performance.now() - started };
		self.postMessage(response);
	} catch (error) {
		const response: BalanceResponse = {
			id: request.id,
			ok: false,
			error: error instanceof Error ? error.message : String(error)
		};
		self.postMessage(response);
	}
});
