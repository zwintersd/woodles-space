<script lang="ts">
	import {
		imageAssetsByTray,
		overlayAssets,
		overlayGroups,
		fillAssets,
		layerFromAsset,
		scenePresets,
		type AssetTray,
		type ImageAsset
	} from '$lib/props';
	import { fillToCss, createImageLayer, coverScale } from '$lib/composer';
	import { layerSourceFromFile, RenderError } from '$lib/render';
	import type { StudioState } from '$lib/studio.svelte';

	let {
		studio,
		creatureSprite = null,
		creaturePixelated = false
	}: { studio: StudioState; creatureSprite?: string | null; creaturePixelated?: boolean } =
		$props();

	type Tab = 'scene' | 'backdrop' | AssetTray | 'upload';
	let tab = $state<Tab>('scene');

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'scene', label: 'scenes' },
		{ id: 'backdrop', label: 'backdrops' },
		{ id: 'nature', label: 'nature' },
		{ id: 'sky', label: 'sky' },
		{ id: 'overlay', label: 'fx' },
		{ id: 'upload', label: 'upload' }
	];

	let dragging = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement>();

	async function addFile(file: File | undefined | null) {
		if (!file) return;
		busy = true;
		error = null;
		try {
			const s = await layerSourceFromFile(file);
			studio.addLayer(
				createImageLayer({
					src: s.src,
					naturalW: s.naturalW,
					naturalH: s.naturalH,
					name: 'upload',
					smooth: !s.pixelated
				})
			);
		} catch (err) {
			error = err instanceof RenderError ? err.message : 'could not add that image';
		} finally {
			busy = false;
		}
	}

	function onInputChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		addFile(input.files?.[0]);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		addFile(e.dataTransfer?.files?.[0]);
	}

	async function addCreatureSprite() {
		if (!creatureSprite) return;
		busy = true;
		error = null;
		try {
			const { measureImage } = await import('$lib/render');
			const { naturalW, naturalH } = await measureImage(creatureSprite);
			studio.addLayer(
				createImageLayer({
					src: creatureSprite,
					naturalW,
					naturalH,
					name: 'creature',
					scale: coverScale(naturalW, naturalH),
					smooth: !creaturePixelated
				})
			);
		} catch {
			error = 'could not add the current sprite';
		} finally {
			busy = false;
		}
	}
</script>

