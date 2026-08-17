<script lang="ts">
	import { compare, witnessOnly, interventionist, type SimResult } from '@woodles/witch-engine';
	import type { TuningState } from './tuning.svelte';

	let { tuning }: { tuning: TuningState } = $props();

	const DURATIONS = [
		{ label: '1h', seconds: 3600 },
		{ label: '6h', seconds: 21600 },
		{ label: '24h', seconds: 86400 }
	];

	let durationSeconds = $state(3600);
	let running = $state(false);
	let results = $state<SimResult[] | null>(null);
	let ranAt = $state<{ durationSeconds: number } | null>(null);

	function fmtDuration(s: number): string {
		if (s < 60) return `${s.toFixed(0)}s`;
		if (s < 3600) return `${(s / 60).toFixed(1)}m`;
		return `${(s / 3600).toFixed(2)}h`;
	}

	function run(): void {
		running = true;
		// Yield a frame so the "running…" state actually paints before the
		// synchronous sim loop blocks the main thread — compare() is not
		// chunked or worker-hosted, so a 24h run is a real, felt pause.
		requestAnimationFrame(() => {
			const duration = durationSeconds;
			results = compare(tuning.def, [witnessOnly(), interventionist()], { duration });
			ranAt = { durationSeconds: duration };
			running = false;
		});
	}
</script>

<div class="panel">
	<div class="panel-head">
		<h2>Balance</h2>
		<p class="blurb">
			Runs Witness against Interventionist on the tuning above — the same two bracketing policies
			BALANCE.md checks every number against. Not chunked, so a longer run pauses the tab while it works.
		</p>
	</div>

	<div class="controls">
		<div class="durations" role="radiogroup" aria-label="run duration">
			{#each DURATIONS as d (d.seconds)}
				<button class:active={durationSeconds === d.seconds} onclick={() => (durationSeconds = d.seconds)}>
					{d.label}
				</button>
			{/each}
		</div>
		<button class="run" onclick={run} disabled={running}>
			{running ? 'running…' : 'run comparison'}
		</button>
	</div>

	{#if results && ranAt}
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
				{#each results as r (r.summary.policy)}
					<tr>
						<td>{r.summary.policy}</td>
						<td>{r.summary.timeToAllKnown !== null ? fmtDuration(r.summary.timeToAllKnown) : '—'}</td>
						<td>{(r.summary.equilibriumShare * 100).toFixed(1)}%</td>
						<td>{(r.summary.stressedShare * 100).toFixed(1)}%</td>
						<td>{r.summary.finalFavor.toFixed(1)}</td>
						<td>{r.summary.interventions}</td>
						<td>{r.summary.concepts}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="ran-note">{fmtDuration(ranAt.durationSeconds)} of game time, from a world with every condition already written.</p>
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
		cursor: wait;
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
</style>
