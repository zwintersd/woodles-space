<script lang="ts">
	import { connectAndHydrate, disconnect, flushSync, syncState } from './sync.svelte.js';

	/**
	 * The whole sync surface: a passphrase in, a status out.
	 *
	 * Deliberately small. Sync here is one person's shelf following them between
	 * their own devices — not collaboration, not accounts — and a panel that
	 * implied otherwise would be promising something the layer doesn't do.
	 */
	let open = $state(false);
	let passphrase = $state('');
	let busy = $state(false);

	const label = $derived(
		syncState.syncing
			? 'Syncing…'
			: syncState.status === 'error'
				? 'Sync problem'
				: syncState.connected
					? 'Synced'
					: 'Sync'
	);

	async function connect(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!passphrase.trim() || busy) return;
		busy = true;
		await connectAndHydrate(passphrase.trim());
		busy = false;
		passphrase = '';
		if (syncState.status !== 'error') open = false;
	}
</script>

<div class="sync">
	<button
		class="bf-button trigger"
		type="button"
		data-state={syncState.status}
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<span class="dot" data-state={syncState.connected ? syncState.status : 'off'}></span>
		{label}
	</button>

	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
		<div class="backdrop" onclick={() => (open = false)}></div>
		<div class="panel">
			{#if syncState.connected}
				<p class="head">Your shelf follows you</p>
				<p class="body">
					Every project syncs, not just the open one. Editing a different game on each device leaves you holding both.
				</p>
				{#if syncState.lastSyncedAt}
					<p class="when">Last synced {syncState.lastSyncedAt.toLocaleTimeString()}</p>
				{/if}
				{#if syncState.errorMessage}
					<p class="error">{syncState.errorMessage}</p>
				{/if}
				<div class="actions">
					<button class="bf-button bf-button--primary" type="button" disabled={syncState.syncing} onclick={() => flushSync()}>
						Sync now
					</button>
					<button class="bf-button" type="button" onclick={() => disconnect()}>Disconnect</button>
				</div>
			{:else}
				<p class="head">Sync your shelf</p>
				<p class="body">
					One passphrase, the same on each device. It never leaves this browser except as the key that unlocks your own
					data.
				</p>
				<form onsubmit={connect}>
					<label class="bf-label" for="bf-sync-pass">Passphrase</label>
					<input
						id="bf-sync-pass"
						class="bf-input"
						type="password"
						autocomplete="current-password"
						bind:value={passphrase}
						placeholder="••••••••"
					/>
					{#if syncState.errorMessage}
						<p class="error">{syncState.errorMessage}</p>
					{/if}
					<button class="bf-button bf-button--primary wide" type="submit" disabled={busy || !passphrase.trim()}>
						{busy ? 'Connecting…' : 'Connect'}
					</button>
				</form>
			{/if}
		</div>
	{/if}
</div>

<style>
	.sync {
		position: relative;
	}

	.trigger {
		gap: 7px;
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-faint);
	}

	.dot[data-state='ok'] {
		background: var(--bf-generator);
	}

	.dot[data-state='error'] {
		background: var(--bf-danger);
	}

	.dot[data-state='idle'] {
		background: var(--bf-currency);
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
	}

	.panel {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 21;
		width: 268px;
		margin-top: 6px;
		padding: 13px 14px;
		border: 1px solid var(--bf-rule);
		border-radius: var(--bf-radius);
		background: var(--bf-surface);
		box-shadow: var(--bf-shadow-lift);
		text-align: left;
	}

	.head {
		margin: 0 0 5px;
		font-size: 13px;
		font-weight: 650;
	}

	.body {
		margin: 0 0 11px;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--bf-muted);
	}

	.when {
		margin: 0 0 10px;
		font-size: 11px;
		color: var(--bf-faint);
	}

	.error {
		margin: 8px 0 0;
		padding: 7px 9px;
		border-radius: var(--bf-radius-sm);
		background: var(--bf-danger-soft);
		color: var(--bf-danger);
		font-size: 11px;
		line-height: 1.4;
	}

	form {
		display: grid;
		gap: 5px;
	}

	.actions {
		display: flex;
		gap: 6px;
	}

	.wide {
		margin-top: 4px;
		justify-content: center;
	}
</style>
