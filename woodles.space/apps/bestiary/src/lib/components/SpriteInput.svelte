<script lang="ts">
	import { processSprite, SpriteError } from '$lib/image';

	let {
		sprite,
		pixelated = false,
		onpick,
		onclear
	}: {
		sprite: string | null;
		pixelated?: boolean;
		onpick: (dataUrl: string, pixelated: boolean) => void;
		onclear: () => void;
	} = $props();

	let dragging = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let fileInput: HTMLInputElement;

	async function handleFile(file: File | undefined | null) {
		if (!file) return;
		busy = true;
		error = null;
		try {
			const result = await processSprite(file);
			onpick(result.dataUrl, result.pixelated);
		} catch (err) {
			error = err instanceof SpriteError ? err.message : 'could not load that sprite';
		} finally {
			busy = false;
		}
	}

	function onInputChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		handleFile(input.files?.[0]);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		handleFile(e.dataTransfer?.files?.[0]);
	}
</script>

<div class="sprite-input">
	<button
		type="button"
		class="drop"
		class:dragging
		class:has-art={!!sprite}
		onclick={() => fileInput.click()}
		ondragover={(e) => { e.preventDefault(); dragging = true; }}
		ondragleave={() => (dragging = false)}
		ondrop={onDrop}
		aria-label={sprite ? 'replace sprite' : 'upload sprite'}
	>
		{#if sprite}
			<img src={sprite} alt="sprite preview" class:pixelated draggable="false" />
			<span class="overlay">replace</span>
		{:else if busy}
			<span class="hint">reading sprite…</span>
		{:else}
			<span class="drop-glyph">⬓</span>
			<span class="hint">drop a sprite, or click to choose</span>
			<span class="sub">png · jpg · gif · webp · svg</span>
		{/if}
	</button>

	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		onchange={onInputChange}
		hidden
	/>

	{#if sprite}
		<button type="button" class="clear" onclick={onclear}>remove sprite</button>
	{/if}

	{#if error}
		<p class="err">{error}</p>
	{/if}
</div>

<style>
	.sprite-input {
		display: flex;
		flex-direction: column;
		gap: var(--b-space-sm);
	}

	.drop {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 3;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--b-space-xs);
		background: var(--b-surface-2);
		border: 1px dashed var(--b-border-strong);
		border-radius: var(--b-radius-md);
		color: var(--b-muted);
		overflow: hidden;
		transition: border-color var(--b-transition-fast), background var(--b-transition-fast);
	}
	.drop:hover { border-color: var(--b-gold); }
	.drop.dragging {
		border-color: var(--b-gold-bright);
		background: var(--b-gold-soft);
		border-style: solid;
	}
	.drop.has-art { border-style: solid; padding: 0; }

	.drop img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: var(--b-vellum);
	}
	.drop img.pixelated { image-rendering: pixelated; }

	.overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-family: var(--b-font-mono);
		font-size: 0.8rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--b-text);
		background: rgba(10, 11, 21, 0.55);
		opacity: 0;
		transition: opacity var(--b-transition-fast);
	}
	.drop.has-art:hover .overlay { opacity: 1; }

	.drop-glyph { font-size: 1.8rem; color: var(--b-gold); opacity: 0.7; }
	.hint { font-family: var(--b-font-mono); font-size: 0.78rem; }
	.sub { font-family: var(--b-font-mono); font-size: 0.66rem; color: var(--b-muted); opacity: 0.7; }

	.clear {
		align-self: flex-start;
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-muted);
		transition: color var(--b-transition-fast);
	}
	.clear:hover { color: var(--b-mythic); }

	.err { font-family: var(--b-font-mono); font-size: 0.74rem; color: var(--b-mythic); }
</style>
