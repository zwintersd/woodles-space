<script lang="ts">
	import { thinkingAbout } from '$lib/thinkingAbout.svelte';
	import { sectionLabel, sectionSize } from '$lib/constants';
	import type { ColumnKey, SectionKey } from '$lib/types';
	import EntryChip from './EntryChip.svelte';

	// `index` staggers this section's arrival within its column — see
	// EntryChip for the same idea one level down.
	let {
		columnKey,
		sectionKey,
		index = 0
	}: { columnKey: ColumnKey; sectionKey: SectionKey; index?: number } = $props();

	let entries = $derived(thinkingAbout.entriesFor(columnKey, sectionKey));
	let size = $derived(sectionSize(entries.length));

	// Picks up where this section's column left off (see Column) and adds its
	// own place in the stack, capped so a long column still finishes dealing
	// itself out promptly. Published onward for the chips inside to wait on.
	let sectionDelay = $derived(
		`calc(var(--column-delay, 0ms) + ${Math.min(index * 38, 210)}ms)`
	);
</script>

<section
	class="section"
	class:minimized={size === 'minimized'}
	class:full={size === 'full'}
	style:--section-delay={sectionDelay}
>
	<header class="section-header">
		<span class="section-label">{sectionLabel(sectionKey)}</span>
		{#if size !== 'minimized'}
			<!-- keyed on the number itself so the badge is rebuilt, and so
			     re-runs its pop, every time the count actually changes -->
			{#key entries.length}
				<span class="section-count">{entries.length}</span>
			{/key}
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

	<!-- Always mounted, and hidden by CSS only while it is genuinely empty. A
	     chip's exit transition is local, so it would be skipped outright if
	     archiving the last entry in a section tore this container down around
	     it — and a section holding one thing is the common case here. `:empty`
	     goes false again the moment the leaving chip is actually gone. -->
	<div class="section-chips">
		{#each entries as entry, i (entry.id)}
			<EntryChip {entry} index={i} />
		{/each}
	</div>
</section>

<style>
	.section {
		padding: 0.65rem 0.85rem;
		border-bottom: 1px solid var(--ta-border-soft);
		transition: background var(--ta-transition-fast), padding var(--ta-transition-medium);
		animation: ta-rise 0.44s var(--ta-ease-glide) both;
		animation-delay: var(--section-delay, 0ms);
	}

	.section:hover,
	.section:focus-within {
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--column-color, var(--ta-accent)) 7%, transparent),
			transparent 72%
		);
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
		transition: font-size var(--ta-transition-medium), color var(--ta-transition-medium),
			letter-spacing var(--ta-transition-medium);
	}

	.section:hover .section-label {
		letter-spacing: 0.05em;
	}

	.section.minimized .section-label {
		font-size: 0.66rem;
		font-weight: 400;
		color: color-mix(in srgb, var(--ta-muted) 65%, transparent);
	}

	.section.full .section-label {
		color: color-mix(in srgb, var(--column-color, var(--ta-accent)) 70%, var(--ta-text-dim));
	}

	.section-count {
		font-family: var(--ta-font-mono);
		font-size: 0.66rem;
		color: color-mix(in srgb, var(--column-color, var(--ta-accent)) 70%, var(--ta-text-dim));
		background: color-mix(in srgb, var(--column-color, var(--ta-accent)) 13%, white);
		border-radius: var(--ta-radius-pill);
		padding: 0.05rem 0.4rem;
		animation: ta-pop 0.36s var(--ta-ease-spring) both;
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
		transition: opacity var(--ta-transition-fast), background var(--ta-transition-fast),
			color var(--ta-transition-fast), transform var(--ta-transition-spring);
	}

	/* dim by default rather than fully hidden — hover-to-reveal has no
	   equivalent on touch, and this is the section's only way to add. */
	.section:hover .section-add,
	.section-add:focus-visible {
		opacity: 1;
	}

	/* the quarter-turn is the whole gesture: a + that becomes a ×-in-waiting
	   reads as "this opens something" before the panel arrives to say so */
	.section-add:hover {
		background: color-mix(in srgb, var(--column-color, var(--ta-accent)) 14%, white);
		color: color-mix(in srgb, var(--column-color, var(--ta-accent)) 78%, black);
		transform: scale(1.15) rotate(90deg);
	}

	.section-add:active {
		transform: scale(0.9) rotate(90deg);
	}

	.section-chips {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-top: 0.45rem;
	}

	.section-chips:empty {
		display: none;
	}
</style>
