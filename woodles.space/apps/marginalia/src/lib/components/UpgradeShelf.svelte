<script lang="ts">
	import { game } from '$lib/state/game.svelte';
	import { upgrades } from '$lib/content/upgrades';

	function reveal(id: string): boolean {
		const u = upgrades.find((x) => x.id === id);
		if (!u) return false;
		if (game.upgrades[id]) return true;
		// generator-gated upgrades only appear once the generator is owned
		if (u.requiresGenerator && (game.generators[u.requiresGenerator] ?? 0) < 1) return false;
		// reveal once they can afford within 50%
		const c = u.cost;
		if (c.commentaries && game.commentaries < c.commentaries * 0.5) return false;
		if (c.apparatus && game.apparatus < c.apparatus * 0.5) return false;
		if (c.recensions && game.recensions < c.recensions * 0.5) return false;
		return true;
	}

	function describeCost(u: { cost: { commentaries?: number; apparatus?: number; recensions?: number } }) {
		const parts: string[] = [];
		if (u.cost.commentaries) parts.push(`${u.cost.commentaries} commentaries`);
		if (u.cost.apparatus) parts.push(`${u.cost.apparatus} apparatus`);
		if (u.cost.recensions) parts.push(`${u.cost.recensions} recensions`);
		return parts.join(', ');
	}
</script>

<section class="upgrades">
	<h3>marginalia</h3>
	<ul>
		{#each upgrades as u (u.id)}
			{#if reveal(u.id)}
				{@const owned = !!game.upgrades[u.id]}
				{@const can = game.canBuyUpgrade(u)}
				<li class:owned>
					<button
						type="button"
						disabled={!can && !owned}
						onclick={() => game.buyUpgrade(u.id)}
						aria-pressed={owned}
					>
						<span class="row1">
							<span class="name">— {u.name} —</span>
							{#if owned}
								<span class="status">adopted</span>
							{:else}
								<span class="cost">{describeCost(u)}</span>
							{/if}
						</span>
						<span class="desc">{u.description}</span>
					</button>
				</li>
			{/if}
		{/each}
	</ul>
</section>

<style>
	.upgrades {
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
		padding: 0.5rem 0.7rem;
		border-radius: 4px;
		background: var(--panel-accent);
		border: 1px solid transparent;
		transition: background 120ms, border-color 120ms;
	}
	button:hover:not(:disabled) {
		border-color: var(--leafeon-pink);
	}
	li.owned button {
		background: transparent;
		border-color: var(--rule);
	}
	.row1 {
		display: flex;
		gap: 0.4rem;
		align-items: baseline;
	}
	.name {
		flex: 1;
		font-family: var(--font-display);
		color: var(--cream);
	}
	.status {
		color: var(--cyan);
		font-family: var(--font-ui);
		font-size: 0.78rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.cost {
		color: var(--leafeon-pink);
		font-family: var(--font-counter);
		font-size: 0.95rem;
	}
	.desc {
		display: block;
		margin-top: 0.15rem;
		font-style: italic;
		color: var(--muted);
		font-size: 0.86rem;
	}
</style>
