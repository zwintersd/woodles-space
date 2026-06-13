<script lang="ts">
	import { garden } from '$lib/garden.svelte';
	import { syncState } from '$lib/sync.svelte';
	import SyncPanel from './SyncPanel.svelte';

	let isSpell = $derived(garden.currentView === 'spell');

	let showSync = $derived(garden.showSyncPanel);

	const ARCHETYPE_GLYPHS: Record<string, string> = {
		plain: '◦',
		diary: '☽',
		media: '▣'
	};

	function glyph(archetype: string): string {
		return ARCHETYPE_GLYPHS[archetype] ?? '◦';
	}
</script>

<nav class="sidebar">
	<div class="sidebar-top">
		<button class="home-btn" onclick={() => garden.openGarden()} title="Garden">
			<span class="home-glyph">❀</span>
			<span class="home-label">spores</span>
		</button>

		{#if garden.spellbooks.length > 0}
			<ul class="nav-books">
				{#each garden.spellbooks as sb}
					<li>
						<button
							class="nav-book"
							class:active={garden.activeSpellbookId === sb.id}
							onclick={() => garden.openSpellbook(sb.id)}
							title={sb.title}
						>
							<span class="nav-glyph">{glyph(sb.archetype)}</span>
							<span class="nav-label">{sb.title}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="sidebar-bottom">
		<button
			class="spell-btn"
			class:active={isSpell}
			onclick={() => isSpell ? garden.closeSpellWizard() : garden.openSpellWizard()}
			title="Cast a spell"
		>
			✦ spell
		</button>
		<button
			class="sync-btn"
			class:connected={syncState.connected}
			onclick={() => (garden.showSyncPanel = !garden.showSyncPanel)}
			title="Sync"
		>
			<span class="sync-dot" class:on={syncState.connected}></span>
			sync
		</button>
	</div>
</nav>

{#if garden.showSyncPanel}
	<div class="sync-overlay">
		<div class="sync-drawer">
			<button class="close-btn" onclick={() => (garden.showSyncPanel = false)}>×</button>
			<SyncPanel />
		</div>
	</div>
{/if}

<style>
	.sidebar {
		width: 200px;
		min-height: 100vh;
		background: var(--g-surface);
		border-right: 1px solid var(--g-border);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: var(--g-space-lg) 0;
		flex-shrink: 0;
	}

	.sidebar-top {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.home-btn {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
		padding: var(--g-space-sm) var(--g-space-lg);
		width: 100%;
		text-align: left;
		color: var(--g-flight);
		transition: background var(--g-transition-fast);
	}

	.home-btn:hover {
		background: var(--g-flight-soft);
	}

	.home-glyph {
		font-size: 1.1rem;
	}

	.home-label {
		font-family: var(--g-font-display);
		font-size: 1rem;
		letter-spacing: 0.03em;
	}

	.nav-books {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: var(--g-space-sm);
		padding: 0 var(--g-space-sm);
	}

	.nav-book {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
		padding: var(--g-space-xs) var(--g-space-md);
		width: 100%;
		text-align: left;
		border-radius: var(--g-radius-sm);
		color: var(--g-text-dim);
		font-size: 0.88rem;
		transition: background var(--g-transition-fast), color var(--g-transition-fast);
		overflow: hidden;
	}

	.nav-book:hover,
	.nav-book.active {
		background: var(--g-flight-soft);
		color: var(--g-flight);
	}

	.nav-glyph {
		flex-shrink: 0;
		font-size: 0.8rem;
	}

	.nav-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sidebar-bottom {
		padding: 0 var(--g-space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.spell-btn {
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-flight);
		border: 1px solid var(--g-flight-soft);
		border-radius: var(--g-radius-pill);
		padding: 0.3rem 0.7rem;
		transition: background var(--g-transition-fast), color var(--g-transition-fast);
		align-self: flex-start;
	}

	.spell-btn:hover,
	.spell-btn.active {
		background: var(--g-flight);
		color: #0d0d1a;
	}

	.sync-btn {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
		font-family: var(--g-font-mono);
		font-size: 0.75rem;
		color: var(--g-muted);
		transition: color var(--g-transition-fast);
	}

	.sync-btn:hover {
		color: var(--g-text-dim);
	}

	.sync-btn.connected {
		color: var(--g-flight-active);
	}

	.sync-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--g-muted);
		flex-shrink: 0;
	}

	.sync-dot.on {
		background: var(--g-flight-active);
	}

	/* ── sync overlay ── */
	.sync-overlay {
		position: fixed;
		inset: 0;
		background: rgba(13, 13, 26, 0.6);
		z-index: var(--g-z-overlay);
		display: flex;
		align-items: flex-end;
		justify-content: flex-start;
	}

	.sync-drawer {
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-lg) var(--g-radius-lg) 0 0;
		width: 400px;
		max-width: 100vw;
		position: relative;
	}

	.close-btn {
		position: absolute;
		top: var(--g-space-md);
		right: var(--g-space-md);
		font-size: 1.2rem;
		color: var(--g-muted);
		transition: color var(--g-transition-fast);
	}

	.close-btn:hover {
		color: var(--g-flight);
	}
</style>
