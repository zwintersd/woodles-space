<script lang="ts">
	import { currencyById, formatAmount, signedRate, timeUntil } from './format.js';
	import { game, type Purchasable } from './game.svelte.js';

	/**
	 * One buyable thing. Generators and upgrades differ in what they lead with —
	 * a rate versus an effect — but they are the same gesture, so they are the
	 * same card.
	 */
	interface Props {
		item: Purchasable;
		kind: 'generator' | 'upgrade';
		icon: string;
		/** The line under the name: what it does for you. */
		detail: string;
		onbuy: (id: string) => void;
	}

	let { item, kind, icon, detail, onbuy }: Props = $props();

	const priced = $derived(currencyById(game.def, item.costCurrencyId));
	const rate = $derived(game.generatorRates[item.id] ?? 0);
	const maxed = $derived(item.cost === null);
	const wait = $derived(
		item.cost === null || item.locked
			? null
			: timeUntil(item.cost, game.amounts[item.costCurrencyId] ?? 0, game.rates[item.costCurrencyId] ?? 0)
	);
</script>

<button
	class="card"
	data-kind={kind}
	type="button"
	disabled={!item.affordable}
	onclick={() => onbuy(item.id)}
	aria-label="Buy {item.name}{item.cost === null ? '' : `, costs ${formatAmount(item.cost, priced)}`}"
>
	<span class="icon" aria-hidden="true">{item.locked ? '🔒' : maxed ? '✅' : icon}</span>

	<span class="body">
		<span class="head">
			<span class="name">{item.name}</span>
			<span class="level">
				{item.level}{item.maxLevel !== null ? ` / ${item.maxLevel}` : ''}
			</span>
		</span>
		<span class="detail">{detail}</span>
		{#if kind === 'generator' && item.level > 0}
			<span class="rate">{signedRate(rate, currencyById(game.def, game.def?.generators.find((g) => g.id === item.id)?.producesCurrencyId))}</span>
		{/if}
	</span>

	<span class="price">
		{#if item.blockedBy}
			<span class="blocked">{item.blockedBy}</span>
		{:else if item.cost !== null}
			<span class="cost" class:short={!item.affordable}>
				<span aria-hidden="true">{priced?.symbol ?? '🪙'}</span>
				{formatAmount(item.cost, priced)}
			</span>
			{#if wait}<span class="wait">{wait}</span>{/if}
		{/if}
	</span>
</button>

<style>
	.card {
		--tint: var(--bp-generator);
		--tint-soft: var(--bp-generator-soft);
		--tint-line: var(--bp-generator-line);

		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 11px 13px;
		border: 1px solid var(--tint-line);
		border-radius: var(--bp-radius);
		background: var(--bp-surface);
		box-shadow: var(--bp-shadow-soft);
		text-align: left;
		cursor: pointer;
		transition: transform 100ms ease, box-shadow 140ms ease, border-color 140ms ease;
	}

	.card[data-kind='upgrade'] {
		--tint: var(--bp-upgrade);
		--tint-soft: var(--bp-upgrade-soft);
		--tint-line: var(--bp-upgrade-line);
	}

	.card:not(:disabled):hover {
		border-color: var(--tint);
		box-shadow: var(--bp-shadow-card);
		transform: translateY(-1px);
	}

	.card:not(:disabled):active {
		transform: translateY(0);
	}

	/* Not `opacity` on the whole card: a shop you can't read is worse than one
	   you can't click, and the numbers are exactly what you're deciding on. */
	.card:disabled {
		cursor: default;
		border-color: var(--bp-rule);
		box-shadow: none;
		background: var(--bp-surface-sunk);
	}

	.icon {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		flex: none;
		border-radius: var(--bp-radius-pill);
		background: var(--tint-soft);
		font-size: 16px;
	}

	.card:disabled .icon {
		background: var(--bp-rule);
		filter: grayscale(0.4);
	}

	.body {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.name {
		font-size: 13.5px;
		font-weight: 650;
		color: var(--bp-ink);
	}

	.level {
		font-size: 11px;
		color: var(--bp-muted);
		font-variant-numeric: tabular-nums;
	}

	.detail {
		font-size: 11.5px;
		line-height: 1.35;
		color: var(--bp-muted);
	}

	.rate {
		font-size: 11.5px;
		font-weight: 650;
		color: var(--tint);
		font-variant-numeric: tabular-nums;
	}

	.price {
		flex: none;
		display: grid;
		gap: 2px;
		justify-items: end;
	}

	.cost {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		border-radius: var(--bp-radius-pill);
		background: var(--bp-currency-soft);
		color: var(--bp-ink-soft);
		font-size: 12px;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.cost.short {
		background: var(--bp-surface);
		color: var(--bp-faint);
	}

	.wait {
		font-size: 10px;
		color: var(--bp-faint);
		font-variant-numeric: tabular-nums;
	}

	.blocked {
		padding: 4px 10px;
		border-radius: var(--bp-radius-pill);
		background: var(--bp-surface);
		color: var(--bp-faint);
		font-size: 11px;
		white-space: nowrap;
	}
</style>
