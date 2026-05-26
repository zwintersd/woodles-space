<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { dayOfWeekLabel, shortDateLabel } from '$lib/utils';
	import TaskItem from './TaskItem.svelte';

	const dateStr = $derived(store.activeDayKey);

	const date = $derived.by(() => {
		if (!dateStr) return null;
		const [y, m, d] = dateStr.split('-').map(Number);
		return new Date(y, m - 1, d);
	});

	const dayShape = $derived(date ? store.getDayShape(date) : null);
	const blocks = $derived(date ? store.getBlocksForDate(date) : []);
	const tasks = $derived(dateStr ? store.getTasksForDay(dateStr) : []);
	const dayShapeLabel = $derived(dayShape?.name ?? 'no shape');

	const blocksWithTasks = $derived(
		blocks
			.map((b) => ({ block: b, tasks: tasks.filter((t) => t.targetBlockId === b.id) }))
			.filter((bt) => bt.tasks.length > 0)
	);

	const unscheduled = $derived(tasks.filter((t) => !t.targetBlockId));

	let addTitle = $state('');
	let addBlockId = $state('');
	let addInput: HTMLInputElement | undefined = $state();

	function submitAdd(e: Event) {
		e.preventDefault();
		const title = addTitle.trim();
		if (!title || !dateStr) return;
		store.addTask({ title, targetDate: dateStr, targetBlockId: addBlockId || undefined });
		addTitle = '';
		addInput?.focus();
	}

	function close() {
		store.closeDayPanel();
		addTitle = '';
	}

	function cycleShape() {
		if (!date) return;
		store.cycleDayShape(date);
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && store.activeDayKey != null && store.editingTaskId == null) close();
	}}
/>

