<script lang="ts">
	import type { NodeProps } from '@xyflow/svelte';
	import { num, type Currency } from '@woodles/incremental-core';
	import { currencyById, formatAmount, signedRate } from '../../format.js';
	import { playtest } from '../../playtest.svelte.js';
	import { studio } from '../../studio.svelte.js';
	import NodeShell from '../NodeShell.svelte';

	let { id, selected }: NodeProps = $props();

	const currency = $derived(studio.def.currencies.find((entry) => entry.id === id) as Currency | undefined);
	const taxTarget = $derived(currencyById(studio.def, currency?.spendTax?.intoCurrencyId));
	const live = $derived(playtest.showLive);
	const amount = $derived(playtest.amounts[id] ?? 0);
	const rate = $derived(playtest.rates[id] ?? 0);

	/**
	 * With no run going the card shows a *sample* value in this currency's own
	 * formatting. It occupies the same slot the live total will, so the card
	 * doesn't change shape when you press play — and it answers the question a
	 * designer actually has at rest, which is "what will my numbers look like".
	 */
	const sample = $derived(currency ? num.format(1234.56, currency.format) : '');
</script>

{#if currency}
	<NodeShell
		kind="currency"
		icon={currency.symbol || '🪙'}
		name={currency.name}
		selected={selected ?? false}
		issues={studio.issuesFor(id)}
	>
		<div class="stat" style:color={currency.color}>
			{live ? formatAmount(amount, currency) : sample}
		</div>
		<div class="rate">
			{live ? signedRate(rate, currency) : `${currency.format.notation} · ${currency.format.decimalPlaces} dp`}
		</div>
		{#if currency.spendTax}
			<span class="tag">taxes into {taxTarget?.name ?? '—'}</span>
		{/if}
	</NodeShell>
{/if}

<style>
	.stat {
		font-size: 19px;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.1;
	}

	.rate {
		margin-top: 2px;
		font-size: 11px;
		color: var(--bf-muted);
		font-variant-numeric: tabular-nums;
	}

	.tag {
		display: inline-block;
		margin-top: 6px;
		padding: 2px 7px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-currency-soft);
		color: var(--bf-currency);
		font-size: 10px;
		font-weight: 600;
	}
</style>
