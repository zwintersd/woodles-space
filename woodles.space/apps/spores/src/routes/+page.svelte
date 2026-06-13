<script lang="ts">
	import { onMount } from 'svelte';
	import { garden } from '$lib/garden.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import SpellbookList from '$lib/components/SpellbookList.svelte';
	import SpellbookView from '$lib/components/SpellbookView.svelte';
	import SporeView from '$lib/components/SporeView.svelte';
	import TagView from '$lib/components/TagView.svelte';
	import SpellWizard from '$lib/components/spell/SpellWizard.svelte';
	import Onboarding from '$lib/components/onboarding/Onboarding.svelte';
	import OnboardingDevPanel from '$lib/components/onboarding/OnboardingDevPanel.svelte';

	onMount(() => {
		// Dev backdoor: ?dev=1 reveals the onboarding dev panel.
		if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('dev') === '1') {
			garden.devMode = true;
		}
		// First-run: empty Garden + never onboarded → run the guided first cast.
		garden.maybeStartOnboarding();
	});

	function handleKeydown(e: KeyboardEvent) {
		// Dev chord works anywhere, even over inputs and the onboarding overlay.
		if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
			garden.devMode = !garden.devMode;
			e.preventDefault();
			return;
		}
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea') return;
		if (e.key === 'Escape') {
			if (garden.showOnboarding) return; // no skip — onboarding can't be dismissed
			if (garden.showSyncPanel) { garden.showSyncPanel = false; return; }
			if (garden.currentView === 'spell') { garden.closeSpellWizard(); return; }
			if (garden.showAddFlight) { garden.showAddFlight = false; garden.flightSearchQuery = ''; return; }
			if (garden.editingSporeId) { garden.editingSporeId = null; return; }
			if (garden.currentView === 'spore') { garden.closeSpore(); return; }
			if (garden.currentView === 'spellbook') { garden.openGarden(); return; }
			if (garden.currentView === 'tag') { garden.openGarden(); return; }
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
		{:else if garden.currentView === 'tag'}
			<TagView />
		{/if}
	</main>
</div>

{#if garden.showOnboarding}
	<Onboarding />
{/if}

{#if garden.devMode}
	<OnboardingDevPanel />
{/if}

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
