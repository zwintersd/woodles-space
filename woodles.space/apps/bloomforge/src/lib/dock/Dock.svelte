<script lang="ts">
	import { playtest } from '../playtest.svelte.js';
	import BalanceTab from './BalanceTab.svelte';
	import LogTab from './LogTab.svelte';
	import NotesTab from './NotesTab.svelte';
	import PlaytestTab from './PlaytestTab.svelte';

	type TabId = 'playtest' | 'balance' | 'notes' | 'log';

	const TABS: { id: TabId; label: string; icon: string }[] = [
		{ id: 'playtest', label: 'Playtest', icon: '🌸' },
		{ id: 'balance', label: 'Balance', icon: '⚖️' },
		{ id: 'notes', label: 'Notes', icon: '📋' },
		{ id: 'log', label: 'Log', icon: '📜' }
	];

	interface Props {
		collapsed: boolean;
		ontoggle: () => void;
	}

	let { collapsed, ontoggle }: Props = $props();
	let active = $state<TabId>('playtest');
</script>

<section class="dock" class:collapsed>
	<div class="tabs" role="tablist" aria-label="Studio panels">
		{#each TABS as tab (tab.id)}
			<button
				role="tab"
				type="button"
				id="bf-tab-{tab.id}"
				aria-selected={active === tab.id}
				aria-controls="bf-panel-{tab.id}"
				tabindex={active === tab.id ? 0 : -1}
				onclick={() => {
					active = tab.id;
					if (collapsed) ontoggle();
				}}
			>
				<span aria-hidden="true">{tab.icon}</span>
				{tab.label}
				{#if tab.id === 'log' && playtest.log.length}
					<span class="count">{playtest.log.length}</span>
				{/if}
			</button>
		{/each}

		<button class="collapse" type="button" onclick={ontoggle} aria-expanded={!collapsed}>
			{collapsed ? '▲ Expand' : '▼ Collapse'}
		</button>
	</div>

	{#if !collapsed}
		<div
			class="panel"
			role="tabpanel"
			id="bf-panel-{active}"
			aria-labelledby="bf-tab-{active}"
			tabindex="-1"
		>
			{#if active === 'playtest'}
				<PlaytestTab />
			{:else if active === 'balance'}
				<BalanceTab />
			{:else if active === 'notes'}
				<NotesTab />
			{:else}
				<LogTab />
			{/if}
		</div>
	{/if}
</section>

<style>
	.dock {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-top: 1px solid var(--bf-rule);
		background: var(--bf-surface);
	}

	.tabs {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 6px 12px 0;
		border-bottom: 1px solid var(--bf-rule);
	}

	[role='tab'] {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 13px;
		border: 1px solid transparent;
		border-bottom: 0;
		border-radius: var(--bf-radius-sm) var(--bf-radius-sm) 0 0;
		background: none;
		color: var(--bf-muted);
		font-size: 12px;
		cursor: pointer;
		position: relative;
		top: 1px;
	}

	[role='tab']:hover {
		color: var(--bf-ink-soft);
	}

	[role='tab'][aria-selected='true'] {
		background: var(--bf-surface);
		border-color: var(--bf-rule);
		color: var(--bf-accent-strong);
		font-weight: 650;
	}

	.count {
		padding: 0 6px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-accent-soft);
		color: var(--bf-accent);
		font-size: 10px;
		font-weight: 700;
	}

	.collapse {
		margin-left: auto;
		margin-bottom: 5px;
		padding: 4px 10px;
		border: 1px solid var(--bf-rule-strong);
		border-radius: var(--bf-radius-pill);
		background: var(--bf-surface);
		color: var(--bf-muted);
		font-size: 11px;
		cursor: pointer;
	}

	.collapse:hover {
		background: var(--bf-accent-soft);
		color: var(--bf-accent-strong);
	}

	.panel {
		flex: 1;
		min-height: 0;
		padding: 14px 16px;
		overflow: hidden;
	}

	.panel:focus {
		outline: none;
	}
</style>
