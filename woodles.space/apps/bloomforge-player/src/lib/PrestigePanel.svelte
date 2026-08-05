<script lang="ts">
	import { nameLookup } from '@woodles/incremental-core';
	import { currencyById, formatAmount } from './format.js';
	import EmojiIcon from './EmojiIcon.svelte';
	import { game } from './game.svelte.js';

	const names = $derived(game.def ? nameLookup(game.def) : (id: string) => id);
	let confirming = $state<string | null>(null);
</script>

{#if game.prestigeLayers.length}
	<section>
		<h2>Rebirth</h2>
		{#each game.prestigeLayers as layer (layer.id)}
			{@const currency = currencyById(game.def, layer.currencyId)}
			<div class="layer" class:ready={layer.ready}>
				<div class="head">
					<span class="name">{layer.name}</span>
					{#if layer.count > 0}
						<span class="count">{layer.count} so far</span>
					{/if}
				</div>

				<p class="state">
					Holding <strong>{formatAmount(layer.held, currency)}</strong>
					{names(layer.currencyId)} · <strong>×{layer.multiplier.toFixed(2)}</strong> to everything
				</p>

				{#if confirming === layer.id}
					<!-- A reset is the one irreversible thing a player can do here, so
					     it asks once. Everything else is just spending. -->
					<p class="warn">This resets your progress and pays out {formatAmount(layer.gain, currency)}. Sure?</p>
					<div class="actions">
						<button
							class="bp-button bp-button--primary"
							type="button"
							onclick={() => {
								game.prestige(layer.id);
								confirming = null;
							}}
						>
							Yes, begin again
						</button>
						<button class="bp-button" type="button" onclick={() => (confirming = null)}>Not yet</button>
					</div>
				{:else}
					<button
						class="bp-button bp-button--primary wide"
						type="button"
						disabled={!layer.ready}
						onclick={() => (confirming = layer.id)}
					>
						{#if layer.ready}
							Rebirth for {formatAmount(layer.gain, currency)}
							<EmojiIcon char={currency?.symbol ?? ''} size={13} />
						{:else}
							Not enough yet
						{/if}
					</button>
				{/if}
			</div>
		{/each}
	</section>
{/if}

<style>
	section {
		display: grid;
		gap: 10px;
	}

	h2 {
		margin: 0;
		font-family: var(--bp-font-display);
		font-size: 17px;
		font-weight: 600;
		color: var(--bp-prestige);
	}

	.layer {
		padding: 12px 14px;
		border: 1px solid var(--bp-prestige-line);
		border-radius: var(--bp-radius);
		background: var(--bp-surface);
		box-shadow: var(--bp-shadow-soft);
	}

	.layer.ready {
		background: linear-gradient(140deg, var(--bp-surface), var(--bp-prestige-soft));
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 4px;
	}

	.name {
		font-size: 13.5px;
		font-weight: 650;
	}

	.count {
		font-size: 11px;
		color: var(--bp-muted);
	}

	.state {
		margin: 0 0 10px;
		font-size: 12px;
		line-height: 1.45;
		color: var(--bp-ink-soft);
	}

	.state strong {
		color: var(--bp-prestige);
	}

	.warn {
		margin: 0 0 9px;
		padding: 8px 10px;
		border-radius: var(--bp-radius-sm);
		background: var(--bp-prestige-soft);
		color: var(--bp-ink-soft);
		font-size: 11.5px;
		line-height: 1.45;
	}

	.actions {
		display: flex;
		gap: 6px;
	}

	.wide {
		width: 100%;
		justify-content: center;
	}
</style>
