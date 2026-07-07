<script lang="ts">
	import { fly } from 'svelte/transition';
	import { motionDuration } from '$lib/motion';
	import { thinkingAbout } from '$lib/thinkingAbout.svelte';
	import type { ThinkingAboutEntry } from '$lib/types';

	let { entry }: { entry: ThinkingAboutEntry } = $props();
</script>

<div
	class="chip"
	style:--chip-color={entry.color}
	transition:fly={{ y: -6, duration: motionDuration(200) }}
>
	<button class="chip-open" onclick={() => thinkingAbout.openEntry(entry.id)}>
		<span class="chip-dot" aria-hidden="true"></span>
		<span class="chip-title">{entry.title || 'untitled'}</span>
	</button>
	<button
		class="chip-archive"
		onclick={() => thinkingAbout.archiveEntry(entry.id)}
		title="mark done"
		aria-label="mark {entry.title || 'untitled'} done"
	>
		✓
	</button>
</div>

<style>
	.chip {
		display: flex;
		align-items: stretch;
		gap: 0.3rem;
		border-radius: var(--ta-radius-sm);
		background: color-mix(in srgb, var(--chip-color) 13%, white);
		border: 1px solid color-mix(in srgb, var(--chip-color) 32%, white);
		transition: background var(--ta-transition-fast), box-shadow var(--ta-transition-fast),
			transform var(--ta-transition-spring);
	}

	.chip:hover,
	.chip:focus-within {
		background: color-mix(in srgb, var(--chip-color) 22%, white);
		box-shadow: var(--ta-shadow-sm);
		transform: var(--ta-lift-hover);
	}

	.chip-open {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		padding: 0.4rem 0.5rem;
		text-align: left;
	}

	.chip-open:active {
		transform: scale(0.985);
	}

	.chip-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--chip-color);
		flex-shrink: 0;
		transition: transform var(--ta-transition-spring);
	}

	.chip:hover .chip-dot {
		transform: scale(1.2);
	}

	.chip-title {
		flex: 1;
		min-width: 0;
		font-family: var(--ta-font-sans);
		font-size: 0.82rem;
		color: var(--ta-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chip-archive {
		flex-shrink: 0;
		width: 1.6rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		color: color-mix(in srgb, var(--chip-color) 65%, black 25%);
		opacity: 0.45;
		transition: opacity var(--ta-transition-fast), background var(--ta-transition-fast),
			transform var(--ta-transition-spring);
		border-radius: var(--ta-radius-sm);
	}

	/* dim by default rather than fully hidden — touch has no hover to reveal it */
	.chip:hover .chip-archive,
	.chip:focus-within .chip-archive {
		opacity: 0.8;
	}

	.chip-archive:hover,
	.chip-archive:focus-visible {
		opacity: 1;
		background: rgba(255, 255, 255, 0.55);
		transform: scale(1.15);
	}

	.chip-archive:active {
		transform: scale(0.92);
	}
</style>
