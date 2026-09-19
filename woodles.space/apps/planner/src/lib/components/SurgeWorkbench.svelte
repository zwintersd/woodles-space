<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { dateKey } from '$lib/utils';
	import type { SurgeDraft } from '$lib/types';
	let title = $state(''),
		body = $state(''),
		notice = $state('');
	let editing = $state<SurgeDraft | null>(null);
	let taskLines = $state(''),
		targetDate = $state('');
	let archived = $state(false);
	let drafts = $derived(store.surgeDrafts.filter((d) => (d.status === 'discarded') === archived));
	function capture() {
		const d = store.addSurgeDraft(title, body);
		if (!d) return;
		title = '';
		body = '';
		queueSync();
		review(d);
		notice = 'Idea saved.';
	}
	function review(d: SurgeDraft) {
		editing = { ...d };
		taskLines = '';
		targetDate = '';
	}
	function save() {
		if (!editing) return;
		store.updateSurgeDraft(editing.id, editing);
		queueSync();
		notice = 'Idea saved.';
	}
	function extract() {
		if (!editing) return;
		save();
		const tasks = store.extractSurgeTasks(
			editing.id,
			taskLines.split(/\r?\n/),
			targetDate || undefined
		);
		if (!tasks.length) return;
		editing = { ...store.surgeDrafts.find((d) => d.id === editing?.id)! };
		taskLines = '';
		queueSync();
		notice =
			tasks.length +
			' task(s) created' +
			(targetDate ? ' for ' + targetDate : '. No date assigned.');
	}
</script>

<section class="workbench">
	<header class="wb-heading">
		<div>
			<p class="wb-kicker">Surge · ideas</p>
			<h1>Save an idea to review later.</h1>
			<p>Ideas stay off your schedule until you create a task or assign a date.</p>
		</div>
	</header>
	<div class="wb-grid">
		<aside>
			<form
				class="wb-card"
				onsubmit={(e) => {
					e.preventDefault();
					capture();
				}}
			>
				<h2>New idea</h2>
				<label>Title<input bind:value={title} /></label><label
					>Notes<textarea rows="5" bind:value={body}></textarea></label
				><button class="primary" disabled={!title.trim() && !body.trim()}>Save idea</button>
			</form>
			<div class="wb-actions">
				<button aria-pressed={!archived} onclick={() => (archived = false)}>Saved</button><button
					aria-pressed={archived}
					onclick={() => (archived = true)}>Archived</button
				>
			</div>
			<div class="wb-list">
				{#each drafts as draft}<button
						aria-pressed={editing?.id === draft.id}
						onclick={() => review(draft)}
						>{draft.title}<small
							>{draft.reviewDate
								? 'Review ' + draft.reviewDate
								: 'No review date'}{draft.reviewDate && draft.reviewDate <= dateKey(store.now)
								? ' · ready'
								: ''}</small
						></button
					>{:else}<p>No ideas here.</p>{/each}
			</div>
		</aside>
		<div>
			{#if editing}<form
					class="wb-card wb-paper"
					onsubmit={(e) => {
						e.preventDefault();
						save();
					}}
				>
					<p class="wb-kicker">Idea · {new Date(editing.createdAt).toLocaleDateString()}</p>
					<label>Idea title<input required bind:value={editing.title} /></label><label
						>Idea notes<textarea rows="7" bind:value={editing.body}></textarea></label
					><label>Review date (optional)<input type="date" bind:value={editing.reviewDate} /></label
					>
					<p class="wb-note">
						The review date is a reminder shown here; it does not lock the idea.
					</p>
					<div class="wb-actions">
						<button class="primary">Save changes</button><button
							type="button"
							onclick={() => {
								if (!editing) return;
								save();
								editing = null;
								notice = 'Kept for later.';
							}}>Keep for later</button
						><button
							type="button"
							onclick={() => {
								if (!editing) return;
								if (editing.status === 'discarded') store.restoreSurgeDraft(editing.id);
								else store.discardSurgeDraft(editing.id);
								editing = null;
								queueSync();
							}}>{editing.status === 'discarded' ? 'Restore' : 'Archive'}</button
						>
					</div>
				</form>
				{#if editing.status !== 'discarded'}<form
						class="wb-card"
						onsubmit={(e) => {
							e.preventDefault();
							extract();
						}}
					>
						<h2>Choose what to do</h2>
						<p>Create tasks from the parts you want to pursue. The original idea stays saved.</p>
						<label
							>One task per line<textarea
								rows="4"
								bind:value={taskLines}
								placeholder="Write an outline&#10;Gather references"></textarea></label
						><label>Schedule for (optional)<input type="date" bind:value={targetDate} /></label
						><button class="primary" disabled={!taskLines.trim()}
							>{targetDate ? 'Create scheduled tasks' : 'Create tasks without dates'}</button
						>
					</form>{/if}
				<div class="wb-card">
					<h2>Tasks from this idea</h2>
					{#each editing.promotedTaskIds ?? [] as id}{@const task = store.tasks.find(
							(t) => t.id === id
						)}{#if task}<div class="wb-row">
								<button onclick={() => store.openTaskEdit(task.id)}>{task.title}</button><span
									>{task.targetDate ?? 'Unscheduled'} · {task.status}</span
								>
							</div>{/if}{:else}<p>No tasks created yet.</p>{/each}
				</div>
			{:else}<div class="wb-card wb-paper">
					<h2>Review saved ideas</h2>
					<p>Select an idea to edit it, create tasks, set a review date, or archive it.</p>
				</div>{/if}
		</div>
	</div>
	<p class="wb-notice" role="status">{notice}</p>
</section>
