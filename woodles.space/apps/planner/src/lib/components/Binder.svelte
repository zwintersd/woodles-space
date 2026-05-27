<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { dayOfWeekLabel, shortDateLabel, dateKey } from '$lib/utils';
	import { EMPTY_STATES, BINDER_LABELS } from '$lib/onboarding.copy';
	import YearScroll from './YearScroll.svelte';

	type BinderTabId =
		| 'domains'
		| 'waiting'
		| 'upcoming'
		| 'year-scroll'
		| 'holidays'
		| 'shapes'
		| 'week-pattern';

	const TABS: { id: BinderTabId; icon: string; label: string }[] = [
		{ id: 'shapes',       icon: '◐', label: BINDER_LABELS.shapes },
		{ id: 'week-pattern', icon: '◇', label: BINDER_LABELS.weekPattern },
		{ id: 'domains',      icon: '◈', label: 'domains' },
		{ id: 'waiting',      icon: '⏳', label: 'waiting' },
		{ id: 'upcoming',     icon: '⇒', label: 'upcoming' },
		{ id: 'year-scroll',  icon: '∞', label: 'year' },
		{ id: 'holidays',     icon: '✦', label: 'holidays' }
	];

	const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
	const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

	let waitingTasks = $derived(
		store.tasks.filter((t) => t.status === 'open' && t.notes?.startsWith('waiting:'))
	);

	let upcomingDays = $derived.by(() => {
		const days = [];
		for (let i = 0; i < 7; i++) {
			const d = new Date(store.now);
			d.setDate(d.getDate() + i);
			const key = dateKey(d);
			const dayTasks = store.tasks.filter(
				(t) => t.status !== 'dropped' && t.targetDate === key
			);
			days.push({ date: d, key, restful: store.isRestful(d), tasks: dayTasks });
		}
		return days;
	});
</script>

