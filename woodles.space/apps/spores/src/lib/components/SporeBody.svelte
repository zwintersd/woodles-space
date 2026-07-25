<script lang="ts">
	import { garden } from '$lib/garden.svelte';
	import type { Spore } from '$lib/types';

	// A spore body rendered as text runs and [[links]]. Segments rather than
	// innerHTML: the body is plain text the person typed, so there is no markup
	// to sanitize and no way for a paste to become live HTML.

	let { spore }: { spore: Spore } = $props();

	let segments = $derived(garden.segmentsOf(spore));

	function follow(target: string) {
		const found = garden.followLink(target, { from: spore });
		garden.openSpore(found.id);
	}
</script>

<div class="body-text">
	{#each segments as segment}
		{#if segment.kind === 'text'}{segment.text}{:else}
			<button
				class="entry-link"
				class:is-broken={segment.sporeId === null}
				onclick={() => follow(segment.link.target)}
				title={segment.sporeId === null
					? `${segment.link.target} — not written yet. Click to sow it.`
					: `Go to ${segment.link.target}`}
			>{segment.link.display}</button>
		{/if}
	{/each}
</div>

<style>
	.body-text {
		font-family: var(--g-font-body);
		font-size: 1rem;
		line-height: 1.75;
		color: var(--g-text);
		white-space: pre-wrap;
	}

	/* A link is a word in a sentence, not a widget: it keeps the baseline and
	   the surrounding rhythm, and only the colour and underline say it's live. */
	.entry-link {
		display: inline;
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		line-height: inherit;
		color: var(--g-flight);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 2px;
		cursor: pointer;
		border-radius: 2px;
		transition: background-color var(--g-transition-fast);
	}

	.entry-link:hover {
		background-color: var(--g-flight-soft);
	}

	.entry-link:focus-visible {
		outline: 2px solid var(--g-flight);
		outline-offset: 2px;
	}

	/* A red link — nothing answers to this title yet. Dashed rather than solid,
	   and the + says what clicking does: sow it, don't fail. */
	.entry-link.is-broken {
		color: var(--g-flight-active);
		text-decoration-style: dashed;
	}

	.entry-link.is-broken::after {
		content: '+';
		font-size: 0.7em;
		vertical-align: super;
		margin-left: 1px;
	}
</style>
