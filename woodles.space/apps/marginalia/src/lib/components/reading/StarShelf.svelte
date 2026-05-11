<script lang="ts">
	import Star from './Star.svelte';

	interface Props {
		count: number;
		size?: number;
	}

	let { count, size = 28 }: Props = $props();

	const safeCount = $derived(Math.max(0, count | 0));
	// Cap visible stars; large counts get a "+N" suffix so the shelf doesn't
	// blow out horizontally on long-haul saves.
	const MAX_VISIBLE = 24;
	const visible = $derived(Math.min(safeCount, MAX_VISIBLE));
	const overflow = $derived(Math.max(0, safeCount - MAX_VISIBLE));
</script>

{#if safeCount === 0}
	<p class="empty">no stars yet. the first will hang here when you complete it.</p>
{:else}
	<div class="shelf" aria-label="completed stars: {safeCount}">
		{#each Array(visible) as _, i (i)}
			<Star points={5} {size} />
		{/each}
		{#if overflow > 0}
			<span class="overflow">+{overflow}</span>
		{/if}
	</div>
{/if}

<style>
	.shelf {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.overflow {
		font-family: var(--font-counter);
		color: var(--cyan);
		font-size: 1rem;
		padding-left: 0.3rem;
	}
	.empty {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		font-style: italic;
		color: var(--muted);
		margin: 0;
	}
</style>
