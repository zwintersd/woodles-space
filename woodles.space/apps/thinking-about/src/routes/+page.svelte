<script lang="ts">
	import { thinkingAbout } from '$lib/thinkingAbout.svelte';
	import { syncState } from '$lib/sync.svelte';
	import Board from '$lib/components/Board.svelte';
	import ArchiveView from '$lib/components/ArchiveView.svelte';
	import EntryDetail from '$lib/components/EntryDetail.svelte';
	import SyncPanel from '$lib/components/SyncPanel.svelte';

	let showSync = $state(false);
</script>

<svelte:head>
	<title>Thinking About · woodles.space</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<a class="home-link" href="/" title="back to woodles.space">·space</a>
		<h1 class="page-title">Thinking About</h1>

		<div class="view-tabs" role="tablist" aria-label="board view">
			<button
				class="view-tab"
				class:active={thinkingAbout.view === 'board'}
				role="tab"
				aria-selected={thinkingAbout.view === 'board'}
				onclick={() => thinkingAbout.openBoard()}
			>
				board
			</button>
			<button
				class="view-tab"
				class:active={thinkingAbout.view === 'archive'}
				role="tab"
				aria-selected={thinkingAbout.view === 'archive'}
				onclick={() => thinkingAbout.openArchive()}
			>
				completed
				{#if thinkingAbout.archived.length > 0}
					<span class="tab-count">{thinkingAbout.archived.length}</span>
				{/if}
			</button>
		</div>

		<button
			class="sync-toggle"
			class:connected={syncState.connected}
			onclick={() => (showSync = !showSync)}
			aria-expanded={showSync}
		>
			<span class="sync-dot" aria-hidden="true"></span>
			{syncState.connected ? 'synced' : 'sync'}
		</button>
	</header>

	{#if showSync}
		<div class="sync-popover">
			<SyncPanel />
		</div>
	{/if}

	<main class="page-main">
		{#if thinkingAbout.view === 'board'}
			<Board />
		{:else}
			<ArchiveView />
		{/if}
	</main>
</div>

<EntryDetail />

<style>
	.page {
		width: min(1180px, calc(100vw - 2rem));
		margin: 0 auto;
		padding: 1.4rem 0 3rem;
		position: relative;
	}

	.page-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding-bottom: 1.1rem;
	}

	.home-link {
		font-family: var(--ta-font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		color: var(--ta-muted);
		text-decoration: none;
		opacity: 0.7;
		transition: opacity var(--ta-transition-fast);
	}

	.home-link:hover {
		opacity: 1;
	}

	.page-title {
		font-family: var(--ta-font-sans);
		font-size: 1.3rem;
		font-weight: 600;
		color: var(--ta-text);
		margin-right: auto;
	}

	.view-tabs {
		display: flex;
		gap: 0.25rem;
		background: var(--ta-bg-subtle);
		border: 1px solid var(--ta-border);
		border-radius: var(--ta-radius-pill);
		padding: 0.2rem;
	}

	.view-tab {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--ta-font-sans);
		font-size: 0.78rem;
		color: var(--ta-muted);
		padding: 0.35rem 0.85rem;
		border-radius: var(--ta-radius-pill);
		transition: background var(--ta-transition-fast), color var(--ta-transition-fast);
	}

	.view-tab.active {
		background: var(--ta-surface);
		color: var(--ta-text);
		box-shadow: var(--ta-shadow-sm);
	}

	.tab-count {
		font-family: var(--ta-font-mono);
		font-size: 0.62rem;
		background: var(--ta-border);
		color: var(--ta-text-dim);
		border-radius: var(--ta-radius-pill);
		padding: 0.05rem 0.4rem;
	}

	.sync-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--ta-font-sans);
		font-size: 0.78rem;
		color: var(--ta-muted);
		border: 1px solid var(--ta-border);
		border-radius: var(--ta-radius-pill);
		padding: 0.35rem 0.8rem;
		transition: border-color var(--ta-transition-fast), color var(--ta-transition-fast);
	}

	.sync-toggle:hover {
		border-color: var(--ta-accent);
		color: var(--ta-accent);
	}

	.sync-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ta-muted);
	}

	.sync-toggle.connected .sync-dot {
		background: #1e8e3e;
	}

	.sync-popover {
		position: absolute;
		right: 0;
		top: 3.6rem;
		z-index: 20;
		background: var(--ta-surface);
		border: 1px solid var(--ta-border);
		border-radius: var(--ta-radius-md);
		box-shadow: var(--ta-shadow-md);
	}

	.page-main {
		min-height: 60vh;
	}

	@media (max-width: 640px) {
		.page-header {
			flex-wrap: wrap;
		}

		.page-title {
			order: -1;
			width: 100%;
			margin-right: 0;
		}
	}
</style>
