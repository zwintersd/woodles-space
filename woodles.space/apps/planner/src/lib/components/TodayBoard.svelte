<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { getCurrentBlock, minutesRemaining } from '$lib/templates';
	import { minutesToDisplay, dayOfWeekLabel, shortDateLabel, nowMinutes, timeToMinutes } from '$lib/utils';

	let dayShape = $derived(store.getDayShape(store.now));
	let blocks = $derived(store.getBlocksForDate(store.now));
	let currentBlock = $derived(getCurrentBlock(blocks, store.now));

	function isPast(blockId: string): boolean {
		const block = blocks.find((b) => b.id === blockId);
		if (!block) return false;
		return timeToMinutes(block.endTime) <= nowMinutes(store.now);
	}

	const dayShapeLabel = $derived(dayShape?.name ?? 'no shape');
</script>

<div class="today-board">
	<header class="tb-header">
		<a href="/" class="tb-home" title="back to woodles.space">·space</a>
		<div class="tb-header-center">
			<span class="tb-heading">TODAY</span>
			<span class="tb-date">{dayOfWeekLabel(store.now)}, {shortDateLabel(store.now)}</span>
		</div>
		<button class="tb-daytype" onclick={() => store.cycleDayShape(store.now)} title="cycle day shape">
			{dayShapeLabel}
		</button>
	</header>

	<div class="tb-timeline">
		{#each blocks as block (block.id)}
			{@const past = isPast(block.id)}
			{@const current = currentBlock?.id === block.id}

			<div class="tb-block" class:past class:current>
				<div class="tb-time-col">
					<span class="tb-time">{block.startTime}</span>
					{#if current}
						<div class="tb-current-dot" aria-label="current block"></div>
					{/if}
				</div>

				<div class="tb-block-content">
					<div class="tb-block-header">
						<span class="tb-block-name">{block.title}</span>
						{#if current}
							<span class="tb-block-remaining">
								{minutesToDisplay(minutesRemaining(block, store.now))}
							</span>
						{/if}
					</div>

					{#if current}
						<p class="tb-block-note">current</p>
					{:else if past}
						<p class="tb-block-note">passed</p>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.today-board {
		max-width: 660px;
		margin: 0 auto;
		padding: 0 clamp(1.25rem, 5vw, 2.5rem) var(--pl-space-xl);
	}

	.tb-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.1rem 0 1.5rem;
		gap: 1rem;
	}

	.tb-home {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.16em;
		color: var(--p-muted);
		text-decoration: none;
		opacity: 0.6;
		transition: opacity var(--pl-transition-fast);
	}

	.tb-home:hover {
		opacity: 1;
	}

	.tb-header-center {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}

	.tb-heading {
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.26em;
		text-transform: uppercase;
		color: var(--p-accent);
		opacity: 0.8;
	}

	.tb-date {
		font-family: var(--pl-font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		color: var(--p-muted);
	}

	.tb-daytype {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.13em;
		text-transform: lowercase;
		color: var(--p-muted);
		border: 1px solid var(--p-border);
		padding: 4px 10px;
		border-radius: var(--pl-radius-pill);
		opacity: 0.7;
		transition: opacity var(--pl-transition-fast), border-color var(--pl-transition-fast), color var(--pl-transition-fast);
	}

	.tb-daytype:hover {
		opacity: 1;
		border-color: var(--p-accent);
		color: var(--p-accent);
	}

	.tb-timeline {
		display: flex;
		flex-direction: column;
	}

	.tb-block {
		display: flex;
		gap: 1.25rem;
		padding: 0.75rem 0;
		border-top: 1px solid var(--p-border);
		transition: opacity var(--pl-transition-fast);
	}

	.tb-block.past {
		opacity: 0.45;
	}

	.tb-block.current {
		opacity: 1;
	}

	.tb-time-col {
		flex-shrink: 0;
		width: 3.5rem;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.35rem;
		padding-top: 0.2rem;
	}

	.tb-time {
		font-family: var(--pl-font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		color: var(--p-muted);
	}

	.tb-block.current .tb-time {
		color: var(--p-accent);
	}

	.tb-current-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--p-accent);
		animation: dot-pulse 2s ease-in-out infinite;
	}

	@keyframes dot-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.tb-block-content {
		flex: 1;
		min-width: 0;
		padding-bottom: 0.25rem;
	}

	.tb-block-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.35rem;
	}

	.tb-block-name {
		font-family: var(--pl-font-display);
		font-size: 1.3rem;
		font-weight: 400;
		color: var(--p-text);
		letter-spacing: -0.01em;
		line-height: 1.2;
	}

	.tb-block.past .tb-block-name {
		color: var(--p-muted);
	}

	.tb-block-remaining {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		color: var(--p-accent);
		flex-shrink: 0;
	}

	.tb-block-note {
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.5;
	}
</style>
