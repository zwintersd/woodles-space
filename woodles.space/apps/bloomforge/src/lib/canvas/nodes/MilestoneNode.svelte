<script lang="ts">
	import type { NodeProps } from '@xyflow/svelte';
	import { describeCondition, evaluateCondition, nameLookup } from '@woodles/incremental-core';
	import { playtest } from '../../playtest.svelte.js';
	import { studio } from '../../studio.svelte.js';
	import NodeShell from '../NodeShell.svelte';

	let { id, selected }: NodeProps = $props();

	const milestone = $derived(studio.def.milestones.find((entry) => entry.id === id));
	const names = $derived(nameLookup(studio.def));
	const condition = $derived(milestone ? describeCondition(milestone.when, names) : '');

	// Read from the live state rather than from the event log: the log is
	// capped, and a long run would lose the early milestones off the end of it.
	const reached = $derived.by(() => {
		if (!playtest.showLive || !milestone) return false;
		return evaluateCondition(milestone.when, {
			gameTime: playtest.elapsed,
			currencies: Object.fromEntries(
				Object.keys(playtest.amounts).map((key) => [
					key,
					{ amount: playtest.amounts[key] ?? 0, lifetime: playtest.lifetimes[key] ?? 0 }
				])
			),
			generators: Object.fromEntries(
				Object.entries(playtest.generatorLevels).map(([key, level]) => [key, { level }])
			),
			upgrades: Object.fromEntries(Object.entries(playtest.upgradeLevels).map(([key, level]) => [key, { level }])),
			prestige: Object.fromEntries(
				Object.entries(playtest.prestigeCounts).map(([key, count]) => [key, { count, currencyAmount: 0 }])
			),
			unlocked: playtest.unlocked
		});
	});
</script>

{#if milestone}
	<NodeShell
		kind="milestone"
		icon={reached ? '🏆' : '🎯'}
		name={milestone.name}
		selected={selected ?? false}
		issues={studio.issuesFor(id)}
		subtitle="when {condition}"
	>
		{#if reached}<span class="tag">reached</span>{/if}
	</NodeShell>
{/if}

<style>
	.tag {
		display: inline-block;
		padding: 2px 7px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-milestone-soft);
		color: var(--bf-milestone);
		font-size: 10px;
		font-weight: 600;
	}
</style>
