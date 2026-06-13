<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Collection from '$lib/components/Collection.svelte';
	import CardEditor from '$lib/components/CardEditor.svelte';

	function handleKeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea') return;
		if (e.key === 'Escape') {
			if (bestiary.showSyncPanel) { bestiary.showSyncPanel = false; return; }
			if (bestiary.currentView === 'editor') { bestiary.openCollection(); return; }
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="page-layout">
	<Sidebar />
	<main class="main-content">
		{#if bestiary.currentView === 'editor'}
			<CardEditor />
		{:else}
			<Collection />
		{/if}
	</main>
</div>

<style>
	.page-layout {
		display: flex;
		min-height: 100vh;
	}
	.main-content { flex: 1; min-width: 0; overflow-y: auto; }

	@media (max-width: 680px) {
		.page-layout { flex-direction: column; }
	}
</style>
