<script lang="ts">
	import type { SimEventKind } from '@woodles/incremental-core';
	import { formatDuration, playtest } from '../playtest.svelte.js';

	const KINDS: { value: SimEventKind | 'all'; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'levelUp', label: 'Levels' },
		{ value: 'purchase', label: 'Purchases' },
		{ value: 'unlock', label: 'Unlocks' },
		{ value: 'milestone', label: 'Milestones' },
		{ value: 'prestige', label: 'Prestige' }
	];

	let filter = $state<SimEventKind | 'all'>('all');

	const entries = $derived(filter === 'all' ? playtest.log : playtest.log.filter((event) => event.kind === filter));
</script>

<div class="log">
	<div class="head">
		<h3>Recent Log</h3>
		<div class="filters" role="group" aria-label="Filter log">
			{#each KINDS as kind (kind.value)}
				<button class="chip" type="button" aria-pressed={filter === kind.value} onclick={() => (filter = kind.value)}>
					{kind.label}
				</button>
			{/each}
		</div>
		<button class="bf-button tiny" type="button" onclick={() => (playtest.log = [])}>Clear</button>
	</div>

	{#if entries.length}
		<ol>
			{#each entries as event, index (`${event.t}-${event.id}-${index}`)}
				<li data-kind={event.kind}>
					<time>[{formatDuration(event.t)}]</time>
					<span>{event.message}</span>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="empty">
			{playtest.log.length ? 'Nothing of that kind yet.' : 'Run a playtest to see purchases, unlocks and milestones here.'}
		</p>
	{/if}
</div>

<style>
	.log {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		flex-wrap: wrap;
	}

	h3 {
		margin: 0;
		font-size: 12px;
		font-weight: 650;
		color: var(--bf-ink-soft);
	}

	.filters {
		display: flex;
		gap: 2px;
		padding: 2px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-surface-sunk);
	}

	.chip {
		padding: 3px 9px;
		border: 0;
		border-radius: var(--bf-radius-pill);
		background: none;
		color: var(--bf-muted);
		font-size: 11px;
		cursor: pointer;
	}

	.chip[aria-pressed='true'] {
		background: var(--bf-surface);
		color: var(--bf-accent-strong);
		font-weight: 650;
		box-shadow: var(--bf-shadow-soft);
	}

	.tiny {
		margin-left: auto;
		padding: 3px 10px;
		font-size: 11px;
	}

	ol {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 1px;
		align-content: start;
	}

	li {
		display: flex;
		gap: 9px;
		padding: 4px 8px;
		border-radius: var(--bf-radius-sm);
		font-size: 11.5px;
		line-height: 1.4;
		color: var(--bf-ink-soft);
	}

	li:nth-child(odd) {
		background: var(--bf-surface-sunk);
	}

	time {
		flex: none;
		color: var(--bf-faint);
		font-family: var(--bf-font-mono);
		font-size: 10.5px;
	}

	/* Colour-coded per the mockup, so a scan finds the shape of the run. */
	li[data-kind='levelUp'] span {
		color: var(--bf-generator);
	}
	li[data-kind='purchase'] span {
		color: var(--bf-upgrade);
	}
	li[data-kind='unlock'] span {
		color: var(--bf-unlock);
	}
	li[data-kind='milestone'] span {
		color: var(--bf-milestone);
		font-weight: 600;
	}
	li[data-kind='prestige'] span {
		color: var(--bf-prestige);
		font-weight: 600;
	}

	.empty {
		margin: 0;
		padding: 14px 4px;
		font-size: 12px;
		color: var(--bf-faint);
	}
</style>
