<script lang="ts">
	import type { ColumnMeta } from '$lib/constants';
	import Section from './Section.svelte';

	let { column }: { column: ColumnMeta } = $props();
</script>

<div class="column">
	<h2 class="column-title">{column.label}</h2>
	<div class="column-sections">
		{#each column.sections as sectionKey (sectionKey)}
			<Section columnKey={column.key} {sectionKey} />
		{/each}
	</div>
</div>

<style>
	.column {
		display: flex;
		flex-direction: column;
		min-width: 0;
		border-right: 1px solid var(--ta-border);
	}

	.column:last-child {
		border-right: none;
	}

	.column-title {
		font-family: var(--ta-font-sans);
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--ta-text);
		padding: 1rem 0.85rem 0.6rem;
		border-bottom: 1px solid var(--ta-border);
	}

	.column-sections {
		flex: 1;
		overflow-y: auto;
	}

	@media (max-width: 860px) {
		.column {
			border-right: none;
			border-bottom: 1px solid var(--ta-border);
		}
	}
</style>
