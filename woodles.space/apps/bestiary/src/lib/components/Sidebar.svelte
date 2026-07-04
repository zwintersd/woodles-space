<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import { syncState } from '$lib/sync.svelte';
	import SyncPanel from './SyncPanel.svelte';
	import ComfortMenu from './ComfortMenu.svelte';
</script>

<nav class="sidebar">
	<div class="top">
		<button class="home" onclick={() => bestiary.openCollection()} title="the shelf">
			<span class="home-glyph">❦</span>
			<span class="home-label">bestiary</span>
		</button>

		<button
			class="gallery-link"
			class:active={bestiary.currentView === 'gallery'}
			onclick={() => bestiary.openGallery()}
			title="the public gallery"
		>
			<span class="gallery-glyph">◈</span> gallery
		</button>

		<button class="new" onclick={() => bestiary.newCreature()}>＋ new creature</button>

		{#if bestiary.ready}
			<p class="tally">
				<span class="tally-num">{bestiary.total}</span>
				<span class="tally-word">{bestiary.total === 1 ? 'creature' : 'creatures'}</span>
			</p>
		{/if}
	</div>

	<div class="bottom">
		<a class="margin-link" href="/marginalia" title="where creatures are discovered">
			↩ marginalia
		</a>
		<a class="echoes-link" href="/letter" title="letters, published the same way">
			↩ echoes
		</a>
		<button
			class="comfort-btn"
			onclick={() => (bestiary.showComfort = !bestiary.showComfort)}
			title="comfort & quiet — calm, motion & hints"
		>
			<span class="comfort-glyph">☾</span>
			comfort
		</button>
		<button
			class="sync-btn"
			class:connected={syncState.connected}
			onclick={() => (bestiary.showSyncPanel = !bestiary.showSyncPanel)}
			title="sync"
		>
			<span class="sync-dot" class:on={syncState.connected}></span>
			sync
		</button>
	</div>
</nav>

{#if bestiary.showComfort}
	<div
		class="drawer-overlay comfort-anchor"
		role="button"
		tabindex="-1"
		onclick={(e) => { if (e.target === e.currentTarget) bestiary.showComfort = false; }}
		onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); bestiary.showComfort = false; } }}
	>
		<div class="drawer">
			<button class="close-btn" onclick={() => (bestiary.showComfort = false)} aria-label="close">×</button>
			<ComfortMenu />
		</div>
	</div>
{/if}

{#if bestiary.showSyncPanel}
	<div
		class="drawer-overlay sync-anchor"
		role="button"
		tabindex="-1"
		onclick={(e) => { if (e.target === e.currentTarget) bestiary.showSyncPanel = false; }}
		onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); bestiary.showSyncPanel = false; } }}
	>
		<div class="drawer">
			<button class="close-btn" onclick={() => (bestiary.showSyncPanel = false)} aria-label="close">×</button>
			<SyncPanel />
		</div>
	</div>
{/if}

<style>
	.sidebar {
		width: 200px;
		min-height: 100vh;
		background: var(--b-surface);
		border-right: 1px solid var(--b-border);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: var(--b-space-lg) 0;
		flex-shrink: 0;
	}
	.top { display: flex; flex-direction: column; gap: var(--b-space-md); }

	.home {
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
		padding: var(--b-space-sm) var(--b-space-lg);
		width: 100%;
		text-align: left;
		color: var(--b-gold);
		transition: background var(--b-transition-fast);
	}
	.home:hover { background: var(--b-gold-soft); }
	.home-glyph { font-size: 1.1rem; }
	.home-label {
		font-family: var(--b-font-codex);
		font-size: 1.15rem;
		letter-spacing: 0.03em;
	}

	.gallery-link {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0 var(--b-space-lg);
		font-family: var(--b-font-mono);
		font-size: 0.78rem;
		color: var(--b-text-dim);
		transition: color var(--b-transition-fast);
	}
	.gallery-link:hover { color: var(--b-gold); }
	.gallery-link.active { color: var(--b-gold); }
	.gallery-glyph { font-size: 0.85rem; color: var(--b-gold); }

	.new {
		margin: 0 var(--b-space-lg);
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		color: var(--b-gold);
		border: 1px solid var(--b-gold-soft);
		border-radius: var(--b-radius-pill);
		padding: 0.35rem 0.7rem;
		transition: background var(--b-transition-fast), color var(--b-transition-fast);
	}
	.new:hover { background: var(--b-gold); color: var(--b-on-accent); }

	.tally {
		padding: 0 var(--b-space-lg);
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
	}
	.tally-num { font-family: var(--b-font-pixel); font-size: 1.3rem; color: var(--b-text); }
	.tally-word { font-family: var(--b-font-mono); font-size: 0.72rem; color: var(--b-muted); }

	.bottom {
		padding: 0 var(--b-space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--b-space-md);
	}
	.margin-link,
	.echoes-link {
		font-family: var(--b-font-mono);
		font-size: 0.74rem;
		color: var(--b-text-dim);
		text-decoration: none;
		transition: color var(--b-transition-fast);
	}
	.margin-link:hover,
	.echoes-link:hover { color: var(--b-relational); }

	.comfort-btn,
	.sync-btn {
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
		font-family: var(--b-font-mono);
		font-size: 0.75rem;
		color: var(--b-muted);
		transition: color var(--b-transition-fast);
	}
	.comfort-btn:hover,
	.sync-btn:hover { color: var(--b-text-dim); }
	.comfort-btn:hover { color: var(--b-relational); }
	.comfort-glyph { font-size: 0.85rem; color: var(--b-gold); }
	.sync-btn.connected { color: var(--b-biochemical); }
	.sync-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--b-muted);
		flex-shrink: 0;
	}
	.sync-dot.on { background: var(--b-biochemical); }

	/* a drawer that rises from the lower-left, shared by sync & comfort */
	.drawer-overlay {
		position: fixed;
		inset: 0;
		background: rgba(90, 54, 80, 0.30);
		backdrop-filter: blur(2px);
		z-index: var(--b-z-overlay);
		display: flex;
		align-items: flex-end;
		justify-content: flex-start;
	}
	.drawer {
		background: var(--b-surface);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-lg) var(--b-radius-lg) 0 0;
		width: 400px;
		max-width: 100vw;
		max-height: 90vh;
		overflow-y: auto;
		position: relative;
		box-shadow: var(--b-shadow-hover);
	}
	.close-btn {
		position: absolute;
		top: var(--b-space-md);
		right: var(--b-space-md);
		font-size: 1.2rem;
		color: var(--b-muted);
		transition: color var(--b-transition-fast);
	}
	.close-btn:hover { color: var(--b-gold); }

	@media (max-width: 680px) {
		.sidebar {
			width: 100%;
			min-height: 0;
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			padding: var(--b-space-sm) var(--b-space-md);
			position: sticky;
			top: 0;
			z-index: var(--b-z-sidebar);
		}
		.top { flex-direction: row; align-items: center; gap: var(--b-space-sm); }
		.new { margin: 0; }
		.gallery-link { margin: 0; }
		.gallery-link .gallery-glyph { font-size: 0.95rem; }
		.tally { display: none; }
		.bottom { flex-direction: row; align-items: center; padding: 0; }
	}
</style>
