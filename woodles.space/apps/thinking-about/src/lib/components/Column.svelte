<script lang="ts">
	import type { ColumnMeta } from '$lib/constants';
	import Section from './Section.svelte';

	let { column, index = 0 }: { column: ColumnMeta; index?: number } = $props();

	// The board deals itself out left to right, and each column deals its own
	// sections out top to bottom from wherever that column started. Published
	// as a custom property rather than passed down as a prop because the
	// chips two levels below want to wait for it too, and a variable already
	// inherits that far.
	let columnDelay = $derived(`${index * 70}ms`);
</script>

<div class="column" style:--column-color={column.color} style:--column-delay={columnDelay}>
	<h2 class="column-title">
		<span class="column-spark" aria-hidden="true"></span>
		{column.label}
	</h2>
	<div class="column-sections">
		{#each column.sections as sectionKey, i (sectionKey)}
			<Section columnKey={column.key} {sectionKey} index={i} />
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
		/* the column itself only fades — the rising is left to the sections
		   inside it, so the two don't travel on top of each other */
		animation: ta-column-in 0.5s var(--ta-ease-glide) both;
		animation-delay: var(--column-delay, 0ms);
	}

	@keyframes ta-column-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
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
		animation: ta-slide-in 0.5s var(--ta-ease-spring) both;
		animation-delay: var(--column-delay, 0ms);
	}

	.column-spark {
		width: 0.52rem;
		height: 0.52rem;
		border-radius: 50%;
		background: var(--column-color);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--column-color) 16%, transparent);
		flex-shrink: 0;
		transition: box-shadow var(--ta-transition-glide), transform var(--ta-transition-spring);
	}

	/* the column answers a hover anywhere inside it — the spark widens its
	   halo, which is enough to say "this one" without moving any text */
	.column:hover .column-spark {
		transform: scale(1.15);
		box-shadow: 0 0 0 6px color-mix(in srgb, var(--column-color) 20%, transparent);
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
