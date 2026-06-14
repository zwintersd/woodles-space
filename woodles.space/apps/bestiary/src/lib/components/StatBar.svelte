<script lang="ts">
	// Ten cells filled left-to-right in the stat's accent color. At zero the
	// cells stay visible as empty outlines — a 0 should read as chosen, not
	// as "not yet filled in".
	let { value, colorVar }: { value: number; colorVar: string } = $props();

	const cells = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
</script>

<div class="bar" style="--c: var({colorVar})" aria-hidden="true">
	{#each cells as n (n)}
		<span class="cell" class:filled={n <= value}></span>
	{/each}
</div>

<style>
	.bar {
		display: flex;
		gap: 2px;
		align-items: center;
	}
	.cell {
		width: 0.5rem;
		height: 0.72rem;
		border-radius: 2px;
		border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
		background: transparent;
		transition: background var(--b-transition-fast);
	}
	.cell.filled {
		background: var(--c);
		border-color: var(--c);
	}
</style>
