<script lang="ts">
	import { COLUMNS } from '$lib/constants';
	import Column from './Column.svelte';
</script>

<div class="board">
	{#each COLUMNS as column (column.key)}
		<Column {column} />
	{/each}
</div>

<style>
	.board {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		background: var(--ta-surface);
		border: 1px solid var(--ta-border);
		border-radius: var(--ta-radius-md);
		overflow: hidden;
	}

	@media (max-width: 860px) {
		.board {
			grid-template-columns: 1fr;
		}
	}
</style>
