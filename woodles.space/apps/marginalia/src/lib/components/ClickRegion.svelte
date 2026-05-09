<script lang="ts">
	import { game, fmt } from '$lib/state/game.svelte';

	function onclick() {
		game.click();
	}

	const cp = $derived(game.clickPower);
	const combo = $derived(game.ductusCombo);
</script>

<div class="region">
	<button type="button" {onclick} aria-label="annotate">
		<span class="bracket">[</span>
		<span class="word">annotate</span>
		<span class="bracket">]</span>
	</button>
	<p class="meta">
		each click writes <span class="num">{fmt(cp)}</span> gloss{cp === 1 ? '' : 'es'}{#if combo > 0 && game.hasUpgrade('ductus')}<span class="combo"> · ductus ×{combo}</span>{/if}.
	</p>
</div>

<style>
	.region {
		text-align: center;
		padding: 1rem 0 1.6rem;
	}
	button {
		font-family: var(--font-display);
		font-size: clamp(1.4rem, 3.2vw, 1.9rem);
		letter-spacing: 0.02em;
		color: var(--cream);
		padding: 0.4rem 0.6rem;
		transition: color 120ms ease, transform 120ms ease;
	}
	button:hover {
		color: var(--leafeon-pink);
	}
	button:active {
		transform: translateY(1px);
		color: var(--cyan);
	}
	.bracket {
		color: var(--periwinkle);
		margin: 0 0.35rem;
	}
	.word {
		text-decoration: underline;
		text-decoration-color: var(--rule);
		text-underline-offset: 0.32em;
		text-decoration-thickness: 1px;
	}
	.meta {
		font-family: var(--font-ui);
		font-size: 0.82rem;
		color: var(--muted);
		margin: 0.3rem 0 0;
	}
	.num {
		font-family: var(--font-counter);
		color: var(--cream);
		font-size: 1rem;
	}
	.combo {
		color: var(--cyan);
		font-family: var(--font-counter);
	}
</style>
