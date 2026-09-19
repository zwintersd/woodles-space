<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { dateKey } from '$lib/utils';
	import type { Block } from '$lib/types';
	import BlockEditor from './BlockEditor.svelte';
	import RoutineRunner from './RoutineRunner.svelte';
	let { onopenpiles }: { onopenpiles?: () => void } = $props();
	let editing = $state(false),
		notice = $state(''),
		activeRoutine = $state('');
	let draft = $state<Block[]>([]);
	let today = $derived(dateKey(store.now));
	let pile = $derived(store.getDayShape());
	let fixed = $derived(store.getBlocksForDate());
	let flexible = $derived(pile?.blocks.filter((b) => b.flexible) ?? []);
	let tasks = $derived(store.getTasksForDay(today));
	let routine = $derived(store.routines.find((r) => r.id === activeRoutine && !r.deletedAt));
	function save() {
		if (
			draft.some(
				(b) =>
					!b.title.trim() ||
					(!b.flexible && (!b.startTime || !b.endTime || b.endTime <= b.startTime))
			)
		) {
			notice = 'Give each activity a name and an end time after its start.';
			return;
		}
		store.saveDayPlan(today, draft);
		queueSync();
		editing = false;
		notice = 'Today’s changes saved. The template is unchanged.';
	}
</script>

<section class="workbench" aria-label="Today's plan">
	<div class="wb-card wb-paper">
		<div class="wb-heading">
			<div>
				<p class="wb-kicker">Today’s plan</p>
				<h2>{pile?.name ?? 'No day pile selected'}</h2>
			</div>
			<div class="wb-actions">
				<button
					onclick={() => {
						draft = (pile?.blocks ?? []).map((b) => ({ ...b, flexible: b.flexible ?? false }));
						editing = true;
					}}>Change today</button
				><button onclick={onopenpiles}>Edit templates</button><button
					onclick={() => store.startCompose({ targetDate: today })}>+ Add task</button
				>
			</div>
		</div>
		{#if editing}
			<form
				onsubmit={(e) => {
					e.preventDefault();
					save();
				}}
			>
				<BlockEditor bind:blocks={draft} />
				<div class="wb-actions">
					<button class="primary">Save today only</button><button
						type="button"
						onclick={() => (editing = false)}>Cancel</button
					>
				</div>
				<p class="wb-note">Recurring commitments keep their existing times. Edit those in setup.</p>
			</form>
		{:else}
			{#each fixed as block}<div class="wb-row">
					<span>{block.startTime}–{block.endTime}</span><strong class="grow">{block.title}</strong
					>{#if block.overlay}<small
							>{block.overlay === 'standing' ? 'Thinking About' : 'Recurring'}</small
						>{/if}{#if block.routineId && store.routines.some((r) => r.id === block.routineId && !r.deletedAt)}<button
							onclick={() => (activeRoutine = block.routineId!)}>Use routine</button
						>{/if}
				</div>{/each}
			{#if flexible.length}<h3>Flexible activities</h3>
				{#each flexible as block}<div class="wb-row">
						<strong class="grow">{block.title}</strong
						>{#if block.routineId && store.routines.some((r) => r.id === block.routineId && !r.deletedAt)}<button
								onclick={() => (activeRoutine = block.routineId!)}>Use routine</button
							>{/if}
					</div>{/each}{/if}
			{#if !fixed.length && !flexible.length}<p>
					Add activities for today or choose a day pile.
				</p>{/if}
			{#if tasks.length}<h3>Tasks</h3>
				{#each tasks as task}<div class="wb-row">
						<button onclick={() => store.openTaskEdit(task.id)}>{task.title}</button><span
							>{task.status}</span
						>
					</div>{/each}{/if}
		{/if}
		<p class="wb-notice" role="status">{notice}</p>
	</div>
	{#if routine}<div class="wb-actions">
			<button onclick={() => (activeRoutine = '')}>Close routine</button>
		</div>
		{#key routine.id}<RoutineRunner {routine} />{/key}{/if}
	<details class="wb-card">
		<summary>Unscheduled tasks</summary>
		<div class="wb-actions">
			<button onclick={() => store.startCompose({ targetDate: '' })}>+ New task</button>
		</div>
		{#each store.tasks.filter((t) => t.status === 'open' && !t.targetDate) as task}<div
				class="wb-row"
			>
				<button onclick={() => store.openTaskEdit(task.id)}>{task.title}</button><span
					>Edit or schedule</span
				>
			</div>{:else}<p>No unscheduled tasks.</p>{/each}
	</details>
</section>
