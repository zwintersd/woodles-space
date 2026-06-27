<script lang="ts">
	import { appIconComposition, type Composition } from '$lib/composer';
	import SpriteStudio from './SpriteStudio.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let studioInitial = $state<Composition>(appIconComposition());
	let lastDataUrl = $state<string | null>(null);
	let savedCount = $state(0);

	function handleSave(comp: Composition, dataUrl: string) {
		lastDataUrl = dataUrl;
		savedCount += 1;
		studioInitial = comp;

		const a = document.createElement('a');
		a.href = dataUrl;
		a.download = `woodles-icon-${Date.now()}.png`;
		a.click();
	}

	function handleClose() {
		onclose();
	}

	function designAnother() {
		lastDataUrl = null;
		studioInitial = appIconComposition();
	}
</script>

{#if lastDataUrl}
	<div class="aie-overlay" role="dialog" aria-modal="true" aria-label="app icon saved">
		<div class="aie-saved">
			<img class="aie-preview" src={lastDataUrl} alt="your launcher icon" />
			<p class="aie-title">icon saved</p>
			<p class="aie-sub">downloaded as a PNG · drop it anywhere that takes an image</p>
			<div class="aie-actions">
				<button class="aie-btn primary" onclick={designAnother}>✦ design another</button>
				<button class="aie-btn" onclick={handleClose}>done</button>
			</div>
		</div>
	</div>
{:else}
	<SpriteStudio
		initial={studioInitial}
		onsave={handleSave}
		onclose={handleClose}
	/>
{/if}

<style>
	.aie-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--b-z-overlay, 40);
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(40, 20, 36, 0.7);
		backdrop-filter: blur(4px);
	}

	.aie-saved {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--b-space-lg);
		background: var(--b-surface);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-lg);
		padding: var(--b-space-2xl);
		max-width: 340px;
		width: 90%;
		box-shadow: var(--b-shadow-hover);
	}

	.aie-preview {
		width: 120px;
		height: 120px;
		border-radius: 20px;
		object-fit: cover;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		image-rendering: pixelated;
	}

	.aie-title {
		font-family: var(--b-font-codex);
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--b-text);
	}

	.aie-sub {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.8rem;
		color: var(--b-muted);
		text-align: center;
		line-height: 1.5;
	}

	.aie-actions {
		display: flex;
		gap: var(--b-space-sm);
	}

	.aie-btn {
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-pill);
		padding: 0.4rem 1rem;
		color: var(--b-text-dim);
		transition: border-color var(--b-transition-fast), color var(--b-transition-fast), background var(--b-transition-fast);
	}
	.aie-btn:hover { border-color: var(--b-border-strong); color: var(--b-text); }
	.aie-btn.primary {
		border-color: var(--b-gold-soft);
		color: var(--b-gold);
	}
	.aie-btn.primary:hover { background: var(--b-gold); color: var(--b-on-accent); border-color: var(--b-gold); }
</style>
