<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import {
		INTERVAL_KIND_OPTIONS,
		findCatchUpGaps,
		kindLabel,
		spanMinutes,
		type DayInterval
	} from '$lib/instrument';
	import { dateKey, minutesToDisplay, timeToMinutes } from '$lib/utils';
	import type { IntervalKind } from '$lib/types';

	let {
		intervals,
		onopenroutines,
		onopensurge
	}: {
		intervals: DayInterval[];
		onopenroutines?: () => void;
		onopensurge?: () => void;
	} = $props();

	let dismissed = $state<string[]>([]);
	let activeGapKey = $state('');
	let fromTime = $state('');
	let toTime = $state('');
	let customOpen = $state(false);
	let customLabel = $state('');
	let feedback = $state('');
	let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

	let todayKey = $derived(dateKey(store.now));
	let gaps = $derived(
		findCatchUpGaps(intervals).filter((gap) => !dismissed.includes(gapKey(gap.startTime)))
	);
	let activeGap = $derived(
		gaps.find((gap) => gapKey(gap.startTime) === activeGapKey) ?? gaps[0] ?? null
	);
	let hollowMinutes = $derived(gaps.reduce((sum, gap) => sum + gap.minutes, 0));

	// Keep the sketch span inside the active gap as marks land and gaps shrink.
	$effect(() => {
		if (!activeGap) return;
		const boundaries = activeGap.boundaries;
		if (!boundaries.slice(0, -1).includes(fromTime)) {
			fromTime = activeGap.startTime;
		}
		const fromIndex = boundaries.indexOf(fromTime);
		if (!boundaries.slice(fromIndex + 1).includes(toTime)) {
			toTime = activeGap.endTime;
		}
	});

	let fromOptions = $derived(activeGap ? activeGap.boundaries.slice(0, -1) : []);
	let toOptions = $derived(
		activeGap ? activeGap.boundaries.slice(activeGap.boundaries.indexOf(fromTime) + 1) : []
	);
	let sketchMinutes = $derived(fromTime && toTime ? spanMinutes(fromTime, toTime) : 0);

	let recentCutoff = $derived.by(() => {
		const cutoff = new Date(store.now);
		cutoff.setDate(cutoff.getDate() - 14);
		return dateKey(cutoff);
	});
	// Only routines the user actually logs get a nudge — a routine never
	// practiced in the last two weeks is a choice, not a lapse.
	let unpracticedRoutines = $derived(
		store.routines.filter((routine) => {
			if (routine.archived) return false;
			const practices = store.routinePractices.filter(
				(practice) => practice.routineId === routine.id
			);
			return (
				practices.some((practice) => practice.date >= recentCutoff && practice.date < todayKey) &&
				!practices.some((practice) => practice.date === todayKey)
			);
		})
	);
	let waitingSurge = $derived(
		store.surgeDrafts.filter(
			(draft) => draft.status === 'captured' && draft.createdSessionId !== store.sessionId
		).length
	);

	function gapKey(startTime: string): string {
		return `${todayKey}@${startTime}`;
	}

	function displayTime(value: string): string {
		const minutes = timeToMinutes(value);
		const hour24 = Math.floor(minutes / 60);
		const minute = minutes % 60;
		const suffix = hour24 >= 12 ? 'pm' : 'am';
		return `${hour24 % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
	}

	function say(message: string): void {
		feedback = message;
		if (feedbackTimer) clearTimeout(feedbackTimer);
		feedbackTimer = setTimeout(() => (feedback = ''), 4200);
	}

	function sketch(kind: IntervalKind): void {
		if (!activeGap || sketchMinutes <= 0) return;
		const label =
			kind === 'elsewhere' && customLabel.trim() ? customLabel.trim() : kindLabel(kind);

		store.observeInterval({
			date: activeGap.date,
			intervalStart: fromTime,
			kind,
			label,
			source: 'recall',
			intervalMinutes: sketchMinutes
		});
		queueSync();

		say(`${minutesToDisplay(sketchMinutes)} recalled as ${label} · one spore`);
		customOpen = false;
		customLabel = '';
	}

	function startCustom(): void {
		customOpen = true;
		requestAnimationFrame(() => {
			document.querySelector<HTMLInputElement>('#catch-up-custom-activity')?.focus();
		});
	}

	function leaveHollow(): void {
		if (!activeGap) return;
		dismissed = [...dismissed, gapKey(activeGap.startTime)];
		activeGapKey = '';
		say('left hollow · unobserved is still an honest answer');
	}
</script>

{#if activeGap || feedback || unpracticedRoutines.length > 0 || waitingSurge > 0}
	<section class="catch-up" aria-label="catch up on the day">
		{#if !activeGap && feedback}
			<p class="caught-up" aria-live="polite">{feedback} · the sheet is caught up</p>
		{/if}
		{#if activeGap}
			<article class="gap-card" data-testid="catch-up-card">
				<header class="gap-heading">
					<div>
						<p class="gap-kicker">while you were away</p>
						<h2>Sketch the hollow hours in broad strokes.</h2>
						<p class="gap-sub">
							{minutesToDisplay(hollowMinutes)} of today went by without a sample. One remembered
							stretch is one sample — and hollow is also an honest answer.
						</p>
					</div>
					<span class="gap-source">remembered · not a live bell</span>
				</header>

				{#if gaps.length > 1}
					<div class="gap-strip" role="group" aria-label="hollow stretches">
						{#each gaps as gap (gap.startTime)}
							<button
								type="button"
								class:active={activeGap.startTime === gap.startTime}
								aria-pressed={activeGap.startTime === gap.startTime}
								onclick={() => (activeGapKey = gapKey(gap.startTime))}
							>
								<strong>{displayTime(gap.startTime)}–{displayTime(gap.endTime)}</strong>
								<small>{minutesToDisplay(gap.minutes)} hollow</small>
							</button>
						{/each}
					</div>
				{/if}

				<div class="span-controls">
					<label>
						<span>from</span>
						<select bind:value={fromTime}>
							{#each fromOptions as option (option)}
								<option value={option}>{displayTime(option)}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>to</span>
						<select bind:value={toTime}>
							{#each toOptions as option (option)}
								<option value={option}>{displayTime(option)}</option>
							{/each}
						</select>
					</label>
					<span class="span-length">{minutesToDisplay(sketchMinutes)} · one stroke</span>
				</div>

				<div class="kind-grid" role="group" aria-label="what this stretch mostly was">
					{#each INTERVAL_KIND_OPTIONS as option (option.kind)}
						<button
							type="button"
							class="kind-chip"
							onclick={() => (option.kind === 'elsewhere' ? startCustom() : sketch(option.kind))}
						>
							<span class="kind-glyph" aria-hidden="true">{option.glyph}</span>
							<span>{option.label}</span>
						</button>
					{/each}
				</div>

				{#if customOpen}
					<form
						class="custom-activity"
						onsubmit={(event) => {
							event.preventDefault();
							sketch('elsewhere');
						}}
					>
						<label for="catch-up-custom-activity">what was it, mostly?</label>
						<div>
							<input
								id="catch-up-custom-activity"
								bind:value={customLabel}
								placeholder="errands, a long call, lost to the scroll…"
							/>
							<button type="submit" disabled={!customLabel.trim()}>recall</button>
						</div>
					</form>
				{/if}

				<footer class="gap-footer">
					<p class="gap-feedback" aria-live="polite">
						{feedback || 'Recalled stretches are marked as memory, never dressed up as live samples.'}
					</p>
					<button type="button" class="hollow-action" onclick={leaveHollow}>
						leave this stretch hollow
					</button>
				</footer>
			</article>
		{/if}

		{#if unpracticedRoutines.length > 0 || waitingSurge > 0}
			<div class="nudge-strip" aria-label="waiting for a mark">
				<span class="nudge-kicker">also waiting</span>
				{#each unpracticedRoutines as routine (routine.id)}
					<button type="button" class="nudge-chip" onclick={onopenroutines}>
						<span aria-hidden="true">↻</span>
						{routine.name} · unmarked today
					</button>
				{/each}
				{#if waitingSurge > 0}
					<button type="button" class="nudge-chip" onclick={onopensurge}>
						<span aria-hidden="true">✴</span>
						{waitingSurge} surge draft{waitingSurge === 1 ? '' : 's'} ready to review
					</button>
				{/if}
			</div>
		{/if}
	</section>
{/if}

<style>
	.catch-up {
		display: grid;
		gap: 0.75rem;
	}

	.caught-up {
		border: 1px dashed var(--car-line);
		border-radius: 999px;
		justify-self: start;
		padding: 0.4rem 0.8rem;
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
	}

	.gap-card {
		border: 1px solid var(--car-line);
		border-radius: 1rem;
		background:
			linear-gradient(rgba(81, 44, 71, 0.025) 1px, transparent 1px),
			linear-gradient(90deg, rgba(81, 44, 71, 0.025) 1px, transparent 1px),
			var(--car-paper);
		background-size: 18px 18px;
		box-shadow: 0 1.25rem 3.5rem var(--car-shadow);
		color: var(--car-ink);
		padding: clamp(1rem, 2.5vw, 1.5rem);
	}

	.gap-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.gap-kicker {
		color: var(--car-pink-dark);
		font-family: var(--car-mono);
		font-size: 0.61rem;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.gap-heading h2 {
		margin-top: 0.35rem;
		font-family: var(--car-display);
		font-size: clamp(1.5rem, 3.2vw, 2.4rem);
		font-weight: 500;
		letter-spacing: -0.035em;
		line-height: 0.98;
	}

	.gap-sub {
		margin-top: 0.5rem;
		max-width: 46ch;
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.76rem;
	}

	.gap-source {
		flex-shrink: 0;
		border: 1px dashed rgba(68, 54, 91, 0.28);
		border-radius: 999px;
		padding: 0.24rem 0.55rem;
		color: var(--car-pink-dark);
		font-family: var(--car-mono);
		font-size: 0.52rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.gap-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.9rem;
	}

	.gap-strip button {
		display: grid;
		gap: 0.05rem;
		border: 1px solid rgba(68, 54, 91, 0.2);
		border-radius: 0.65rem;
		padding: 0.4rem 0.6rem;
		color: var(--car-ink);
		text-align: left;
	}

	.gap-strip button.active {
		border-color: var(--car-pink-dark);
		background: var(--car-pink-wash);
	}

	.gap-strip strong {
		font-family: var(--car-counter);
		font-size: 0.8rem;
		font-weight: 400;
	}

	.gap-strip small {
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.46rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.span-controls {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.span-controls label {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
	}

	.span-controls label span {
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.55rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.span-controls select {
		border-bottom: 1px solid rgba(68, 54, 91, 0.28);
		background: transparent;
		padding: 0.2rem 0.1rem;
		color: var(--car-ink);
		font-family: var(--car-counter);
		font-size: 0.92rem;
	}

	.span-length {
		color: var(--car-pink-dark);
		font-family: var(--car-mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
	}

	.kind-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.45rem;
		margin-top: 0.85rem;
	}

	.kind-chip {
		display: grid;
		min-height: 3.6rem;
		place-items: center;
		gap: 0.18rem;
		border: 1px solid rgba(68, 54, 91, 0.16);
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.45);
		color: var(--car-ink);
		font-family: var(--car-mono);
		font-size: 0.56rem;
		line-height: 1.2;
		text-align: center;
		transition:
			transform 150ms ease,
			border-color 150ms ease,
			background 150ms ease;
	}

	.kind-chip:hover {
		border-color: var(--car-pink-dark);
		background: var(--car-pink-wash);
		transform: translateY(-2px);
	}

	.kind-glyph {
		color: var(--car-pink-dark);
		font-family: var(--car-display);
		font-size: 0.95rem;
	}

	.custom-activity {
		margin-top: 0.75rem;
		border: 1px dashed rgba(68, 54, 91, 0.24);
		border-radius: 0.75rem;
		padding: 0.75rem;
	}

	.custom-activity label {
		display: block;
		margin-bottom: 0.35rem;
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.custom-activity div {
		display: flex;
		gap: 0.5rem;
	}

	.custom-activity input {
		flex: 1;
		min-width: 0;
		border-bottom: 1px solid rgba(68, 54, 91, 0.28);
		padding: 0.35rem 0.2rem;
		font-family: var(--car-body);
	}

	.custom-activity button {
		border-radius: 999px;
		background: var(--car-ink);
		padding: 0.3rem 0.75rem;
		color: var(--car-paper);
		font-family: var(--car-mono);
		font-size: 0.62rem;
	}

	.gap-footer {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1rem;
	}

	.gap-feedback {
		color: var(--car-pink-dark);
		font-family: var(--car-mono);
		font-size: 0.6rem;
	}

	.hollow-action {
		flex-shrink: 0;
		border: 1px solid rgba(68, 54, 91, 0.2);
		border-radius: 999px;
		padding: 0.32rem 0.65rem;
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.55rem;
	}

	.hollow-action:hover {
		border-color: var(--car-pink-dark);
		color: var(--car-pink-dark);
	}

	.nudge-strip {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.nudge-kicker {
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.5rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.nudge-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--car-line);
		border-radius: 999px;
		padding: 0.35rem 0.65rem;
		color: var(--car-cream);
		font-family: var(--car-mono);
		font-size: 0.57rem;
		transition:
			border-color 150ms ease,
			background 150ms ease;
	}

	.nudge-chip:hover {
		border-color: var(--car-pink);
		background: var(--car-wash);
	}

	.nudge-chip span {
		color: var(--car-pink);
	}

	@media (max-width: 600px) {
		.gap-heading {
			flex-direction: column;
		}

		.kind-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.gap-footer {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.kind-chip,
		.nudge-chip {
			transition: none;
		}
	}
</style>
