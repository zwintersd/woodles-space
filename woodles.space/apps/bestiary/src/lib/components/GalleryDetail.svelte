<script lang="ts">
	import type { PublicCreature } from '@woodles/sync';
	import PublishedCardPanel from './PublishedCardPanel.svelte';

	let { creature, onclose }: { creature: PublicCreature; onclose: () => void } = $props();

	let displayName = $derived(creature.name.trim() || 'Unnamed Creature');

	// A click-to-close backdrop div never holds keyboard focus, so a local
	// onkeydown on it would only fire if something had already focused it —
	// listening on the window instead means Escape closes this regardless of
	// what's focused, exactly like a real dialog.
	function handleKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="detail-overlay"
	role="button"
	tabindex="-1"
	onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
	onkeydown={handleKeydown}
>
	<div class="detail-card" role="dialog" aria-modal="true" aria-label="{displayName}, from the gallery">
		<button class="close-btn" onclick={onclose} aria-label="close">×</button>
		<PublishedCardPanel {creature} />
	</div>
</div>

<style>
	.detail-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--b-z-overlay, 40);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--b-space-lg);
		background: rgba(40, 20, 36, 0.6);
		backdrop-filter: blur(3px);
		overflow-y: auto;
	}

	.detail-card {
		position: relative;
		width: 100%;
		max-width: 46rem;
		max-height: calc(100vh - 2 * var(--b-space-lg));
		overflow-y: auto;
		background: var(--b-surface);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-lg);
		box-shadow: var(--b-shadow-hover);
		margin: auto;
		padding: var(--b-space-xl);
	}

	.close-btn {
		position: absolute;
		top: var(--b-space-md);
		right: var(--b-space-md);
		z-index: 2;
		font-size: 1.3rem;
		color: var(--b-muted);
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--b-surface);
		transition: color var(--b-transition-fast), background var(--b-transition-fast);
	}
	.close-btn:hover { color: var(--b-text); background: var(--b-surface-2, var(--b-bg)); }
</style>
