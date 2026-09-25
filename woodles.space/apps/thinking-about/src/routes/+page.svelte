<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { thinkingAbout } from '$lib/thinkingAbout.svelte';
	import { clearEntryLinkFromAddressBar, parseEntryLink } from '$lib/deepLink';
	import { syncState } from '$lib/sync.svelte';
	import { motionDuration } from '$lib/motion';
	import Board from '$lib/components/Board.svelte';
	import ArchiveView from '$lib/components/ArchiveView.svelte';
	import EntryDetail from '$lib/components/EntryDetail.svelte';
	import SyncPanel from '$lib/components/SyncPanel.svelte';

	let showSync = $state(false);

	// The tab indicator is one pill that moves between the tabs rather than a
	// background each tab paints for itself, so switching views reads as the
	// same object travelling. That means measuring: the tabs are different
	// widths, and "completed" changes width again when its count appears.
	let boardTab = $state<HTMLButtonElement | undefined>();
	let archiveTab = $state<HTMLButtonElement | undefined>();
	let pill = $state<{ x: number; width: number } | null>(null);

	function measureTabs(): void {
		const active = thinkingAbout.view === 'board' ? boardTab : archiveTab;
		if (!active) return;
		pill = { x: active.offsetLeft, width: active.offsetWidth };
	}

	$effect(() => {
		// Everything that can move the pill or resize a tab, named so the
		// effect re-runs on it.
		thinkingAbout.view;
		thinkingAbout.archived.length;
		measureTabs();
	});

	onMount(() => {
		// Arriving from Carillon's "about <title>" link. Read once, then taken
		// out of the address bar so a reload lands on the board as usual.
		const entryId = parseEntryLink(window.location.href);
		if (!entryId) return;
		clearEntryLinkFromAddressBar();
		// An entry that no longer exists (deleted on another device, or a stale
		// link) simply leaves you on the board — the id is not worth an error.
		if (thinkingAbout.entries.some((e) => e.id === entryId)) thinkingAbout.openEntry(entryId);
	});

	onMount(() => {
		// Web fonts land after the first paint and take every label's width
		// with them, so the pill measures itself again once they are in.
		document.fonts?.ready.then(measureTabs).catch(() => {});
	});
</script>

<svelte:head>
	<title>Thinking About · woodles.space</title>
</svelte:head>

<svelte:window onresize={measureTabs} />

