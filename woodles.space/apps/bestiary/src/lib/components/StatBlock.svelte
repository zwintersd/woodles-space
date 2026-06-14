<script lang="ts">
	import type { Creature } from '$lib/types';
	import { capacities, arc } from '$lib/content/stats';
	import StatRow from './StatRow.svelte';

	let { creature }: { creature: Creature } = $props();
</script>

<fieldset class="group stats">
	<legend>stats</legend>

	<div class="subgroup">
		<h4 class="sub-head">capacities</h4>
		<div class="rows">
			{#each capacities as core (core.id)}
				<StatRow creatureId={creature.id} {core} stats={creature.stats} />
			{/each}
		</div>
	</div>

	<hr class="arc-rule" />

	<div class="subgroup arc">
		<h4 class="sub-head">arc</h4>
		<div class="rows">
			{#each arc as core (core.id)}
				<StatRow creatureId={creature.id} {core} stats={creature.stats} />
			{/each}
		</div>
	</div>
</fieldset>

<style>
	.subgroup {
		display: flex;
		flex-direction: column;
		gap: var(--b-space-sm);
	}
	.sub-head {
		font-family: var(--b-font-mono);
		font-size: 0.64rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--b-text-dim);
		margin: 0;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--b-space-md);
	}

	.arc-rule {
		border: none;
		border-top: 1px solid var(--b-border);
		margin: var(--b-space-md) 0 var(--b-space-sm);
		width: 60%;
	}
	/* the arc reads as the "other panel": slightly inset, a touch quieter */
	.subgroup.arc {
		padding-left: var(--b-space-md);
	}
	.subgroup.arc .sub-head {
		color: var(--b-muted);
	}
</style>
