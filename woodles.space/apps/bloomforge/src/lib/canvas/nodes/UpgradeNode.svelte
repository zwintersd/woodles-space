<script lang="ts">
	import type { NodeProps } from '@xyflow/svelte';
	import { describeEffect, nameLookup, upgradeMaxLevel } from '@woodles/incremental-core';
	import { currencyById, formatAmount } from '../../format.js';
	import { playtest } from '../../playtest.svelte.js';
	import { studio } from '../../studio.svelte.js';
	import EmojiIcon from '../../EmojiIcon.svelte';
	import NodeShell from '../NodeShell.svelte';
	import LevelPips from '../LevelPips.svelte';

	let { id, selected }: NodeProps = $props();

	const upgrade = $derived(studio.def.upgrades.find((entry) => entry.id === id));
	const priced = $derived(currencyById(studio.def, upgrade?.cost.currencyId));
	const names = $derived(nameLookup(studio.def));

	const live = $derived(playtest.showLive);
	const level = $derived(playtest.upgradeLevels[id] ?? 0);
	const max = $derived(upgrade ? upgradeMaxLevel(upgrade) : 1);
	const nextCost = $derived(playtest.nextCosts[id]);
	const maxed = $derived(live && level >= max);
	const locked = $derived(live && !playtest.unlocked.has(id) && isGated(id));

	const summary = $derived(
		upgrade?.effects.length ? upgrade.effects.map((effect) => describeEffect(effect, names)).join(' · ') : 'no effect yet'
	);
	const isGlobal = $derived(upgrade?.effects.some((effect) => effect.target.type === 'global') ?? false);

	function isGated(entityId: string): boolean {
		return studio.def.unlocks.some((unlock) => unlock.reveals.includes(entityId));
	}
</script>

{#if upgrade}
	<NodeShell
		kind="upgrade"
		icon={maxed ? '✅' : locked ? '🔒' : '✨'}
		name={upgrade.name}
		selected={selected ?? false}
		dimmed={locked}
		issues={studio.issuesFor(id)}
		subtitle={live ? `Level ${level} / ${max}` : max > 1 ? `repeatable to ${max}` : 'one-shot'}
	>
		<p class="effect">{summary}</p>
		{#if isGlobal}
			<!-- A global effect draws no edges, so the card has to say so itself. -->
			<span class="tag">affects everything</span>
		{/if}
		{#if live && max > 1}
			<LevelPips {level} {max} />
		{/if}
		<div class="cost" class:done={maxed}>
			<EmojiIcon char={priced?.symbol ?? '🪙'} size={11} />
			{#if maxed}
				fully grown
			{:else}
				{formatAmount(live && nextCost != null ? nextCost : upgrade.cost.amount, priced)}
			{/if}
		</div>
	</NodeShell>
{/if}

<style>
	.effect {
		margin: 0;
		font-size: 11px;
		line-height: 1.4;
		color: var(--bf-ink-soft);
	}

	.tag {
		display: inline-block;
		margin-top: 6px;
		padding: 2px 7px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-upgrade-soft);
		color: var(--bf-upgrade);
		font-size: 10px;
		font-weight: 600;
	}

	.cost {
		margin-top: 8px;
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

	.cost.done {
		background: var(--bf-generator-soft);
		color: var(--bf-generator);
	}
</style>
