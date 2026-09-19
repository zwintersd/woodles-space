<script lang="ts">
	import type { Block } from '$lib/types';
	import { store } from '$lib/store.svelte';
	import { uid } from '$lib/utils';
	let { blocks = $bindable<Block[]>([]) } = $props();
	function move(index: number, offset: number) {
		const next = [...blocks];
		[next[index], next[index + offset]] = [next[index + offset], next[index]];
		blocks = next;
	}
</script>

<div class="wb-list">
	{#each blocks as block, index (block.id)}
		<div class="wb-card">
			<label
				>Activity {index + 1}<input
					aria-label={`Activity ${index + 1}`}
					required
					bind:value={block.title}
				/></label
			>
			<div class="wb-row">
				<label
					>Timing<select bind:value={block.flexible}
						><option value={false}>Fixed time</option><option value={true}>Flexible</option></select
					></label
				>
				{#if !block.flexible}
					<label class="time-field"
						>Start<input type="time" required bind:value={block.startTime} /></label
					>
					<label class="time-field"
						>End<input type="time" required bind:value={block.endTime} /></label
					>
				{/if}
				<label
					>Routine<select bind:value={block.routineId}
						><option value={undefined}>None</option
						>{#each store.routines.filter((r) => !r.archived && !r.deletedAt) as routine}<option
								value={routine.id}>{routine.name}</option
							>{/each}</select
					></label
				>
			</div>
			<div class="wb-actions">
				<button
					type="button"
					disabled={index === 0}
					onclick={() => move(index, -1)}
					aria-label={`Move ${block.title || 'activity'} up`}>↑ Move up</button
				>
				<button
					type="button"
					disabled={index === blocks.length - 1}
					onclick={() => move(index, 1)}
					aria-label={`Move ${block.title || 'activity'} down`}>↓ Move down</button
				>
				<button type="button" onclick={() => (blocks = blocks.filter((b) => b.id !== block.id))}
					>Remove activity</button
				>
			</div>
		</div>
	{/each}
</div>
<button
	type="button"
	onclick={() =>
		(blocks = [
			...blocks,
			{ id: uid(), title: '', startTime: '09:00', endTime: '10:00', flexible: true }
		])}>+ Add activity</button
>
<p class="wb-note">
	Fixed activities keep their times when reordered. Flexible activities follow your list order.
</p>
