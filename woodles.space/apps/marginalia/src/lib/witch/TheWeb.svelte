<script lang="ts">
	import { book } from './book.svelte';
	import { conditions } from './content/conditions';
	import { assumptions, assumptionGroupLabel, type AssumptionGroup } from './content/assumptions';

	let showAssumptions = $state(false);

	const groups: AssumptionGroup[] = ['temporal', 'spatial', 'biochemical', 'relational'];
</script>

<div class="web">
	<header class="mode-head">
		<h2>the web</h2>
		<p class="mode-sub">
			she does not create the creature. she writes the condition, and the world
			works out the rest.
		</p>
	</header>

	<p class="essence-line">
		essence remaining: <span class="num">{book.essence}</span>
		{#if book.essence > 0}
			<span class="muted">— enough to write a little more of the world into being.</span>
		{:else}
			<span class="muted">— spent. this world is as written as it will get, for now.</span>
		{/if}
	</p>

	<section class="tier" aria-label="the first choices">
		<h3 class="tier-label">tier i · the first choices</h3>
		<div class="nodes">
			{#each conditions as c (c.id)}
				{@const written = book.hasWritten(c.id)}
				<div class="node" class:written>
					<div class="node-body">
						<p class="phrase">{c.phrase}</p>
						<p class="enables">{c.enables}</p>
					</div>
					{#if written}
						<span class="written-mark">written</span>
					{:else}
						<button
							class="write"
							disabled={!book.canWrite(c.id)}
							onclick={() => book.writeCondition(c.id)}
						>
							write · {c.cost} essence
						</button>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<section class="tier" aria-label="what emerged">
		<h3 class="tier-label">tier ii · what emerged from combination</h3>
		{#if book.emergences.length === 0}
			<p class="empty">
				nothing yet. write conditions that belong together, and the web will
				find what they imply.
			</p>
		{:else}
			<ul class="emergences">
				{#each book.emergences as e (e.id)}
					<li>
						<span class="em-name">{e.name}</span>
						<span class="em-note">{e.note}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="tier dim" aria-label="the unspoken">
		<button class="reveal" onclick={() => (showAssumptions = !showAssumptions)}>
			tier 0 · the unspoken {showAssumptions ? '−' : '+'}
		</button>
		{#if showAssumptions}
			<p class="empty">
				she did not choose these. they are simply true. one day she may notice
				that <em>true</em> and <em>chosen</em> were never very far apart.
			</p>
			<div class="assumption-groups">
				{#each groups as g (g)}
					<div class="assumption-group">
						<h4>{assumptionGroupLabel[g]}</h4>
						<ul>
							{#each assumptions.filter((a) => a.group === g) as a (a.id)}
								<li>{a.text}</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.web {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
	}
	.mode-head h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.5rem;
		color: var(--periwinkle);
		margin: 0 0 0.15rem;
	}
	.mode-sub {
		font-family: var(--font-body);
		font-style: italic;
		color: var(--muted);
		margin: 0;
		max-width: 34rem;
	}
	.essence-line {
		font-family: var(--font-ui);
		font-size: 0.86rem;
		color: var(--text);
		margin: 0;
	}
	.muted {
		color: var(--muted);
		font-style: italic;
	}
	.num {
		font-family: var(--font-counter);
		color: var(--leafeon-pink);
		font-size: 1.1em;
	}
	.tier {
		border-top: 1px solid var(--rule);
		padding-top: 0.8rem;
	}
	.tier-label,
	.reveal {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0 0 0.7rem;
	}
	.reveal {
		display: block;
	}
	.reveal:hover {
		color: var(--cyan);
	}
	.nodes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.7rem;
	}
	.node {
		border: 1px solid var(--rule);
		border-radius: 4px;
		background: var(--panel);
		padding: 0.7rem 0.8rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.node.written {
		background: var(--panel-accent);
		border-color: rgba(240, 143, 184, 0.4);
	}
	.phrase {
		font-family: var(--font-display);
		font-size: 1.05rem;
		color: var(--cream);
		margin: 0 0 0.2rem;
	}
	.enables {
		font-family: var(--font-body);
		font-size: 0.84rem;
		color: var(--muted);
		margin: 0;
	}
	.write {
		font-family: var(--font-ui);
		font-size: 0.74rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--cream);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.35rem 0.5rem;
		align-self: flex-start;
	}
	.write:hover:not(:disabled) {
		border-color: var(--leafeon-pink);
		color: var(--leafeon-pink);
	}
	.written-mark {
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--leafeon-pink);
		align-self: flex-start;
	}
	.emergences {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.emergences li {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.em-name {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--cyan);
	}
	.em-note {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.empty {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.86rem;
		color: var(--muted);
		margin: 0 0 0.7rem;
		max-width: 34rem;
	}
	.tier.dim {
		opacity: 0.78;
	}
	.assumption-groups {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		gap: 0.8rem;
	}
	.assumption-group h4 {
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0 0 0.3rem;
	}
	.assumption-group ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.assumption-group li {
		font-family: var(--font-body);
		font-size: 0.8rem;
		color: var(--muted);
	}
</style>
