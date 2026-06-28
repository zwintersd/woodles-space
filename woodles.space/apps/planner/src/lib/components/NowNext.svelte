<script lang="ts">
	import { store } from '$lib/store.svelte';
	import {
		getCurrentBlock,
		getNextBlock,
		minutesRemaining,
		minutesUntilBlock
	} from '$lib/templates';
	import { minutesToDisplay, dayOfWeekLabel, shortDateLabel, formatTime, timeToMinutes } from '$lib/utils';
	import { getDailyFlourish, shouldShowFlourish } from '$lib/voice';

	let dayShape = $derived(store.getDayShape(store.now));
	let blocks = $derived(store.getBlocksForDate(store.now));
	let currentBlock = $derived(getCurrentBlock(blocks, store.now));
	let nextBlock = $derived(getNextBlock(blocks, store.now));
	let remaining = $derived(currentBlock ? minutesRemaining(currentBlock, store.now) : null);
	let untilNext = $derived(nextBlock ? minutesUntilBlock(nextBlock, store.now) : null);

	let leadTime = $derived(
		untilNext !== null &&
			untilNext > 0 &&
			untilNext <= store.settings.leadTimeMinutes
	);

	let flourishText = $derived.by(() => {
		if (!store.settings.flourishEnabled) return null;
		if (!currentBlock?.flourishEligible) return null;
		if (!shouldShowFlourish(store.now, currentBlock.id)) return null;
		return getDailyFlourish(
			{
				date: store.now,
				block: currentBlock,
				dayShape,
				domains: store.domains,
				blockCount: blocks.length
			},
			store.settings.tone,
			currentBlock.id
		);
	});

	// Progress through current block
	let progressPct = $derived.by(() => {
		if (!currentBlock || remaining === null) return 0;
		const start = timeToMinutes(currentBlock.startTime);
		const end = timeToMinutes(currentBlock.endTime);
		const total = end - start;
		if (total <= 0) return 100;
		return Math.min(100, Math.max(0, ((total - remaining) / total) * 100));
	});

	const dayShapeLabel = $derived(dayShape?.name ?? 'no shape');

	let elapsedLabel = $derived(currentBlock ? `${Math.round(progressPct)}% elapsed` : null);
</script>

