<script lang="ts">
	import type { ColumnMeta } from '$lib/constants';
	import Section from './Section.svelte';

	let { column }: { column: ColumnMeta } = $props();
</script>

<div class="column" style:--column-color={column.color}>
	<h2 class="column-title">
		<span class="column-spark" aria-hidden="true"></span>
		{column.label}
	</h2>
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
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--column-color) 8%, transparent) 0, transparent 9rem),
			var(--ta-surface);
	}

	.column:last-child {
		border-right: none;
	}

	.column-title {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-family: var(--ta-font-sans);
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--ta-text);
		padding: 1rem 0.85rem 0.6rem;
		border-bottom: 1px solid color-mix(in srgb, var(--column-color) 18%, var(--ta-border));
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--column-color) 11%, transparent),
			transparent 72%
		);
	}

	.column-spark {
		width: 0.52rem;
		height: 0.52rem;
		border-radius: 50%;
		background: var(--column-color);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--column-color) 16%, transparent);
		flex-shrink: 0;
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
