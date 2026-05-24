<script lang="ts">
	import type { Task } from '$lib/types';
	import { store } from '$lib/store.svelte';

	let { task, compact = false }: { task: Task; compact?: boolean } = $props();

	let confirmDrop = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout> | undefined;

	function toggleComplete() {
		if (task.status === 'done') {
			store.reopenTask(task.id);
		} else {
			store.completeTask(task.id);
		}
	}

	function startDrop() {
		confirmDrop = true;
		clearTimeout(confirmTimer);
		confirmTimer = setTimeout(() => { confirmDrop = false; }, 3000);
	}

	function cancelDrop() {
		confirmDrop = false;
		clearTimeout(confirmTimer);
	}

	function confirmDropTask() {
		store.dropTask(task.id);
		confirmDrop = false;
		clearTimeout(confirmTimer);
	}

	const domain = $derived(task.domainId ? store.getDomainById(task.domainId) : undefined);
</script>

<div class="task-item" class:done={task.status === 'done'} class:compact role="listitem">
	<button
		class="task-check"
		onclick={toggleComplete}
		aria-label={task.status === 'done' ? 'reopen task' : 'complete task'}
	>
		{#if task.status === 'done'}
			<span class="check-mark">✓</span>
		{:else}
			<span class="check-circle"></span>
		{/if}
	</button>

	<button class="task-title-btn" onclick={() => store.openTaskEdit(task.id)}>
		{task.title}
	</button>

	{#if domain && !compact}
		<span class="task-domain" style:color={domain.color} title={domain.name}>{domain.icon}</span>
	{/if}

	{#if !compact}
		{#if confirmDrop}
			<button class="task-drop-confirm" onclick={confirmDropTask} onblur={cancelDrop}>drop?</button>
		{:else}
			<button class="task-drop" onclick={startDrop} title="drop task" aria-label="drop task">×</button>
		{/if}
	{/if}
</div>

<style>
	.task-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.35rem 0;
		transition: opacity var(--pl-transition-fast);
	}

	.task-item.done {
		opacity: 0.45;
	}

	.task-item.done .task-title-btn {
		text-decoration: line-through;
	}

	.task-check {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform var(--pl-transition-spring);
	}

	.task-check:hover {
		transform: scale(1.15);
	}

	.check-circle {
		display: block;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1.5px solid var(--p-muted);
		transition: border-color var(--pl-transition-fast);
	}

	.task-check:hover .check-circle {
		border-color: var(--p-accent);
	}

	.check-mark {
		font-family: var(--pl-font-mono);
		font-size: 0.75rem;
		color: var(--p-accent);
		line-height: 1;
	}

	.task-title-btn {
		flex: 1;
		font-family: var(--pl-font-mono);
		font-size: 0.82rem;
		color: var(--p-text);
		letter-spacing: 0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: left;
		transition: color var(--pl-transition-fast);
	}

	.task-title-btn:hover {
		color: var(--p-accent);
	}

	.task-domain {
		font-size: 0.75rem;
		flex-shrink: 0;
		opacity: 0.8;
	}

	.task-drop {
		flex-shrink: 0;
		opacity: 0;
		font-size: 0.9rem;
		color: var(--p-muted);
		padding: 2px 6px;
		border-radius: var(--pl-radius-sm);
		transition: opacity var(--pl-transition-fast), color var(--pl-transition-fast), background var(--pl-transition-fast);
	}

	.task-item:hover .task-drop {
		opacity: 0.4;
	}

	.task-drop:hover {
		opacity: 1 !important;
		color: var(--p-accent);
		background: var(--p-accent-soft);
	}

	.task-drop-confirm {
		flex-shrink: 0;
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		font-style: italic;
		color: var(--p-accent);
		background: var(--p-accent-soft);
		border: 1px solid var(--p-accent);
		padding: 2px 8px;
		border-radius: var(--pl-radius-pill);
	}
</style>
