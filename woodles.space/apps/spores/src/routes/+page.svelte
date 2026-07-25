<script lang="ts">
	import { onMount } from 'svelte';
	import { garden } from '$lib/garden.svelte';
	import { importDevlogOnce } from '$lib/devlogImport';
	import { importTextbookOnce } from '$lib/textbookImport';
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
		// The retired Dev Log folds in on first open, once.
		const devlog = importDevlogOnce(garden);
		if (devlog) {
			garden.handoffNotice =
				`folded in the Dev Log — ${devlog.entries} ${devlog.entries === 1 ? 'entry' : 'entries'}` +
				` and ${devlog.records} ${devlog.records === 1 ? 'record' : 'records'}, in a new spellbook`;
		}
		// The Ologypedia Textbook folds in on first open, once.
		const textbook = importTextbookOnce(garden);
		if (textbook) {
			garden.handoffNotice =
				`folded in the Textbook — ${textbook.entries} ${textbook.entries === 1 ? 'entry' : 'entries'}` +
				(textbook.danglingLinks > 0
					? `, ${textbook.danglingLinks} link${textbook.danglingLinks === 1 ? '' : 's'} left to sow`
					: '');
		}
		// Anything sent here from another app is planted before onboarding is
		// considered, so a Garden that only looks empty doesn't trigger the
		// first-run flow over the top of what just arrived.
		const caught = garden.ingestHandoffs();
		if (caught.length > 0) {
			garden.handoffNotice =
				caught.length === 1
					? `caught "${caught[0].title}" from elsewhere`
					: `caught ${caught.length} things from elsewhere`;
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
		{#if garden.handoffNotice}
			<p class="handoff-notice" aria-live="polite">
				{garden.handoffNotice}
				<button type="button" onclick={() => (garden.handoffNotice = '')} aria-label="dismiss">×</button>
			</p>
		{/if}
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

	/* things sent here from another app, announced once on arrival */
	.handoff-notice {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
		margin: var(--g-space-md) var(--g-space-md) 0;
		padding: var(--g-space-sm) var(--g-space-md);
		border: 1px solid var(--g-border-strong);
		border-radius: 999px;
		background: var(--g-flight-soft);
		color: var(--g-text);
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
	}

	.handoff-notice button {
		margin-left: auto;
		border: none;
		background: none;
		color: var(--g-text-dim);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}

	.handoff-notice button:hover {
		color: var(--g-flight);
	}
</style>
