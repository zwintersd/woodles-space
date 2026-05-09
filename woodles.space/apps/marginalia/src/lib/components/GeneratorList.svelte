<script lang="ts">
	import { game, fmt } from '$lib/state/game.svelte';
	import { generators } from '$lib/content/generators';

	// reveal: each tier becomes visible once you can almost afford it
	// (cost <= 2× your current glosses or you already own it).
	function isRevealed(id: string): boolean {
		const g = generators.find((x) => x.id === id);
		if (!g) return false;
		if (game.owned(id) > 0) return true;
		return game.glosses * 2 >= g.baseCost;
	}
</script>

<section class="generators">
	<h3>readers</h3>
	<ul>
		{#each generators as g (g.id)}
			{#if isRevealed(g.id)}
				{@const owned = game.owned(g.id)}
				{@const cost = game.costFor(g.id)}
				{@const can = game.canBuyGenerator(g.id)}
				<li>
					<button
						type="button"
						disabled={!can}
						onclick={() => game.buyGenerator(g.id)}
						aria-label={`acquire ${g.name}`}
					>
						<span class="row1">
							<span class="name">{g.name}</span>
							<span class="own"
								>{owned > 0 ? `· ${owned}` : ''}</span
							>
							<span class="cost">{fmt(cost)} glosses</span>
						</span>
						<span class="flavor">{g.flavor}</span>
						<span class="rate">+{fmt(g.rate)} g/s each</span>
					</button>
				</li>
			{/if}
		{/each}
	</ul>
</section>

<style>
	.generators {
		padding: 0 1rem;
	}
	h3 {
		font-family: var(--font-ui);
		font-weight: 500;
		font-size: 0.78rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0 0 0.6rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--rule);
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	button {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.55rem 0.7rem;
		border-radius: 4px;
		background: var(--panel);
		border: 1px solid transparent;
		transition: background 120ms, border-color 120ms;
	}
	button:hover:not(:disabled) {
		background: var(--panel-accent);
		border-color: var(--rule);
	}
	.row1 {
		display: flex;
		gap: 0.4rem;
		align-items: baseline;
		font-family: var(--font-ui);
	}
	.name {
		flex: 1;
		font-weight: 500;
		color: var(--cream);
	}
	.own {
		color: var(--cyan);
		font-family: var(--font-counter);
		font-size: 1rem;
	}
	.cost {
		color: var(--leafeon-pink);
		font-family: var(--font-counter);
		font-size: 1rem;
	}
	.flavor {
		display: block;
		margin-top: 0.18rem;
		color: var(--muted);
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.86rem;
	}
	.rate {
		display: block;
		margin-top: 0.15rem;
		color: var(--periwinkle);
		font-family: var(--font-counter);
		font-size: 0.92rem;
	}
</style>
