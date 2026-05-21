<script lang="ts">
	import { store } from '$lib/store.svelte';
	import {
		getCurrentBlock,
		getNextBlock,
		minutesRemaining,
		minutesUntilBlock
	} from '$lib/templates';
	import { minutesToDisplay, dayOfWeekLabel, shortDateLabel, dateKey, formatTime, timeToMinutes } from '$lib/utils';
	import { getDailyFlourish, shouldShowFlourish } from '$lib/voice';
	import TaskItem from './TaskItem.svelte';

	let dayType = $derived(store.getDayType(store.now));
	let currentBlock = $derived(getCurrentBlock(dayType, store.now));
	let nextBlock = $derived(getNextBlock(dayType, store.now));
	let remaining = $derived(currentBlock ? minutesRemaining(currentBlock, store.now) : null);
	let untilNext = $derived(nextBlock ? minutesUntilBlock(nextBlock, store.now) : null);
	let currentTasks = $derived(
		currentBlock ? store.getTasksForBlock(currentBlock.id, dateKey(store.now)) : []
	);

	let leadTime = $derived(
		untilNext !== null &&
			untilNext > 0 &&
			untilNext <= store.settings.leadTimeMinutes
	);

	let flourishText = $derived.by(() => {
		if (!store.settings.flourishEnabled) return null;
		if (!currentBlock?.flourishEligible) return null;
		if (!shouldShowFlourish(store.now, currentBlock.id)) return null;
		return getDailyFlourish(store.now, currentBlock.id);
	});

	// Progress through current block
	let progressPct = $derived.by(() => {
		if (!currentBlock || remaining === null) return 0;
		const start = timeToMinutes(currentBlock.startTime);
		const end = timeToMinutes(currentBlock.endTime);
		const total = end - start;
		if (total <= 0) return 100;
		return Math.min(100, Math.max(0, ((total - remaining) / total) * 100));
	});

	const dayTypeLabel = $derived(dayType === 'weekday-work' ? 'work day' : 'day off');

	let newTaskTitle = $state('');
	let inputEl: HTMLInputElement | undefined = $state();

	function submitTask(e: Event) {
		e.preventDefault();
		const title = newTaskTitle.trim();
		if (!title || !currentBlock) return;
		store.addTask({ title, targetBlockId: currentBlock.id });
		newTaskTitle = '';
	}

	function handleInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			newTaskTitle = '';
			inputEl?.blur();
		}
	}
</script>

