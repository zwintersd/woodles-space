<script lang="ts">
	import type { Routine } from '$lib/types';
	let { routine }: { routine: Routine } = $props();
	let checked = $state<string[]>([]);
</script>

<div class="wb-card wb-paper">
	<p class="wb-kicker">Routine</p>
	<h2>{routine.name}</h2>
	{#if routine.cue}<p>{routine.cue}</p>{/if}
	{#each routine.steps as step}<label class="wb-check"
			><input type="checkbox" value={step.id} bind:group={checked} /><span>{step.label}</span
			></label
		>{/each}
	<button type="button" onclick={() => (checked = [])}>Reset checklist</button>
	<p class="wb-note">
		Checks are for this use only. They do not record independence or change which steps are shown.
	</p>
</div>
