<script lang="ts">
	import { store } from '$lib/store.svelte';
	import {
		getCurrentBlock,
		getNextBlock,
		minutesRemaining,
		minutesUntilBlock
	} from '$lib/templates';
	import {
		minutesToDisplay,
		dayOfWeekLabel,
		shortDateLabel,
		formatTime,
		timeToMinutes,
		dateKey
	} from '$lib/utils';
	import { getDailyFlourish, shouldShowFlourish } from '$lib/voice';
	import { onboarding } from '$lib/onboarding.store.svelte';
	import TaskItem from './TaskItem.svelte';

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

	// The first useful Carillon gesture is naming one thing for the part of the
	// day that is happening now (or next). Keep it on the default landing view
	// so setup does not end in a read-only schedule.
	const focusBlock = $derived(currentBlock ?? nextBlock);
	const focusDate = $derived(dateKey(store.now));
	const focusTasks = $derived.by(() => {
		if (focusBlock) return store.getTasksForBlock(focusBlock.id, focusDate);
		return store
			.getTasksForDay(focusDate)
			.filter((task) => task.status !== 'dropped' && !task.targetBlockId);
	});
	const focusLabel = $derived(focusBlock ? `things for ${focusBlock.title}` : 'things for today');
	const setupStep = $derived(store.settings.onboardingStep);

	function addThing() {
		store.startCompose({
			targetDate: focusDate,
			targetBlockId: focusBlock?.id
		});
	}

	function continueSetup() {
		onboarding.resumeFromPlanner();
	}
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

	{#if setupStep}
		<section class="nn-setup-nudge" aria-label="unfinished setup">
			<div>
				<span class="nn-setup-eyebrow">SETUP PAUSED</span>
				<p>Pick up at question {setupStep} when the week has your attention again.</p>
			</div>
			<button class="nn-setup-resume" onclick={continueSetup}>continue setup →</button>
		</section>
	{/if}

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

	<section class="nn-things" aria-labelledby="nn-things-heading">
		<div class="nn-things-head">
			<div>
				<span class="nn-things-eyebrow">ONE REAL THING</span>
				<h2 id="nn-things-heading" class="nn-things-title">{focusLabel}</h2>
			</div>
			<button class="nn-add-thing" data-testid="add-task" onclick={addThing}>
				+ add
			</button>
		</div>

		{#if focusTasks.length > 0}
			<div class="nn-task-list" role="list">
				{#each focusTasks as task (task.id)}
					<TaskItem {task} />
				{/each}
			</div>
		{:else}
			<p class="nn-things-empty">Give this part of the day one name. It can be small.</p>
		{/if}
	</section>

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

	/* ── gentle resume point for a deferred setup ─────────────────── */
	.nn-setup-nudge {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--p-border);
		border-left: 2px solid var(--p-accent);
		border-radius: var(--pl-radius-sm);
		background: color-mix(in srgb, var(--p-accent-soft) 58%, transparent);
	}

	.nn-setup-eyebrow {
		display: block;
		font-family: var(--pl-font-mono);
		font-size: 0.5rem;
		letter-spacing: 0.18em;
		color: var(--p-accent);
		opacity: 0.8;
	}

	.nn-setup-nudge p {
		font-family: var(--pl-font-body);
		font-size: 0.82rem;
		font-style: italic;
		line-height: 1.35;
		color: var(--p-muted);
	}

	.nn-setup-resume {
		flex-shrink: 0;
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		color: var(--p-text);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-pill);
		padding: 4px 9px;
		transition: border-color var(--pl-transition-fast), color var(--pl-transition-fast);
	}

	.nn-setup-resume:hover { color: var(--p-accent); border-color: var(--p-accent); }

	/* ── things ──────────────────────────────────────────────────── */
	.nn-things {
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-md);
		background: color-mix(in srgb, var(--p-surface) 64%, transparent);
		padding: 1rem 1.25rem;
		margin-bottom: 1rem;
		transition: var(--pl-transition-palette), border-color var(--pl-transition-fast);
	}

	.nn-things:focus-within { border-color: var(--p-accent); }

	.nn-things-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.nn-things-eyebrow {
		display: block;
		font-family: var(--pl-font-mono);
		font-size: 0.52rem;
		letter-spacing: 0.18em;
		color: var(--p-accent);
		opacity: 0.75;
	}

	.nn-things-title {
		font-family: var(--pl-font-optical);
		font-size: 1.2rem;
		font-weight: 400;
		font-style: italic;
		line-height: 1.2;
		color: var(--p-text);
		letter-spacing: -0.01em;
		font-variation-settings: 'opsz' 36;
	}

	.nn-add-thing {
		flex-shrink: 0;
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		color: var(--p-text);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-pill);
		padding: 4px 10px;
		transition: color var(--pl-transition-fast), border-color var(--pl-transition-fast), background var(--pl-transition-fast);
	}

	.nn-add-thing:hover {
		color: var(--p-bg);
		border-color: var(--p-accent);
		background: var(--p-accent);
	}

	.nn-task-list {
		margin-top: 0.55rem;
		padding-top: 0.45rem;
		border-top: 1px solid var(--p-border);
	}

	.nn-things-empty {
		font-family: var(--pl-font-body);
		font-size: 0.88rem;
		font-style: italic;
		line-height: 1.45;
		color: var(--p-muted);
		opacity: 0.78;
		margin-top: 0.55rem;
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

		.nn-setup-nudge {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.55rem;
		}

	}
</style>