<div class="now-next">
	<!-- Header bar -->
	<header class="nn-header">
		<a href="/" class="nn-home" title="back to woodles.space">·space</a>

		<div class="nn-header-center">
			<span class="nn-clock">{formatTime(store.now)}</span>
			<span class="nn-sep">·</span>
			<span class="nn-date">{dayOfWeekLabel(store.now)} {shortDateLabel(store.now)}</span>
		</div>

		<button
			class="nn-daytype"
			onclick={() => store.toggleDayType(store.now)}
			title="toggle day type"
		>
			{dayTypeLabel}
		</button>
	</header>

	<!-- Current block card -->
	<section class="nn-now-card" class:lead-time={leadTime}>
		<div class="nn-card-eyebrow">
			<span class="eyebrow-label">NOW</span>
			{#if currentBlock && remaining !== null}
				<span class="eyebrow-remaining">{minutesToDisplay(remaining)} remaining</span>
			{/if}
		</div>

		{#if currentBlock}
			<div class="nn-progress-bar" role="progressbar" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}>
				<div class="nn-progress-fill" style:width="{progressPct}%"></div>
			</div>

			<h1 class="nn-block-title">{currentBlock.title}</h1>
			<p class="nn-block-time">{currentBlock.startTime} — {currentBlock.endTime}</p>

			{#if currentTasks.length > 0}
				<div class="nn-tasks" role="list">
					{#each currentTasks as task (task.id)}
						<TaskItem {task} />
					{/each}
				</div>
			{/if}

			<form class="nn-add-task" onsubmit={submitTask}>
				<input
					bind:this={inputEl}
					bind:value={newTaskTitle}
					class="nn-add-input"
					placeholder="+ add task"
					autocomplete="off"
					spellcheck="false"
					onkeydown={handleInputKeydown}
				/>
			</form>
		{:else}
			<h1 class="nn-block-title nn-free">—</h1>
			<p class="nn-block-time">between schedule</p>
		{/if}
	</section>

	<!-- Next block card -->
	{#if nextBlock}
		<section class="nn-next-card" class:urgent={leadTime}>
			<div class="nn-card-eyebrow">
				<span class="eyebrow-label">NEXT</span>
			</div>
			<div class="nn-next-body">
				<h2 class="nn-next-title">{nextBlock.title}</h2>
				<div class="nn-next-meta">
					<span class="nn-next-time">{nextBlock.startTime}</span>
					{#if untilNext !== null && untilNext > 0}
						<span class="nn-next-until">in {minutesToDisplay(untilNext)}</span>
					{:else if untilNext === 0}
						<span class="nn-next-until nn-now">now</span>
					{/if}
				</div>
			</div>
		</section>
	{/if}

	{#if flourishText}
		<p class="nn-flourish">{flourishText}</p>
	{/if}
</div>

<style>
	.now-next {
		max-width: 660px;
		margin: 0 auto;
		padding: 0 clamp(1.25rem, 5vw, 2.5rem) var(--pl-space-xl);
	}

	.nn-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.1rem 0 1.75rem;
		gap: 1rem;
	}

	.nn-home {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.16em;
		color: var(--p-muted);
		text-decoration: none;
		opacity: 0.6;
		transition: opacity var(--pl-transition-fast);
	}

	.nn-home:hover {
		opacity: 1;
	}

	.nn-header-center {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.nn-clock {
		font-family: var(--pl-font-mono);
		font-size: 0.95rem;
		letter-spacing: 0.12em;
		color: var(--p-text);
	}

	.nn-sep {
		color: var(--p-muted);
		opacity: 0.5;
	}

	.nn-date {
		font-family: var(--pl-font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		color: var(--p-muted);
	}

	.nn-daytype {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.13em;
		text-transform: lowercase;
		color: var(--p-muted);
		border: 1px solid var(--p-border);
		padding: 4px 10px;
		border-radius: var(--pl-radius-pill);
		opacity: 0.7;
		transition: opacity var(--pl-transition-fast), border-color var(--pl-transition-fast), color var(--pl-transition-fast);
	}

	.nn-daytype:hover {
		opacity: 1;
		border-color: var(--p-accent);
		color: var(--p-accent);
	}

	.nn-now-card {
		background: var(--p-surface);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-lg);
		padding: clamp(1.5rem, 5vw, 2.25rem) clamp(1.5rem, 5vw, 2.5rem);
		margin-bottom: 1rem;
		transition: var(--pl-transition-palette), box-shadow var(--pl-transition-medium), border-color var(--pl-transition-medium);
		box-shadow: var(--pl-shadow-card);
	}

	.nn-now-card.lead-time {
		border-color: var(--p-accent);
		box-shadow: 0 0 0 1px var(--p-accent-soft), var(--pl-shadow-card);
	}

	.nn-card-eyebrow {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.9rem;
	}

	.eyebrow-label {
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--p-accent);
		opacity: 0.8;
	}

	.eyebrow-remaining {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		color: var(--p-muted);
	}

	.nn-progress-bar {
		height: 2px;
		background: var(--p-border);
		border-radius: 1px;
		margin-bottom: 1.25rem;
		overflow: hidden;
	}

	.nn-progress-fill {
		height: 100%;
		background: var(--p-accent);
		border-radius: 1px;
		transition: width 30s linear;
		opacity: 0.6;
	}

	.nn-block-title {
		font-family: var(--pl-font-display);
		font-size: var(--pl-title-now);
		font-weight: 400;
		line-height: 1.05;
		color: var(--p-text);
		margin-bottom: 0.4rem;
		letter-spacing: -0.01em;
	}

	.nn-block-title.nn-free {
		color: var(--p-muted);
		opacity: 0.4;
	}

	.nn-block-time {
		font-family: var(--pl-font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		color: var(--p-muted);
		margin-bottom: 1.5rem;
	}

	.nn-tasks {
		border-top: 1px solid var(--p-border);
		padding-top: 0.85rem;
		margin-bottom: 0.5rem;
		display: flex;
		flex-direction: column;
	}

	.nn-add-task {
		border-top: 1px solid var(--p-border);
		padding-top: 0.75rem;
		margin-top: 0.25rem;
	}

	.nn-add-input {
		width: 100%;
		font-family: var(--pl-font-mono);
		font-size: 0.8rem;
		color: var(--p-muted);
		letter-spacing: 0.03em;
		padding: 0.3rem 0;
		transition: color var(--pl-transition-fast);
	}

	.nn-add-input::placeholder {
		color: var(--p-muted);
		opacity: 0.45;
	}

	.nn-add-input:focus {
		color: var(--p-text);
	}

	.nn-next-card {
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-md);
		padding: 1rem 1.5rem;
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		transition: var(--pl-transition-palette), border-color var(--pl-transition-medium);
		opacity: 0.8;
	}

	.nn-next-card.urgent {
		border-color: var(--p-highlight);
		opacity: 1;
	}

	.nn-next-body {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.nn-next-title {
		font-family: var(--pl-font-display);
		font-size: var(--pl-title-next);
		font-weight: 400;
		color: var(--p-text);
		letter-spacing: -0.01em;
	}

	.nn-next-meta {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-shrink: 0;
	}

	.nn-next-time {
		font-family: var(--pl-font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		color: var(--p-muted);
	}

	.nn-next-until {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		color: var(--p-muted);
		opacity: 0.7;
	}

	.nn-next-until.nn-now {
		color: var(--p-accent);
		opacity: 1;
	}

	.nn-flourish {
		font-family: var(--pl-font-body);
		font-style: italic;
		font-size: 0.9rem;
		line-height: 1.6;
		color: var(--p-muted);
		text-align: center;
		padding: var(--pl-space-lg) var(--pl-space-xl);
		opacity: 0.75;
	}
</style>
