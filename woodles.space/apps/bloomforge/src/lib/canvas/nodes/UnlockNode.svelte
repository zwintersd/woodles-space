<script lang="ts">
	import type { NodeProps } from '@xyflow/svelte';
	import { describeCondition, nameLookup } from '@woodles/incremental-core';
	import { playtest } from '../../playtest.svelte.js';
	import { studio } from '../../studio.svelte.js';
	import NodeShell from '../NodeShell.svelte';

	let { id, selected }: NodeProps = $props();

	const unlock = $derived(studio.def.unlocks.find((entry) => entry.id === id));
	const names = $derived(nameLookup(studio.def));
	const condition = $derived(unlock ? describeCondition(unlock.when, names) : '');

	// An unlock has fired once everything it reveals is revealed.
	const fired = $derived(
		playtest.showLive && !!unlock?.reveals.length && unlock.reveals.every((entry) => playtest.unlocked.has(entry))
	);
	const reveals = $derived(unlock?.reveals.map((entry) => names(entry)).join(', ') || 'nothing yet');
</script>

{#if unlock}
	<NodeShell
		kind="unlock"
		icon={fired ? '🔓' : '🔒'}
		name={unlock.name}
		selected={selected ?? false}
		issues={studio.issuesFor(id)}
		subtitle="when {condition}"
	>
		<p class="reveals">reveals {reveals}</p>
		{#if fired}<span class="tag">opened</span>{/if}
	</NodeShell>
{/if}

<style>
	.reveals {
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
		background: var(--bf-unlock-soft);
		color: var(--bf-unlock);
		font-size: 10px;
		font-weight: 600;
	}
</style>
