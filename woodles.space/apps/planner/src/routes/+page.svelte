<script lang="ts">
	import { store } from '$lib/store.svelte';
	import NowNext from '$lib/components/NowNext.svelte';
	import TodayBoard from '$lib/components/TodayBoard.svelte';
	import WeekView from '$lib/components/WeekView.svelte';
	import Binder from '$lib/components/Binder.svelte';
	import Dock from '$lib/components/Dock.svelte';

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

<div class="page-wrap">
	<main class="view-host">
		{#if store.currentView === 'now-next'}
			<NowNext />
		{:else if store.currentView === 'today'}
			<TodayBoard />
		{:else if store.currentView === 'week'}
			<WeekView />
		{:else if store.currentView === 'month'}
			<WeekView stub="month" />
		{:else if store.currentView === 'year'}
			<WeekView stub="year" />
		{/if}
	</main>

	<Binder />
	<Dock />
</div>

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
