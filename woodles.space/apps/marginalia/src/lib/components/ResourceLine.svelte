<script lang="ts">
	import { game, fmt } from '$lib/state/game.svelte';

	const g = $derived(game.glosses);
	const c = $derived(game.commentaries);
	const a = $derived(game.apparatus);
	const r = $derived(game.recensions);
	const p = $derived(game.palimpsest);
	const rate = $derived(game.glossesPerSec);
	const cRate = $derived(game.commentaryRate);
	const aRate = $derived(game.apparatusRate);
</script>

<p class="line">
	you have written <span class="num">{fmt(g)}</span> gloss{g === 1 ? '' : 'es'}{#if rate > 0}, accumulating at <span class="num">{fmt(rate)}</span>/s{/if}{#if c > 0}, of which <span class="num">{fmt(c)}</span> have settled into commentaries{#if cRate > 0}{` (+${fmt(cRate)}/s)`}{/if}{/if}{#if a > 0}, supporting <span class="num">{fmt(a)}</span> in apparatus{#if aRate > 0}{` (+${aRate.toFixed(3)}/s)`}{/if}{/if}{#if r > 0}, sufficient for <span class="num">{fmt(r)}</span> recension{r === 1 ? '' : 's'}{/if}.
	{#if p > 1}
		<span class="palimpsest">the palimpsest underneath is <span class="num">{p}</span> layer{p === 1 ? '' : 's'} deep.</span>
	{/if}
</p>

<style>
	.line {
		font-family: var(--font-body);
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--text);
		max-width: 44rem;
		margin: 0 auto;
		padding: 0 1.4rem;
		text-align: center;
	}
	.num {
		font-family: var(--font-counter);
		color: var(--cream);
		font-size: 1.1em;
	}
	.palimpsest {
		display: block;
		margin-top: 0.3rem;
		color: var(--print-pink);
		font-family: var(--font-hand);
		font-size: 1.05rem;
	}
</style>
