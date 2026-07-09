<script lang="ts">
	import { fly, scale } from 'svelte/transition';
	import { motionDuration } from '$lib/motion';
	import { sessionVerb } from '$lib/constants';
	import { latestSessionDate } from '$lib/entries';
	import { thinkingAbout } from '$lib/thinkingAbout.svelte';
	import type { ThinkingAboutEntry } from '$lib/types';

	let { entry }: { entry: ThinkingAboutEntry } = $props();

	let lastLogged = $derived(latestSessionDate(entry.sessions));
	let logTitle = $derived(
		lastLogged
			? `log a ${sessionVerb(entry.columnKey)} session — last logged ${lastLogged}`
			: `log a ${sessionVerb(entry.columnKey)} session`
	);
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
		class="chip-log"
		onclick={() => thinkingAbout.logSession(entry.id)}
		title={logTitle}
		aria-label="log a {sessionVerb(entry.columnKey)} session for {entry.title || 'untitled'}"
	>
		<span aria-hidden="true">▸</span>
		{#if entry.sessions.length > 0}
			{#key entry.sessions.length}
				<span class="chip-log-count" in:scale={{ duration: motionDuration(220), start: 0.4 }}>
					{entry.sessions.length}
				</span>
			{/key}
		{/if}
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
		background:
			linear-gradient(90deg, color-mix(in srgb, var(--chip-color) 26%, white), white 150%),
			color-mix(in srgb, var(--chip-color) 18%, white);
		border: 1px solid color-mix(in srgb, var(--chip-color) 42%, white);
		transition: background var(--ta-transition-fast), box-shadow var(--ta-transition-fast),
			transform var(--ta-transition-spring);
	}

	.chip:hover,
	.chip:focus-within {
		background:
			linear-gradient(90deg, color-mix(in srgb, var(--chip-color) 34%, white), white 145%),
			color-mix(in srgb, var(--chip-color) 24%, white);
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
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--chip-color);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--chip-color) 18%, transparent);
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

	.chip-log,
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

	.chip-log {
		width: auto;
		min-width: 1.6rem;
		padding: 0 0.3rem;
		gap: 0.12rem;
	}

	.chip-log-count {
		font-family: var(--ta-font-mono);
		font-size: 0.6rem;
	}

	/* dim by default rather than fully hidden — touch has no hover to reveal it */
	.chip:hover .chip-log,
	.chip:focus-within .chip-log,
	.chip:hover .chip-archive,
	.chip:focus-within .chip-archive {
		opacity: 0.8;
	}

	.chip-log:hover,
	.chip-log:focus-visible,
	.chip-archive:hover,
	.chip-archive:focus-visible {
		opacity: 1;
		background: rgba(255, 255, 255, 0.55);
		transform: scale(1.15);
	}

	.chip-log:active,
	.chip-archive:active {
		transform: scale(0.92);
	}
</style>