{#if store.binderTab !== null}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="binder-backdrop" onclick={() => store.closeBinder()}></div>
{/if}

<div class="binder-tabs" role="tablist" aria-label="binder">
	{#each TABS as tab}
		<button
			class="binder-tab"
			class:active={store.binderTab === tab.id}
			role="tab"
			aria-selected={store.binderTab === tab.id}
			onclick={() => store.toggleBinder(tab.id)}
			title={tab.label}
			aria-label={tab.label}
		>
			<span class="binder-tab-icon">{tab.icon}</span>
		</button>
	{/each}
</div>

<aside
	class="binder-panel"
	class:open={store.binderTab !== null}
	aria-hidden={store.binderTab === null}
>
	{#if store.binderTab === 'domains'}
		<header class="binder-header">
			<span class="binder-eyebrow">binder</span>
			<span class="binder-title">domains</span>
		</header>
		<div class="binder-body">
			{#each store.domains as domain (domain.id)}
				<div class="domain-row">
					<span class="domain-icon" style:color={domain.color}>{domain.icon}</span>
					<span class="domain-name">{domain.name}</span>
					<span class="domain-count">
						{store.tasks.filter((t) => t.status !== 'dropped' && t.domainId === domain.id).length}
					</span>
				</div>
			{/each}
		</div>

	{:else if store.binderTab === 'waiting'}
		<header class="binder-header">
			<span class="binder-eyebrow">binder</span>
			<span class="binder-title">waiting tray</span>
		</header>
		<div class="binder-body">
			{#if waitingTasks.length === 0}
				<p class="binder-empty">nothing waiting.</p>
			{:else}
				{#each waitingTasks as task (task.id)}
					<div class="binder-task-row">
						<span class="binder-task-title">{task.title}</span>
						{#if task.notes}
							<span class="binder-task-note">{task.notes.replace('waiting:', '').trim()}</span>
						{/if}
					</div>
				{/each}
			{/if}
		</div>

	{:else if store.binderTab === 'upcoming'}
		<header class="binder-header">
			<span class="binder-eyebrow">binder</span>
			<span class="binder-title">next 7 days</span>
		</header>
		<div class="binder-body">
			{#each upcomingDays as day, i (day.key)}
				<div class="upcoming-day" class:today={i === 0}>
					<div class="upcoming-day-header">
						<span class="upcoming-day-name">{dayOfWeekLabel(day.date)}</span>
						<span class="upcoming-day-date">{shortDateLabel(day.date)}</span>
						{#if day.restful}
							<span class="upcoming-day-type">off</span>
						{/if}
					</div>
					{#if day.tasks.length > 0}
						<div class="upcoming-tasks">
							{#each day.tasks as task (task.id)}
								<span class="upcoming-task">{task.title}</span>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

	{:else if store.binderTab === 'year-scroll'}
		<div class="binder-year-scroll">
			<YearScroll compact />
		</div>

	{:else if store.binderTab === 'holidays'}
		<header class="binder-header">
			<span class="binder-eyebrow">binder</span>
			<span class="binder-title">holidays</span>
		</header>
		<div class="binder-body">
			<p class="binder-empty">holiday layer — coming soon.</p>
		</div>

	{:else if store.binderTab === 'shapes'}
		<header class="binder-header">
			<span class="binder-eyebrow">binder</span>
			<span class="binder-title">{BINDER_LABELS.shapes}</span>
		</header>
		<div class="binder-body">
			{#if store.dayShapes.length === 0}
				<div class="binder-empty-block">
					<p class="binder-empty-heading">{EMPTY_STATES.shapes.heading}</p>
					<p class="binder-empty-body">{EMPTY_STATES.shapes.body}</p>
				</div>
			{:else}
				{#each store.dayShapes as shape (shape.id)}
					<div class="shape-row">
						<span class="shape-row-name">{shape.name}</span>
						<span class="shape-row-meta">
							{shape.blocks.length} block{shape.blocks.length === 1 ? '' : 's'}
							{#if shape.restful}<span class="shape-restful">· restful</span>{/if}
						</span>
					</div>
				{/each}
			{/if}
		</div>

	{:else if store.binderTab === 'week-pattern'}
		<header class="binder-header">
			<span class="binder-eyebrow">binder</span>
			<span class="binder-title">{BINDER_LABELS.weekPattern}</span>
		</header>
		<div class="binder-body">
			{#if store.dayShapes.length === 0}
				<div class="binder-empty-block">
					<p class="binder-empty-heading">{EMPTY_STATES.weekPattern.heading}</p>
					<p class="binder-empty-body">{EMPTY_STATES.weekPattern.body}</p>
				</div>
			{:else}
				{#each WEEKDAY_ORDER as dow, i}
					{@const shapeId = store.weekPattern.days[dow]}
					{@const shape = store.dayShapes.find((s) => s.id === shapeId)}
					<div class="pattern-row">
						<span class="pattern-dow">{WEEKDAY_LABELS[i]}</span>
						<span class="pattern-shape">{shape?.name ?? '—'}</span>
						{#if shape?.restful}<span class="pattern-restful">restful</span>{/if}
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</aside>

<style>
	.binder-backdrop {
		position: fixed;
		inset: 0;
		z-index: calc(var(--pl-z-binder) - 1);
	}

	.binder-tabs {
		position: fixed;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		z-index: var(--pl-z-binder);
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--p-surface);
		border: 1px solid var(--p-border);
		border-right: none;
		border-radius: var(--pl-radius-md) 0 0 var(--pl-radius-md);
		padding: 6px 0;
		box-shadow: -2px 0 12px var(--p-accent-soft);
		transition: var(--pl-transition-palette);
	}

	.binder-tab {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--pl-radius-sm);
		margin: 0 4px;
		transition: background var(--pl-transition-fast), color var(--pl-transition-fast);
		opacity: 0.5;
	}

	.binder-tab:hover {
		opacity: 0.9;
		background: var(--p-accent-soft);
	}

	.binder-tab.active {
		opacity: 1;
		background: var(--p-accent-soft);
	}

	.binder-tab-icon {
		font-size: 0.85rem;
		color: var(--p-text);
	}

	.binder-panel {
		position: fixed;
		top: 0;
		right: 44px;
		bottom: 0;
		width: 300px;
		background: var(--p-surface);
		border-left: 1px solid var(--p-border);
		z-index: var(--pl-z-binder);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		transform: translateX(110%);
		transition: transform var(--pl-transition-medium), var(--pl-transition-palette);
		box-shadow: -4px 0 24px var(--p-accent-soft);
	}

	.binder-panel.open {
		transform: translateX(0);
	}

	.binder-header {
		padding: 1.25rem 1.25rem 0.75rem;
		border-bottom: 1px solid var(--p-border);
		flex-shrink: 0;
	}

	.binder-eyebrow {
		display: block;
		font-family: var(--pl-font-mono);
		font-size: 0.52rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.5;
		margin-bottom: 0.2rem;
	}

	.binder-title {
		font-family: var(--pl-font-display);
		font-size: 1.4rem;
		font-weight: 400;
		color: var(--p-text);
		letter-spacing: -0.01em;
	}

	.binder-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.binder-empty {
		font-family: var(--pl-font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		color: var(--p-muted);
		opacity: 0.5;
		padding: 1rem 0;
	}

	.domain-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--p-border);
	}

	.domain-icon {
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.domain-name {
		font-family: var(--pl-font-mono);
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		color: var(--p-text);
		flex: 1;
	}

	.domain-count {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		color: var(--p-muted);
		opacity: 0.6;
	}

	.binder-task-row {
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--p-border);
	}

	.binder-task-title {
		display: block;
		font-family: var(--pl-font-mono);
		font-size: 0.75rem;
		color: var(--p-text);
		margin-bottom: 0.2rem;
	}

	.binder-task-note {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		color: var(--p-muted);
		opacity: 0.6;
		font-style: italic;
	}

	.upcoming-day {
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--p-border);
	}

	.upcoming-day.today .upcoming-day-name {
		color: var(--p-accent);
	}

	.upcoming-day-header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.2rem;
	}

	.upcoming-day-name {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		color: var(--p-text);
	}

	.upcoming-day-date {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		color: var(--p-muted);
		opacity: 0.7;
	}

	.upcoming-day-type {
		font-family: var(--pl-font-mono);
		font-size: 0.55rem;
		color: var(--p-muted);
		opacity: 0.5;
		margin-left: auto;
		font-style: italic;
	}

	.upcoming-tasks {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.upcoming-task {
		font-family: var(--pl-font-mono);
		font-size: 0.68rem;
		color: var(--p-muted);
		padding-left: 0.6rem;
	}

	.upcoming-task::before {
		content: '· ';
	}

	.binder-year-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 0 0.75rem;
	}

	/* ── empty states ─────────────────────────────────────────────── */
	.binder-empty-block {
		padding: 1.2rem 0.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.binder-empty-heading {
		font-family: var(--pl-font-optical);
		font-style: italic;
		font-weight: 400;
		font-size: 1rem;
		color: var(--p-text);
		font-variation-settings: 'opsz' 36;
	}

	.binder-empty-body {
		font-family: var(--pl-font-body);
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--p-muted);
		font-style: italic;
		opacity: 0.85;
	}

	/* ── shape rows ───────────────────────────────────────────────── */
	.shape-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.55rem 0;
		border-bottom: 1px solid var(--p-border);
	}

	.shape-row-name {
		font-family: var(--pl-font-optical);
		font-style: italic;
		font-size: 0.95rem;
		color: var(--p-text);
		font-variation-settings: 'opsz' 36;
	}

	.shape-row-meta {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		color: var(--p-muted);
		opacity: 0.7;
	}

	.shape-restful {
		opacity: 0.6;
	}

	/* ── week-pattern rows ────────────────────────────────────────── */
	.pattern-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.7rem;
		align-items: baseline;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--p-border);
	}

	.pattern-dow {
		font-family: var(--pl-font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--p-muted);
	}

	.pattern-shape {
		font-family: var(--pl-font-body);
		font-size: 0.88rem;
		font-style: italic;
		color: var(--p-text);
	}

	.pattern-restful {
		font-family: var(--pl-font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.55;
	}
</style>
