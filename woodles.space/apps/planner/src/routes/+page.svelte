<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { dateKey } from '$lib/utils';
	import NowNext from '$lib/components/NowNext.svelte';
	import TodayBoard from '$lib/components/TodayBoard.svelte';
	import WeekView from '$lib/components/WeekView.svelte';
	import MonthView from '$lib/components/MonthView.svelte';
	import YearScroll from '$lib/components/YearScroll.svelte';
	import TaskEditDrawer from '$lib/components/TaskEditDrawer.svelte';
	import DayPanel from '$lib/components/DayPanel.svelte';
	import Binder from '$lib/components/Binder.svelte';
	import Dock from '$lib/components/Dock.svelte';
	import Onboarding from '$lib/components/onboarding/Onboarding.svelte';

	function handleKeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea') return;

		switch (e.key) {
			case '1':
				store.setView('now-next');
				break;
			case '2':
				store.setView('today');
				break;
			case '3':
				store.setView('week');
				break;
			case '4':
				store.setView('month');
				break;
			case '5':
				store.setView('year');
				break;
			case 'n':
			case 'N':
				if (!store.composing && store.editingTaskId == null) {
					store.startCompose({ targetDate: dateKey(store.now) });
					e.preventDefault();
				}
				break;
			case 'Escape':
				if (store.binderTab !== null) {
					store.closeBinder();
					e.preventDefault();
				}
				break;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if !store.settings.onboardingComplete}
	<Onboarding />
{:else}
	<div class="page-wrap">
		<main class="view-host">
			{#if store.currentView === 'now-next'}
				<NowNext />
			{:else if store.currentView === 'today'}
				<TodayBoard />
			{:else if store.currentView === 'week'}
				<WeekView />
			{:else if store.currentView === 'month'}
				<MonthView />
			{:else if store.currentView === 'year'}
				<YearScroll />
			{/if}
		</main>

		<button
			class="compose-fab"
			onclick={() => store.startCompose({ targetDate: dateKey(store.now) })}
			title="new task [n]"
			aria-label="new task"
		>
			<span class="compose-fab-plus" aria-hidden="true">+</span>
			<span class="compose-fab-label">task</span>
		</button>

		<DayPanel />
		<TaskEditDrawer />
		<Binder />
		<Dock />
	</div>
{/if}

<style>
	.page-wrap {
		position: relative;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.view-host {
		flex: 1;
		padding-bottom: 3.5rem;
	}

	/* Always-on "new task" affordance — reaches the guided composer from any view. */
	.compose-fab {
		position: fixed;
		left: 1rem;
		bottom: 1rem;
		z-index: var(--pl-z-dock);
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 8px 14px 8px 12px;
		background: var(--p-surface);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-pill);
		box-shadow: 0 2px 14px var(--p-accent-soft);
		opacity: 0.85;
		transition: opacity var(--pl-transition-fast), color var(--pl-transition-fast),
			border-color var(--pl-transition-fast), transform var(--pl-transition-spring);
	}

	.compose-fab:hover {
		opacity: 1;
		border-color: var(--p-accent);
		transform: translateY(-1px);
	}

	.compose-fab-plus {
		font-family: var(--pl-font-mono);
		font-size: 1rem;
		line-height: 1;
		color: var(--p-accent);
	}

	.compose-fab-label {
		font-family: var(--pl-font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: lowercase;
		color: var(--p-muted);
	}

	.compose-fab:hover .compose-fab-label {
		color: var(--p-accent);
	}

	/* On narrow screens collapse to a round icon so it clears the dock. */
	@media (max-width: 520px) {
		.compose-fab-label {
			display: none;
		}

		.compose-fab {
			padding: 10px 12px;
		}
	}
</style>
