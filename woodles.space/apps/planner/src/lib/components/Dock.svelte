<script lang="ts">
	import { store } from '$lib/store.svelte';
	import type { View } from '$lib/types';

	const VIEWS: { id: View; label: string; key: string }[] = [
		{ id: 'now-next', label: 'now',   key: '1' },
		{ id: 'today',    label: 'today', key: '2' },
		{ id: 'week',     label: 'week',  key: '3' },
		{ id: 'month',    label: 'month', key: '4' },
		{ id: 'year',     label: 'year',  key: '5' }
	];
</script>

<nav class="dock" aria-label="view navigation">
	{#each VIEWS as view}
		<button
			class="dock-btn"
			class:active={store.currentView === view.id}
			onclick={() => store.setView(view.id)}
			title="{view.label} [{view.key}]"
			aria-label={view.label}
			aria-current={store.currentView === view.id ? 'page' : undefined}
		>
			<span class="dock-label">{view.label}</span>
			<span class="dock-key">{view.key}</span>
		</button>
	{/each}
</nav>

<style>
	.dock {
		position: fixed;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--pl-z-dock);
		display: flex;
		align-items: center;
		gap: 2px;
		background: var(--p-surface);
		border: 1px solid var(--p-border);
		border-bottom: none;
		border-radius: var(--pl-radius-md) var(--pl-radius-md) 0 0;
		padding: 7px 11px 9px;
		box-shadow: 0 -2px 16px var(--p-accent-soft);
		transition: var(--pl-transition-palette);
	}

	.dock-btn {
		display: flex;
		align-items: baseline;
		gap: 0.3em;
		padding: 5px 12px;
		border-radius: var(--pl-radius-sm);
		font-family: var(--pl-font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: lowercase;
		color: var(--p-muted);
		opacity: 0.72;
		transition: opacity var(--pl-transition-fast), background var(--pl-transition-fast), color var(--pl-transition-fast);
	}

	.dock-btn:hover {
		opacity: 0.9;
		background: var(--p-accent-soft);
	}

	.dock-btn.active {
		opacity: 1;
		color: var(--p-text);
		background: var(--p-accent-soft);
	}

	.dock-key {
		font-size: 0.48rem;
		opacity: 0.45;
		letter-spacing: 0.06em;
	}

	.dock-btn.active .dock-key {
		opacity: 0.6;
	}
</style>
