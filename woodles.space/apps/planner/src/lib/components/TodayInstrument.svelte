<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import {
		INTERVAL_KIND_OPTIONS,
		buildDayIntervals,
		currentIntervalStart,
		kindLabel,
		timeForMinutes,
		type DayInterval
	} from '$lib/instrument';
	import { dateKey, dayOfWeekLabel, shortDateLabel, timeToMinutes } from '$lib/utils';
	import type { IntervalKind } from '$lib/types';
	import EchoCreature from './EchoCreature.svelte';
	import CatchUp from './CatchUp.svelte';

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
	let paperEntry = $state(false);
	let paperDate = $state(dateKey(store.now));
	let selectedLedgerDate = $state('');
	let customOpen = $state(false);
	let customLabel = $state('');
	let feedback = $state('');
	let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

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
	let ledgerDateKey = $derived(paperEntry ? paperDate || todayKey : todayKey);
	let ledgerDate = $derived(dateFromKey(ledgerDateKey));
	let ledgerObservations = $derived(store.getObservationsForDate(ledgerDateKey));
	let ledgerIntervals = $derived(
		buildDayIntervals(
			ledgerDate,
			store.getBlocksForDate(ledgerDate),
			ledgerObservations,
			store.settings.wakeAnchor,
			store.settings.sleepAnchor,
			store.settings.samplingIntervalMinutes,
			store.now
		)
	);
	let selectedInterval = $derived(
		paperEntry
			? ledgerIntervals.find((row) => row.startTime === selectedStart) ?? null
			: currentInterval
	);

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

	$effect(() => {
		const liveStart = currentIntervalStart(store.now, store.settings.samplingIntervalMinutes);
		if (!paperEntry) {
			selectedStart = currentInterval?.startTime ?? liveStart;
			selectedLedgerDate = todayKey;
			return;
		}
		if (selectedLedgerDate !== ledgerDateKey) {
			selectedStart =
				ledgerDateKey === todayKey
					? currentInterval?.startTime ?? liveStart
					: ledgerIntervals[0]?.startTime ?? '';
			selectedLedgerDate = ledgerDateKey;
		} else if (!ledgerIntervals.some((row) => row.startTime === selectedStart)) {
			selectedStart = ledgerIntervals[0]?.startTime ?? '';
		}
	});

	function dateFromKey(key: string): Date {
		const [year, month, day] = key.split('-').map(Number);
		return new Date(year, month - 1, day, 12);
	}

	function displayTime(value: string): string {
		const minutes = timeToMinutes(value);
		const hour24 = Math.floor(minutes / 60);
		const minute = minutes % 60;
		const suffix = hour24 >= 12 ? 'pm' : 'am';
		const hour = hour24 % 12 || 12;
		return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
	}

	function canSelect(row: DayInterval): boolean {
		return row.state === 'current' || (paperEntry && row.state === 'past');
	}

	function selectRow(row: DayInterval): void {
		if (!canSelect(row)) return;
		selectedStart = row.startTime;
		customOpen = false;
		customLabel = '';
	}

	function record(kind: IntervalKind): void {
		if (!selectedInterval || !canSelect(selectedInterval)) return;
		// A recalled stretch that merely covers this row is not the row's own
		// mark — recording here adds a sharper sample inside it, not a correction.
		const existing =
			selectedInterval.observation?.intervalStart === selectedInterval.startTime
				? selectedInterval.observation
				: null;
		const label =
			kind === 'elsewhere' && customLabel.trim()
				? customLabel.trim()
				: kindLabel(kind);

		store.observeInterval({
			date: selectedInterval.date,
			intervalStart: selectedInterval.startTime,
			kind,
			label,
			source:
				existing?.source ?? (paperEntry ? 'paper' : 'live')
		});
		queueSync();

		feedback = existing
			? 'sample corrected · same spore, clearer data'
			: paperEntry
				? 'paper mark entered · one spore'
				: 'observed · one spore';
		customOpen = false;
		customLabel = '';
		if (feedbackTimer) clearTimeout(feedbackTimer);
		feedbackTimer = setTimeout(() => (feedback = ''), 3200);
	}

	function startCustom(): void {
		customOpen = true;
		requestAnimationFrame(() => {
			document.querySelector<HTMLInputElement>('#carillon-custom-activity')?.focus();
		});
	}

	function printTomorrow(): void {
		window.print();
	}
</script>

