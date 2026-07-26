<script lang="ts">
	// Brianna's control panel for the shared, public decorative-creature pool
	// (CREATURE_SPECS in worldShape.ts) — free, auto-placed, no vitals/insight
	// participation. Distinct from Bestiary bindings (per-user) and from Life
	// (the mechanical, vitals-driven roster) — this is pure company.
	import { book } from './book.svelte';
	import { CREATURE_SPECS } from './worldShape';

	function isPlaced(creatureId: string): boolean {
		return book.worldShape.placedCreatures.some((p) => p.creatureId === creatureId);
	}

	function actionLabel(creatureId: string): string {
		if (isPlaced(creatureId)) return 'settled';
		if (book.creaturePlacementReason(creatureId) === 'locked') return 'needs the shallows';
		return 'call it in';
	}
</script>

<section class="creature-panel">
	<div class="creature-head">
		<div>
			<span class="creature-kicker">the menagerie</span>
			<h3>borrowed things</h3>
		</div>
	</div>
	<p class="creature-sub">
		small lives from elsewhere — free, and asking nothing back. she can call one in just to
		have it there.
	</p>
	<div class="creature-list">
		{#each CREATURE_SPECS as creature (creature.id)}
			<article class="creature-row" class:placed={isPlaced(creature.id)}>
				<div>
					<h4>{creature.name}</h4>
					<p>{creature.blurb}</p>
				</div>
				<button
					disabled={!book.canPlaceCreature(creature.id)}
					onclick={() => book.placeCreature(creature.id)}
				>
					{actionLabel(creature.id)}
				</button>
			</article>
		{/each}
	</div>
</section>

<style>
	.creature-panel {
		border: 1px solid rgba(95, 122, 82, 0.24);
		border-radius: 4px;
		background:
			linear-gradient(180deg, rgba(95, 122, 82, 0.05), rgba(52, 40, 29, 0.24)),
			var(--panel);
		padding: 0.75rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.creature-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.creature-kicker {
		display: block;
		font-family: var(--font-ui);
		font-size: 0.64rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--cyan);
	}
	.creature-head h3 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.2rem;
		color: var(--cream);
		margin: 0.05rem 0 0;
	}
	.creature-sub {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.84rem;
		color: var(--muted);
		margin: 0;
	}
	.creature-list {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--rule);
	}
	.creature-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.55rem 0;
		border-bottom: 1px solid var(--rule);
	}
	.creature-row h4 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1rem;
		color: var(--cream);
		margin: 0;
	}
	.creature-row p {
		font-family: var(--font-body);
		font-size: 0.82rem;
		color: var(--muted);
		margin: 0.08rem 0;
	}
	.creature-row.placed {
		opacity: 0.75;
	}
	.creature-row.placed button {
		color: var(--periwinkle);
	}
	.creature-row button {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--cream);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.35rem 0.58rem;
		white-space: nowrap;
	}
	.creature-row button:hover:not(:disabled) {
		border-color: var(--cyan);
		color: var(--cyan);
	}
	@media (max-width: 680px) {
		.creature-row {
			align-items: stretch;
			grid-template-columns: 1fr;
			flex-direction: column;
		}
		.creature-row button {
			width: 100%;
		}
	}
</style>
