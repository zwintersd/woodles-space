<script lang="ts">
	import { balance, formatMilestoneTime, HOUR_OPTIONS } from '../balance.svelte.js';
	import { compact, currencyById } from '../format.js';
	import { studio } from '../studio.svelte.js';

	const POLICY_COLOURS = { idle: 'var(--bf-faint)', greedy: 'var(--bf-accent)' } as const;
	const POLICY_LABELS = { idle: 'Idle', greedy: 'Greedy' } as const;

	let chartCurrencyId = $state<string | null>(null);
	const chartCurrency = $derived(
		currencyById(studio.def, chartCurrencyId ?? studio.def.currencies[0]?.id)
	);

	/** Every run's series for the charted currency, on one shared scale. */
	const overlay = $derived.by(() => {
		const id = chartCurrency?.id;
		if (!id || !balance.runs.length) return null;

		const lines = balance.runs.map((run) => ({
			policy: run.policy,
			points: run.result.series.map((sample) => ({ t: sample.t, value: sample.currencies[id] ?? 0 }))
		}));
		const max = Math.max(1, ...lines.flatMap((line) => line.points.map((point) => point.value)));
		const span = Math.max(1, ...lines.flatMap((line) => line.points.map((point) => point.t)));
		return { lines, max, span };
	});

	// Measured rather than scaled: an SVG stretched to fill its container
	// stretches its axis labels too, and a squashed label is the tell.
	let measured = $state(520);
	const width = $derived(Math.max(320, measured));
	const height = 168;
	const pad = { top: 10, right: 10, bottom: 20, left: 52 };

	function toX(t: number, span: number): number {
		return pad.left + (t / span) * (width - pad.left - pad.right);
	}

	function toY(value: number, max: number): number {
		// Log-ish: an incremental's whole point is that late values dwarf early
		// ones, and a linear axis shows an hour of flat line then a spike.
		const ratio = Math.log10(1 + value) / Math.log10(1 + max);
		return pad.top + (1 - ratio) * (height - pad.top - pad.bottom);
	}

	function path(points: { t: number; value: number }[], max: number, span: number): string {
		return points.map((point, i) => `${i === 0 ? 'M' : 'L'}${toX(point.t, span)},${toY(point.value, max)}`).join(' ');
	}

	function hours(seconds: number): string {
		return seconds >= 3600 ? `${Math.round(seconds / 3600)}h` : `${Math.round(seconds / 60)}m`;
	}
</script>

