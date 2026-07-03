<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Collection from '$lib/components/Collection.svelte';
	import CardEditor from '$lib/components/CardEditor.svelte';
	import CreatureCodex from '$lib/components/CreatureCodex.svelte';
	import Gallery from '$lib/components/Gallery.svelte';

	function handleKeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea') return;
		if (e.key === 'Escape') {
			if (bestiary.showComfort) { bestiary.showComfort = false; return; }
			if (bestiary.showSyncPanel) { bestiary.showSyncPanel = false; return; }
			if (bestiary.currentView === 'editor') { bestiary.openCollection(); return; }
			if (bestiary.currentView === 'codex') { bestiary.openCollection(); return; }
		}
		if (e.key === 'ArrowLeft' && bestiary.currentView === 'codex' && bestiary.activeCreatureId) {
			const { prev } = bestiary.codexNeighbours(bestiary.activeCreatureId);
			if (prev) bestiary.openCodex(prev);
		}
		if (e.key === 'ArrowRight' && bestiary.currentView === 'codex' && bestiary.activeCreatureId) {
			const { next } = bestiary.codexNeighbours(bestiary.activeCreatureId);
			if (next) bestiary.openCodex(next);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="page-layout">
	<Sidebar />
	<main class="main-content">
		{#if bestiary.currentView === 'editor'}
			<CardEditor />
		{:else if bestiary.currentView === 'codex'}
			<CreatureCodex />
		{:else if bestiary.currentView === 'gallery'}
			<Gallery />
		{:else}
			<Collection />
		{/if}
	</main>
</div>

<style>
	/* Fixed-height shell so the editor can run its own internal scroll
	   regions (the immersive workshop fills the viewport); the gallery still
	   scrolls naturally inside .main-content. */
	.page-layout {
		display: flex;
		height: 100vh;
	}
	.main-content { flex: 1; min-width: 0; overflow-y: auto; }

	/* The workshop manages its own scrolling — let it own the full height. */
	.main-content:has(:global(.workshop)) { overflow-y: hidden; }

	@media (max-width: 680px) {
		.page-layout { flex-direction: column; height: auto; min-height: 100vh; }
		.main-content:has(:global(.workshop)) { overflow-y: auto; }
	}
</style>
