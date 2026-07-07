<script lang="ts">
	import { syncState, connectAndHydrate, disconnect, flushSync } from '$lib/sync.svelte';

	let pass = $state('');
	let connecting = $state(false);

	async function handleConnect(): Promise<void> {
		if (!pass.trim()) return;
		connecting = true;
		await connectAndHydrate(pass.trim());
		connecting = false;
		pass = '';
	}
</script>

<div class="sync-panel">
	<h3 class="panel-title">sync</h3>

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
	{:else}
		<p class="sync-hint">enter your passphrase to keep this board synced across devices.</p>
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
	{/if}

	{#if syncState.errorMessage}
		<p class="error-msg">{syncState.errorMessage}</p>
	{/if}
</div>

<style>
	.sync-panel {
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		min-width: 15rem;
	}

	.panel-title {
		font-family: var(--ta-font-sans);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ta-muted);
		font-weight: 600;
	}

	.sync-status {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--ta-font-sans);
		font-size: 0.8rem;
		color: var(--ta-text-dim);
	}

	.sync-status.ok .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #1e8e3e;
		flex-shrink: 0;
	}

	.sync-hint {
		font-family: var(--ta-font-sans);
		font-size: 0.8rem;
		color: var(--ta-muted);
	}

	.pass-row {
		display: flex;
		gap: 0.4rem;
	}

	.pass-input {
		flex: 1;
		background: var(--ta-bg-subtle);
		border: 1px solid var(--ta-border);
		border-radius: var(--ta-radius-sm);
		padding: 0.4rem 0.6rem;
		font-size: 0.85rem;
		transition: border-color var(--ta-transition-fast), box-shadow var(--ta-transition-fast);
	}

	.pass-input:focus-visible {
		border-color: var(--ta-accent);
		box-shadow: 0 0 0 3px var(--ta-accent-soft);
		outline: none;
	}

	.sync-actions {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.btn-primary {
		background: var(--ta-accent);
		color: #fff;
		border-radius: var(--ta-radius-sm);
		padding: 0.4rem 0.7rem;
		font-size: 0.8rem;
		font-weight: 600;
		transition: opacity var(--ta-transition-fast), transform var(--ta-transition-spring);
	}

	.btn-primary:disabled {
		opacity: 0.5;
	}

	.btn-primary:not(:disabled):hover {
		transform: var(--ta-lift-hover);
	}

	.btn-primary:not(:disabled):active {
		transform: var(--ta-lift-press);
	}

	.btn-ghost {
		border: 1px solid var(--ta-border);
		border-radius: var(--ta-radius-sm);
		padding: 0.35rem 0.65rem;
		font-size: 0.78rem;
		color: var(--ta-text-dim);
		transition: border-color var(--ta-transition-fast), color var(--ta-transition-fast),
			transform var(--ta-transition-spring);
	}

	.btn-ghost:hover {
		border-color: var(--ta-accent);
		color: var(--ta-accent);
		transform: var(--ta-lift-hover);
	}

	.btn-ghost:active {
		transform: var(--ta-lift-press);
	}

	.btn-ghost.muted {
		color: var(--ta-muted);
	}

	.error-msg {
		font-family: var(--ta-font-sans);
		font-size: 0.76rem;
		color: var(--ta-danger);
	}
</style>
