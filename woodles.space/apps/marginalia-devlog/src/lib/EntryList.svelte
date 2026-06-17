<script lang="ts">
	import type { DevlogEntry, BlockType } from '$lib/types';
	import { devlog } from '$lib/devlog.svelte';
	import { syncState, connectAndHydrate, flushSync, disconnect } from '$lib/sync.svelte';
	import SmartLinkChip from '$lib/blocks/SmartLinkChip.svelte';

	const BLOCK_META: Record<BlockType, { icon: string; color: string }> = {
		prose:    { icon: '¶',  color: 'var(--d-prose)' },
		creature: { icon: '✦',  color: 'var(--d-creature)' },
		biome:    { icon: '◈',  color: 'var(--d-biome)' },
		ability:  { icon: '◆',  color: 'var(--d-ability)' },
		stat:     { icon: '▲',  color: 'var(--d-stat)' },
		minigame: { icon: '●',  color: 'var(--d-minigame)' },
		lore:     { icon: '◐',  color: 'var(--d-lore)' }
	};

	function blockTypesIn(entry: DevlogEntry): BlockType[] {
		const seen = new Set<BlockType>();
		for (const b of entry.blocks) {
			if (b.type !== 'prose') seen.add(b.type);
		}
		return [...seen];
	}

	function prosePreview(entry: DevlogEntry): string {
		const first = entry.blocks.find((b) => b.type === 'prose');
		if (!first || first.type !== 'prose') return '';
		return first.content.replace(/\s+/g, ' ').trim().slice(0, 120);
	}

	let sortedEntries = $derived(
		[...devlog.entries].sort((a, b) => b.date.localeCompare(a.date))
	);

	function createEntry() {
		const entry = devlog.createEntry();
		devlog.openEntry(entry.id);
	}

	// ── sync panel ────────────────────────────────────────────────────
	let syncOpen = $state(false);
	let passphraseInput = $state('');
	let showPass = $state(false);

	async function handleConnect() {
		if (!passphraseInput.trim()) return;
		await connectAndHydrate(passphraseInput.trim());
		passphraseInput = '';
		syncOpen = false;
	}

	// ── delete confirm ────────────────────────────────────────────────
	let deletingId = $state<string | null>(null);

	function confirmDelete(id: string) { deletingId = id; }
	function cancelDelete() { deletingId = null; }
	function executeDelete() {
		if (deletingId) { devlog.deleteEntry(deletingId); deletingId = null; }
	}
</script>

