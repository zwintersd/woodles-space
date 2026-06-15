<script lang="ts">
	import { untrack } from 'svelte';
	import { StudioState } from '$lib/studio.svelte';
	import { renderComposition } from '$lib/render';
	import type { Composition } from '$lib/composer';
	import type { Creature } from '$lib/types';
	import StudioStage from './StudioStage.svelte';
	import LayerControls from './LayerControls.svelte';
	import AssetTray from './AssetTray.svelte';

	let {
		initial,
		creature,
		onsave,
		onclose
	}: {
		initial: Composition;
		creature: Creature;
		onsave: (comp: Composition, dataUrl: string) => void;
		onclose: () => void;
	} = $props();

	// The studio is remounted on each open, so a one-time load of the seed
	// composition is correct; untrack keeps it from reading as reactive.
	const studio = new StudioState();
	untrack(() => studio.load(initial));

	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let root: HTMLDivElement;

	$effect(() => {
		root?.focus();
	});

	// Keep the live outline bakes in step with the layers as their outlines
	// change; reading studio.layers here is what re-runs the effect.
	$effect(() => {
		void studio.layers;
		studio.syncBakes();
	});

	async function place() {
		saving = true;
		saveError = null;
		try {
			const comp = $state.snapshot(studio.comp) as Composition;
			const dataUrl = await renderComposition(comp);
			onsave(comp, dataUrl);
		} catch {
			saveError = 'could not render the art — try removing a layer';
			saving = false;
		}
	}

	function close() {
		if (studio.undoDepth > 0 && !confirm('Leave the studio? Unplaced changes are lost.')) return;
		onclose();
	}

	function onKeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
		const mod = e.metaKey || e.ctrlKey;

		if (e.key === 'Escape') {
			e.stopPropagation();
			close();
			return;
		}
		if (mod && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			if (e.shiftKey) studio.redo();
			else studio.undo();
			return;
		}
		if (typing) return;
		if ((e.key === 'Delete' || e.key === 'Backspace') && studio.selected) {
			e.preventDefault();
			studio.removeSelected();
			return;
		}
		const step = e.shiftKey ? 0.04 : 0.008;
		if (e.key === 'ArrowLeft') { e.preventDefault(); studio.nudge(-step, 0); }
		else if (e.key === 'ArrowRight') { e.preventDefault(); studio.nudge(step, 0); }
		else if (e.key === 'ArrowUp') { e.preventDefault(); studio.nudge(0, -step); }
		else if (e.key === 'ArrowDown') { e.preventDefault(); studio.nudge(0, step); }
	}

	const layerGlyph = (kind: string) => (kind === 'fill' ? '▦' : '▣');
</script>

<svelte:window onpointerup={() => studio.end()} onkeyup={() => studio.end()} />

<div
	class="studio"
	bind:this={root}
	tabindex="-1"
	role="dialog"
	aria-modal="true"
	aria-label="sprite studio"
	onkeydown={onKeydown}