{#if store.activeDayKey != null && store.editingTaskId == null}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="dp-backdrop" onclick={close}></div>
{/if}

<div class="dp-sheet" class:open={store.activeDayKey != null}>
	{#if date}
		<div class="dp-handle"></div>

		<header class="dp-header">
			<div class="dp-header-left">
				<span class="dp-dow">{dayOfWeekLabel(date)}</span>
				<span class="dp-date">{shortDateLabel(date)}</span>
			</div>
			<div class="dp-header-right">
				<button class="dp-daytype" onclick={cycleShape}>{dayShapeLabel}</button>
				<button class="dp-close" onclick={close} aria-label="close">×</button>
			</div>
		</header>

		<div class="dp-body">
			{#if tasks.length === 0}
				<p class="dp-empty">nothing scheduled.</p>
			{:else}
				{#each blocksWithTasks as bt (bt.block.id)}
					<div class="dp-group">
						<span class="dp-group-label">{bt.block.startTime} · {bt.block.title}</span>
						<div role="list">
							{#each bt.tasks as task (task.id)}
								<TaskItem {task} />
							{/each}
						</div>
					</div>
				{/each}
				{#if unscheduled.length > 0}
					<div class="dp-group">
						<span class="dp-group-label">unscheduled</span>
						<div role="list">
							{#each unscheduled as task (task.id)}
								<TaskItem {task} />
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<form class="dp-add" onsubmit={submitAdd}>
			<input
				bind:this={addInput}
				bind:value={addTitle}
				class="dp-add-input"
				placeholder="add a task…"
				autocomplete="off"
				spellcheck="false"
			/>
			<select class="dp-add-block" bind:value={addBlockId}>
				<option value="">no block</option>
				{#each blocks as b (b.id)}
					<option value={b.id}>{b.startTime} {b.title}</option>
				{/each}
			</select>
			<button type="submit" class="dp-add-submit" disabled={!addTitle.trim()}>→</button>
		</form>
	{/if}
</div>

<style>
	.dp-backdrop {
		position: fixed;
		inset: 0;
		z-index: calc(var(--pl-z-panel) - 1);
		background: rgba(0, 0, 0, 0.12);
	}

	.dp-sheet {
		position: fixed;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%) translateY(100%);
		width: min(100vw, 500px);
		background: var(--p-surface);
		border-radius: 20px 20px 0 0;
		border: 1px solid var(--p-border);
		border-bottom: none;
		z-index: var(--pl-z-panel);
		transition: transform var(--pl-transition-medium);
		box-shadow: 0 -8px 32px var(--p-accent-soft);
		max-height: 70vh;
		display: flex;
		flex-direction: column;
	}

	.dp-sheet.open {
		transform: translateX(-50%) translateY(0);
	}

	.dp-handle {
		width: 32px;
		height: 3px;
		background: var(--p-border);
		border-radius: 100px;
		margin: 10px auto 0;
		flex-shrink: 0;
	}

	.dp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem 1.25rem 0.5rem;
		border-bottom: 1px solid var(--p-border);
		flex-shrink: 0;
	}

	.dp-header-left {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.dp-dow {
		font-family: var(--pl-font-display);
		font-size: 1.35rem;
		font-weight: 400;
		color: var(--p-text);
		letter-spacing: -0.01em;
	}

	.dp-date {
		font-family: var(--pl-font-mono);
		font-size: 0.62rem;
		color: var(--p-muted);
		letter-spacing: 0.06em;
	}

	.dp-header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dp-daytype {
		font-family: var(--pl-font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		color: var(--p-muted);
		border: 1px solid var(--p-border);
		padding: 3px 8px;
		border-radius: var(--pl-radius-pill);
		opacity: 0.7;
		transition: opacity var(--pl-transition-fast), color var(--pl-transition-fast),
			border-color var(--pl-transition-fast);
	}

	.dp-daytype:hover {
		opacity: 1;
		color: var(--p-accent);
		border-color: var(--p-accent);
	}

	.dp-close {
		font-family: var(--pl-font-mono);
		font-size: 1rem;
		color: var(--p-muted);
		opacity: 0.45;
		padding: 0 4px;
		line-height: 1;
		transition: opacity var(--pl-transition-fast);
	}

	.dp-close:hover {
		opacity: 1;
	}

	.dp-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.6rem 1.25rem 0.25rem;
	}

	.dp-empty {
		font-family: var(--pl-font-mono);
		font-size: 0.72rem;
		color: var(--p-muted);
		opacity: 0.45;
		padding: 0.5rem 0;
		letter-spacing: 0.04em;
	}

	.dp-group {
		margin-bottom: 0.65rem;
	}

	.dp-group-label {
		display: block;
		font-family: var(--pl-font-mono);
		font-size: 0.5rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.5;
		margin-bottom: 0.1rem;
	}

	.dp-add {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 1.25rem 1rem;
		border-top: 1px solid var(--p-border);
		flex-shrink: 0;
	}

	.dp-add-input {
		flex: 1;
		font-family: var(--pl-font-mono);
		font-size: 0.76rem;
		color: var(--p-text);
		padding: 4px 0;
		border-bottom: 1px solid var(--p-border);
		background: transparent;
		transition: border-color var(--pl-transition-fast);
		min-width: 0;
	}

	.dp-add-input:focus {
		border-color: var(--p-accent);
		outline: none;
	}

	.dp-add-input::placeholder {
		color: var(--p-muted);
		opacity: 0.4;
	}

	.dp-add-block {
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		color: var(--p-muted);
		background: transparent;
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-sm);
		padding: 3px 5px;
		max-width: 110px;
		flex-shrink: 0;
	}

	.dp-add-submit {
		font-family: var(--pl-font-mono);
		font-size: 0.85rem;
		color: var(--p-muted);
		opacity: 0.45;
		padding: 2px 4px;
		flex-shrink: 0;
		transition: opacity var(--pl-transition-fast), color var(--pl-transition-fast);
	}

	.dp-add-submit:not(:disabled):hover {
		opacity: 1;
		color: var(--p-accent);
	}

	.dp-add-submit:disabled {
		opacity: 0.2;
		cursor: default;
	}
</style>
