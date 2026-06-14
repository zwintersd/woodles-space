<script lang="ts">
	import type { Creature } from '$lib/types';
	import { capacities, arc } from '$lib/content/stats';
	import { statProfile } from '$lib/collection';
	import StatRow from './StatRow.svelte';
	import StatChart from './StatChart.svelte';

	let { creature }: { creature: Creature } = $props();

	let profile = $derived(statProfile(creature.stats));
</script>

<fieldset class="group stats">
	<legend>stats</legend>

	<div class="portrait">
		<StatChart stats={creature.stats} />
		<p class="profile">{profile}</p>
	</div>

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
	/* the portrait: hexagon + its one-line reading, centred above the controls */
	.portrait {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--b-space-xs);
		padding-bottom: var(--b-space-sm);
	}
	.profile {
		margin: 0;
		max-width: 26rem;
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.82rem;
		line-height: 1.35;
		color: var(--b-text-dim);
		text-align: center;
	}

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
