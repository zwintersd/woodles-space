<script lang="ts">
	import type { Paragraph } from '$lib/reading/text';

	interface Props {
		paragraphs: Paragraph[];
		rootEl?: HTMLElement;
	}

	let { paragraphs, rootEl = $bindable() }: Props = $props();
</script>

<div class="passage" bind:this={rootEl}>
	{#each paragraphs as p (p.id)}
		<p data-anchor={p.id}>{p.content}</p>
	{/each}
</div>

<style>
	.passage {
		font-family: var(--font-body);
		font-size: 1.02rem;
		line-height: 1.7;
		color: var(--text);
	}
	.passage p {
		margin: 0 0 1.1em;
		white-space: pre-wrap;
	}
	.passage p:last-child {
		margin-bottom: 0;
	}
	.passage :global(p::selection) {
		background: rgba(108, 229, 232, 0.28);
	}
</style>
