<script lang="ts">
	import { onDestroy } from 'svelte';
	import { world1Def, type Worldspace } from '@woodles/witch-engine';
	import type { TuningState } from './tuning.svelte';
	import type { BalanceRequest, BalanceResponse, BalanceRow } from './balanceTypes';

	let { tuning, worldspace }: { tuning: TuningState; worldspace: Worldspace } = $props();

	const DURATIONS = [
		{ label: '1h', seconds: 3600 },
		{ label: '6h', seconds: 21600 },
		{ label: '24h', seconds: 86400 }
	];

	type Kind = 'duration' | 'percent' | 'number';

	const COLUMNS: { head: string; get: (r: BalanceRow) => number | null; kind: Kind }[] = [
		{ head: 'all Known', get: (r) => r.timeToAllKnown, kind: 'duration' },
		{ head: 'eq. share', get: (r) => r.equilibriumShare, kind: 'percent' },
		{ head: 'stressed', get: (r) => r.stressedShare, kind: 'percent' },
		{ head: 'favor', get: (r) => r.finalFavor, kind: 'number' },
		{ head: 'interventions', get: (r) => r.interventions, kind: 'number' },
		{ head: 'concepts', get: (r) => r.concepts, kind: 'number' }
	];

	let durationSeconds = $state(3600);
	let running = $state(false);
	let response = $state<BalanceResponse | null>(null);
	/** The tuning signature the shown numbers were produced from. */
	let ranWith = $state<string | null>(null);

	/**
	 * World 1's numbers for a given duration and worldspace don't change, so a
	 * baseline is run once and kept. Without this every comparison would pay
	 * for the same shipped run again — at 24h that is another twenty seconds
	 * to learn something already known.
	 */
	const baselineCache = new Map<string, BalanceRow[]>();
	const cacheKey = (duration: number, space: Worldspace) => `${duration}:${space}`;

	/** The baseline actually in force for what is on screen, cache included. */
	const baseline = $derived(
		response ? (response.baselineRows ?? baselineCache.get(cacheKey(response.duration, response.worldspace)) ?? null) : null
	);

	function fmtValue(v: number | null, kind: Kind): string {
		if (v === null) return '—';
		if (kind === 'duration') return fmtDuration(v);
		if (kind === 'percent') return `${(v * 100).toFixed(1)}%`;
		return Number.isInteger(v) ? String(v) : v.toFixed(1);
	}

	/**
	 * Deliberately unsigned by colour. The harness "does not decide whether a
	 * number is good — it reports; the caller judges" (sim.ts), and which
	 * direction is an improvement genuinely depends on what you were trying to
	 * do. So: magnitude and direction, no green and no red.
	 */
	function fmtDelta(cur: number | null, base: number | null, kind: Kind): string | null {
		if (cur === null || base === null) return null;
		const d = cur - base;
		if (Math.abs(d) < 1e-9) return null;
		const sign = d > 0 ? '+' : '−';
		const mag = Math.abs(d);
		if (kind === 'duration') return sign + fmtDuration(mag);
		if (kind === 'percent') return `${sign}${(mag * 100).toFixed(1)}pp`;
		return sign + (Number.isInteger(d) ? String(mag) : mag.toFixed(1));
	}

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
			if (event.data.baselineRows) {
				baselineCache.set(cacheKey(event.data.duration, event.data.worldspace), event.data.baselineRows);
			}
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
		const key = cacheKey(durationSeconds, worldspace);
		// Nothing edited means the two runs would be identical, so there is no
		// baseline to ask for — the single run *is* World 1.
		const wantsBaseline = tuning.isModified && !baselineCache.has(key);

		const request: BalanceRequest = {
			id: ++nextId,
			def: tuning.def,
			baselineDef: wantsBaseline ? structuredClone(world1Def) : null,
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
							{#each COLUMNS as col (col.head)}
								<th>{col.head}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each response.rows as row, i (row.policy)}
							<tr>
								<td>{row.policy}</td>
								{#each COLUMNS as col (col.head)}
									{@const base = baseline?.[i] ? col.get(baseline[i]) : null}
									{@const delta = fmtDelta(col.get(row), base, col.kind)}
									<td>
										{fmtValue(col.get(row), col.kind)}
										{#if delta}<span class="delta">{delta}</span>{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="ran-note">
				{fmtDuration(response.duration)} of game time in <strong>{response.worldspace}</strong>, from a
				world with every condition already written.
				{#if baseline}
					Deltas are against World 1's shipped numbers over the same run.
				{:else}
					These <em>are</em> World 1's shipped numbers — edit something to get a comparison.
				{/if}
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

	/* No red, no green — see fmtDelta. Direction and magnitude only. */
	.delta {
		display: block;
		font-size: 0.68rem;
		color: var(--accent-strong, var(--muted));
		opacity: 0.85;
	}
</style>
