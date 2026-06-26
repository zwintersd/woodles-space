<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { EMPTY_STATES, BINDER_LABELS } from '$lib/onboarding.copy';
	import YearScroll from './YearScroll.svelte';
	import { syncState, connectAndHydrate, flushSync, disconnect } from '$lib/sync.svelte';

	type BinderTabId =
		| 'year-scroll'
		| 'holidays'
		| 'shapes'
		| 'week-pattern'
		| 'sync';

	const TABS: { id: BinderTabId; icon: string; label: string }[] = [
		{ id: 'shapes',       icon: '◐', label: BINDER_LABELS.shapes },
		{ id: 'week-pattern', icon: '◇', label: BINDER_LABELS.weekPattern },
		{ id: 'year-scroll',  icon: '∞', label: 'year' },
		{ id: 'holidays',     icon: '✦', label: 'holidays' },
		{ id: 'sync',         icon: '◎', label: 'sync' }
	];

	let passphraseInput = $state('');

	async function handleConnect() {
		const pass = passphraseInput.trim();
		if (!pass) return;
		passphraseInput = '';
		await connectAndHydrate(pass);
	}

	const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
	const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
</script>

{#if store.binderTab !== null}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="binder-backdrop" onclick={() => store.closeBinder()}></div>
{/if}

<div class="binder-tabs" role="tablist" aria-label="binder">
	{#each TABS as tab}
		<button
			class="binder-tab"
			class:active={store.binderTab === tab.id}
			role="tab"
			aria-selected={store.binderTab === tab.id}
			onclick={() => store.toggleBinder(tab.id)}
			title={tab.label}
			aria-label={tab.label}
		>
			<span class="binder-tab-icon">{tab.icon}</span>
		</button>
	{/each}
</div>

<aside
	class="binder-panel"
	class:open={store.binderTab !== null}
	aria-hidden={store.binderTab === null}
>
	{#if store.binderTab === 'year-scroll'}
		<div class="binder-year-scroll">
			<YearScroll compact />
		</div>

	{:else if store.binderTab === 'holidays'}
		<header class="binder-header">
			<span class="binder-eyebrow">binder</span>
			<span class="binder-title">holidays</span>
		</header>
		<div class="binder-body">
			<p class="binder-empty">holiday layer — coming soon.</p>
		</div>

	{:else if store.binderTab === 'shapes'}
		<header class="binder-header">
			<span class="binder-eyebrow">binder</span>
			<span class="binder-title">{BINDER_LABELS.shapes}</span>
		</header>
		<div class="binder-body">
			{#if store.dayShapes.length === 0}
				<div class="binder-empty-block">
					<p class="binder-empty-heading">{EMPTY_STATES.shapes.heading}</p>
					<p class="binder-empty-body">{EMPTY_STATES.shapes.body}</p>
				</div>
			{:else}
				{#each store.dayShapes as shape (shape.id)}
					<div class="shape-row">
						<span class="shape-row-name">{shape.name}</span>
						<span class="shape-row-meta">
							{shape.blocks.length} block{shape.blocks.length === 1 ? '' : 's'}
							{#if shape.restful}<span class="shape-restful">· restful</span>{/if}
						</span>
					</div>
				{/each}
			{/if}
		</div>

	{:else if store.binderTab === 'week-pattern'}
		<header class="binder-header">
			<span class="binder-eyebrow">binder</span>
			<span class="binder-title">{BINDER_LABELS.weekPattern}</span>
		</header>
		<div class="binder-body">
			{#if store.dayShapes.length === 0}
				<div class="binder-empty-block">
					<p class="binder-empty-heading">{EMPTY_STATES.weekPattern.heading}</p>
					<p class="binder-empty-body">{EMPTY_STATES.weekPattern.body}</p>
				</div>
			{:else}
				{#each WEEKDAY_ORDER as dow, i}
					{@const shapeId = store.weekPattern.days[dow]}
					{@const shape = store.dayShapes.find((s) => s.id === shapeId)}
					<div class="pattern-row">
						<span class="pattern-dow">{WEEKDAY_LABELS[i]}</span>
						<span class="pattern-shape">{shape?.name ?? '—'}</span>
						{#if shape?.restful}<span class="pattern-restful">restful</span>{/if}
					</div>
				{/each}
			{/if}
		</div>

	{:else if store.binderTab === 'sync'}
		<header class="binder-header">
			<span class="binder-eyebrow">binder</span>
			<span class="binder-title">sync</span>
		</header>
		<div class="binder-body">
			{#if !syncState.connected}
				<div class="sync-section">
					<label class="sync-label" for="sync-pass">passphrase</label>
					<div class="sync-row">
						<input
							id="sync-pass"
							type="password"
							class="sync-input"
							bind:value={passphraseInput}
							placeholder="·····"
							onkeydown={(e) => { if (e.key === 'Enter') handleConnect(); }}
						/>
						<button class="sync-btn-primary" onclick={handleConnect}>connect</button>
					</div>
					{#if syncState.errorMessage}
						<p class="sync-error">{syncState.errorMessage}</p>
					{/if}
				</div>
			{:else}
				<div class="sync-status-row">
					{#if syncState.syncing}
						<span class="sync-dot syncing">○</span>
						<span class="sync-status-text">syncing…</span>
					{:else if syncState.status === 'ok'}
						<span class="sync-dot ok">✓</span>
						<span class="sync-status-text">synced</span>
					{:else if syncState.status === 'error'}
						<span class="sync-dot error">✗</span>
						<span class="sync-status-text sync-status-error">{syncState.errorMessage}</span>
					{:else}
						<span class="sync-dot">○</span>
						<span class="sync-status-text">ready</span>
					{/if}
				</div>
				{#if syncState.lastSyncedAt}
					<p class="sync-last">last synced {syncState.lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
				{/if}
				<div class="sync-actions">
					<button class="sync-btn-primary" onclick={() => flushSync()} disabled={syncState.syncing}>
						sync now
					</button>
					<button class="sync-btn-ghost" onclick={() => disconnect()}>disconnect</button>
				</div>
			{/if}
		</div>
	{/if}
</aside>

<style>
	.binder-backdrop {
		position: fixed;
		inset: 0;
		z-index: calc(var(--pl-z-binder) - 1);
	}

	.binder-tabs {
		position: fixed;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		z-index: var(--pl-z-binder);
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--p-surface);
		border: 1px solid var(--p-border);
		border-right: none;
		border-radius: var(--pl-radius-md) 0 0 var(--pl-radius-md);
		padding: 6px 0;
		box-shadow: -2px 0 12px var(--p-accent-soft);
		transition: var(--pl-transition-palette);
	}

	.binder-tab {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--pl-radius-sm);
		margin: 0 4px;
		transition: background var(--pl-transition-fast), color var(--pl-transition-fast);
		opacity: 0.5;
	}

	.binder-tab:hover {
		opacity: 0.9;
		background: var(--p-accent-soft);
	}

	.binder-tab.active {
		opacity: 1;
		background: var(--p-accent-soft);
	}

	.binder-tab-icon {
		font-size: 0.85rem;
		color: var(--p-text);
	}

	.binder-panel {
		position: fixed;
		top: 0;
		right: 44px;
		bottom: 0;
		width: 300px;
		background: var(--p-surface);
		border-left: 1px solid var(--p-border);
		z-index: var(--pl-z-binder);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		transform: translateX(110%);
		transition: transform var(--pl-transition-medium), var(--pl-transition-palette);
		box-shadow: -4px 0 24px var(--p-accent-soft);
	}

	.binder-panel.open {
		transform: translateX(0);
	}

	.binder-header {
		padding: 1.25rem 1.25rem 0.75rem;
		border-bottom: 1px solid var(--p-border);
		flex-shrink: 0;
	}

	.binder-eyebrow {
		display: block;
		font-family: var(--pl-font-mono);
		font-size: 0.52rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.5;
		margin-bottom: 0.2rem;
	}

	.binder-title {
		font-family: var(--pl-font-display);
		font-size: 1.4rem;
		font-weight: 400;
		color: var(--p-text);
		letter-spacing: -0.01em;
	}

	.binder-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.binder-empty {
		font-family: var(--pl-font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		color: var(--p-muted);
		opacity: 0.5;
		padding: 1rem 0;
	}

	.binder-year-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 0 0.75rem;
	}

	/* ── empty states ─────────────────────────────────────────────── */
	.binder-empty-block {
		padding: 1.2rem 0.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.binder-empty-heading {
		font-family: var(--pl-font-optical);
		font-style: italic;
		font-weight: 400;
		font-size: 1rem;
		color: var(--p-text);
		font-variation-settings: 'opsz' 36;
	}

	.binder-empty-body {
		font-family: var(--pl-font-body);
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--p-muted);
		font-style: italic;
		opacity: 0.85;
	}

	/* ── shape rows ───────────────────────────────────────────────── */
	.shape-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.55rem 0;
		border-bottom: 1px solid var(--p-border);
	}

	.shape-row-name {
		font-family: var(--pl-font-optical);
		font-style: italic;
		font-size: 0.95rem;
		color: var(--p-text);
		font-variation-settings: 'opsz' 36;
	}

	.shape-row-meta {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		color: var(--p-muted);
		opacity: 0.7;
	}

	.shape-restful {
		opacity: 0.6;
	}

	/* ── week-pattern rows ────────────────────────────────────────── */
	.pattern-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.7rem;
		align-items: baseline;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--p-border);
	}

	.pattern-dow {
		font-family: var(--pl-font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--p-muted);
	}

	.pattern-shape {
		font-family: var(--pl-font-body);
		font-size: 0.88rem;
		font-style: italic;
		color: var(--p-text);
	}

	.pattern-restful {
		font-family: var(--pl-font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.55;
	}

	/* ── sync tab ─────────────────────────────────────────────────── */
	.sync-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem 0;
	}

	.sync-label {
		font-family: var(--pl-font-mono);
		font-size: 0.48rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.55;
	}

	.sync-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.sync-input {
		flex: 1;
		font-family: var(--pl-font-mono);
		font-size: 0.7rem;
		color: var(--p-text);
		background: var(--p-bg);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-sm);
		padding: 5px 8px;
		transition: border-color var(--pl-transition-fast);
	}

	.sync-input:focus {
		border-color: var(--p-accent);
		outline: none;
	}

	.sync-btn-primary {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		color: var(--p-muted);
		border: 1px solid var(--p-border);
		padding: 5px 12px;
		border-radius: var(--pl-radius-pill);
		white-space: nowrap;
		transition: opacity var(--pl-transition-fast), color var(--pl-transition-fast), border-color var(--pl-transition-fast);
	}

	.sync-btn-primary:hover:not(:disabled) {
		color: var(--p-accent);
		border-color: var(--p-accent);
	}

	.sync-btn-primary:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.sync-error {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		color: var(--p-accent);
		opacity: 0.85;
	}

	.sync-status-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0 0.25rem;
	}

	.sync-dot {
		font-size: 0.75rem;
		color: var(--p-muted);
		opacity: 0.6;
	}

	.sync-dot.ok { color: var(--p-accent); opacity: 1; }
	.sync-dot.error { color: var(--p-accent); opacity: 0.85; }
	.sync-dot.syncing { opacity: 0.5; }

	.sync-status-text {
		font-family: var(--pl-font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		color: var(--p-text);
	}

	.sync-status-error {
		color: var(--p-accent);
		opacity: 0.85;
	}

	.sync-last {
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		color: var(--p-muted);
		opacity: 0.55;
		padding-bottom: 0.75rem;
	}

	.sync-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-top: 0.25rem;
	}

	.sync-btn-ghost {
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		color: var(--p-muted);
		opacity: 0.45;
		transition: opacity var(--pl-transition-fast);
	}

	.sync-btn-ghost:hover {
		opacity: 0.9;
	}

	@media (max-width: 620px) {
		.binder-tabs {
			top: auto;
			right: 0.75rem;
			bottom: 4.15rem;
			transform: none;
			flex-direction: row;
			max-width: calc(100vw - 5.4rem);
			overflow-x: auto;
			border: 1px solid var(--p-border);
			border-radius: var(--pl-radius-md);
			padding: 4px;
		}

		.binder-tab {
			width: 32px;
			height: 32px;
			margin: 0;
			flex: 0 0 auto;
		}

		.binder-panel {
			right: 0;
			width: min(320px, calc(100vw - 1rem));
		}
	}
</style>
