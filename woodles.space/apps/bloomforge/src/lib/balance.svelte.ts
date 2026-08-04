import { hasErrors, validateGameDef, type GameDef } from '@woodles/incremental-core';
import type { BalancePolicy, BalanceRequest, BalanceResponse, BalanceRun } from './sim.worker.js';

/**
 * The Balance tab's state. This is the question the live playtest can't answer
 * — "when does the player hit a wall?" — because feeling it in real time takes
 * as long as the wall does.
 */

export const HOUR_OPTIONS = [1, 4, 10, 24] as const;

export class Balance {
	hours = $state<number>(10);
	seed = $state(1);
	running = $state(false);
	error = $state<string | null>(null);
	runs = $state<BalanceRun[]>([]);
	elapsedMs = $state(0);

	#worker: Worker | null = null;
	#nextId = 1;
	/** Only the newest request's answer is wanted; older ones are stale. */
	#pendingId = 0;

	run(def: GameDef): void {
		const issues = validateGameDef(def);
		if (hasErrors(issues)) {
			this.error = issues.find((issue) => issue.severity === 'error')?.message ?? 'this game has errors';
			this.runs = [];
			return;
		}

		const worker = this.#ensureWorker();
		if (!worker) {
			this.error = 'this browser cannot run background simulations';
			return;
		}

		this.error = null;
		this.running = true;
		this.#pendingId = this.#nextId;
		this.#nextId += 1;

		const request: BalanceRequest = {
			id: this.#pendingId,
			// Through `$state.snapshot` first: the def is a rune proxy, and neither
			// `structuredClone` nor `postMessage` can clone one.
			def: structuredClone($state.snapshot(def)) as GameDef,
			hours: this.hours,
			seed: this.seed,
			policies: ['idle', 'greedy'] as BalancePolicy[]
		};
		worker.postMessage(request);
	}

	/** Releases the worker — call when the editor is torn down. */
	dispose(): void {
		this.#worker?.terminate();
		this.#worker = null;
	}

	#ensureWorker(): Worker | null {
		if (this.#worker) return this.#worker;
		if (typeof Worker === 'undefined') return null;

		const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
		worker.addEventListener('message', (event: MessageEvent<BalanceResponse>) => {
			const response = event.data;
			if (response.id !== this.#pendingId) return;

			this.running = false;
			if (response.ok) {
				this.runs = response.runs;
				this.elapsedMs = response.elapsedMs;
				this.error = null;
			} else {
				this.runs = [];
				this.error = response.error;
			}
		});
		worker.addEventListener('error', (event) => {
			this.running = false;
			this.error = event.message || 'the background simulation failed';
		});

		this.#worker = worker;
		return worker;
	}
}

export const balance = new Balance();

/** `—` for a milestone never reached, so the table reads as "didn't happen". */
export function formatMilestoneTime(seconds: number | null): string {
	if (seconds === null) return '—';
	if (seconds < 60) return `${seconds.toFixed(1)}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ${String(Math.floor(seconds % 60)).padStart(2, '0')}s`;
	return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