<section class="instrument" aria-labelledby="today-heading">
	<header class="day-heading">
		<div>
			<p class="section-kicker">observed day · {todayKey}</p>
			<h1 id="today-heading">{dayOfWeekLabel(store.now)}, {shortDateLabel(store.now)}</h1>
			<p class="day-thesis">The plan is a hypothesis. The day is data.</p>
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
		<article class="sampler" data-testid="interval-sampler">
			<div class="sampler-meta">
				<div>
					<p class="interval-clock">
						{#if selectedInterval}
							{displayTime(selectedInterval.startTime)}–{displayTime(selectedInterval.endTime)}
						{:else}
							outside sampling hours
						{/if}
					</p>
					<p class="bell-note">
						{paperEntry ? 'paper transcription · no live bell' : bellStatus}
					</p>
				</div>
				<span class="sample-source" class:paper={paperEntry}>
					{paperEntry ? 'paper entry' : 'momentary sample'}
				</span>
			</div>

			<p class="plan-hint">
				<span>pile suggested</span>
				<strong>{selectedInterval?.plannedBlock?.title ?? 'nothing in particular'}</strong>
			</p>

			<h2>{paperEntry ? 'What was marked here?' : 'What is happening right now?'}</h2>
			<p class="sampler-sub">
				{paperEntry
					? 'Enter the paper mark without pretending it was sampled live.'
					: 'Tap what is true. Matching the pile earns nothing extra.'}
			</p>

			<div class="activity-grid" role="group" aria-label="observed activity">
				{#each INTERVAL_KIND_OPTIONS as option (option.kind)}
					<button
						type="button"
						class="activity-chip"
						class:selected={selectedInterval?.observation?.kind === option.kind}
						aria-pressed={selectedInterval?.observation?.kind === option.kind}
						onclick={() => option.kind === 'elsewhere' ? startCustom() : record(option.kind)}
						disabled={!selectedInterval || !canSelect(selectedInterval)}
					>
						<span class="activity-glyph" aria-hidden="true">{option.glyph}</span>
						<span>{option.label}</span>
					</button>
				{/each}
			</div>

			{#if customOpen}
				<form
					class="custom-activity"
					onsubmit={(event) => {
						event.preventDefault();
						record('elsewhere');
					}}
				>
					<label for="carillon-custom-activity">what is it?</label>
					<div>
						<input
							id="carillon-custom-activity"
							bind:value={customLabel}
							placeholder="transition, scrolling, groceries…"
						/>
						<button type="submit" disabled={!customLabel.trim()}>record</button>
					</div>
				</form>
			{/if}

			<div class="sample-footer">
				<p class="sample-feedback" aria-live="polite">
					{#if feedback}
						{feedback}
					{:else if selectedInterval?.observation}
						observed as {selectedInterval.observation.label}
						{#if selectedInterval.continuation} · part of a recalled stretch{:else if selectedInterval.observation.source === 'paper'} · entered from paper{:else if selectedInterval.observation.source === 'recall'} · recalled from memory{/if}
					{:else}
						An unplanned day is still a day. Start observing.
					{/if}
				</p>
				{#if selectedInterval?.observation}
					<span class="edit-note">tap another answer to correct it</span>
				{/if}
			</div>
		</article>

		<EchoCreature />
	</div>

	<CatchUp intervals={todayIntervals} {onopenroutines} {onopensurge} />

	<section class="ledger-card" aria-labelledby="ledger-heading">
		<header class="ledger-titlebar">
			<div>
				<p class="section-kicker">field sheet · {ledgerDateKey}</p>
				<h2 id="ledger-heading">Plan beside observation</h2>
			</div>
			<div class="ledger-controls">
				<span>{ledgerObservations.length} sampled moment{ledgerObservations.length === 1 ? '' : 's'}</span>
				<button
					type="button"
					class:active={paperEntry}
					aria-pressed={paperEntry}
					onclick={() => {
						paperEntry = !paperEntry;
						if (paperEntry) paperDate = todayKey;
					}}
				>
					{paperEntry ? 'paper entry on' : 'enter paper marks'}
				</button>
				{#if paperEntry}
					<label class="paper-date">
						<span>sheet date</span>
						<input type="date" max={todayKey} bind:value={paperDate} />
					</label>
				{/if}
			</div>
		</header>

		<div class="ledger-head" aria-hidden="true">
			<span>interval</span>
			<span>pile suggested</span>
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
							<i data-kind={row.observation.kind} aria-hidden="true"></i>
							{row.observation.label}
							{#if row.continuation}<sup>same stretch</sup>{:else if row.observation.source === 'paper'}<sup>paper</sup>{:else if row.observation.source === 'recall'}<sup>recalled</sup>{/if}
						{:else}
							<span class="hollow">—</span>
						{/if}
					</span>
				</button>
			{/each}
		</div>
		<p class="ledger-footnote">
			A hollow interval is unobserved—not failed. Paper marks and recalled stretches are labeled
			because live samples and remembered marks are different kinds of evidence.
		</p>
	</section>
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
		font-size: clamp(2.4rem, 5vw, 4.6rem);
		font-weight: 400;
		letter-spacing: -0.04em;
		line-height: 0.94;
	}

	.day-thesis {
		margin-top: 0.55rem;
		color: var(--car-mist);
		font-family: var(--car-body);
		font-size: 0.92rem;
		font-style: italic;
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
		grid-template-columns: minmax(0, 1.65fr) minmax(15rem, 0.75fr);
		gap: 1rem;
		align-items: stretch;
	}

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
		overflow: hidden;
		border-radius: 1rem 1rem 2.8rem 1rem;
		padding: clamp(1.15rem, 3vw, 2rem);
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

	.sampler-meta {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.interval-clock {
		font-family: var(--car-counter);
		font-size: clamp(1.35rem, 3vw, 2rem);
		letter-spacing: 0.04em;
		line-height: 1;
	}

	.bell-note {
		margin-top: 0.3rem;
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
	}

	.sample-source {
		border: 1px solid rgba(68, 54, 91, 0.18);
		border-radius: 999px;
		padding: 0.24rem 0.55rem;
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.52rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.sample-source.paper {
		border-style: dashed;
		color: var(--car-pink-dark);
	}

	.plan-hint {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		margin-top: 1.5rem;
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.62rem;
	}

	.plan-hint span {
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.plan-hint strong {
		font-weight: 500;
	}

	.sampler h2 {
		max-width: 13ch;
		margin-top: 0.55rem;
		font-family: var(--car-display);
		font-size: clamp(2rem, 4.5vw, 3.7rem);
		font-weight: 500;
		letter-spacing: -0.045em;
		line-height: 0.95;
	}

	.sampler-sub {
		margin-top: 0.6rem;
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.78rem;
	}

	.activity-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.45rem;
		margin-top: 1.4rem;
	}

	.activity-chip {
		display: grid;
		min-height: 4.4rem;
		place-items: center;
		gap: 0.2rem;
		border: 1px solid rgba(68, 54, 91, 0.16);
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.45);
		color: var(--car-ink);
		font-family: var(--car-mono);
		font-size: 0.58rem;
		line-height: 1.2;
		text-align: center;
		transition:
			transform 150ms ease,
			border-color 150ms ease,
			background 150ms ease;
	}

	.activity-chip:hover:not(:disabled),
	.activity-chip.selected {
		border-color: var(--car-pink-dark);
		background: var(--car-pink-wash);
		transform: translateY(-2px);
	}

	.activity-chip:disabled {
		cursor: default;
		opacity: 0.42;
	}

	.activity-glyph {
		color: var(--car-pink-dark);
		font-family: var(--car-display);
		font-size: 1.05rem;
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

	.sample-footer {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		min-height: 1.35rem;
		margin-top: 1rem;
		padding-right: 3rem;
	}

	.sample-feedback {
		color: var(--car-pink-dark);
		font-family: var(--car-mono);
		font-size: 0.64rem;
	}

	.edit-note {
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.5rem;
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

	.ledger-controls button {
		border: 1px solid rgba(68, 54, 91, 0.2);
		border-radius: 999px;
		padding: 0.35rem 0.65rem;
	}

	.ledger-controls button.active {
		border-color: var(--car-pink-dark);
		background: var(--car-pink-wash);
		color: var(--car-pink-dark);
	}

	.paper-date {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.paper-date span {
		font-size: 0.48rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.paper-date input {
		width: 7.8rem;
		border-bottom: 1px solid rgba(68, 54, 91, 0.28);
		padding: 0.2rem 0;
		color: var(--car-ink);
		font-family: var(--car-mono);
		font-size: 0.58rem;
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
		.activity-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.activity-chip {
			min-height: 3.65rem;
		}

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
		.print-action,
		.activity-chip {
			transition: none;
		}
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