<div class="balance">
	<section class="chart">
		<div class="head">
			<h3>Idle vs Greedy</h3>
			{#if studio.def.currencies.length > 1}
				<label class="sr-only" for="bf-balance-currency">Charted currency</label>
				<select
					id="bf-balance-currency"
					class="bf-select mini"
					value={chartCurrency?.id}
					onchange={(event) => (chartCurrencyId = event.currentTarget.value)}
				>
					{#each studio.def.currencies as currency (currency.id)}
						<option value={currency.id}>{currency.name}</option>
					{/each}
				</select>
			{/if}
			<div class="legend">
				{#each balance.runs as run (run.policy)}
					<span class="key"><i style:background={POLICY_COLOURS[run.policy]}></i>{POLICY_LABELS[run.policy]}</span>
				{/each}
			</div>
		</div>

		{#if balance.error}
			<p class="error">{balance.error}</p>
		{:else if overlay}
			<div class="wrap" bind:clientWidth={measured}>
				<svg viewBox="0 0 {width} {height}" role="img" aria-label="{chartCurrency?.name} held over time, idle against greedy">
				{#each [0, 0.5, 1] as fraction (fraction)}
					{@const y = pad.top + (1 - fraction) * (height - pad.top - pad.bottom)}
					<line x1={pad.left} y1={y} x2={width - pad.right} y2={y} class="grid" />
					<text x={pad.left - 6} y={y + 3} class="tick" text-anchor="end">
						{compact(Math.pow(10, fraction * Math.log10(1 + overlay.max)) - 1)}
					</text>
				{/each}

				{#each overlay.lines as line (line.policy)}
					<path
						d={path(line.points, overlay.max, overlay.span)}
						fill="none"
						stroke={POLICY_COLOURS[line.policy]}
						stroke-width="1.75"
						stroke-dasharray={line.policy === 'idle' ? '4 3' : undefined}
					/>
				{/each}

				<text x={pad.left} y={height - 4} class="tick">0</text>
				<text x={width - pad.right} y={height - 4} class="tick" text-anchor="end">{hours(overlay.span)}</text>
				</svg>
			</div>
		{:else}
			<p class="idle-note">
				Fast-forward the game under both a player who never buys anything and one who always buys the cheapest thing.
				The gap between them is the room your design has to breathe.
			</p>
		{/if}

		<div class="controls">
			<div class="group" role="group" aria-label="Duration">
				{#each HOUR_OPTIONS as option (option)}
					<button class="chip" type="button" aria-pressed={balance.hours === option} onclick={() => (balance.hours = option)}>
						{option}h
					</button>
				{/each}
			</div>
			<button
				class="bf-button bf-button--primary"
				type="button"
				disabled={balance.running}
				onclick={() => balance.run(studio.def)}
			>
				{balance.running ? 'Simulating…' : '⏩ Fast-forward'}
			</button>
			{#if balance.elapsedMs > 0 && !balance.running}
				<span class="timing">{Math.round(balance.elapsedMs)}ms</span>
			{/if}
		</div>
	</section>

	<section class="table">
		<h3>Time to Milestone</h3>
		{#if studio.def.milestones.length === 0}
			<p class="idle-note">Add milestones to measure how long the game takes to reach them.</p>
		{:else}
			<div class="scroll">
				<table>
					<thead>
						<tr>
							<th scope="col">Milestone</th>
							{#each balance.runs as run (run.policy)}
								<th scope="col">{POLICY_LABELS[run.policy]}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each studio.def.milestones as milestone (milestone.id)}
							<tr>
								<th scope="row">{milestone.name}</th>
								{#each balance.runs as run (run.policy)}
									{@const reached = run.result.summary.timeToMilestone[milestone.id] ?? null}
									<td class:never={reached === null}>{formatMilestoneTime(reached)}</td>
								{/each}
							</tr>
						{/each}
						{#each studio.def.prestigeLayers as layer (layer.id)}
							<tr>
								<th scope="row">{layer.name} resets</th>
								{#each balance.runs as run (run.policy)}
									<td>{run.result.summary.totalPrestiges[layer.id] ?? 0}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<style>
	.balance {
		display: grid;
		grid-template-columns: 1fr minmax(240px, 340px);
		gap: 20px;
		height: 100%;
		min-height: 0;
	}

	section {
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
		flex-wrap: wrap;
	}

	h3 {
		margin: 0 0 6px;
		font-size: 12px;
		font-weight: 650;
		color: var(--bf-ink-soft);
	}

	.head h3 {
		margin: 0;
	}

	.legend {
		margin-left: auto;
		display: flex;
		gap: 10px;
	}

	.key {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 10.5px;
		color: var(--bf-muted);
	}

	.key i {
		width: 10px;
		height: 2.5px;
		border-radius: 2px;
	}

	.wrap {
		width: 100%;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.grid {
		stroke: var(--bf-rule);
		stroke-width: 1;
	}

	.tick {
		font-size: 9px;
		fill: var(--bf-faint);
		font-family: var(--bf-font-mono);
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}

	.group {
		display: flex;
		gap: 2px;
		padding: 2px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-surface-sunk);
	}

	.chip {
		padding: 3px 10px;
		border: 0;
		border-radius: var(--bf-radius-pill);
		background: none;
		color: var(--bf-muted);
		font-size: 11px;
		cursor: pointer;
	}

	.chip[aria-pressed='true'] {
		background: var(--bf-surface);
		color: var(--bf-accent-strong);
		font-weight: 650;
		box-shadow: var(--bf-shadow-soft);
	}

	.timing {
		font-size: 10.5px;
		color: var(--bf-faint);
		font-family: var(--bf-font-mono);
	}

	.mini {
		width: auto;
		padding: 2px 8px;
		font-size: 11px;
	}

	.scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 11.5px;
	}

	th,
	td {
		padding: 5px 8px;
		text-align: right;
		border-bottom: 1px solid var(--bf-rule);
		font-variant-numeric: tabular-nums;
	}

	thead th {
		position: sticky;
		top: 0;
		background: var(--bf-surface);
		color: var(--bf-muted);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	tbody th {
		text-align: left;
		font-weight: 550;
		color: var(--bf-ink-soft);
	}

	td.never {
		color: var(--bf-faint);
	}

	.error {
		margin: 0;
		padding: 10px;
		border-radius: var(--bf-radius-sm);
		background: var(--bf-danger-soft);
		color: var(--bf-danger);
		font-size: 11.5px;
	}

	.idle-note {
		flex: 1;
		margin: 0;
		padding: 12px 0;
		font-size: 12px;
		line-height: 1.55;
		color: var(--bf-faint);
		max-width: 46ch;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
