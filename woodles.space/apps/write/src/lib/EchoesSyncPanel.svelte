<script lang="ts">
	import { syncState, connectAndHydrate, disconnect } from './sync.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let pass = $state('');
	let connecting = $state(false);

	async function handleConnect() {
		if (!pass.trim()) return;
		connecting = true;
		await connectAndHydrate(pass.trim());
		connecting = false;
		pass = '';
	}
</script>

<div class="echoes-sync-panel" role="dialog" aria-label="publish to echoes">
	<div class="panel-head">
		<span class="panel-title">publish to echoes</span>
		<button class="close-btn" onclick={onclose} aria-label="close">×</button>
	</div>

	{#if syncState.connected}
		<div class="sync-status ok">
			<span class="dot"></span>
			connected — letters marked "public" push to woodles.space when you publish
		</div>
		<button class="btn-ghost muted" onclick={() => disconnect()}>disconnect</button>
	{:else}
		<p class="sync-hint">
			Enter your passphrase once to let a "public" letter actually reach the world when you
			publish it. Without it, publishing still saves the letter here, just not to the world.
		</p>
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
	.echoes-sync-panel {
		position: fixed;
		top: 52px;
		right: 1.6rem;
		z-index: 26;
		width: min(320px, calc(100vw - 3.2rem));
		background: var(--surface);
		backdrop-filter: blur(22px);
		-webkit-backdrop-filter: blur(22px);
		border: 1px solid var(--rule);
		border-radius: 10px;
		box-shadow: 0 14px 40px color-mix(in srgb, var(--bg) 70%, transparent);
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}
	.panel-title {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--accent-strong);
	}
	.close-btn {
		font-size: 1rem;
		line-height: 1;
		color: var(--muted);
		opacity: 0.6;
	}
	.close-btn:hover {
		opacity: 1;
		color: var(--accent-strong);
	}
	.sync-hint {
		font-family: var(--font-body);
		font-size: 0.8rem;
		line-height: 1.5;
		color: var(--muted);
	}
	.sync-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.72rem;
		line-height: 1.4;
		color: var(--muted);
	}
	.sync-status.ok .dot {
		flex-shrink: 0;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent-strong);
	}
	.pass-row {
		display: flex;
		gap: 0.5rem;
	}
	.pass-input {
		flex: 1;
		min-width: 0;
		background: color-mix(in srgb, var(--bg) 40%, transparent);
		border: 1px solid var(--rule);
		border-radius: 6px;
		padding: 0.4rem 0.6rem;
		color: var(--text);
		font-size: 0.85rem;
	}
	.btn-primary {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		color: var(--bg);
		background: var(--accent-strong);
		border-radius: 6px;
		padding: 0.4rem 0.75rem;
		transition: opacity 0.15s ease;
	}
	.btn-primary:disabled {
		opacity: 0.45;
	}
	.btn-ghost {
		align-self: flex-start;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: lowercase;
		color: var(--muted);
		border: 1px solid var(--rule);
		border-radius: 6px;
		padding: 0.35rem 0.65rem;
		transition: border-color 0.15s ease, color 0.15s ease;
	}
	.btn-ghost:hover {
		border-color: var(--accent);
		color: var(--accent-strong);
	}
	.error-msg {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.7rem;
		color: var(--accent-deep);
	}
</style>