{#snippet stamp(a: ImageAsset)}
	<button type="button" class="stamp" title={a.name} onclick={() => studio.addLayer(layerFromAsset(a))}>
		<img src={a.src} alt={a.name} draggable="false" />
		<span class="stamp-name">{a.name}</span>
	</button>
{/snippet}

<div class="tray">
	<div class="tabs" role="tablist">
		{#each tabs as t (t.id)}
			<button
				type="button"
				role="tab"
				class="tab"
				class:active={tab === t.id}
				aria-selected={tab === t.id}
				onclick={() => (tab = t.id)}>{t.label}</button
			>
		{/each}
	</div>

	<div class="tray-body">
		{#if tab === 'scene'}
			<p class="tray-hint">a whole little world in one tap — then take it apart.</p>
			<div class="scene-list">
				{#each scenePresets as s (s.id)}
					<button type="button" class="scene" onclick={() => studio.loadScene(s)}>
						<span class="scene-name">{s.name}</span>
						<span class="scene-note">{s.note}</span>
					</button>
				{/each}
			</div>
		{:else if tab === 'backdrop'}
			<p class="tray-hint">a full-bleed colour or sky, dropped behind everything.</p>
			<div class="grid swatches">
				{#each fillAssets as f (f.id)}
					<button
						type="button"
						class="swatch"
						title={f.name}
						style="background:{fillToCss(f.fill)}"
						onclick={() => studio.addBackdrop(f.fill, f.name)}
						aria-label="{f.name} backdrop"
					></button>
				{/each}
			</div>
		{:else if tab === 'upload'}
			<button
				type="button"
				class="drop"
				class:dragging
				onclick={() => fileInput?.click()}
				ondragover={(e) => {
					e.preventDefault();
					dragging = true;
				}}
				ondragleave={() => (dragging = false)}
				ondrop={onDrop}
			>
				{#if busy}
					<span class="drop-hint">reading…</span>
				{:else}
					<span class="drop-glyph">⬓</span>
					<span class="drop-hint">drop an image, or click</span>
					<span class="drop-sub">it lands as a new layer</span>
				{/if}
			</button>
			{#if creatureSprite}
				<button type="button" class="add-current" onclick={addCreatureSprite}>
					+ add the card's current sprite
				</button>
			{/if}
			{#if error}<p class="err">{error}</p>{/if}
			<input bind:this={fileInput} type="file" accept="image/*" onchange={onInputChange} hidden />
		{:else if tab === 'overlay'}
			<p class="tray-hint">light, weather, grain — stacked over the whole scene.</p>
			{#each overlayGroups as g (g.id)}
				{@const items = overlayAssets(g.id)}
				{#if items.length}
					<h4 class="grp">{g.label}</h4>
					<div class="grid">
						{#each items as a (a.id)}
							{@render stamp(a)}
						{/each}
					</div>
				{/if}
			{/each}
		{:else}
			<p class="tray-hint">tap to stamp it on; drag to place, the corner to size.</p>
			<div class="grid">
				{#each imageAssetsByTray(tab) as a (a.id)}
					{@render stamp(a)}
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.tray { display: flex; flex-direction: column; gap: var(--b-space-sm); min-height: 0; }
	.tabs { display: flex; flex-wrap: wrap; gap: 0.2rem; }
	.tab {
		padding: 0.28rem 0.5rem;
		font-family: var(--b-font-mono);
		font-size: 0.68rem;
		color: var(--b-text-dim);
		border-radius: var(--b-radius-pill);
		border: 1px solid transparent;
		transition: all var(--b-transition-fast);
	}
	.tab:hover { color: var(--b-gold); }
	.tab.active { color: var(--b-on-accent); background: var(--b-gold); }

	.tray-body { overflow-y: auto; min-height: 0; padding-right: 0.2rem; }
	.tray-hint {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.76rem;
		color: var(--b-muted);
		margin-bottom: var(--b-space-sm);
		line-height: 1.4;
	}

	.grp {
		font-family: var(--b-font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--b-text-dim);
		margin: var(--b-space-sm) 0 var(--b-space-xs);
	}
	.grp:first-child { margin-top: 0; }

	.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--b-space-xs); }
	.swatches { grid-template-columns: repeat(4, 1fr); }

	.stamp {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		padding: 0.35rem 0.2rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		background: var(--b-surface-2);
		transition: all var(--b-transition-fast);
	}
	.stamp:hover { border-color: var(--b-gold); transform: translateY(-1px); }
	.stamp img {
		width: 100%;
		height: 44px;
		object-fit: contain;
	}
	.stamp-name {
		font-family: var(--b-font-mono);
		font-size: 0.58rem;
		color: var(--b-text-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.swatch {
		aspect-ratio: 1;
		border-radius: var(--b-radius-sm);
		border: 1px solid var(--b-border-strong);
		transition: transform var(--b-transition-fast);
	}
	.swatch:hover { transform: scale(1.06); }

	.scene-list { display: flex; flex-direction: column; gap: var(--b-space-xs); }
	.scene {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		background: var(--b-surface-2);
		text-align: left;
		transition: all var(--b-transition-fast);
	}
	.scene:hover { border-color: var(--b-gold); transform: translateY(-1px); }
	.scene-name { font-family: var(--b-font-codex); font-size: 0.92rem; color: var(--b-text); }
	.scene-note { font-family: var(--b-font-body); font-style: italic; font-size: 0.72rem; color: var(--b-muted); }

	.drop {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		width: 100%;
		aspect-ratio: 3 / 2;
		border: 1px dashed var(--b-border-strong);
		border-radius: var(--b-radius-md);
		background: var(--b-surface-2);
		color: var(--b-muted);
		transition: all var(--b-transition-fast);
	}
	.drop:hover { border-color: var(--b-gold); }
	.drop.dragging { border-color: var(--b-gold-bright); background: var(--b-gold-soft); border-style: solid; }
	.drop-glyph { font-size: 1.5rem; color: var(--b-gold); opacity: 0.7; }
	.drop-hint { font-family: var(--b-font-mono); font-size: 0.74rem; }
	.drop-sub { font-family: var(--b-font-mono); font-size: 0.62rem; opacity: 0.7; }

	.add-current {
		margin-top: var(--b-space-sm);
		width: 100%;
		padding: 0.4rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-text-dim);
		transition: all var(--b-transition-fast);
	}
	.add-current:hover { border-color: var(--b-gold); color: var(--b-gold); }
	.err { font-family: var(--b-font-mono); font-size: 0.72rem; color: var(--b-mythic); margin-top: var(--b-space-xs); }
</style>
