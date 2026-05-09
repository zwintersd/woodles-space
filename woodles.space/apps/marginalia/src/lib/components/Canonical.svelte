<script lang="ts">
	import { game } from '$lib/state/game.svelte';
	const c = $derived(game.canonical);
</script>

<div class="canonical">
	<div class="lines">
		{#each c.lines as line, i (i)}
			<p>{line}</p>
		{/each}
	</div>
	<p class="attrib">— {c.attribution} ✦</p>
</div>

<style>
	.canonical {
		max-width: 38rem;
		margin: 0 auto;
		padding: 2.5rem 1rem 1.5rem;
		text-align: center;
	}
	.lines p {
		font-family: var(--font-display);
		font-size: clamp(1.05rem, 2.2vw, 1.4rem);
		line-height: 1.6;
		color: var(--cream);
		margin: 0.15em 0;
		letter-spacing: 0.005em;
	}
	.attrib {
		margin-top: 0.9rem;
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
</style>
