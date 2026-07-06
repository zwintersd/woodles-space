<script lang="ts">
	import { thinkingAbout } from '$lib/thinkingAbout.svelte';
	import { sectionLabel, sectionSize } from '$lib/constants';
	import type { ColumnKey, SectionKey } from '$lib/types';
	import EntryChip from './EntryChip.svelte';

	let { columnKey, sectionKey }: { columnKey: ColumnKey; sectionKey: SectionKey } = $props();

	let entries = $derived(thinkingAbout.entriesFor(columnKey, sectionKey));
	let size = $derived(sectionSize(entries.length));
</script>

<section class="section" class:minimized={size === 'minimized'} class:full={size === 'full'}>
	<header class="section-header">
		<span class="section-label">{sectionLabel(sectionKey)}</span>
		{#if size !== 'minimized'}
			<span class="section-count">{entries.length}</span>
		{/if}
		<button
			class="section-add"
			onclick={() => thinkingAbout.createEntry(columnKey, sectionKey)}
			title="add to {sectionLabel(sectionKey)}"
			aria-label="add to {sectionLabel(sectionKey)}"
		>
			+
		</button>
	</header>

	{#if size !== 'minimized'}
		<div class="section-chips">
			{#each entries as entry (entry.id)}
				<EntryChip {entry} />
			{/each}
		</div>
	{/if}
</section>

<style>
	.section {
		padding: 0.65rem 0.85rem;
		border-bottom: 1px solid var(--ta-border-soft);
		transition: padding var(--ta-transition-medium);
	}

	.section:last-child {
		border-bottom: none;
	}

	.section.minimized {
		padding: 0.3rem 0.85rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.section-label {
		font-family: var(--ta-font-sans);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--ta-muted);
		transition: font-size var(--ta-transition-medium), color var(--ta-transition-medium);
	}

	.section.minimized .section-label {
		font-size: 0.66rem;
		font-weight: 400;
		color: color-mix(in srgb, var(--ta-muted) 65%, transparent);
	}

	.section.full .section-label {
		color: var(--ta-text-dim);
	}

	.section-count {
		font-family: var(--ta-font-mono);
		font-size: 0.66rem;
		color: var(--ta-muted);
		background: var(--ta-bg-subtle);
		border-radius: var(--ta-radius-pill);
		padding: 0.05rem 0.4rem;
	}

	.section-add {
		margin-left: auto;
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		color: var(--ta-muted);
		font-size: 0.85rem;
		line-height: 1;
		opacity: 0.4;
		transition: opacity var(--ta-transition-fast), background var(--ta-transition-fast), color var(--ta-transition-fast);
	}

	/* dim by default rather than fully hidden — hover-to-reveal has no
	   equivalent on touch, and this is the section's only way to add. */
	.section:hover .section-add,
	.section-add:focus-visible {
		opacity: 1;
	}

	.section-add:hover {
		background: var(--ta-accent-soft);
		color: var(--ta-accent);
	}

	.section-chips {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-top: 0.45rem;
	}
</style>
