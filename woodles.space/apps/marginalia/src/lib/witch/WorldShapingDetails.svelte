<script lang="ts">
	import { book, fmt } from './book.svelte';
	import {
		featureEffectLines,
		generateSpawnPoints,
		spawnTagsForShape,
		SEDIMENT_CELL_THRESHOLD
	} from './worldShape';

	const coveragePct = $derived(Math.floor(book.sedimentCoverage * 100));
	const tags = $derived(spawnTagsForShape(book.worldShape));
	const effects = $derived(featureEffectLines(book.worldShape));
	const spawnCount = $derived(generateSpawnPoints(book.worldShape).length);
</script>

<div class="details" aria-label="world shaping details">
	<div class="stat-grid">
		<div class="stat">
			<span>sediment</span>
			<strong>{coveragePct}%</strong>
		</div>
		<div class="stat">
			<span>cell threshold</span>
			<strong>{Math.floor(SEDIMENT_CELL_THRESHOLD * 100)}%</strong>
		</div>
		<div class="stat">
			<span>pour cost</span>
			<strong>{fmt(book.sedimentPourRate)}/s</strong>
		</div>
		<div class="stat">
			<span>spawn points</span>
			<strong>{spawnCount}</strong>
		</div>
	</div>

	<div class="detail-block">
		<span class="label">spawn tags</span>
		{#if tags.length > 0}
			<div class="chips">
				{#each tags as tag}
					<span>{tag}</span>
				{/each}
			</div>
		{:else}
			<p>water, current, and deep places only.</p>
		{/if}
	</div>

	<div class="detail-block">
		<span class="label">feature effects</span>
		{#if effects.length > 0}
			<ul>
				{#each effects as effect}
					<li>{effect}</li>
				{/each}
			</ul>
		{:else}
			<p>no feature cards have settled yet.</p>
		{/if}
	</div>
</div>

<style>
	.details {
		border: 1px solid rgba(154, 150, 201, 0.22);
		border-radius: 4px;
		background: rgba(26, 26, 62, 0.46);
		padding: 0.65rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.45rem;
	}
	.stat {
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.45rem;
		min-width: 0;
	}
	.stat span,
	.label {
		display: block;
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.stat strong {
		display: block;
		font-family: var(--font-counter);
		font-weight: 400;
		font-size: 1.2rem;
		color: var(--cyan);
		margin-top: 0.1rem;
	}
	.detail-block {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.chips span {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		color: var(--cream);
		border: 1px solid var(--rule);
		border-radius: 999px;
		padding: 0.18rem 0.42rem;
	}
	p,
	li {
		font-family: var(--font-body);
		font-size: 0.82rem;
		color: var(--muted);
		margin: 0;
	}
	ul {
		margin: 0;
		padding-left: 1rem;
	}
	@media (max-width: 720px) {
		.stat-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
