<script lang="ts">
	import { syncState, connectAndHydrate, disconnect, flushSync } from '$lib/sync.svelte';
	import { bestiary } from '$lib/bestiary.svelte';
	import PublishPanel from './PublishPanel.svelte';

	let pass = $state('');
	let connecting = $state(false);
	let showPublish = $state(false);

	async function handleConnect() {
		if (!pass.trim()) return;
		connecting = true;
		await connectAndHydrate(pass.trim());
		connecting = false;
		pass = '';
	}
</script>

<div class="sync-panel">
	<h3 class="panel-title">sync &amp; export</h3>

	{#if syncState.connected}
		<div class="sync-status ok">
			<span class="dot"></span>
			connected
			{#if syncState.lastSyncedAt}
				· synced {syncState.lastSyncedAt.toLocaleTimeString()}
			{/if}
		</div>
		<div class="sync-actions">
			<button class="btn-ghost" onclick={() => flushSync()} disabled={syncState.syncing}>
				{syncState.syncing ? 'syncing…' : 'push now'}
			</button>
			<button class="btn-ghost muted" onclick={() => disconnect()}>disconnect</button>
		</div>
		{#if syncState.errorMessage}
			<p class="error-msg">{syncState.errorMessage}</p>
		{/if}

		<div class="publish-row">
			<button class="btn-ghost" onclick={() => (showPublish = true)}>publish to the gallery…</button>
		</div>
	{:else}
		<p class="sync-hint">Enter your passphrase to sync the bestiary across devices.</p>
		<div class="pass-row">
			<input
				type="password"
				placeholder="passphrase"
				bind:value={pass}
				onkeydown={(e) => e.key === 'Enter' && handleConnect()}
				class="pass-input"
			/>
			<button class="btn-primary" onclick={handleConnect} disabled={connecting || !pass.trim()}>
				{connecting ? '…' : 'connect'}
			</button>
		</div>
		{#if syncState.errorMessage}
			<p class="error-msg">{syncState.errorMessage}</p>
		{/if}
	{/if}

	<div class="export-row">
		<button class="btn-ghost" onclick={() => bestiary.downloadExport()}>export all as JSON</button>
	</div>
</div>

{#if showPublish}
	<PublishPanel onclose={() => (showPublish = false)} />
{/if}

<style>
	.sync-panel {
		padding: var(--b-space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--b-space-md);
	}
	.panel-title {
		font-family: var(--b-font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--b-muted);
		font-weight: 400;
	}
	.sync-status {
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
		font-size: 0.85rem;
		color: var(--b-text-dim);
		font-family: var(--b-font-mono);
	}
	.sync-status.ok .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--b-biochemical);
		flex-shrink: 0;
	}
	.sync-hint { font-size: 0.85rem; color: var(--b-muted); font-family: var(--b-font-body); }
	.pass-row { display: flex; gap: var(--b-space-sm); }
	.pass-input {
		flex: 1;
		background: var(--b-surface-2);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: var(--b-space-sm) var(--b-space-md);
		color: var(--b-text);
		font-size: 0.9rem;
	}
	.sync-actions { display: flex; gap: var(--b-space-sm); flex-wrap: wrap; }
	.btn-primary {
		background: var(--b-gold);
		color: var(--b-on-accent);
		border-radius: var(--b-radius-sm);
		padding: var(--b-space-sm) var(--b-space-md);
		font-size: 0.85rem;
		font-weight: 600;
		font-family: var(--b-font-mono);
		transition: opacity var(--b-transition-fast);
	}
	.btn-primary:disabled { opacity: 0.4; }
	.btn-ghost {
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: var(--b-space-sm) var(--b-space-md);
		font-size: 0.85rem;
		font-family: var(--b-font-mono);
		color: var(--b-text-dim);
		transition: border-color var(--b-transition-fast), color var(--b-transition-fast);
	}
	.btn-ghost:hover { border-color: var(--b-gold); color: var(--b-gold); }
	.btn-ghost.muted { color: var(--b-muted); }
	.btn-ghost.muted:hover { color: var(--b-text-dim); border-color: var(--b-border-strong); }
	.error-msg { font-size: 0.82rem; color: var(--b-mythic); font-family: var(--b-font-mono); }
	.publish-row { padding-top: var(--b-space-sm); }
	.export-row { padding-top: var(--b-space-md); border-top: 1px solid var(--b-rule); }
</style>
