<script lang="ts">
	import type { NodeProps } from '@xyflow/svelte';
	import { formatAmount, currencyById, signedRate } from '../../format.js';
	import { playtest } from '../../playtest.svelte.js';
	import { studio } from '../../studio.svelte.js';
	import EmojiIcon from '../../EmojiIcon.svelte';
	import NodeShell from '../NodeShell.svelte';
	import LevelPips from '../LevelPips.svelte';

	let { id, selected }: NodeProps = $props();

	const generator = $derived(studio.def.generators.find((entry) => entry.id === id));
	const produces = $derived(currencyById(studio.def, generator?.producesCurrencyId));
	const priced = $derived(currencyById(studio.def, generator?.cost.currencyId));

	const live = $derived(playtest.showLive);
	const level = $derived(playtest.generatorLevels[id] ?? generator?.startsOwned ?? 0);
	const rate = $derived(playtest.generatorRates[id] ?? 0);
	const nextCost = $derived(playtest.nextCosts[id]);
	const locked = $derived(live && !playtest.unlocked.has(id) && isGated(id));

	function isGated(entityId: string): boolean {
		return studio.def.unlocks.some((unlock) => unlock.reveals.includes(entityId));
	}
</script>

{#if generator}
	<NodeShell
		kind="generator"
		icon="🌱"
		name={generator.name}
		selected={selected ?? false}
		dimmed={locked}
		issues={studio.issuesFor(id)}
		subtitle={live ? `Level ${level}` : `${generator.baseRate} / sec at level 1`}
	>
		{#if live}
			<div class="rate">{signedRate(rate, produces)}</div>
			<LevelPips {level} max={generator.maxLevel ?? 10} />
			{#if nextCost !== null && nextCost !== undefined}
				<div class="cost">
					<EmojiIcon char={priced?.symbol ?? '🪙'} size={11} />
					{formatAmount(nextCost, priced)}
				</div>
			{/if}
		{:else}
			<div class="rate muted">makes {produces?.name ?? '—'}</div>
			<div class="cost">
				<EmojiIcon char={priced?.symbol ?? '🪙'} size={11} />
				{formatAmount(generator.cost.base, priced)} to start
			</div>
		{/if}
		{#if generator.populationBoost}
			<span class="tag">boosted by unequipped upgrades</span>
		{/if}
	</NodeShell>
{/if}

<style>
	.rate {
		font-size: 14px;
		font-weight: 650;
		color: var(--bf-generator);
		font-variant-numeric: tabular-nums;
	}

	.rate.muted {
		font-size: 11px;
		font-weight: 500;
		color: var(--bf-muted);
	}

	.cost {
		margin-top: 6px;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 8px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-currency-soft);
		color: var(--bf-ink-soft);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.tag {
		display: inline-block;
		margin-top: 6px;
		padding: 2px 7px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-generator-soft);
		color: var(--bf-generator);
		font-size: 10px;
		font-weight: 600;
	}
</style>
