<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { dayOfWeekLabel, shortDateLabel } from '$lib/utils';

	const dateStr = $derived(store.activeDayKey);

	const date = $derived.by(() => {
		if (!dateStr) return null;
		const [y, m, d] = dateStr.split('-').map(Number);
		return new Date(y, m - 1, d);
	});

	const dayShape = $derived(date ? store.getDayShape(date) : null);
	const blocks = $derived(date ? store.getBlocksForDate(date) : []);
	const dayShapeLabel = $derived(dayShape?.name ?? 'no shape');

	function close() {
		store.closeDayPanel();
	}

	function cycleShape() {
		if (!date) return;
		store.cycleDayShape(date);
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && store.activeDayKey != null) close();
	}}
/>

{#if store.activeDayKey != null}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="dp-backdrop" onclick={close}></div>
{/if}

<div class="dp-sheet" class:open={store.activeDayKey != null}>
	{#if date}
		<div class="dp-handle"></div>

		<header class="dp-header">
			<div class="dp-header-left">
				<span class="dp-dow">{dayOfWeekLabel(date)}</span>
				<span class="dp-date">{shortDateLabel(date)}</span>
			</div>
			<div class="dp-header-right">
				<button class="dp-daytype" onclick={cycleShape}>{dayShapeLabel}</button>
				<button class="dp-close" onclick={close} aria-label="close">×</button>
			</div>
		</header>

		<div class="dp-body">
			{#if blocks.length === 0}
				<p class="dp-empty">no blocks.</p>
			{:else}
				{#each blocks as block (block.id)}
					<div class="dp-block" class:overlay={block.overlay != null}>
						<span class="dp-block-time">{block.startTime} — {block.endTime}</span>
						<span class="dp-block-title">{block.title}</span>
						{#if block.overlay}
							<span class="dp-block-kind">{block.overlay}</span>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.dp-backdrop {
		position: fixed;
		inset: 0;
		z-index: calc(var(--pl-z-panel) - 1);
		background: rgba(0, 0, 0, 0.12);
	}

	.dp-sheet {
		position: fixed;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%) translateY(100%);
		width: min(100vw, 500px);
		background: var(--p-surface);
		border-radius: 20px 20px 0 0;
		border: 1px solid var(--p-border);
		border-bottom: none;
		z-index: var(--pl-z-panel);
		transition: transform var(--pl-transition-medium);
		box-shadow: 0 -8px 32px var(--p-accent-soft);
		max-height: 70vh;
		display: flex;
		flex-direction: column;
	}

	.dp-sheet.open {
		transform: translateX(-50%) translateY(0);
	}

	.dp-handle {
		width: 32px;
		height: 3px;
		background: var(--p-border);
		border-radius: 100px;
		margin: 10px auto 0;
		flex-shrink: 0;
	}

	.dp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem 1.25rem 0.5rem;
		border-bottom: 1px solid var(--p-border);
		flex-shrink: 0;
	}

	.dp-header-left {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.dp-dow {
		font-family: var(--pl-font-display);
		font-size: 1.35rem;
		font-weight: 400;
		color: var(--p-text);
		letter-spacing: -0.01em;
	}

	.dp-date {
		font-family: var(--pl-font-mono);
		font-size: 0.62rem;
		color: var(--p-muted);
		letter-spacing: 0.06em;
	}

	.dp-header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dp-daytype {
		font-family: var(--pl-font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		color: var(--p-muted);
		border: 1px solid var(--p-border);
		padding: 3px 8px;
		border-radius: var(--pl-radius-pill);
		opacity: 0.7;
		transition: opacity var(--pl-transition-fast), color var(--pl-transition-fast),
			border-color var(--pl-transition-fast);
	}

	.dp-daytype:hover {
		opacity: 1;
		color: var(--p-accent);
		border-color: var(--p-accent);
	}

	.dp-close {
		font-family: var(--pl-font-mono);
		font-size: 1rem;
		color: var(--p-muted);
		opacity: 0.45;
		padding: 0 4px;
		line-height: 1;
		transition: opacity var(--pl-transition-fast);
	}

	.dp-close:hover {
		opacity: 1;
	}

	.dp-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.6rem 1.25rem 0.25rem;
	}

	.dp-empty {
		font-family: var(--pl-font-mono);
		font-size: 0.72rem;
		color: var(--p-muted);
		opacity: 0.45;
		padding: 0.5rem 0;
		letter-spacing: 0.04em;
	}

	.dp-block {
		display: grid;
		grid-template-columns: 6.8rem 1fr auto;
		align-items: baseline;
		gap: 0.7rem;
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--p-border);
	}

	.dp-block-time,
	.dp-block-kind {
		font-family: var(--pl-font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.62;
	}

	.dp-block-title {
		font-family: var(--pl-font-display);
		font-size: 1.08rem;
		line-height: 1.25;
		color: var(--p-text);
	}

	.dp-block.overlay .dp-block-title {
		font-style: italic;
	}
</style>
