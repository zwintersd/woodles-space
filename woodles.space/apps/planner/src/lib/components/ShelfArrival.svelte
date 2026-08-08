<script lang="ts">
	// What Carillon shows when you arrive from Thinking About holding an entry.
	//
	// The order is the point: what's already scheduled, then adding another
	// time as a deliberate choice. Landing straight in a composer would invite
	// a duplicate of something already on Thursday, and would answer a question
	// ("when am I doing this?") with a form.

	import { store } from '$lib/store.svelte';
	import { arrival, thinkingAboutEntryHref } from '$lib/arrival.svelte';
	import { thinkingAboutShelf } from '$lib/thinkingAboutShelf.svelte';
	import { minutesToDisplay } from '$lib/utils';

	const entryId = $derived(arrival.entryId);
	const entry = $derived(entryId ? thinkingAboutShelf.find(entryId) : null);
	const tasks = $derived(entryId ? store.getTasksForThinkingAboutEntry(entryId) : []);

	// The shelf may not have reached this device yet, or the entry may have been
	// archived over in Thinking About. Either way the reference is still good
	// enough to schedule against — we just can't show its title or colour, so
	// the tasks' own titles carry it. A cold reference is not an error.
	const title = $derived(entry?.title ?? tasks[0]?.title ?? 'that thing');
	const cold = $derived(entry === null);

	function addAnother(): void {
		if (!entryId) return;
		store.startCompose({
			title: entry?.title ?? tasks[0]?.title ?? '',
			thinkingAboutEntryId: entryId
		});
		arrival.close();
	}

	function openTask(id: string): void {
		store.openTaskEdit(id);
		arrival.close();
	}

	function when(task: (typeof tasks)[number]): string {
		if (!task.targetDate) return 'not scheduled yet';
		const block = task.targetBlockId
			? store.getAllBlocks().find((b) => b.id === task.targetBlockId)
			: null;
		const duration = task.estimatedDuration ? ` · ${minutesToDisplay(task.estimatedDuration)}` : '';
		return block ? `${task.targetDate} · ${block.title}${duration}` : `${task.targetDate}${duration}`;
	}
</script>

{#if arrival.active}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="arr-backdrop" onclick={() => arrival.close()}></div>

	<!-- A div rather than a section: a non-interactive landmark can't carry
	     role="dialog". Same reason TaskEditDrawer's sheet is a div. -->
	<div
		class="arr-sheet"
		role="dialog"
		aria-modal="true"
		aria-label="Time for {title}"
		data-testid="shelf-arrival"
	>
		<header class="arr-header">
			<div>
				<p class="arr-kicker">from Thinking About</p>
				<h2 class="arr-title">
					{#if entry}
						<span class="arr-dot" style:background={entry.color}></span>
					{/if}
					{title}
				</h2>
			</div>
			<button class="arr-close" onclick={() => arrival.close()}>done</button>
		</header>

		{#if tasks.length > 0}
			<p class="arr-lede">
				{tasks.length === 1 ? "It's already on the plan." : `Already on the plan ${tasks.length} times.`}
			</p>
			<ul class="arr-tasks">
				{#each tasks as task (task.id)}
					<li>
						<button type="button" class="arr-task" onclick={() => openTask(task.id)}>
							<span class="arr-task-title" class:done={task.status === 'done'}>{task.title}</span>
							<span class="arr-task-when">{when(task)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="arr-lede">Nothing scheduled for this yet.</p>
		{/if}

		<div class="arr-actions">
			<button class="arr-primary" onclick={addAnother}>
				{tasks.length > 0 ? 'add another time' : 'find it a time'}
			</button>
			{#if entryId}
				<a class="arr-back" href={thinkingAboutEntryHref(entryId)}>back to the board</a>
			{/if}
		</div>

		{#if cold}
			<p class="arr-cold">
				This one isn't on the shelf any more — archived, or not synced to this device yet. What's
				above still stands.
			</p>
		{/if}
	</div>
{/if}

<style>
	.arr-backdrop {
		position: fixed;
		inset: 0;
		background: var(--car-scrim, rgba(0, 0, 0, 0.35));
		z-index: 60;
	}

	.arr-sheet {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(30rem, calc(100vw - 2rem));
		max-height: min(32rem, calc(100vh - 2rem));
		overflow-y: auto;
		z-index: 61;
		background: var(--p-surface);
		border: 1px solid var(--p-border);
		border-radius: 0.6rem;
		padding: 1.1rem 1.2rem 1.2rem;
		box-shadow: 0 1.5rem 3rem rgba(0, 0, 0, 0.22);
	}

	.arr-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.arr-kicker {
		font-size: 0.7rem;
		text-transform: lowercase;
		letter-spacing: 0.04em;
		color: var(--p-muted);
	}

	.arr-title {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-family: var(--pl-font-display);
		font-size: 1.3rem;
		font-weight: 400;
		color: var(--p-text);
		margin-top: 0.15rem;
	}

	.arr-dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		flex: none;
	}

	.arr-close {
		font-size: 0.78rem;
		color: var(--p-muted);
		background: transparent;
		flex: none;
	}

	.arr-close:hover {
		color: var(--p-text);
	}

	.arr-lede {
		font-size: 0.85rem;
		color: var(--p-text);
		margin-bottom: 0.6rem;
	}

	.arr-tasks {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-bottom: 0.9rem;
	}

	.arr-task {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		text-align: left;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--p-border);
		border-radius: 0.4rem;
		background: transparent;
		transition: border-color var(--pl-transition-fast);
	}

	.arr-task:hover,
	.arr-task:focus-visible {
		border-color: var(--p-accent);
	}

	.arr-task-title {
		font-size: 0.88rem;
		color: var(--p-text);
	}

	.arr-task-title.done {
		text-decoration: line-through;
		color: var(--p-muted);
	}

	.arr-task-when {
		font-size: 0.74rem;
		color: var(--p-muted);
	}

	.arr-actions {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.arr-primary {
		font-size: 0.82rem;
		color: var(--p-text);
		padding: 0.4rem 0.8rem;
		border: 1px solid var(--p-accent);
		border-radius: 0.35rem;
		background: transparent;
	}

	.arr-primary:hover {
		background: var(--p-accent);
		color: var(--p-surface);
	}

	.arr-back {
		font-size: 0.78rem;
		color: var(--p-muted);
	}

	.arr-back:hover {
		color: var(--p-text);
	}

	.arr-cold {
		font-size: 0.74rem;
		color: var(--p-muted);
		margin-top: 0.8rem;
		padding-top: 0.7rem;
		border-top: 1px solid var(--p-border);
	}
</style>
