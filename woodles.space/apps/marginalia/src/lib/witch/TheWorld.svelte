<script lang="ts">
	import { book, stageLabel, STAGE_KNOWN } from './book.svelte';
	import { domainVerb, type LifeCategory } from './content/life';

	const categories: { id: LifeCategory; label: string }[] = [
		{ id: 'aquatic', label: 'in the water' },
		{ id: 'terrestrial', label: 'on the land' },
		{ id: 'atmospheric', label: 'in the sky' }
	];

	const metric = (n: number) => Math.min(100, Math.round(n));
</script>

<div class="world">
	<header class="mode-head">
		<h2>the world</h2>
		<p class="mode-sub">
			she wrote one condition. the world answered with forty things. she cannot
			help a thing until she has truly seen it.
		</p>
	</header>

	<div class="ledger">
		<span>insight <span class="num">{book.insight}</span></span>
		<span>favor <span class="num">{metric(book.favor)}</span></span>
		<span class="metrics">
			nutrients {metric(book.nutrients)} · oxygen {metric(book.oxygen)} · stability
			{metric(book.stability)} · complexity {book.complexity}
		</span>
	</div>

	{#if book.life.length === 0}
		<p class="empty">
			the world is still rock and salt water and waiting. go back to the web and
			write a condition — life emerges from what you allow.
		</p>
	{:else}
		{#each categories as cat (cat.id)}
			{@const here = book.life.filter((l) => l.category === cat.id)}
			{#if here.length > 0}
				<section class="cat">
					<h3 class="cat-label">{cat.label}</h3>
					<div class="cards">
						{#each here as l (l.id)}
							{@const stage = book.stageOf(l.id)}
							{@const known = stage >= STAGE_KNOWN}
							<article class="card" class:unlooked={stage === 0}>
								<div class="card-head">
									<h4>{l.name}</h4>
									<span class="sci">{l.scientificName}</span>
								</div>
								<p class="stage-text">{book.stageTextFor(l)}</p>
								<div class="card-foot">
									<span class="stage-badge">{stageLabel[stage]}</span>
									{#if book.canObserve(l.id)}
										<button class="observe" onclick={() => book.observe(l.id)}>
											{stage === 0 ? 'observe' : 'keep watching'}
										</button>
									{:else}
										<span class="intervene" title="interventions arrive in a later pass">
											she could {domainVerb[l.domain]} it now — soon
										</span>
									{/if}
								</div>
							</article>
						{/each}
					</div>
				</section>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.world {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}
	.mode-head h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.5rem;
		color: var(--cyan);
		margin: 0 0 0.15rem;
	}
	.mode-sub {
		font-family: var(--font-body);
		font-style: italic;
		color: var(--muted);
		margin: 0;
		max-width: 34rem;
	}
	.ledger {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.1rem;
		font-family: var(--font-ui);
		font-size: 0.82rem;
		color: var(--text);
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: 0.5rem 0;
	}
	.metrics {
		color: var(--muted);
	}
	.num {
		font-family: var(--font-counter);
		color: var(--leafeon-pink);
		font-size: 1.15em;
	}
	.empty {
		font-family: var(--font-body);
		font-style: italic;
		color: var(--muted);
		max-width: 34rem;
		margin: 0;
	}
	.cat-label {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0 0 0.6rem;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 0.7rem;
	}
	.card {
		border: 1px solid var(--rule);
		border-radius: 4px;
		background: var(--panel);
		padding: 0.7rem 0.8rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.card.unlooked {
		opacity: 0.6;
	}
	.card-head {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
	}
	.card h4 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.05rem;
		color: var(--cream);
		margin: 0;
	}
	.sci {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.74rem;
		color: var(--periwinkle);
	}
	.stage-text {
		font-family: var(--font-body);
		font-size: 0.86rem;
		color: var(--muted);
		margin: 0;
		flex: 1;
	}
	.card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.stage-badge {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
	.observe {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--cream);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.3rem 0.5rem;
	}
	.observe:hover {
		border-color: var(--cyan);
		color: var(--cyan);
	}
	.intervene {
		font-family: var(--font-ui);
		font-style: italic;
		font-size: 0.72rem;
		color: var(--leafeon-pink);
		text-align: right;
	}
</style>
