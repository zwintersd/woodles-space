<script lang="ts">
	import { isEmptyHtml, previewText } from './htmlTools';
	import {
		pocketLayerLabel,
		type BinderTab,
		type LayerId,
		type LayerStat,
		type MarginEntry,
		type PocketLayer,
		type PocketNote,
		type PocketsOrder
	} from './types';
	import { templates, findFont } from '@shared/library.js';

	let {
		open = $bindable(),
		activeLayer,
		layerStats,
		pockets,
		filter = $bindable(),
		order = $bindable(),
		marginEntries,
		onLayerGoto,
		onPocketGoto,
		onMarginGoto,
		onSelectTemplate
	}: {
		open: BinderTab | null;
		activeLayer: LayerId;
		layerStats: LayerStat[];
		pockets: PocketNote[];
		filter: 'all' | PocketLayer;
		order: PocketsOrder;
		marginEntries: MarginEntry[];
		onLayerGoto: (layer: LayerId) => void;
		onPocketGoto: (id: string, layer: PocketLayer) => void;
		onMarginGoto: (id: string, anchorId: string) => void;
		onSelectTemplate: (id: string) => void;
	} = $props();

	const TABS: BinderTab[] = ['layers', 'pockets', 'notes', 'templates'];

	const filteredPockets = $derived.by(() => {
		const arr = filter === 'all' ? pockets : pockets.filter((p) => p.layer === filter);
		return order === 'oldest'
			? [...arr].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
			: [...arr].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	});

	function toggle(tab: BinderTab) {
		open = open === tab ? null : tab;
	}

	function flipOrder() {
		order = order === 'oldest' ? 'newest' : 'oldest';
	}
</script>

<svelte:window on:keydown={(e) => { if (e.key === 'Escape' && open) open = null; }} />

