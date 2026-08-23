<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Worldspace } from '@woodles/witch-engine';
	import type { TuningState } from './tuning.svelte';
	import type { BalanceRequest, BalanceResponse } from './balanceTypes';

	let { tuning, worldspace }: { tuning: TuningState; worldspace: Worldspace } = $props();

	const DURATIONS = [
		{ label: '1h', seconds: 3600 },
		{ label: '6h', seconds: 21600 },
		{ label: '24h', seconds: 86400 }
	];

	let durationSeconds = $state(3600);
	let running = $state(false);
	let response = $state<BalanceResponse | null>(null);
	/** The tuning signature the shown numbers were produced from. */
	let ranWith = $state<string | null>(null);

	// The run's numbers describe the tuning as it was when it started. Say so
	// rather than clearing them — comparing the last run against the edit you
	// just made is most of what this panel is for.
	const stale = $derived(ranWith !== null && ranWith !== tuning.signature);

	let worker: Worker | null = null;
	let nextId = 0;
	/** Only the newest request's response is accepted; earlier ones are discarded. */
	let awaitingId = -1;

	function ensureWorker(): Worker {
		if (worker) return worker;
		worker = new Worker(new URL('./balance.worker.ts', import.meta.url), { type: 'module' });
		worker.addEventListener('message', (event: MessageEvent<BalanceResponse>) => {
			if (event.data.id !== awaitingId) return;
			response = event.data;
			running = false;
		});
		return worker;
	}

	onDestroy(() => worker?.terminate());

	function fmtDuration(s: number): string {
		if (s < 60) return `${s.toFixed(0)}s`;
		if (s < 3600) return `${(s / 60).toFixed(1)}m`;
		return `${(s / 3600).toFixed(2)}h`;
	}

	function run(): void {
		const request: BalanceRequest = {
			id: ++nextId,
			def: tuning.def,
			duration: durationSeconds,
			worldspace
		};
		awaitingId = request.id;
		ranWith = tuning.signature;
		running = true;
		ensureWorker().postMessage(request);
	}
</script>

<div class="panel">
	<div class="panel-head">
		<h2>Balance</h2>
		<p class="blurb">
			Runs Witness against Interventionist — the same two bracketing policies BALANCE.md checks every
			number against — on the tuning above, in the current worldspace. Runs on a worker thread, so a long
			comparison doesn't freeze the page.
		</p>
	</div>

	<div class="controls">
		<div class="durations" role="radiogroup" aria-label="run duration">
			{#each DURATIONS as d (d.seconds)}
				<button
					role="radio"
					aria-checked={durationSeconds === d.seconds}
					class:active={durationSeconds === d.seconds}
					onclick={() => (durationSeconds = d.seconds)}
				>
					{d.label}
				</button>
			{/each}
		</div>
		<button class="run" onclick={run} disabled={running}>
			{running ? 'running…' : 'run comparison'}
		</button>
		{#if running}
			<span class="note">{fmtDuration(durationSeconds)} of game time, on a worker</span>
		{/if}
	</div>

	{#if response}
		<div class="results" class:stale>
			<div class="table-scroll">
				<table>
					<thead>
						<tr>
							<th>policy</th>
							<th>all Known</th>
							<th>eq. share</th>
							<th>stressed</th>
							<th>favor</th>
							<th>interventions</th>
							<th>concepts</th>
						</tr>
					</thead>
					<tbody>
						{#each response.rows as row (row.policy)}
							<tr>
								<td>{row.policy}</td>
								<td>{row.timeToAllKnown !== null ? fmtDuration(row.timeToAllKnown) : '—'}</td>
								<td>{(row.equilibriumShare * 100).toFixed(1)}%</td>
								<td>{(row.stressedShare * 100).toFixed(1)}%</td>
								<td>{row.finalFavor.toFixed(1)}</td>
								<td>{row.interventions}</td>
								<td>{row.concepts}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="ran-note">
				{fmtDuration(response.duration)} of game time in <strong>{response.worldspace}</strong>, from a
				world with every condition already written.
				{#if stale}
					<span class="stale-flag">Tuning has changed since this run.</span>
				{/if}
			</p>
		</div>
	{/if}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.panel-head h2 {
		font-size: 1.1rem;
		margin: 0 0 0.35rem;
	}

	.blurb {
		font-size: 0.78rem;
		color: var(--muted);
		line-height: 1.4;
		margin: 0;
		max-width: 42rem;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.durations {
		display: flex;
		border: 1px solid var(--rule);
		border-radius: 999px;
		overflow: hidden;
	}

	.durations button {
		font: inherit;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.78rem;
		padding: 0.35rem 0.85rem;
		border: none;
		background: none;
		color: var(--muted);
		cursor: pointer;
	}

	.durations button.active {
		background: var(--accent);
		color: var(--lapis, var(--text));
	}

	.run {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.45rem 1.1rem;
		border-radius: 999px;
		border: 1px solid var(--rule);
		background: var(--accent-warm, var(--accent));
		color: var(--lapis, var(--text));
		cursor: pointer;
	}

	.run:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.note {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.72rem;
		color: var(--muted);
	}

	.results {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.results.stale table {
		opacity: 0.55;
	}

	.table-scroll {
		overflow-x: auto;
	}

	table {
		border-collapse: collapse;
		width: 100%;
		font-size: 0.82rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.4rem 0.7rem;
		border-bottom: 1px solid var(--rule);
		white-space: nowrap;
	}

	th {
		font-weight: 500;
		color: var(--muted);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	td {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-variant-numeric: tabular-nums;
	}

	.ran-note {
		font-size: 0.72rem;
		color: var(--muted);
		margin: 0;
	}

	.stale-flag {
		color: var(--accent-warm, var(--accent));
	}
</style>