>
	<header class="bar">
		<div class="bar-left">
			<button class="x" title="close studio" aria-label="close studio" onclick={close}>←</button>
			<div class="titles">
				<h2 class="title">sprite studio</h2>
				<p class="sub">layer a world — backdrop, trees, the creature, light</p>
			</div>
		</div>
		<div class="bar-right">
			<div class="history">
				<button class="ghost" disabled={studio.undoDepth === 0} onclick={() => studio.undo()} title="undo (⌘Z)">↶</button>
				<button class="ghost" disabled={studio.redoDepth === 0} onclick={() => studio.redo()} title="redo (⇧⌘Z)">↷</button>
			</div>
			<button class="ghost danger" disabled={studio.isEmpty} onclick={() => studio.clearAll()}>clear</button>
			<button class="primary" disabled={saving} onclick={place}>
				{saving ? 'placing…' : 'place into card'}
			</button>
		</div>
	</header>

	{#if saveError}<p class="save-error">{saveError}</p>{/if}

	<div class="work">
		<!-- left: the art kit -->
		<aside class="rail left">
			<AssetTray {studio} creatureSprite={creature.sprite} creaturePixelated={creature.pixelated} />
		</aside>

		<!-- center: the stage -->
		<section class="center">
			<div class="stage-wrap">
				<StudioStage {studio} />
			</div>
			<p class="stage-tip">
				drag to move · corner to resize · top knob to spin · scroll to scale · arrows to nudge
			</p>
		</section>

		<!-- right: layers + controls -->
		<aside class="rail right">
			<div class="panel">
				<h3 class="panel-h">layers <span class="count">{studio.layers.length}</span></h3>
				{#if studio.layers.length === 0}
					<p class="empty-note">nothing yet — start from a scene or a backdrop.</p>
				{:else}
					<ul class="layer-list">
						{#each studio.layersTopFirst as layer (layer.id)}
							<li class="lrow" class:active={layer.id === studio.selectedId}>
								<button
									class="eye"
									class:off={layer.hidden}
									title={layer.hidden ? 'show' : 'hide'}
									aria-label={layer.hidden ? 'show layer' : 'hide layer'}
									onclick={() => studio.toggleHidden(layer.id)}>{layer.hidden ? '○' : '◉'}</button
								>
								<button class="lname" onclick={() => studio.select(layer.id)}>
									<span class="lglyph">{layerGlyph(layer.kind)}</span>
									<span class="ltext">{layer.name}</span>
								</button>
								<div class="lacts">
									<button title="move up" aria-label="move layer up" onclick={() => { studio.select(layer.id); studio.move('up'); }}>↑</button>
									<button title="move down" aria-label="move layer down" onclick={() => { studio.select(layer.id); studio.move('down'); }}>↓</button>
									<button title="duplicate" aria-label="duplicate layer" onclick={() => { studio.select(layer.id); studio.duplicateSelected(); }}>⧉</button>
									<button class="del" title="delete" aria-label="delete layer" onclick={() => { studio.select(layer.id); studio.removeSelected(); }}>✕</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="panel grow">
				<h3 class="panel-h">shape</h3>
				<LayerControls {studio} />
			</div>
		</aside>
	</div>
</div>

<style>
	.studio {
		position: fixed;
		inset: 0;
		z-index: var(--b-z-overlay);
		background: var(--b-bg);
		display: flex;
		flex-direction: column;
		outline: none;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--b-space-md);
		padding: var(--b-space-sm) var(--b-space-md);
		border-bottom: 1px solid var(--b-border);
		background: var(--b-surface);
		flex-wrap: wrap;
	}
	.bar-left { display: flex; align-items: center; gap: var(--b-space-sm); }
	.x {
		width: 2rem;
		height: 2rem;
		display: grid;
		place-items: center;
		border-radius: var(--b-radius-sm);
		font-size: 1.1rem;
		color: var(--b-text-dim);
		transition: all var(--b-transition-fast);
	}
	.x:hover { background: var(--b-gold-soft); color: var(--b-gold); }
	.titles { display: flex; flex-direction: column; }
	.title {
		font-family: var(--b-font-codex);
		font-size: 1.15rem;
		color: var(--b-text);
		line-height: 1.1;
	}
	.sub { font-family: var(--b-font-body); font-style: italic; font-size: 0.74rem; color: var(--b-muted); }

	.bar-right { display: flex; align-items: center; gap: var(--b-space-sm); }
	.history { display: flex; gap: 0.2rem; }
	.ghost {
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.34rem 0.6rem;
		font-family: var(--b-font-mono);
		font-size: 0.8rem;
		color: var(--b-text-dim);
		transition: all var(--b-transition-fast);
	}
	.ghost:hover:not(:disabled) { border-color: var(--b-gold); color: var(--b-gold); }
	.ghost:disabled { opacity: 0.35; }
	.ghost.danger:hover:not(:disabled) { border-color: var(--b-mythic); color: var(--b-mythic); }
	.primary {
		background: var(--b-gold);
		color: var(--b-on-accent);
		border-radius: var(--b-radius-sm);
		padding: 0.4rem 0.9rem;
		font-family: var(--b-font-mono);
		font-size: 0.82rem;
		font-weight: 600;
		transition: opacity var(--b-transition-fast);
	}
	.primary:disabled { opacity: 0.5; }
	.save-error {
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		color: var(--b-mythic);
		padding: var(--b-space-xs) var(--b-space-md);
	}

	.work {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 230px minmax(0, 1fr) 270px;
		gap: var(--b-space-md);
		padding: var(--b-space-md);
	}
	.rail {
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: var(--b-space-md);
		overflow: hidden;
	}

	.center {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--b-space-sm);
		min-height: 0;
	}
	.stage-wrap {
		width: 100%;
		max-width: min(100%, 64vh);
		max-height: 100%;
	}
	.stage-tip {
		font-family: var(--b-font-mono);
		font-size: 0.66rem;
		color: var(--b-muted);
		text-align: center;
	}

	.panel {
		background: var(--b-surface);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-md);
		padding: var(--b-space-sm) var(--b-space-md) var(--b-space-md);
		display: flex;
		flex-direction: column;
		gap: var(--b-space-sm);
		min-height: 0;
	}
	.panel.grow { flex: 1; overflow-y: auto; }
	.panel-h {
		font-family: var(--b-font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--b-gold);
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
	}
	.count { color: var(--b-muted); }
	.empty-note { font-family: var(--b-font-body); font-style: italic; font-size: 0.78rem; color: var(--b-muted); }

	.layer-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		max-height: 30vh;
		overflow-y: auto;
	}
	.lrow {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.3rem;
		border-radius: var(--b-radius-sm);
		border: 1px solid transparent;
	}
	.lrow.active { border-color: var(--b-border-strong); background: var(--b-gold-soft); }
	.eye { color: var(--b-text-dim); font-size: 0.8rem; width: 1.1rem; flex-shrink: 0; }
	.eye.off { color: var(--b-muted); }
	.lname {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		text-align: left;
	}
	.lglyph { color: var(--b-gold); font-size: 0.74rem; flex-shrink: 0; }
	.ltext {
		font-family: var(--b-font-mono);
		font-size: 0.74rem;
		color: var(--b-text-dim);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lrow.active .ltext { color: var(--b-text); }
	.lacts { display: flex; gap: 0.05rem; flex-shrink: 0; }
	.lacts button {
		width: 1.3rem;
		height: 1.3rem;
		display: grid;
		place-items: center;
		font-size: 0.74rem;
		color: var(--b-muted);
		border-radius: 4px;
		transition: all var(--b-transition-fast);
	}
	.lacts button:hover { color: var(--b-gold); background: var(--b-gold-soft); }
	.lacts .del:hover { color: var(--b-mythic); }

	/* ── responsive: collapse the three rails into a scrollable column ── */
	@media (max-width: 900px) {
		.work {
			grid-template-columns: 1fr;
			overflow-y: auto;
		}
		.rail { overflow: visible; }
		.stage-wrap { max-width: min(100%, 52vh); }
		.layer-list { max-height: none; }
	}
</style>