<div class="now-next">
	<!-- Header bar -->
	<header class="nn-header">
		<a href="/" class="nn-home" title="back to woodles.space">·space</a>

		<div class="nn-header-center">
			<span class="nn-header-mark" aria-hidden="true">❦</span>
			<span class="nn-clock">{formatTime(store.now)}</span>
			<span class="nn-sep">·</span>
			<span class="nn-date">{dayOfWeekLabel(store.now)} {shortDateLabel(store.now)}</span>
			<span class="nn-header-mark" aria-hidden="true">❦</span>
		</div>

		<button
			class="nn-daytype"
			onclick={() => store.cycleDayShape(store.now)}
			title="cycle day shape"
		>
			{dayShapeLabel}
		</button>
	</header>

	<!-- Current block card -->
	<section class="nn-now-card" class:lead-time={leadTime}>
		<div class="nn-card-eyebrow">
			<span class="eyebrow-label">NOW</span>
			{#if currentBlock && remaining !== null}
				<span class="eyebrow-remaining">{minutesToDisplay(remaining)} remaining</span>
			{/if}
		</div>

		{#if currentBlock}
			<div class="nn-progress-bar" role="progressbar" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}>
				<div class="nn-progress-fill" style:width="{progressPct}%"></div>
			</div>

			<h1 class="nn-block-title">{currentBlock.title}</h1>
			<p class="nn-block-time">{currentBlock.startTime} — {currentBlock.endTime}</p>

			{#if elapsedLabel}
				<p class="nn-block-note">{elapsedLabel}</p>
			{/if}
		{:else if blocks.length === 0}
			<h1 class="nn-block-title nn-free">The day has not yet decided what it is.</h1>
			<p class="nn-block-time">neither have you. this seems fine.</p>
		{:else}
			<h1 class="nn-block-title nn-free">—</h1>
			<p class="nn-block-time">between schedule</p>
		{/if}

	</section>

	<!-- Next block card -->
	{#if nextBlock}
		<section class="nn-next-card" class:urgent={leadTime}>
			<div class="nn-card-eyebrow">
				<span class="eyebrow-label">NEXT</span>
			</div>
			<div class="nn-next-body">
				<h2 class="nn-next-title">{nextBlock.title}</h2>
				<div class="nn-next-meta">
					<span class="nn-next-time">{nextBlock.startTime}</span>
					{#if untilNext !== null && untilNext > 0}
						<span class="nn-next-until">in {minutesToDisplay(untilNext)}</span>
					{:else if untilNext === 0}
						<span class="nn-next-until nn-now">now</span>
					{/if}
				</div>
			</div>
		</section>
	{/if}

	{#if flourishText}
		<figure class="nn-flourish-wrap">
			<span class="nn-flourish-rule" aria-hidden="true">
				<span class="flourish-line"></span>
				<span class="flourish-mark">⁂</span>
				<span class="flourish-line"></span>
			</span>
			<blockquote class="nn-flourish">
				<span class="nn-flourish-quote" aria-hidden="true">“</span>
				<span class="nn-flourish-text">{flourishText}</span>
				<span class="nn-flourish-quote nn-flourish-quote-close" aria-hidden="true">”</span>
			</blockquote>
		</figure>
	{/if}
</div>

<style>
	.now-next {
		max-width: 660px;
		margin: 0 auto;
		padding: 0 clamp(1.25rem, 5vw, 2.5rem) var(--pl-space-xl);
	}

	.nn-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.1rem 0 1.75rem;
		gap: 1rem;
	}

	.nn-home {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.16em;
		color: var(--p-muted);
		text-decoration: none;
		opacity: 0.6;
		transition: opacity var(--pl-transition-fast);
	}

	.nn-home:hover {
		opacity: 1;
	}

	.nn-header-center {
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
	}

	.nn-header-mark {
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		opacity: 0.45;
		font-size: 0.72rem;
		line-height: 1;
	}

	.nn-clock {
		font-family: var(--pl-font-mono);
		font-size: 0.95rem;
		letter-spacing: 0.12em;
		color: var(--p-text);
	}

	.nn-sep {
		color: var(--p-muted);
		opacity: 0.5;
	}

	.nn-date {
		font-family: var(--pl-font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		color: var(--p-muted);
	}

	.nn-daytype {
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

	.nn-daytype:hover {
		opacity: 1;
		border-color: var(--p-accent);
		color: var(--p-accent);
	}

	.nn-now-card {
		background: var(--p-surface);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-lg);
		padding: clamp(1.5rem, 5vw, 2.25rem) clamp(1.5rem, 5vw, 2.5rem);
		margin-bottom: 1rem;
		transition: var(--pl-transition-palette), box-shadow var(--pl-transition-medium), border-color var(--pl-transition-medium);
		box-shadow: var(--pl-shadow-card);
	}

	.nn-now-card.lead-time {
		border-color: var(--p-accent);
		box-shadow: 0 0 0 1px var(--p-accent-soft), var(--pl-shadow-card);
	}

	.nn-card-eyebrow {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.9rem;
	}

	.eyebrow-label {
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--p-accent);
		opacity: 0.8;
	}

	.eyebrow-remaining {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		color: var(--p-muted);
	}

	.nn-progress-bar {
		height: 2px;
		background: var(--p-border);
		border-radius: 1px;
		margin-bottom: 1.25rem;
		overflow: hidden;
	}

	.nn-progress-fill {
		height: 100%;
		background: var(--p-accent);
		border-radius: 1px;
		transition: width 30s linear;
		opacity: 0.6;
	}

	.nn-block-title {
		font-family: var(--pl-font-display);
		font-size: var(--pl-title-now);
		font-weight: 400;
		line-height: 1.05;
		color: var(--p-text);
		margin-bottom: 0.4rem;
		letter-spacing: -0.01em;
	}

	.nn-block-title.nn-free {
		color: var(--p-muted);
		opacity: 0.4;
	}

	.nn-block-time {
		font-family: var(--pl-font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		color: var(--p-muted);
		margin-bottom: 1.5rem;
	}

	.nn-block-note {
		font-family: var(--pl-font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		color: var(--p-muted);
		margin-top: 1.2rem;
	}

	.nn-next-card {
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-md);
		padding: 1rem 1.5rem;
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		transition: var(--pl-transition-palette), border-color var(--pl-transition-medium);
		opacity: 0.8;
	}

	.nn-next-card.urgent {
		border-color: var(--p-highlight);
		opacity: 1;
	}


	.nn-next-body {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.nn-next-title {
		font-family: var(--pl-font-display);
		font-size: var(--pl-title-next);
		font-weight: 400;
		color: var(--p-text);
		letter-spacing: -0.01em;
	}

	.nn-next-meta {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-shrink: 0;
	}

	.nn-next-time {
		font-family: var(--pl-font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		color: var(--p-muted);
	}

	.nn-next-until {
		font-family: var(--pl-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		color: var(--p-muted);
		opacity: 0.7;
	}

	.nn-next-until.nn-now {
		color: var(--p-accent);
		opacity: 1;
	}

	.nn-flourish-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.85rem;
		margin: 0;
		padding: var(--pl-space-lg) clamp(0.75rem, 4vw, 2rem);
	}

	.nn-flourish-rule {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		max-width: 18rem;
	}

	.flourish-line {
		flex: 1;
		height: 1px;
		background: var(--p-border);
	}

	.flourish-mark {
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		opacity: 0.55;
		font-size: 0.9rem;
		line-height: 1;
	}

	.nn-flourish {
		font-family: var(--pl-font-body);
		font-style: italic;
		font-size: 0.95rem;
		line-height: 1.65;
		color: var(--p-text);
		text-align: center;
		opacity: 0.82;
		max-width: 32rem;
		margin: 0;
		position: relative;
	}

	.nn-flourish-quote {
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		opacity: 0.55;
		font-size: 1.6rem;
		line-height: 0.5;
		vertical-align: -0.25em;
		margin-right: 0.1em;
	}

	.nn-flourish-quote-close {
		margin-left: 0.1em;
		margin-right: 0;
		vertical-align: -0.5em;
	}

	.nn-flourish-text { font-style: italic; }

	@media (max-width: 620px) {
		.nn-header {
			align-items: flex-start;
			gap: 0.65rem;
		}

		.nn-header-center {
			flex-wrap: wrap;
			justify-content: center;
			row-gap: 0.25rem;
		}

		.nn-date {
			width: 100%;
			text-align: center;
		}

	}
</style>
