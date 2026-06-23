<script lang="ts">
	import {
		overlayAssets,
		overlayGroups,
		fillAssets,
		layerFromAsset,
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

	type Tab = 'backdrop' | 'overlay' | 'upload';
	let tab = $state<Tab>('backdrop');

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'backdrop', label: 'backdrops' },
		{ id: 'overlay', label: 'fx' },
		{ id: 'upload', label: 'upload' }
	];

	let dragging = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement>();

	type PendingUpload = { src: string; naturalW: number; naturalH: number; pixelated: boolean };
	let pendingUpload = $state<PendingUpload | null>(null);
	let pendingName = $state('Sprite');
	let nameInput = $state<HTMLInputElement>();

	async function addFile(file: File | undefined | null) {
		if (!file) return;
		busy = true;
		error = null;
		try {
			const s = await layerSourceFromFile(file);
			pendingUpload = { src: s.src, naturalW: s.naturalW, naturalH: s.naturalH, pixelated: s.pixelated };
			pendingName = 'Sprite';
		} catch (err) {
			error = err instanceof RenderError ? err.message : 'could not add that image';
		} finally {
			busy = false;
		}
	}

	function confirmAdd() {
		if (!pendingUpload) return;
		const name = pendingName.trim() || 'layer';
		const isCreature = name.toLowerCase() === 's' || name.toLowerCase() === 'sprite';
		studio.addLayer(
			createImageLayer({
				src: pendingUpload.src,
				naturalW: pendingUpload.naturalW,
				naturalH: pendingUpload.naturalH,
				name,
				smooth: !pendingUpload.pixelated,
				isCreature
			})
		);
		pendingUpload = null;
		pendingName = 'Sprite';
	}

	function cancelAdd() {
		pendingUpload = null;
		pendingName = 'Sprite';
		error = null;
	}

	$effect(() => {
		if (pendingUpload) nameInput?.focus();
	});

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
		{#if tab === 'backdrop'}
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
			{#if pendingUpload}
				<div class="name-step">
					<p class="name-label">name this layer</p>
					<input
						bind:this={nameInput}
						bind:value={pendingName}
						class="name-input"
						type="text"
						placeholder="Sprite"
						onkeydown={(e) => {
							if (e.key === 'Enter') { e.preventDefault(); confirmAdd(); }
							if (e.key === 'Escape') cancelAdd();
						}}
					/>
					<p class="sprite-rule">must have a layer named <strong>Sprite</strong> or <strong>S</strong> for the isolated creature render</p>
					<div class="name-actions">
						<button type="button" class="name-cancel" onclick={cancelAdd}>cancel</button>
						<button type="button" class="name-add" onclick={confirmAdd}>add layer</button>
					</div>
				</div>
			{:else}
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
			{/if}
		{:else}
			<p class="tray-hint">light, weather, colour & grain — stacked over the whole scene, and recolourable once placed.</p>
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
	.stamp:hover { border-color: var(--b-gold); transform: translateY(-1px); box-shadow: var(--b-shadow-card); }
	/* a light→dark tile behind each fx so white glows and dark vignettes
	   both have something to read against */
	.stamp img {
		width: 100%;
		height: 46px;
		object-fit: cover;
		border-radius: 5px;
		background:
			linear-gradient(135deg, #f3ecf6 0%, #c7b8d8 48%, #5d5168 100%);
		box-shadow: inset 0 0 0 1px rgba(90, 42, 72, 0.12);
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
	.swatch:hover { transform: scale(1.06); box-shadow: var(--b-shadow-card); }

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

	.name-step {
		display: flex;
		flex-direction: column;
		gap: var(--b-space-sm);
	}
	.name-label {
		font-family: var(--b-font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--b-gold);
	}
	.name-input {
		background: var(--b-surface-2);
		border: 1px solid var(--b-border-strong);
		border-radius: var(--b-radius-sm);
		padding: 0.45rem 0.6rem;
		color: var(--b-text);
		font-family: var(--b-font-mono);
		font-size: 0.86rem;
		width: 100%;
	}
	.name-input:focus { border-color: var(--b-gold); outline: none; }
	.sprite-rule {
		font-family: var(--b-font-body);
		font-size: 0.72rem;
		color: var(--b-muted);
		line-height: 1.4;
	}
	.sprite-rule strong { color: var(--b-text-dim); font-weight: 600; }
	.name-actions {
		display: flex;
		gap: var(--b-space-xs);
		justify-content: flex-end;
	}
	.name-cancel {
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.32rem 0.6rem;
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-muted);
		transition: all var(--b-transition-fast);
	}
	.name-cancel:hover { color: var(--b-text-dim); border-color: var(--b-border-strong); }
	.name-add {
		background: var(--b-gold);
		color: var(--b-on-accent);
		border-radius: var(--b-radius-sm);
		padding: 0.32rem 0.7rem;
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		font-weight: 600;
		transition: opacity var(--b-transition-fast);
	}
	.name-add:hover { opacity: 0.85; }
</style>
