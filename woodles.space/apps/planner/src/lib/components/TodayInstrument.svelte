<script lang="ts">
	import { tick } from 'svelte';
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import {
		INTERVAL_KIND_OPTIONS,
		buildDayIntervals,
		timeForMinutes,
		type DayInterval
	} from '$lib/instrument';
	import { thinkingAboutShelf } from '$lib/thinkingAboutShelf.svelte';
	import { dateKey, dayOfWeekLabel, shortDateLabel, timeToMinutes } from '$lib/utils';
	import MomentarySample from './MomentarySample.svelte';
	import MomentDayReview from './MomentDayReview.svelte';
	import { detailSummary } from '$lib/momentDetails';
	import CatchUp from './CatchUp.svelte';
	import Capacity from './Capacity.svelte';

	let {
		onopenpiles,
		onopenroutines,
		onopensurge
	}: {
		onopenpiles?: () => void;
		onopenroutines?: () => void;
		onopensurge?: () => void;
	} = $props();

	let selectedStart = $state('');
	let todayKey = $derived(dateKey(store.now));
	let dayShape = $derived(store.getDayShape(store.now));
	let blocks = $derived(store.getBlocksForDate(store.now));
	let todayObservations = $derived(store.getObservationsForDate(todayKey));
	let todayIntervals = $derived(
		buildDayIntervals(
			store.now,
			blocks,
			todayObservations,
			store.settings.wakeAnchor,
			store.settings.sleepAnchor,
			store.settings.samplingIntervalMinutes,
			store.now
		)
	);
	let currentInterval = $derived(
		todayIntervals.find((row) => row.state === 'current') ?? null
	);
	let ledgerDateKey = $derived(todayKey);
	let ledgerObservations = $derived(todayObservations);
	let ledgerIntervals = $derived(todayIntervals);
	let selectedInterval = $derived.by((): DayInterval | null => {
		if (!selectedStart) return currentInterval;
		const row = todayIntervals.find(row => row.startTime === selectedStart);
		if (row) return row;
		// A saved moment remains editable even after sampling hours have changed.
		const observation = todayObservations.find(o => o.intervalStart === selectedStart);
		return observation ? { key: `${todayKey}@${selectedStart}`, date: todayKey, startTime: selectedStart,
			endTime: timeForMinutes(timeToMinutes(selectedStart) + (observation.intervalMinutes ?? store.settings.samplingIntervalMinutes)),
			state: 'past', plannedBlock: null, observation } : null;
	});

	let tomorrow = $derived.by(() => {
		const next = new Date(store.now);
		next.setDate(next.getDate() + 1);
		return next;
	});
	let tomorrowShape = $derived(store.getDayShape(tomorrow));
	let tomorrowIntervals = $derived(
		buildDayIntervals(
			tomorrow,
			store.getBlocksForDate(tomorrow),
			[],
			store.settings.wakeAnchor,
			store.settings.sleepAnchor,
			store.settings.samplingIntervalMinutes,
			store.now
		)
	);
	let printRowsPerColumn = $derived(Math.ceil(tomorrowIntervals.length / 2));

	let nextBell = $derived.by(() => {
		const minutes = store.now.getHours() * 60 + store.now.getMinutes();
		const interval = Math.max(1, store.settings.samplingIntervalMinutes);
		return timeForMinutes((Math.floor(minutes / interval) + 1) * interval);
	});
	let bellStatus = $derived.by(() => {
		if (!store.settings.bellsEnabled) return 'bells off';
		const minutes = store.now.getHours() * 60 + store.now.getMinutes();
		const quietStart = timeToMinutes(store.settings.quietHoursStart);
		const quietEnd = timeToMinutes(store.settings.quietHoursEnd);
		const quiet =
			quietStart <= quietEnd
				? minutes >= quietStart && minutes < quietEnd
				: minutes >= quietStart || minutes < quietEnd;
		return quiet ? 'quiet hours · bell resting' : `next bell · ${displayTime(nextBell)}`;
	});

	// The shelf names the entries an offer is about. Loaded once here rather
	// than per-interval — it changes in the other app, not with the cursor.
	$effect(() => {
		void thinkingAboutShelf.refresh();
	});

	function displayTime(value: string): string {
		const minutes = timeToMinutes(value);
		const hour24 = Math.floor(minutes / 60);
		const minute = minutes % 60;
		const suffix = hour24 >= 12 ? 'pm' : 'am';
		const hour = hour24 % 12 || 12;
		return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
	}

	function canSelect(row: DayInterval): boolean {
		return row.state === 'current' || Boolean(row.observation?.intervalStart === row.startTime && row.observation);
	}
	async function selectRow(row: DayInterval): Promise<void> {
		if (!canSelect(row)) return;
		selectedStart = row.startTime;
		await tick();
		document.querySelector<HTMLElement>('#moment-entry')?.focus();
	}

	async function reopenMoment(start: string): Promise<void> {
		selectedStart = start;
		await tick();
		document.querySelector<HTMLElement>('#moment-entry')?.focus();
	}

	// After a mark lands, the entries the plan says this block was about. An
	// offer, never an action taken: a session is a thing a person did, and
	// Carillon converting every observation into one would be the instrument
	// deciding on their behalf.
	const offerableEntries = $derived.by(() => {
		if (!selectedInterval?.observation) return [];
		return store
			.offerableEntryIdsForInterval(selectedInterval.date, selectedInterval.startTime)
			.map((entryId) => ({ entryId, entry: thinkingAboutShelf.find(entryId) }));
	});

	function logSitting(entryId: string): void {
		if (!selectedInterval) return;
		store.logThinkingAboutSession(entryId, selectedInterval.date);
		queueSync();
	}

	function unlogSitting(entryId: string): void {
		if (!selectedInterval) return;
		store.unlogThinkingAboutSession(entryId, selectedInterval.date);
		queueSync();
	}

	function printTomorrow(): void {
		window.print();
	}
