<script lang="ts">
	import { game } from '$lib/state/game.svelte';
	const c = $derived(game.canonical);
	const remembered = $derived(game.canonicalRemembered);

	let trembling = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		// react to every click pulse
		game.clickPulse;
		trembling = true;
		clearTimeout(timer);
		timer = setTimeout(() => (trembling = false), 160);
		return () => clearTimeout(timer);
	});
</script>

<div class="canonical" class:trembling>
	{#if remembered.length > 0}
		<div class="remembered" aria-label="lines returned by recitation">
			{#each remembered as line, i (i)}
				<p>{line}</p>
			{/each}
		</div>
	{/if}
	<div class="lines">
		{#each c.lines as line, i (i)}
			<p style="--s: {i % 2 === 0 ? 1 : -1}">{line}</p>
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
		transition: transform 80ms ease;
	}
	.attrib {
		margin-top: 0.9rem;
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
	.remembered {
		margin: 0 auto 1rem;
		max-width: 32rem;
		padding-bottom: 0.6rem;
		border-bottom: 1px dashed var(--rule);
	}
	.remembered p {
		font-family: var(--font-hand);
		color: var(--print-pink);
		font-size: clamp(0.95rem, 1.8vw, 1.1rem);
		line-height: 1.5;
		margin: 0.15em 0;
		font-style: italic;
		opacity: 0.85;
	}
	.canonical.trembling .lines p {
		animation: tremor 160ms ease;
	}
	@keyframes tremor {
		0% {
			transform: translate(0, 0);
		}
		25% {
			transform: translate(calc(var(--s, 1) * 0.6px), -0.4px);
		}
		60% {
			transform: translate(calc(var(--s, 1) * -0.4px), 0.3px);
		}
		100% {
			transform: translate(0, 0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.canonical.trembling .lines p {
			animation: none;
		}
	}
</style>
