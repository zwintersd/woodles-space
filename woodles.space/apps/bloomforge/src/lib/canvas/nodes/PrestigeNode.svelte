<script lang="ts">
	import type { NodeProps } from '@xyflow/svelte';
	import { currencyById, formatAmount } from '../../format.js';
	import { playtest } from '../../playtest.svelte.js';
	import { studio } from '../../studio.svelte.js';
	import NodeShell from '../NodeShell.svelte';

	let { id, selected }: NodeProps = $props();

	const layer = $derived(studio.def.prestigeLayers.find((entry) => entry.id === id));
	const awards = $derived(currencyById(studio.def, layer?.currencyId));

	const live = $derived(playtest.showLive);
	const held = $derived(layer ? (playtest.amounts[layer.currencyId] ?? 0) : 0);
	const resets = $derived(playtest.prestigeCounts[id] ?? 0);
	const locked = $derived(live && !playtest.unlocked.has(id) && isGated(id));

	// The multiplier a *single* layer contributes, which is what the card is
	// about — `playtest.prestigeMultiplier` is the product of every layer.
	const multiplier = $derived(layer ? 1 + layer.multiplier.perUnit * held : 1);

	function isGated(entityId: string): boolean {
		return studio.def.unlocks.some((unlock) => unlock.reveals.includes(entityId));
	}
</script>

{#if layer}
	<NodeShell
		kind="prestige"
		icon={locked ? '🔒' : '💎'}
		name={layer.name}
		selected={selected ?? false}
		dimmed={locked}
		issues={studio.issuesFor(id)}
		subtitle="Prestige Multiplier"
	>
		<div class="multiplier">×{multiplier.toFixed(2)}</div>
		<div class="held">
			<span aria-hidden="true">{awards?.symbol ?? '💠'}</span>
			{formatAmount(held, awards)}
			{#if live && resets > 0}<span class="resets">· {resets} reset{resets === 1 ? '' : 's'}</span>{/if}
		</div>
	</NodeShell>
{/if}

<style>
	.multiplier {
		font-size: 19px;
		font-weight: 700;
		color: var(--bf-prestige);
		letter-spacing: -0.01em;
		font-variant-numeric: tabular-nums;
	}

	.held {
		margin-top: 6px;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 8px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-prestige-soft);
		color: var(--bf-ink-soft);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.resets {
		color: var(--bf-muted);
	}
</style>