</script>

<section class="instrument" aria-labelledby="today-heading">
	<header class="day-heading">
		<div>
			<h1 id="today-heading">{dayOfWeekLabel(store.now)}, {shortDateLabel(store.now)}</h1>
		</div>
		<div class="day-actions">
			<button type="button" class="pile-pill" onclick={onopenpiles}>
				<span>today’s pile</span>
				<strong>{dayShape?.name ?? 'none chosen'}</strong>
			</button>
			<button type="button" class="print-action" onclick={printTomorrow}>
				<span aria-hidden="true">⌑</span>
				print tomorrow
			</button>
		</div>
	</header>

	<div class="instrument-grid">
		<div class="moment-column">
		<article class="sampler" data-testid="interval-sampler">
			{#if selectedInterval && selectedInterval.observation?.intervalStart === selectedInterval.startTime && !selectedStart}
				<div class="sample-rest" role="status">
					<span class="rest-mark" aria-hidden="true">✓</span>
					<div><small>{displayTime(selectedInterval.startTime)}–{displayTime(selectedInterval.endTime)}</small><strong>Moment saved</strong><p>Your note is in Day so far. The next prompt will appear with the next interval.</p></div>
				</div>
			{:else if selectedInterval}
				<MomentarySample interval={selectedInterval} timeLabel="{displayTime(selectedInterval.startTime)}–{displayTime(selectedInterval.endTime)}" bellNote={selectedStart ? 'editing a recorded moment' : bellStatus} editingPast={Boolean(selectedStart)} onreturnnow={() => selectedStart = ''} onsaved={() => selectedStart = ''} />
			{:else}
				<p class="sample-rest">Outside sampling hours. Your saved moments are below.</p>
			{/if}

			{#if selectedStart && offerableEntries.length > 0}
				<div class="sitting-offer" data-testid="sitting-offer">
					{#each offerableEntries as { entryId, entry } (entryId)}
						{@const logged = store.hasLoggedSession(entryId, selectedInterval?.date ?? '')}
						{@const name = entry?.title ?? 'this'}
						{#if logged}
							<p class="sitting-logged">
								<span class="sitting-dot" style:background={entry?.color ?? 'currentColor'}
								></span>
								logged a sitting with <strong>{name}</strong>
								<button type="button" onclick={() => unlogSitting(entryId)}>undo</button>
							</p>
						{:else}
							<button
								type="button"
								class="sitting-chip"
								style:--chip={entry?.color ?? 'currentColor'}
								onclick={() => logSitting(entryId)}
							>
								also log a sitting with {name}?
							</button>
						{/if}
					{/each}
				</div>
			{/if}

		</article>
		<MomentDayReview observations={todayObservations} onselect={reopenMoment} />
		</div>
	</div>

	<details class="context-details"><summary>Sleep and context</summary><Capacity /></details>
	<details class="context-details"><summary>Add an earlier activity</summary><CatchUp intervals={todayIntervals} {onopenroutines} {onopensurge} /></details>

	<details class="context-details"><summary>Earlier today · {ledgerObservations.length} records</summary>
	<section class="ledger-card" aria-labelledby="ledger-heading">
		<header class="ledger-titlebar">
			<div>
				<p class="section-kicker">field sheet · {ledgerDateKey}</p>
				<h2 id="ledger-heading">Today’s record</h2>
			</div>
			<div class="ledger-controls">
				<span>{ledgerObservations.length} sampled moment{ledgerObservations.length === 1 ? '' : 's'}</span>
			</div>
		</header>

		<div class="ledger-head" aria-hidden="true">
			<span>interval</span>
			<span>planned activity</span>
			<span>observed</span>
		</div>
		<div class="ledger-rows">
			{#each ledgerIntervals as row (row.key)}
				<button
					type="button"
					class="ledger-row"
					class:current={row.state === 'current'}
					class:selected={selectedInterval?.key === row.key}
					class:observed={Boolean(row.observation)}
					disabled={!canSelect(row)}
					onclick={() => selectRow(row)}
					aria-label={`${displayTime(row.startTime)}, planned ${row.plannedBlock?.title ?? 'open'}, ${row.observation ? `observed ${row.observation.label}${row.continuation ? ', same recalled stretch' : ''}` : 'unobserved'}`}
				>
					<span class="row-time">{displayTime(row.startTime)}</span>
					<span class="row-plan">{row.plannedBlock?.title ?? 'open'}</span>
					<span class="row-observed" class:continuation={row.continuation}>
						{#if row.observation}
							<i data-kind={row.observation.kind} style:background={row.observation.sampleTag?.color} aria-hidden="true"></i>
							{row.observation.label}
							{#if detailSummary(row.observation.details)}<sup title={detailSummary(row.observation.details)}>{Object.keys(row.observation.details ?? {}).length} details</sup>{/if}
							{#if row.observation.sampleTag}<sup>{row.observation.sampleTag.name}</sup>{/if}
							{#if row.continuation}<sup>same stretch</sup>{:else if row.observation.source === 'paper'}<sup>paper</sup>{:else if row.observation.source === 'recall'}<sup>recalled</sup>{/if}
						{:else}
							<span class="hollow">—</span>
						{/if}
					</span>
				</button>
			{/each}
		</div>
		<p class="ledger-footnote">
			Blank intervals have no record. Paper entries and recalled stretches are labeled by source.
		</p>
	</section>
	</details>
</section>

<!-- This artifact is always ready so the evening ritual is one click. -->
<section class="print-sheet" aria-hidden="true">
	<header class="print-header">
		<div>
			<p>CARILLON · MOMENTARY TIME SAMPLE</p>
			<h1>{dayOfWeekLabel(tomorrow)}, {shortDateLabel(tomorrow)}</h1>
		</div>
		<div class="print-meta">
			<span>PILE</span>
			<strong>{tomorrowShape?.name ?? 'open day'}</strong>
		</div>
	</header>
	<p class="print-thesis">The plan is a hypothesis. The day is data.</p>
	<div class="print-ledger" style={`--print-rows: ${printRowsPerColumn}`}>
		{#each tomorrowIntervals as row (row.key)}
			<div class="print-row">
				<time>{row.startTime}</time>
				<span class="print-plan">{row.plannedBlock?.title ?? 'open'}</span>
				<span class="print-mark"></span>
			</div>
		{/each}
	</div>
	<footer class="print-footer">
		<div class="print-legend">
			{#each INTERVAL_KIND_OPTIONS as option (option.kind)}
				<span><b>{option.glyph}</b> {option.shortLabel}</span>
			{/each}
		</div>
		<p>Circle a code at the bell. Blank means unobserved.</p>
	</footer>
</section>

<style>
	.context-details { margin: 0; color: var(--car-cream); }
	.context-details summary { cursor:pointer; padding:.15rem 0; }
	.instrument {
		display: grid;
		gap: 1.2rem;
	}

	.day-heading,
	.ledger-titlebar {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.section-kicker {
		color: var(--car-pink);
		font-family: var(--car-mono);
		font-size: 0.63rem;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.day-heading h1 {
		margin-top: 0.2rem;
		color: var(--car-cream);
		font-family: var(--car-display);
		font-size: clamp(1.3rem, 2.4vw, 1.9rem);
		font-weight: 400;
		letter-spacing: -0.04em;
		line-height: 0.94;
	}


	.day-actions {
		display: flex;
		align-items: stretch;
		gap: 0.55rem;
	}

	.pile-pill,
	.print-action {
		border: 1px solid var(--car-line);
		border-radius: 0.8rem;
		color: var(--car-cream);
		transition:
			border-color 160ms ease,
			background 160ms ease,
			transform 160ms ease;
	}

	.pile-pill {
		display: grid;
		gap: 0.1rem;
		min-width: 9.5rem;
		padding: 0.55rem 0.75rem;
		text-align: left;
	}

	.pile-pill span {
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.54rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.pile-pill strong {
		font-family: var(--car-body);
		font-size: 0.78rem;
		font-weight: 500;
	}

	.print-action {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.6rem 0.8rem;
		font-family: var(--car-mono);
		font-size: 0.68rem;
	}

	.pile-pill:hover,
	.print-action:hover {
		border-color: var(--car-pink);
		background: var(--car-wash);
		transform: translateY(-1px);
	}

	.instrument-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}
	.moment-column { display: grid; min-width: 0; gap: 1rem; }
	.sample-rest { display: flex; align-items: center; gap: 0.8rem; margin-top: 1.5rem; padding: 1rem; border-radius: 0.7rem; background: var(--car-pink-wash); color: var(--car-ink-soft); font: 0.8rem/1.45 var(--car-body); }
	.sample-rest strong { display: block; color: var(--car-ink); font: 500 1.2rem var(--car-display); }
	.sample-rest p { margin-top: 0.2rem; }
	.rest-mark { display: grid; place-items: center; width: 2rem; height: 2rem; flex: none; border: 1px solid var(--car-pink-dark); border-radius: 50%; color: var(--car-pink-dark); }

	.sampler,
	.ledger-card {
		border: 1px solid var(--car-line);
		background:
			linear-gradient(rgba(81, 44, 71, 0.025) 1px, transparent 1px),
			linear-gradient(90deg, rgba(81, 44, 71, 0.025) 1px, transparent 1px),
			var(--car-paper);
		background-size: 18px 18px;
		box-shadow: 0 1.25rem 3.5rem var(--car-shadow);
		color: var(--car-ink);
	}

	.sampler {
		position: relative;
		overflow: clip;
		border-radius: 1rem 1rem 2.8rem 1rem;
		padding: 1.15rem;
	}

	.sampler::after {
		position: absolute;
		right: -2.4rem;
		bottom: -2.4rem;
		width: 5.5rem;
		height: 5.5rem;
		border: 1px solid rgba(141, 49, 83, 0.25);
		border-radius: 50%;
		content: '';
		box-shadow: 0 0 0 0.7rem rgba(141, 49, 83, 0.04);
	}













	/* The offer to log a sitting in Thinking About. Deliberately quiet — it is
	   an aside to the observation, not a second thing to answer. */
	.sitting-offer {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-top: 0.6rem;
	}

	.sitting-chip {
		align-self: flex-start;
		font-size: 0.78rem;
		color: var(--p-text);
		padding: 0.28rem 0.65rem;
		border: 1px solid var(--p-border);
		border-left: 3px solid var(--chip, var(--p-accent));
		border-radius: 0.35rem;
		background: transparent;
		transition: border-color var(--pl-transition-fast);
	}

	.sitting-chip:hover,
	.sitting-chip:focus-visible {
		border-color: var(--p-accent);
	}

	.sitting-logged {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.76rem;
		color: var(--p-muted);
	}

	.sitting-logged strong {
		color: var(--p-text);
		font-weight: 500;
	}

	.sitting-dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		flex: none;
	}

	.sitting-logged button {
		font-size: 0.72rem;
		color: var(--p-muted);
		background: transparent;
		text-decoration: underline;
	}

	.sitting-logged button:hover {
		color: var(--p-text);
	}




	.ledger-card {
		overflow: hidden;
		border-radius: 1rem;
	}

	.ledger-titlebar {
		padding: 1rem 1.1rem;
		border-bottom: 1px solid rgba(68, 54, 91, 0.14);
	}

	.ledger-titlebar h2 {
		margin-top: 0.2rem;
		font-family: var(--car-display);
		font-size: 1.55rem;
		font-weight: 500;
	}

	.ledger-controls {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.55rem;
	}

	.ledger-head,
	.ledger-row {
		display: grid;
		grid-template-columns: 7.3rem minmax(8rem, 1fr) minmax(8rem, 1fr);
		align-items: center;
	}

	.ledger-head {
		padding: 0.5rem 1.1rem;
		border-bottom: 1px solid rgba(68, 54, 91, 0.12);
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.ledger-rows {
		max-height: 32rem;
		overflow: auto;
		scrollbar-color: rgba(141, 49, 83, 0.35) transparent;
	}

	.ledger-row {
		width: 100%;
		min-height: 2.35rem;
		padding: 0.35rem 1.1rem;
		border-bottom: 1px solid rgba(68, 54, 91, 0.09);
		color: var(--car-ink);
		text-align: left;
	}

	.ledger-row:not(:disabled):hover,
	.ledger-row.selected {
		background: rgba(141, 49, 83, 0.07);
	}

	.ledger-row.current {
		box-shadow: inset 0.18rem 0 var(--car-pink-dark);
	}

	.ledger-row:disabled {
		cursor: default;
		opacity: 1;
	}

	.row-time {
		font-family: var(--car-counter);
		font-size: 0.96rem;
	}

	.row-plan {
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.68rem;
	}

	.row-observed {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--car-mono);
		font-size: 0.62rem;
	}

	.row-observed i {
		width: 0.42rem;
		height: 0.42rem;
		border-radius: 50%;
		background: var(--car-pink-dark);
	}

	.row-observed.continuation {
		opacity: 0.62;
	}

	.row-observed.continuation i {
		border: 1px solid var(--car-pink-dark);
		background: transparent;
	}

	.row-observed sup {
		color: var(--car-ink-soft);
		font-size: 0.42rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.hollow {
		color: rgba(68, 54, 91, 0.25);
	}

	.ledger-footnote {
		padding: 0.75rem 1.1rem;
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.65rem;
		font-style: italic;
	}

	.print-sheet {
		display: none;
	}

	@media (max-width: 850px) {
		.instrument-grid {
			grid-template-columns: 1fr;
		}

		.day-heading {
			align-items: flex-start;
			flex-direction: column;
		}

		.day-actions {
			width: 100%;
		}

		.pile-pill {
			flex: 1;
		}
	}

	@media (max-width: 600px) {


		.ledger-titlebar {
			align-items: flex-start;
			flex-direction: column;
		}

		.ledger-controls {
			width: 100%;
			justify-content: space-between;
		}

		.ledger-head,
		.ledger-row {
			grid-template-columns: 5.5rem minmax(5rem, 0.8fr) minmax(7rem, 1.2fr);
		}

		.ledger-head,
		.ledger-row {
			padding-right: 0.75rem;
			padding-left: 0.75rem;
		}

		.row-plan,
		.row-observed {
			font-size: 0.56rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pile-pill,
		.print-action { transition: none; }
	}

	/* The plan stays available beside the moment, without competing for the main column. */
	.instrument { gap: 0.8rem; }
	.day-heading { align-items: center; }
	.sampler { animation: settle-in 280ms ease-out both; }
	.context-details { border: 1px solid var(--car-line); border-radius: 0.7rem; padding: 0.65rem 0.85rem; }
	.context-details summary { cursor: pointer; font-size: 0.8rem; }
	@keyframes settle-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
	@media (max-width: 900px) {
		.instrument-grid { grid-template-columns: minmax(0, 1fr); }
		.day-heading { flex-wrap: wrap; gap: 0.6rem; }
		.day-heading h1 { font-size: 1.4rem; }
		.day-actions { flex-wrap: wrap; }
	}
	@media (prefers-reduced-motion: reduce) {
		.sampler { animation: none; }
	}

	@media print {
		@page {
			size: letter portrait;
			margin: 0.35in;
		}

		:global(body) {
			background: #fff8e8 !important;
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}

		.instrument {
			display: none !important;
		}

		.print-sheet {
			display: block;
			height: 10.25in;
			overflow: hidden;
			background: #fff8e8;
			color: #332437;
			font-family: var(--car-body);
		}

		.print-header {
			display: flex;
			align-items: flex-end;
			justify-content: space-between;
			padding-bottom: 0.12in;
			border-bottom: 3px double #8d3153;
		}

		.print-header p,
		.print-meta span {
			color: #8d3153;
			font-family: var(--car-mono);
			font-size: 7pt;
			letter-spacing: 0.14em;
		}

		.print-header h1 {
			margin: 0.03in 0 0;
			font-family: var(--car-display);
			font-size: 24pt;
			font-weight: 500;
			line-height: 1;
		}

		.print-meta {
			display: grid;
			gap: 0.02in;
			text-align: right;
		}

		.print-meta strong {
			font-family: var(--car-body);
			font-size: 10pt;
			font-weight: 500;
		}

		.print-thesis {
			margin: 0.08in 0;
			color: #6e5e6f;
			font-size: 7.5pt;
			font-style: italic;
		}

		.print-ledger {
			display: grid;
			grid-auto-flow: column;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-template-rows: repeat(var(--print-rows), 1fr);
			column-gap: 0.22in;
			height: 8.85in;
		}

		.print-row {
			display: grid;
			grid-template-columns: 0.58in minmax(0, 1fr) 0.35in;
			align-items: center;
			min-height: 0;
			border-bottom: 0.5px solid rgba(141, 49, 83, 0.34);
		}

		.print-row time {
			color: #8d3153;
			font-family: var(--car-counter);
			font-size: 9pt;
			letter-spacing: 0.04em;
		}

		.print-plan {
			overflow: hidden;
			color: #746878;
			font-size: 6.8pt;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.print-mark {
			width: 0.18in;
			height: 0.18in;
			border: 1px solid #8d3153;
			border-radius: 50%;
			justify-self: end;
		}

		.print-footer {
			display: flex;
			align-items: flex-end;
			justify-content: space-between;
			gap: 0.15in;
			margin-top: 0.08in;
			color: #6e5e6f;
			font-size: 6.5pt;
		}

		.print-legend {
			display: flex;
			flex-wrap: wrap;
			gap: 0.04in 0.12in;
			max-width: 6.2in;
			font-family: var(--car-mono);
		}

		.print-legend b {
			color: #8d3153;
		}
	}
</style>