<div class="list-page">
	<!-- header -->
	<header class="list-header">
		<div class="list-title">
			<h1>marginalia devlog</h1>
			<span class="list-subtitle">making the witch's world</span>
		</div>

		<div class="header-actions">
			<button class="sync-toggle" onclick={() => syncOpen = !syncOpen} title="sync settings">
				{#if syncState.connected}
					<span class="sync-dot" class:ok={syncState.status === 'ok'} class:error={syncState.status === 'error'}></span>
				{/if}
				⇄
			</button>
			<button class="new-entry-btn" onclick={createEntry}>+ new entry</button>
		</div>
	</header>

	<!-- sync panel -->
	{#if syncOpen}
		<div class="sync-panel">
			{#if syncState.connected}
				<div class="sync-status-row">
					<span class="sync-label">
						{syncState.status === 'ok' ? `synced ${syncState.lastSyncedAt?.toLocaleTimeString() ?? ''}` :
						 syncState.status === 'error' ? syncState.errorMessage :
						 'connected'}
					</span>
					<div class="sync-actions">
						<button
							class="sync-action-btn"
							onclick={flushSync}
							disabled={syncState.syncing}
						>
							{syncState.syncing ? 'syncing…' : 'sync now'}
						</button>
						<button class="sync-action-btn danger" onclick={disconnect}>disconnect</button>
					</div>
				</div>
			{:else}
				<div class="sync-connect-row">
					<span class="sync-label">passphrase</span>
					<div class="passphrase-input-group">
						<input
							type={showPass ? 'text' : 'password'}
							bind:value={passphraseInput}
							placeholder="enter passphrase to sync…"
							class="passphrase-input"
							onkeydown={(e) => { if (e.key === 'Enter') handleConnect(); }}
						/>
						<button class="show-pass-btn" onclick={() => showPass = !showPass}>
							{showPass ? '◉' : '○'}
						</button>
					</div>
					<button
						class="sync-action-btn"
						onclick={handleConnect}
						disabled={!passphraseInput.trim() || syncState.syncing}
					>
						{syncState.syncing ? 'connecting…' : 'connect'}
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- entry stream -->
	{#if sortedEntries.length === 0}
		<div class="empty-state">
			<p class="empty-text">no entries yet</p>
			<button class="empty-new" onclick={createEntry}>write the first one</button>
		</div>
	{:else}
		<div class="entry-stream">
			{#each sortedEntries as entry (entry.id)}
					<div
					class="entry-card"
					onclick={() => devlog.openEntry(entry.id)}
					role="button"
					tabindex="0"
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') devlog.openEntry(entry.id); }}
				>
					<div class="entry-card-main">
						<div class="entry-card-top">
							<time class="entry-date">{entry.date}</time>
							<div class="entry-types">
								{#each blockTypesIn(entry) as type}
									<span
										class="type-pip"
										style="color: {BLOCK_META[type].color}"
										title={type}
									>
										{BLOCK_META[type].icon}
									</span>
								{/each}
							</div>
						</div>

						<h2 class="entry-title" class:is-untitled={!entry.title}>
							{entry.title || 'untitled'}
						</h2>

						{#if prosePreview(entry)}
							<p class="entry-preview">{prosePreview(entry)}</p>
						{/if}
					</div>

					<button
						class="entry-delete"
						onclick={(e) => { e.stopPropagation(); confirmDelete(entry.id); }}
						aria-label="delete entry"
					>×</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- delete confirmation -->
{#if deletingId}
	<div class="confirm-backdrop" role="presentation" onclick={cancelDelete} onkeydown={cancelDelete}></div>
	<div class="confirm-dialog" role="alertdialog">
		<p class="confirm-text">delete this entry?</p>
		<p class="confirm-sub">this cannot be undone</p>
		<div class="confirm-actions">
			<button class="confirm-btn danger" onclick={executeDelete}>delete</button>
			<button class="confirm-btn" onclick={cancelDelete}>cancel</button>
		</div>
	</div>
{/if}

<style>
	.list-page {
		max-width: var(--d-max-width);
		margin: 0 auto;
		padding: var(--d-space-xl) var(--d-space-md);
	}

	/* ── header ─────────────────────────────────────────────────────── */
	.list-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--d-space-md);
		margin-bottom: var(--d-space-xl);
	}

	.list-title h1 {
		font-family: var(--d-font-display);
		font-size: clamp(1.6rem, 4vw, 2.2rem);
		font-weight: 600;
		color: var(--d-text);
		line-height: 1.1;
		letter-spacing: -0.01em;
	}

	.list-subtitle {
		display: block;
		font-family: var(--d-font-mono);
		font-size: 11px;
		color: var(--d-text-faint);
		letter-spacing: 0.06em;
		margin-top: 4px;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--d-space-sm);
		flex-shrink: 0;
		margin-top: 4px;
	}

	.sync-toggle {
		width: 32px;
		height: 32px;
		border-radius: var(--d-radius-sm);
		border: 1px solid var(--d-border);
		color: var(--d-text-dim);
		font-size: 14px;
		position: relative;
		transition: all var(--d-transition-fast);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.sync-toggle:hover { border-color: var(--d-border-mid); color: var(--d-text); }

	.sync-dot {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--d-text-faint);
	}
	.sync-dot.ok    { background: var(--d-biome); }
	.sync-dot.error { background: var(--d-ability); }

	.new-entry-btn {
		padding: 6px var(--d-space-md);
		border-radius: var(--d-radius-md);
		border: 1px solid var(--d-accent);
		background: var(--d-accent-soft);
		color: var(--d-accent);
		font-family: var(--d-font-mono);
		font-size: 12px;
		letter-spacing: 0.04em;
		transition: all var(--d-transition-fast);
		white-space: nowrap;
	}
	.new-entry-btn:hover {
		background: var(--d-accent);
		color: var(--d-on-accent);
	}

	/* ── sync panel ─────────────────────────────────────────────────── */
	.sync-panel {
		background: var(--d-surface-2);
		border: 1px solid var(--d-border-mid);
		border-radius: var(--d-radius-md);
		padding: var(--d-space-md);
		margin-bottom: var(--d-space-lg);
	}

	.sync-status-row,
	.sync-connect-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--d-space-sm);
	}

	.sync-label {
		font-family: var(--d-font-mono);
		font-size: 11px;
		color: var(--d-text-dim);
		flex: 1;
		min-width: 140px;
	}

	.sync-actions { display: flex; gap: var(--d-space-sm); }

	.sync-action-btn {
		padding: 4px var(--d-space-sm);
		border-radius: var(--d-radius-sm);
		border: 1px solid var(--d-border-mid);
		font-family: var(--d-font-mono);
		font-size: 11px;
		color: var(--d-text-dim);
		transition: all var(--d-transition-fast);
	}
	.sync-action-btn:hover { border-color: var(--d-accent); color: var(--d-accent); }
	.sync-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.sync-action-btn.danger:hover { border-color: var(--d-ability); color: var(--d-ability); }

	.passphrase-input-group {
		display: flex;
		flex: 1;
		min-width: 200px;
		gap: 4px;
	}

	.passphrase-input {
		flex: 1;
		background: var(--d-surface-3);
		border: 1px solid var(--d-border);
		border-radius: var(--d-radius-sm);
		padding: 4px var(--d-space-sm);
		font-family: var(--d-font-mono);
		font-size: 12px;
		color: var(--d-text);
	}
	.passphrase-input:focus { outline: none; border-color: var(--d-accent); }
	.passphrase-input::placeholder { color: var(--d-placeholder); }

	.show-pass-btn {
		width: 28px;
		height: 28px;
		border-radius: var(--d-radius-sm);
		border: 1px solid var(--d-border);
		font-size: 12px;
		color: var(--d-text-faint);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.show-pass-btn:hover { color: var(--d-text-dim); border-color: var(--d-border-mid); }

	/* ── empty state ────────────────────────────────────────────────── */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--d-space-md);
		padding: var(--d-space-2xl) var(--d-space-md);
		text-align: center;
	}

	.empty-text {
		font-family: var(--d-font-mono);
		font-size: 13px;
		color: var(--d-text-faint);
	}

	.empty-new {
		font-family: var(--d-font-mono);
		font-size: 12px;
		color: var(--d-accent);
		letter-spacing: 0.04em;
		transition: opacity var(--d-transition-fast);
	}
	.empty-new:hover { opacity: 0.7; }

	/* ── entry stream ───────────────────────────────────────────────── */
	.entry-stream {
		display: flex;
		flex-direction: column;
		gap: var(--d-space-sm);
	}

	.entry-card {
		display: flex;
		align-items: flex-start;
		gap: var(--d-space-md);
		background: var(--d-surface);
		border: 1px solid var(--d-border);
		border-radius: var(--d-radius-md);
		padding: var(--d-space-md);
		cursor: pointer;
		transition: all var(--d-transition-fast);
		text-align: left;
	}
	.entry-card:hover {
		background: var(--d-surface-2);
		border-color: var(--d-border-mid);
		transform: translateY(-1px);
		box-shadow: var(--d-shadow-card);
	}

	.entry-card-main { flex: 1; min-width: 0; }

	.entry-card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--d-space-sm);
		margin-bottom: var(--d-space-xs);
	}

	.entry-date {
		font-family: var(--d-font-mono);
		font-size: 11px;
		color: var(--d-text-faint);
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}

	.entry-types {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.type-pip {
		font-size: 11px;
		opacity: 0.8;
	}

	.entry-title {
		font-family: var(--d-font-display);
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--d-text);
		margin-bottom: var(--d-space-xs);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.entry-title.is-untitled {
		color: var(--d-text-faint);
		font-style: italic;
	}

	.entry-preview {
		font-family: var(--d-font-body);
		font-size: 13px;
		color: var(--d-text-dim);
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.entry-delete {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		border-radius: var(--d-radius-sm);
		border: 1px solid transparent;
		font-size: 16px;
		color: var(--d-text-faint);
		opacity: 0;
		transition: all var(--d-transition-fast);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.entry-card:hover .entry-delete { opacity: 1; }
	.entry-delete:hover {
		color: var(--d-ability);
		border-color: var(--d-ability);
		opacity: 1;
	}

	/* ── delete confirm ─────────────────────────────────────────────── */
	.confirm-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--d-z-overlay);
		background: rgba(0, 0, 0, 0.5);
	}

	.confirm-dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: calc(var(--d-z-overlay) + 1);
		background: var(--d-surface-2);
		border: 1px solid var(--d-border-mid);
		border-radius: var(--d-radius-lg);
		padding: var(--d-space-lg);
		min-width: 260px;
		text-align: center;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
	}

	.confirm-text {
		font-family: var(--d-font-display);
		font-size: 1.1rem;
		color: var(--d-text);
		margin-bottom: var(--d-space-xs);
	}

	.confirm-sub {
		font-family: var(--d-font-mono);
		font-size: 11px;
		color: var(--d-text-faint);
		margin-bottom: var(--d-space-lg);
	}

	.confirm-actions { display: flex; gap: var(--d-space-sm); justify-content: center; }

	.confirm-btn {
		padding: 6px var(--d-space-md);
		border-radius: var(--d-radius-md);
		border: 1px solid var(--d-border-mid);
		font-family: var(--d-font-mono);
		font-size: 12px;
		color: var(--d-text-dim);
		transition: all var(--d-transition-fast);
	}
	.confirm-btn:hover { border-color: var(--d-border-glow); color: var(--d-text); }
	.confirm-btn.danger {
		border-color: var(--d-ability);
		color: var(--d-ability);
	}
	.confirm-btn.danger:hover {
		background: rgba(240, 122, 174, 0.15);
	}
</style>
