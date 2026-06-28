<script lang="ts">
	import { store } from '$lib/store.svelte';
	import NowNext from '$lib/components/NowNext.svelte';
	import TodayBoard from '$lib/components/TodayBoard.svelte';
	import WeekView from '$lib/components/WeekView.svelte';
	import MonthView from '$lib/components/MonthView.svelte';
	import YearScroll from '$lib/components/YearScroll.svelte';
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

		<DayPanel />
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
</style>
