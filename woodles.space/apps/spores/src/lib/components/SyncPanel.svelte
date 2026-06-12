<script lang="ts">
	import { syncState, connectAndHydrate, disconnect, flushSync } from '$lib/sync.svelte';
	import { garden } from '$lib/garden.svelte';

	let pass = $state('');
	let connecting = $state(false);

	async function handleConnect() {
		if (!pass.trim()) return;
		connecting = true;
		await connectAndHydrate(pass.trim());
		connecting = false;
		pass = '';
	}

	async function handleFlush() {
		await flushSync();
	}

	function handleDisconnect() {
		disconnect();
	}

	function handleExport() {
		garden.downloadExport();
	}
</script>

<div class="sync-panel">
	<h3 class="panel-title">sync & export</h3>

	{#if syncState.connected}
		<div class="sync-status ok">
			<span class="dot"></span>
			connected
			{#if syncState.lastSyncedAt}
				· synced {syncState.lastSyncedAt.toLocaleTimeString()}
			{/if}
		</div>
		<div class="sync-actions">
			<button class="btn-ghost" onclick={handleFlush} disabled={syncState.syncing}>
				{syncState.syncing ? 'syncing…' : 'push now'}
			</button>
			<button class="btn-ghost muted" onclick={handleDisconnect}>disconnect</button>
		</div>
		{#if syncState.errorMessage}
			<p class="error-msg">{syncState.errorMessage}</p>
		{/if}
	{:else}
		<p class="sync-hint">Enter your passphrase to sync across devices.</p>
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
		<button class="btn-ghost" onclick={handleExport}>export all as JSON</button>
	</div>
</div>

<style>
	.sync-panel {
		padding: var(--g-space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-md);
	}

	.panel-title {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--g-muted);
		font-weight: 400;
	}

	.sync-status {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
		font-size: 0.85rem;
		color: var(--g-text-dim);
	}

	.sync-status.ok .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--g-flight-active);
		flex-shrink: 0;
	}

	.sync-hint {
		font-size: 0.85rem;
		color: var(--g-muted);
	}

	.pass-row {
		display: flex;
		gap: var(--g-space-sm);
	}

	.pass-input {
		flex: 1;
		background: var(--g-surface-2);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-md);
		color: var(--g-text);
		font-size: 0.9rem;
	}

	.sync-actions {
		display: flex;
		gap: var(--g-space-sm);
		flex-wrap: wrap;
	}

	.btn-primary {
		background: var(--g-flight);
		color: #0d0d1a;
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-md);
		font-size: 0.85rem;
		font-weight: 600;
		transition: opacity var(--g-transition-fast);
	}

	.btn-primary:disabled {
		opacity: 0.4;
	}

	.btn-ghost {
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: var(--g-space-sm) var(--g-space-md);
		font-size: 0.85rem;
		color: var(--g-text-dim);
		transition: border-color var(--g-transition-fast), color var(--g-transition-fast);
	}

	.btn-ghost:hover {
		border-color: var(--g-flight);
		color: var(--g-flight);
	}

	.btn-ghost.muted {
		color: var(--g-muted);
	}

	.btn-ghost.muted:hover {
		color: var(--g-text-dim);
		border-color: var(--g-border-strong);
	}

	.error-msg {
		font-size: 0.82rem;
		color: #f08fb8;
	}

	.export-row {
		padding-top: var(--g-space-md);
		border-top: 1px solid var(--g-rule);
	}
</style>
