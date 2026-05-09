<script lang="ts">
	import { game } from '$lib/state/game.svelte';
	import { fade } from 'svelte/transition';

	// newest at the bottom; older entries are slightly more faded.
	const entries = $derived(game.feed);
</script>

<div class="feed" aria-live="polite" aria-relevant="additions">
	{#each entries as e, i (e.id)}
		{@const opacity = Math.max(0.18, 1 - (entries.length - 1 - i) * 0.018)}
		<p class="entry kind-{e.kind}" style="opacity: {opacity}" in:fade={{ duration: 320 }}>
			{#if e.kind === 'echo'}
				<span class="echo">{e.text}</span>
			{:else if e.kind === 'narration'}
				<span class="narration">— {e.text}</span>
			{:else if e.kind === 'ambient'}
				<span class="ambient">· {e.text}</span>
			{:else if e.kind === 'milestone'}
				<span class="milestone">✦ {e.text}</span>
			{:else if e.kind === 'system'}
				<span class="system">{e.text}</span>
			{:else}
				<span class="gloss">{e.text}</span>
			{/if}
		</p>
	{/each}
	{#if entries.length === 0}
		<p class="empty">the page is blank but for the canonical text. begin annotating.</p>
	{/if}
</div>

<style>
	.feed {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 1.2rem 1.4rem;
		max-height: 22rem;
		overflow: hidden;
		font-family: var(--font-body);
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--text);
		mask-image: linear-gradient(to bottom, transparent 0%, black 14%, black 100%);
		-webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 14%, black 100%);
	}
	.entry {
		margin: 0;
		padding-left: 0.5rem;
		border-left: 1px solid var(--rule);
	}
	.gloss {
		color: var(--text);
	}
	.narration {
		color: var(--periwinkle);
		font-style: italic;
	}
	.ambient {
		color: var(--muted);
	}
	.milestone {
		color: var(--leafeon-pink);
		font-family: var(--font-ui);
		font-size: 0.88rem;
	}
	.system {
		color: var(--cyan);
		font-family: var(--font-ui);
		font-size: 0.84rem;
		letter-spacing: 0.04em;
	}
	.echo {
		color: var(--print-pink);
		font-family: var(--font-hand);
		font-size: 1.18rem;
		letter-spacing: 0.01em;
	}
	.empty {
		color: var(--muted);
		font-style: italic;
		opacity: 0.7;
	}
</style>
