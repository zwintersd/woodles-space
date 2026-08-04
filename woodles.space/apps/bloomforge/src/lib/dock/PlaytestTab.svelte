<script lang="ts">
	import { currencyById, formatAmount, signedRate } from '../format.js';
	import { formatDuration, playtest, SPEEDS, type PolicyName } from '../playtest.svelte.js';
	import { studio } from '../studio.svelte.js';
	import Sparkline from './Sparkline.svelte';

	const chartCurrency = $derived(currencyById(studio.def, playtest.chartCurrencyId ?? undefined));
</script>

<div class="playtest">
	<section class="readout">
		<div class="head">
			<h3>Simulation</h3>
			<span class="state" class:running={playtest.running}>
				<!-- A simulation exists from the moment a project opens, so "paused"
				     is only honest once the run has actually moved. -->
				{playtest.blocked ? 'Blocked' : playtest.running ? 'Running' : playtest.elapsed > 0 ? 'Paused' : 'Idle'}
			</span>
		</div>

		{#if playtest.blocked}
			<p class="blocked">{playtest.blocked}</p>
		{:else}
			<dl>
				<div><dt>Time Elapsed</dt><dd>{formatDuration(playtest.elapsed)}</dd></div>
				{#each studio.def.currencies as currency (currency.id)}
					<div>
						<dt>{currency.name}</dt>
						<dd>{formatAmount(playtest.amounts[currency.id] ?? 0, currency)}</dd>
					</div>
				{/each}
				{#each studio.def.generators as generator (generator.id)}
					<div>
						<dt>{generator.name} ({playtest.generatorLevels[generator.id] ?? 0})</dt>
						<dd class="rate">
							{signedRate(playtest.generatorRates[generator.id] ?? 0, currencyById(studio.def, generator.producesCurrencyId))}
						</dd>
					</div>
				{/each}
				{#if playtest.prestigeMultiplier !== 1}
					<div><dt>Prestige</dt><dd>×{playtest.prestigeMultiplier.toFixed(2)}</dd></div>
				{/if}
			</dl>
		{/if}

		<div class="controls">
			<button class="bf-button bf-button--primary" type="button" onclick={() => playtest.toggle(studio.def)}>
				{playtest.running ? '❙❙ Pause' : '▶ Play'}
			</button>
			<button class="bf-button" type="button" onclick={() => playtest.reset(studio.def)}>↺ Reset</button>
		</div>

		<div class="options">
			<div class="group" role="group" aria-label="Speed">
				{#each SPEEDS as speed (speed)}
					<button
						class="chip"
						type="button"
						aria-pressed={playtest.speed === speed}
						onclick={() => (playtest.speed = speed)}
					>
						{speed}×
					</button>
				{/each}
			</div>

			<div class="group" role="group" aria-label="Player">
				{#each [['greedy', 'Greedy'], ['idle', 'Idle']] as [value, label] (value)}
					<button
						class="chip"
						type="button"
						aria-pressed={playtest.policyName === value}
						onclick={() => playtest.setPolicy(value as PolicyName, studio.def)}
					>
						{label}
					</button>
				{/each}
			</div>
		</div>
	</section>

	<section class="chart">
		<div class="head">
			<h3>{chartCurrency?.name ?? 'Currency'} Over Time</h3>
			{#if studio.def.currencies.length > 1}
				<label class="sr-only" for="bf-chart-currency">Charted currency</label>
				<select
					id="bf-chart-currency"
					class="bf-select mini"
					value={playtest.chartCurrencyId}
					onchange={(event) => {
						playtest.chartCurrencyId = event.currentTarget.value;
						playtest.reset(studio.def);
					}}
				>
					{#each studio.def.currencies as currency (currency.id)}
						<option value={currency.id}>{currency.name}</option>
					{/each}
				</select>
			{/if}
		</div>
		<Sparkline
			points={playtest.history}
			colour={chartCurrency?.color ?? 'var(--bf-accent)'}
			label="{chartCurrency?.name ?? 'Currency'} over time"
		/>
	</section>
</div>

<style>
	.playtest {
		display: grid;
		grid-template-columns: minmax(230px, 300px) 1fr;
		gap: 20px;
		height: 100%;
		overflow: hidden;
	}

	section {
		min-width: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	h3 {
		margin: 0;
		font-size: 12px;
		font-weight: 650;
		color: var(--bf-ink-soft);
	}

	.state {
		margin-left: auto;
		padding: 2px 9px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-surface-sunk);
		color: var(--bf-muted);
		font-size: 10px;
		font-weight: 600;
	}

	.state.running {
		background: var(--bf-generator-soft);
		color: var(--bf-generator);
	}

	dl {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		margin: 0;
		display: grid;
		gap: 1px;
		align-content: start;
	}

	dl > div {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 4px 0;
		border-bottom: 1px solid var(--bf-rule);
	}

	dt {
		flex: 1;
		font-size: 11.5px;
		color: var(--bf-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	dd {
		margin: 0;
		font-size: 12px;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}

	dd.rate {
		color: var(--bf-generator);
		font-weight: 600;
	}

	.blocked {
		flex: 1;
		margin: 0;
		padding: 10px;
		border-radius: var(--bf-radius-sm);
		background: var(--bf-danger-soft);
		color: var(--bf-danger);
		font-size: 11.5px;
		line-height: 1.45;
	}

	.controls {
		display: flex;
		gap: 6px;
		margin-top: 10px;
	}

	.options {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
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

	.mini {
		width: auto;
		padding: 2px 8px;
		font-size: 11px;
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
