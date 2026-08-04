<script lang="ts">
	import { currencyById, formatAmount, signedRate } from './format.js';
	import { game } from './game.svelte.js';
</script>

<div class="bar">
	{#each game.visibleCurrencies as currency (currency.id)}
		{@const rate = game.rates[currency.id] ?? 0}
		<div class="currency" style:--tint={currency.color}>
			<span class="symbol" aria-hidden="true">{currency.symbol || '🪙'}</span>
			<span class="figures">
				<span class="amount">{formatAmount(game.amounts[currency.id] ?? 0, currency)}</span>
				<span class="name">{currency.name}</span>
			</span>
			{#if rate > 0}
				<span class="rate">{signedRate(rate, currency)}</span>
			{/if}
		</div>
	{/each}

	{#if game.prestigeMultiplier > 1}
		{@const layer = game.prestigeLayers[0]}
		<div class="currency multiplier" title="Every prestige layer, multiplied together">
			<span class="symbol" aria-hidden="true">✨</span>
			<span class="figures">
				<span class="amount">×{game.prestigeMultiplier.toFixed(2)}</span>
				<span class="name">{layer ? `from ${currencyById(game.def, layer.currencyId)?.name ?? 'prestige'}` : 'prestige'}</span>
			</span>
		</div>
	{/if}
</div>

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.currency {
		--tint: var(--bp-accent);
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px 10px 12px;
		border: 1px solid color-mix(in srgb, var(--tint) 28%, transparent);
		border-radius: var(--bp-radius);
		background: var(--bp-surface);
		box-shadow: var(--bp-shadow-soft);
	}

	.symbol {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		flex: none;
		border-radius: var(--bp-radius-pill);
		background: color-mix(in srgb, var(--tint) 14%, var(--bp-surface));
		font-size: 17px;
	}

	.figures {
		display: grid;
		line-height: 1.15;
	}

	.amount {
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.015em;
		color: var(--tint);
		font-variant-numeric: tabular-nums;
	}

	.name {
		font-size: 11px;
		color: var(--bp-muted);
	}

	.rate {
		margin-left: 4px;
		padding: 3px 9px;
		border-radius: var(--bp-radius-pill);
		background: var(--bp-generator-soft);
		color: var(--bp-generator);
		font-size: 11.5px;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.multiplier {
		--tint: var(--bp-prestige);
	}
</style>