<div class="binder-tabs" role="tablist" aria-label="binder">
	{#each TABS as tab (tab)}
		<button
			class="binder-tab"
			class:active={open === tab}
			role="tab"
			aria-selected={open === tab}
			onclick={() => toggle(tab)}
			title={tab}
		>
			<span class="binder-tab-label">{tab}</span>
		</button>
	{/each}
</div>

<aside
	class="binder-panel"
	class:open={open !== null}
	aria-hidden={open === null}
	role="region"
>
	{#if open === 'layers'}
		<header class="binder-header">
			<span class="binder-header-eyebrow">binder</span>
			<span class="binder-header-title">layers</span>
		</header>
		<div class="binder-body">
			{#each layerStats as stat (stat.id)}
				<button
					class="binder-row layer-row"
					class:active={activeLayer === stat.id}
					onclick={() => onLayerGoto(stat.id)}
					title="edit {stat.id}"
				>
					<span class="binder-row-head">
						<span class="binder-row-name">{stat.id}</span>
						<span class="binder-row-meta">
							{stat.words} word{stat.words === 1 ? '' : 's'}
						</span>
					</span>
					<span class="binder-row-preview" class:dim={stat.isEmpty}>
						{stat.isEmpty ? 'empty' : stat.preview}
					</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if open === 'pockets'}
		<header class="binder-header">
			<span class="binder-header-eyebrow">binder</span>
			<span class="binder-header-title">pockets · {pockets.length}</span>
		</header>
		<div class="binder-controls">
			<div class="binder-filter">
				{#each ['all', 'midground', 'background'] as f (f)}
					<button
						class="binder-filter-btn"
						class:active={filter === f}
						onclick={() => (filter = f as 'all' | PocketLayer)}
					>{f === 'all' ? 'all' : f === 'midground' ? 'mg' : 'bg'}</button>
				{/each}
			</div>
			<button class="binder-sort" onclick={flipOrder} title="flip ordering">
				{order === 'oldest' ? 'oldest ↓' : 'newest ↑'}
			</button>
		</div>
		<div class="binder-body">
			{#if filteredPockets.length === 0}
				<p class="binder-empty">nothing here.</p>
			{:else}
				{#each filteredPockets as note (note.id)}
					<button
						class="binder-row pocket-row pocket-row-{note.layer}"
						onclick={() => onPocketGoto(note.id, note.layer)}
						title="open in inside cover"
					>
						<span class="binder-row-head">
							<span class="binder-chip">{pocketLayerLabel(note.layer)}</span>
						</span>
						<span class="binder-row-preview" class:dim={isEmptyHtml(note.html)}>
							{isEmptyHtml(note.html) ? '(empty)' : previewText(note.html, 110)}
						</span>
					</button>
				{/each}
			{/if}
		</div>
	{/if}

	{#if open === 'notes'}
		<header class="binder-header">
			<span class="binder-header-eyebrow">binder</span>
			<span class="binder-header-title">margin notes · {marginEntries.length}</span>
		</header>
		<div class="binder-body">
			{#if marginEntries.length === 0}
				<p class="binder-empty">no margin notes yet.</p>
			{:else}
				{#each marginEntries as entry (entry.id)}
					<button
						class="binder-row margin-row"
						onclick={() => onMarginGoto(entry.id, entry.anchorId)}
						title="scroll to {entry.anchorId}"
					>
						<span class="binder-row-head">
							<span class="binder-chip binder-chip-anchor">{entry.anchorId}</span>
						</span>
						<span class="binder-row-passage">
							{entry.passage || '(passage missing)'}
						</span>
						<span class="binder-row-preview">{entry.preview}</span>
					</button>
				{/each}
			{/if}
		</div>
	{/if}

	{#if open === 'templates'}
		<header class="binder-header">
			<span class="binder-header-eyebrow">binder</span>
			<span class="binder-header-title">scaffolds · {templates.length}</span>
		</header>
		<div class="binder-body">
			{#each templates as t (t.id)}
				<button
					class="binder-row template-row"
					onclick={() => onSelectTemplate(t.id)}
					title="use template '{t.name}'"
				>
					<span class="binder-row-head">
						<span class="binder-row-name" style="font-family: {findFont(t.font).display}; font-style: italic;">{t.name}</span>
						<span class="binder-row-meta">{t.font} · {t.palette}</span>
					</span>
					<span class="binder-row-preview">
						{t.desc}
					</span>
				</button>
			{/each}
		</div>
	{/if}
</aside>

<style>
	.binder-tabs {
		position: fixed;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		gap: 4px;
		z-index: 30;
	}
	.binder-tab {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		padding: 12px 6px;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.55rem;
		letter-spacing: 0.18em;
		text-transform: lowercase;
		color: var(--muted);
		background: var(--surface);
		backdrop-filter: blur(18px);
		-webkit-backdrop-filter: blur(18px);
		border: 1px solid var(--rule);
		border-right: none;
		border-radius: 6px 0 0 6px;
		cursor: pointer;
		opacity: 0.75;
		transition: color 0.22s ease, background 0.22s ease, border-color 0.22s ease, opacity 0.22s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), padding-right 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.binder-tab:hover {
		opacity: 1;
		color: var(--accent-strong);
	}
	.binder-tab.active {
		color: var(--accent-strong);
		opacity: 1;
		background: color-mix(in srgb, var(--accent) 22%, var(--surface) 78%);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		padding-right: 10px;
	}
	.binder-tab-label { display: inline-block; }

	.binder-panel {
		position: fixed;
		top: 42px;
		bottom: 46px;
		right: 32px;
		width: min(360px, calc(100vw - 64px));
		background: var(--surface);
		backdrop-filter: blur(22px);
		-webkit-backdrop-filter: blur(22px);
		border-left: 1px solid var(--rule);
		z-index: 25;
		display: flex;
		flex-direction: column;
		transform: translateX(calc(100% + 32px));
		transition: transform 0.34s cubic-bezier(0.34, 1.36, 0.64, 1), box-shadow 0.34s ease;
		box-shadow: none;
	}
	.binder-panel.open {
		transform: translateX(0);
		box-shadow: -10px 0 36px color-mix(in srgb, var(--accent-deep) 16%, transparent);
	}

	.binder-header {
		padding: 1.1rem 1.2rem 0.75rem;
		border-bottom: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.binder-header-eyebrow {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--muted);
		opacity: 0.55;
	}
	.binder-header-title {
		font-family: var(--editor-display, var(--font-display));
		font-size: 1.25rem;
		font-weight: 300;
		font-style: italic;
		color: var(--accent-strong);
	}

	.binder-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.7rem 1.2rem 0.6rem;
		border-bottom: 1px solid var(--rule);
	}
	.binder-filter { display: inline-flex; gap: 2px; }
	.binder-filter-btn {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.52rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--muted);
		background: none;
		border: 1px solid transparent;
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.55;
		transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
	}
	.binder-filter-btn:hover { opacity: 0.95; color: var(--accent-strong); }
	.binder-filter-btn.active {
		color: var(--accent-strong);
		opacity: 1;
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.binder-sort {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.52rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--muted);
		background: none;
		border: 1px dashed transparent;
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.6;
		transition: color 0.18s ease, border-color 0.18s ease, opacity 0.18s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.binder-sort:hover {
		opacity: 0.95;
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 35%, transparent);
		transform: translateY(-1px);
	}

	.binder-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.7rem 1.2rem 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.binder-empty {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		color: var(--muted);
		opacity: 0.4;
		font-style: italic;
		padding: 1rem 0.4rem;
		text-align: center;
	}

	.binder-row {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--rule);
		border-radius: 6px;
		background: color-mix(in srgb, var(--surface) 30%, transparent);
		text-align: left;
		cursor: pointer;
		transition: border-color 0.2s ease, background 0.2s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
		font-family: var(--editor-mono, var(--font-mono));
	}
	.binder-row:hover {
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		background: color-mix(in srgb, var(--surface) 70%, transparent);
		transform: translateY(-1px);
	}
	.binder-row.active {
		border-color: color-mix(in srgb, var(--accent) 60%, transparent);
		background: color-mix(in srgb, var(--accent) 12%, var(--surface) 88%);
	}
	.binder-row-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.binder-row-name {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--accent-strong);
	}
	.binder-row.active .binder-row-name { color: var(--accent-deep); }
	.binder-row-meta {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		color: var(--muted);
		opacity: 0.6;
	}
	.binder-row-preview {
		font-family: var(--editor-body, var(--font-body));
		font-size: 0.78rem;
		line-height: 1.45;
		color: var(--muted);
		font-style: italic;
	}
	.binder-row-preview.dim { opacity: 0.4; }
	.binder-row-passage {
		font-family: var(--editor-body, var(--font-body));
		font-size: 0.74rem;
		line-height: 1.4;
		color: var(--text);
		opacity: 0.85;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.binder-chip {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem;
		letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--muted);
		background: color-mix(in srgb, var(--surface) 90%, transparent);
		padding: 1px 5px;
		border-radius: 6px;
		opacity: 0.7;
	}
	.binder-chip-anchor { color: var(--accent-deep); }

	.pocket-row-background { border-style: dashed; }
	.pocket-row-background .binder-row-preview { opacity: 0.7; }

	@media (max-width: 700px) {
		.binder-panel {
			right: 28px;
			width: calc(100vw - 56px);
		}
	}
</style>
