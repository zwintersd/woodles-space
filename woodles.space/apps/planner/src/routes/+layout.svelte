<script lang="ts">
	import '$lib/style/tokens.css';
	import { store } from '$lib/store.svelte';
	import { getPaletteForTime, getNamedPalette } from '$lib/dayCycle';
	import type { PaletteModeName } from '$lib/dayCycle';
	import { initSync } from '$lib/sync.svelte';
	import { importNotebookTasksOnce } from '$lib/notebookTasks';
	import { onMount } from 'svelte';

	let { children } = $props();
	let root: HTMLElement | undefined = $state();
	let taskNotice = $state('');

	onMount(() => {
		initSync();
		// Notebook's tasks move here — a task with a date belongs where time
		// lives. Runs once; see CONVERGENCE.md step 5.
		const moved = importNotebookTasksOnce(store);
		if (moved) {
			const total = moved.open + moved.done;
			taskNotice =
				`took over ${total} ${total === 1 ? 'task' : 'tasks'} from notebook` +
				(moved.done > 0 ? ` (${moved.done} already done)` : '');
		}
	});

	$effect(() => {
		if (!root) return;
		const palette = store.settings.fixedPaletteMode
			? getNamedPalette(store.settings.fixedPaletteMode as PaletteModeName)
			: getPaletteForTime(store.now);
		for (const [k, v] of Object.entries(palette)) {
			root.style.setProperty(k, v);
		}
	});
</script>

<div class="planner-root" bind:this={root}>
	{#if taskNotice}
		<p class="task-notice" aria-live="polite">
			{taskNotice}
			<button type="button" onclick={() => (taskNotice = '')} aria-label="dismiss">×</button>
		</p>
	{/if}
	{@render children()}
</div>

<style>
	/* tasks that moved here from notebook, announced once on arrival */
	.task-notice {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: var(--p-space-md, 1rem);
		padding: 0.45rem 0.9rem;
		border: 1px solid var(--p-line, rgba(0, 0, 0, 0.15));
		border-radius: 999px;
		background: var(--p-surface, rgba(255, 255, 255, 0.6));
		color: var(--p-ink, inherit);
		font-size: 0.78rem;
	}

	.task-notice button {
		margin-left: auto;
		border: none;
		background: none;
		color: inherit;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0.6;
	}

	.task-notice button:hover {
		opacity: 1;
	}

	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(html),
	:global(body) {
		height: 100%;
	}

	/* base type scale — % keeps it relative to the reader's browser font size,
	   so every rem in the app scales from here (and large-text prefs are honored) */
	:global(html) {
		font-size: 112.5%;
	}

	:global(body) {
		background: #e8fbff;
		overflow-x: hidden;
	}

	:global(button) {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	:global(button:disabled) {
		cursor: not-allowed;
		opacity: 0.4;
	}

	:global(input) {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		outline: none;
	}

	.planner-root {
		min-height: 100vh;
		background: var(--p-bg);
		color: var(--p-text);
		font-family: var(--pl-font-mono);
		font-weight: 400;
		font-size: 1rem;
		line-height: 1.55;
		transition: var(--pl-transition-palette);
		position: relative;
	}
</style>
