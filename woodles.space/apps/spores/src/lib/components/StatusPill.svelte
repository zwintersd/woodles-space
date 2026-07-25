<script lang="ts">
	import { garden } from '$lib/garden.svelte';
	import { SPORE_STATUSES, type Spore, type SporeStatus } from '$lib/types';

	// How far along an entry is. The Textbook's rule, kept: a seed is a
	// legitimate finished state, not a nag — so this never shows a completion
	// bar, never counts what's unfinished, and clicking only ever moves forward.
	// Going back is possible but deliberately tucked into the menu.

	let { spore }: { spore: Spore } = $props();

	const LABEL: Record<SporeStatus, string> = {
		seed: 'Seed',
		growing: 'Growing',
		grown: 'Grown'
	};

	let status = $derived(garden.statusOf(spore));
	let open = $state(false);

	function advance() {
		if (status === 'grown') {
			open = !open;
			return;
		}
		garden.advanceStatus(spore.id);
	}

	function set(next: SporeStatus) {
		garden.setStatus(spore.id, next);
		open = false;
	}
</script>

<div class="status-wrap">
	<button
		class="status-pill"
		data-status={status}
		onclick={advance}
		oncontextmenu={(e) => {
			e.preventDefault();
			open = !open;
		}}
		title={status === 'grown'
			? 'Grown. Click to change it back.'
			: `${LABEL[status]} — click when it has moved on`}
	>
		<span class="dot"></span>
		{LABEL[status]}
	</button>

	{#if open}
		<div class="status-menu">
			{#each SPORE_STATUSES as option}
				<button class="status-option" data-status={option} onclick={() => set(option)}>
					<span class="dot"></span>
					{LABEL[option]}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.status-wrap {
		position: relative;
		display: inline-block;
	}

	.status-pill,
	.status-option {
		display: inline-flex;
		align-items: center;
		gap: var(--g-space-xs);
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		color: var(--g-text-dim);
		background: var(--g-surface);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-pill);
		padding: 0.28rem 0.7rem;
		cursor: pointer;
		transition: border-color var(--g-transition-fast);
	}

	.status-pill:hover,
	.status-option:hover {
		border-color: var(--g-border-strong);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: none;
	}

	[data-status='seed'] .dot {
		background: var(--g-muted);
	}

	[data-status='growing'] .dot {
		background: var(--g-flight-active);
	}

	[data-status='grown'] .dot {
		background: var(--g-flight);
	}

	.status-menu {
		position: absolute;
		left: 0;
		top: calc(100% + 6px);
		z-index: var(--g-z-panel);
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 4px;
		background: var(--g-surface);
		border: 1px solid var(--g-border-strong);
		border-radius: var(--g-radius-md);
		box-shadow: var(--g-shadow-card);
	}

	.status-option {
		border-color: transparent;
		white-space: nowrap;
	}
</style>