<div class="page">
	<header class="page-header">
		<div class="brand-cluster">
			<a class="home-link" href="/" title="back to woodles.space">·space</a>
			<div class="brand-mark" aria-hidden="true">
				<span class="mark-dot" style:background="#d50000"></span>
				<span class="mark-dot" style:background="#f6bf26"></span>
				<span class="mark-dot" style:background="#33b679"></span>
				<span class="mark-dot" style:background="#039be5"></span>
			</div>
			<h1 class="page-title">Thinking About</h1>
		</div>

		<div class="header-actions">
			<div class="view-tabs" role="tablist" aria-label="board view">
				{#if pill}
					<span
						class="tab-pill"
						aria-hidden="true"
						style:--pill-x="{pill.x}px"
						style:--pill-w="{pill.width}px"
					></span>
				{/if}
				<button
					bind:this={boardTab}
					class="view-tab"
					class:active={thinkingAbout.view === 'board'}
					role="tab"
					aria-selected={thinkingAbout.view === 'board'}
					onclick={() => thinkingAbout.openBoard()}
				>
					board
				</button>
				<button
					bind:this={archiveTab}
					class="view-tab"
					class:active={thinkingAbout.view === 'archive'}
					role="tab"
					aria-selected={thinkingAbout.view === 'archive'}
					onclick={() => thinkingAbout.openArchive()}
				>
					completed
					{#if thinkingAbout.archived.length > 0}
						{#key thinkingAbout.archived.length}
							<span class="tab-count">{thinkingAbout.archived.length}</span>
						{/key}
					{/if}
				</button>
			</div>

			<button
				class="sync-toggle"
				class:connected={syncState.connected}
				class:busy={syncState.syncing}
				onclick={() => (showSync = !showSync)}
				aria-expanded={showSync}
			>
				<span class="sync-dot" aria-hidden="true"></span>
				{syncState.connected ? 'synced' : 'sync'}
			</button>
		</div>
	</header>

	{#if showSync}
		<div class="sync-popover" transition:fly={{ y: -8, duration: motionDuration(180) }}>
			<SyncPanel />
		</div>
	{/if}

	<!-- Both views share one grid cell, so the one leaving fades out from
	     under the one arriving instead of the page jumping between them. -->
	<main class="page-main">
		{#if thinkingAbout.view === 'board'}
			<div class="view" out:fade={{ duration: motionDuration(120) }}>
				<Board />
			</div>
		{:else}
			<div class="view" out:fade={{ duration: motionDuration(120) }}>
				<ArchiveView />
			</div>
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
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 1.1rem;
		animation: ta-rise 0.5s var(--ta-ease-glide) both;
	}

	.brand-cluster,
	.header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-width: 0;
	}

	.header-actions {
		gap: 0.8rem;
	}

	.home-link {
		font-family: var(--ta-font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		color: var(--ta-muted);
		text-decoration: none;
		opacity: 0.7;
		transition: opacity var(--ta-transition-fast), color var(--ta-transition-fast),
			transform var(--ta-transition-spring);
	}

	.home-link:hover {
		opacity: 1;
		color: var(--ta-accent);
		transform: translateX(-2px);
	}

	/* a small Calendar-icon-style mark — the only spot of color in the
	   chrome, reusing the same swatch family the entries themselves are
	   colored from, everything else stays neutral. */
	.brand-mark {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 3px;
		width: 20px;
		height: 20px;
		padding: 3px;
		border-radius: 7px;
		background: color-mix(in srgb, var(--ta-surface) 82%, var(--ta-accent));
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow: var(--ta-shadow-sm);
		flex-shrink: 0;
		transition: transform var(--ta-transition-spring), box-shadow var(--ta-transition-fast);
	}

	.brand-cluster:hover .brand-mark {
		transform: rotate(-4deg) scale(1.08);
		box-shadow: var(--ta-shadow-md);
	}

	/* the four dots land one after another, the way the board's own columns
	   do a moment later */
	.mark-dot {
		border-radius: 2px;
		animation: ta-pop 0.42s var(--ta-ease-spring) both;
	}

	.mark-dot:nth-child(1) {
		animation-delay: 0.1s;
	}

	.mark-dot:nth-child(2) {
		animation-delay: 0.16s;
	}

	.mark-dot:nth-child(3) {
		animation-delay: 0.22s;
	}

	.mark-dot:nth-child(4) {
		animation-delay: 0.28s;
	}

	.page-title {
		position: relative;
		font-family: var(--ta-font-sans);
		font-size: 1.3rem;
		font-weight: 600;
		color: var(--ta-text);
		white-space: nowrap;
	}

	/* drawn rather than declared: text-decoration can't animate, and this
	   underline arriving under the title is the page saying hello */
	.page-title::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -0.22em;
		height: 3px;
		border-radius: 2px;
		background: rgba(51, 182, 121, 0.35);
		transform-origin: left center;
		animation: ta-draw 0.62s var(--ta-ease-glide) 0.18s both;
		transition: background var(--ta-transition-medium);
	}

	.brand-cluster:hover .page-title::after {
		background: rgba(51, 182, 121, 0.6);
	}

	.view-tabs {
		position: relative;
		display: flex;
		gap: 0.25rem;
		background: rgba(255, 255, 255, 0.78);
		border: 1px solid rgba(255, 255, 255, 0.85);
		border-radius: var(--ta-radius-pill);
		padding: 0.2rem;
		box-shadow: var(--ta-shadow-sm);
	}

	/* one pill, two tabs: it travels rather than being repainted */
	.tab-pill {
		position: absolute;
		top: 0.2rem;
		bottom: 0.2rem;
		left: 0;
		width: var(--pill-w);
		transform: translateX(var(--pill-x));
		border-radius: var(--ta-radius-pill);
		background:
			linear-gradient(135deg, rgba(26, 115, 232, 0.12), rgba(51, 182, 121, 0.1)),
			var(--ta-surface);
		box-shadow: var(--ta-shadow-sm);
		pointer-events: none;
		transition: transform 0.42s var(--ta-ease-spring), width 0.42s var(--ta-ease-spring);
		animation: ta-fade-in 0.3s ease both;
	}

	@keyframes ta-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.view-tab {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--ta-font-sans);
		font-size: 0.78rem;
		color: var(--ta-muted);
		padding: 0.35rem 0.85rem;
		border-radius: var(--ta-radius-pill);
		transition: color var(--ta-transition-medium), transform var(--ta-transition-spring);
	}

	.view-tab:hover {
		color: var(--ta-text-dim);
	}

	.view-tab:active {
		transform: var(--ta-lift-press);
	}

	.view-tab.active {
		color: var(--ta-text);
	}

	.tab-count {
		font-family: var(--ta-font-mono);
		font-size: 0.62rem;
		background: var(--ta-border);
		color: var(--ta-text-dim);
		border-radius: var(--ta-radius-pill);
		padding: 0.05rem 0.4rem;
		animation: ta-pop 0.4s var(--ta-ease-spring) both;
	}

	.sync-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--ta-font-sans);
		font-size: 0.78rem;
		color: var(--ta-muted);
		background: rgba(255, 255, 255, 0.72);
		border: 1px solid rgba(255, 255, 255, 0.85);
		border-radius: var(--ta-radius-pill);
		padding: 0.35rem 0.8rem;
		transition: border-color var(--ta-transition-fast), color var(--ta-transition-fast),
			transform var(--ta-transition-spring), box-shadow var(--ta-transition-fast);
	}

	.sync-toggle:hover {
		border-color: var(--ta-accent);
		color: var(--ta-accent);
		box-shadow: var(--ta-shadow-sm);
		transform: var(--ta-lift-hover);
	}

	.sync-toggle:active {
		transform: var(--ta-lift-press);
	}

	.sync-dot {
		position: relative;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ta-muted);
		transition: background var(--ta-transition-medium);
	}

	.sync-toggle.connected .sync-dot {
		background: #1e8e3e;
	}

	/* a connected board keeps a slow pulse going; a push in flight quickens
	   it, which is the whole status readout the header needs */
	.sync-dot::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 1.5px solid #1e8e3e;
		opacity: 0;
	}

	.sync-toggle.connected .sync-dot::after {
		animation: ta-breathe 2.8s var(--ta-ease-glide) infinite;
	}

	.sync-toggle.busy .sync-dot::after {
		animation-duration: 0.9s;
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
		transform-origin: top right;
	}

	.page-main {
		display: grid;
		min-height: 60vh;
	}

	.view {
		grid-area: 1 / 1;
		min-width: 0;
	}

	@media (max-width: 640px) {
		.page-header {
			flex-wrap: wrap;
			gap: 0.65rem;
			padding-bottom: 0.85rem;
		}

		.brand-cluster {
			width: 100%;
			gap: 0.7rem;
		}

		.page-title {
			font-size: 1.2rem;
		}

		.header-actions {
			width: 100%;
			justify-content: space-between;
			gap: 0.6rem;
		}

		.view-tabs {
			min-width: 0;
		}

		.view-tab {
			padding-inline: 0.7rem;
		}
	}
</style>
