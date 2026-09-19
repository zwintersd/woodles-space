<script lang="ts">
	import { tick } from 'svelte';
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { dateKey, timeToMinutes } from '$lib/utils';
	import type { Block } from '$lib/types';
	import BlockEditor from './BlockEditor.svelte';
	import RoutineRunner from './RoutineRunner.svelte';
	let { onopenpiles }: { onopenpiles?: () => void } = $props();
	let editing = $state(false),
		notice = $state(''),
		activeRoutine = $state('');
	let draft = $state<Block[]>([]);
	let editor = $state<HTMLFormElement>();
	let remainingOnly = $state(false);
	let today = $derived(dateKey(store.now));
	let pile = $derived(store.getDayShape());
	let fixed = $derived(store.getBlocksForDate());
	let minutes = $derived(store.now.getHours() * 60 + store.now.getMinutes());
	let visibleBlocks = $derived(fixed.filter((block) => !remainingOnly || timeToMinutes(block.endTime) > minutes));
	let pastCount = $derived(fixed.filter((block) => timeToMinutes(block.endTime) <= minutes).length);
	function isCurrent(block: Block) {
		return timeToMinutes(block.startTime) <= minutes && minutes < timeToMinutes(block.endTime);
	}
	async function editActivity(id?: string) {
		if (editing) return;
		draft = (pile?.blocks ?? []).map((b) => ({ ...b, flexible: b.flexible ?? false }));
		notice = '';
		editing = true;
		await tick();
		const index = id ? draft.findIndex((block) => block.id === id) : 0;
		editor?.querySelector<HTMLInputElement>(`input[aria-label="Activity ${index + 1}"]`)?.focus();
	}
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
					disabled={editing}
					onclick={() => editActivity()}>Change today</button
				><button onclick={onopenpiles}>Edit templates</button><button
					onclick={() => store.startCompose({ targetDate: today })}>+ Add task</button
				>
			</div>
		</div>
		{#if editing}
			<form
				bind:this={editor}
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
			{#if fixed.length}
				<div class="plan-toolbar">
					<span>{fixed.length} timed activities</span>
					<button aria-pressed={remainingOnly} onclick={() => remainingOnly = !remainingOnly}>From now</button>
				</div>
			{/if}
			{#each visibleBlocks as block}<div class="wb-row plan-row" class:now={isCurrent(block)}>
					<span class="plan-time">{block.startTime}–{block.endTime}{#if isCurrent(block)}<small>Now</small>{/if}</span>
					{#if !block.overlay}
						<button class="activity-title grow" aria-label={`Edit activity: ${block.title}`} onclick={() => editActivity(block.id)}><span class="title-text">{block.title}</span><span aria-hidden="true"> ↗</span></button>
					{:else}<strong class="grow">{block.title}</strong>{/if}
					{#if block.overlay}<small
							>{block.overlay === 'standing' ? 'Thinking About' : 'Recurring'}</small
						>{/if}{#if block.routineId && store.routines.some((r) => r.id === block.routineId && !r.deletedAt)}<button
							onclick={() => (activeRoutine = block.routineId!)}>Use routine</button
						>{/if}
				</div>{/each}
			{#if remainingOnly && pastCount}<p class="wb-note">{pastCount} earlier activit{pastCount === 1 ? 'y' : 'ies'} hidden. Turn off “From now” to see the whole day.</p>{/if}
			{#if flexible.length}<h3>Flexible activities</h3>
				{#each flexible as block}<div class="wb-row">
						<button class="activity-title grow" aria-label={`Edit activity: ${block.title}`} onclick={() => editActivity(block.id)}><span class="title-text">{block.title}</span><span aria-hidden="true"> ↗</span></button
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

<style>
	.plan-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.4rem; font: 0.7rem var(--car-mono); }
	.plan-row { border-radius: 0.45rem; transition: background 200ms ease; }
	.plan-row.now { background: var(--car-pink-wash); box-shadow: inset 3px 0 var(--car-pink-dark); padding-left: 0.65rem; }
	.plan-time { display: grid; gap: 0.2rem; font: 0.7rem var(--car-mono); }
	.plan-time small { color: var(--car-pink-dark); font-weight: 600; }
	.workbench .activity-title { border: 0; background: transparent; padding: 0.3rem; text-align: left; font: 600 1rem var(--car-body); }
	.activity-title span[aria-hidden] { opacity: 0.45; font-size: 0.75rem; }
	.workbench .activity-title:hover { background: var(--car-pink-wash); }
	@media (prefers-reduced-motion: reduce) { .plan-row { transition: none; } }
</style>
