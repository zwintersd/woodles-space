<script lang="ts">
	import { garden } from '$lib/garden.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import SpellbookList from '$lib/components/SpellbookList.svelte';
	import SpellbookView from '$lib/components/SpellbookView.svelte';
	import SporeView from '$lib/components/SporeView.svelte';
	import SpellWizard from '$lib/components/spell/SpellWizard.svelte';

	function handleKeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea') return;
		if (e.key === 'Escape') {
			if (garden.showSyncPanel) { garden.showSyncPanel = false; return; }
			if (garden.currentView === 'spell') { garden.closeSpellWizard(); return; }
			if (garden.showAddFlight) { garden.showAddFlight = false; garden.flightSearchQuery = ''; return; }
			if (garden.editingSporeId) { garden.editingSporeId = null; return; }
			if (garden.currentView === 'spore') {
				if (garden.activeSpellbookId) garden.currentView = 'spellbook';
				else garden.openGarden();
				return;
			}
			if (garden.currentView === 'spellbook') { garden.openGarden(); return; }
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="page-layout">
	<Sidebar />

	<main class="main-content">
		{#if garden.currentView === 'spell'}
			<SpellWizard />
		{:else if garden.currentView === 'garden'}
			<SpellbookList />
		{:else if garden.currentView === 'spellbook'}
			<SpellbookView />
		{:else if garden.currentView === 'spore'}
			<SporeView />
		{/if}
	</main>
</div>

<style>
	.page-layout {
		display: flex;
		min-height: 100vh;
	}

	.main-content {
		flex: 1;
		overflow-y: auto;
	}
</style>
