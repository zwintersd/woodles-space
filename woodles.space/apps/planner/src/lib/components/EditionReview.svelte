<script lang="ts">
	import { store } from '$lib/store.svelte';
	import {
		INTERVAL_KIND_OPTIONS,
		buildEchoesExport,
		intervalKey,
		sporeStats,
		timeForMinutes,
		type DayInterval
	} from '$lib/instrument';
	import { dateKey, timeToMinutes } from '$lib/utils';

	let selectedDate = $state('');
	let commentaryOn = $state(true);

	let availableDates = $derived(
		[...new Set(store.intervalObservations.map((observation) => observation.date))].sort((a, b) =>
			b.localeCompare(a)
		)
	);
	let activeDateKey = $derived(selectedDate || availableDates[0] || dateKey(store.now));
	let activeDate = $derived(dateFromKey(activeDateKey));
	let activeObservations = $derived(store.getObservationsForDate(activeDateKey));
	let activeEvents = $derived(store.sporeEvents.filter((event) => event.date === activeDateKey));
	let activeStats = $derived(sporeStats(activeEvents));
	let reviewRows = $derived(
		activeObservations.map(
			(observation): DayInterval => ({
				key: intervalKey(observation.date, observation.intervalStart),
				date: observation.date,
				startTime: observation.intervalStart,
				endTime: timeForMinutes(
					timeToMinutes(observation.intervalStart) + (observation.intervalMinutes ?? 15)
				),
				state: 'past',
				plannedBlock: null,
				observation
			})
		)
	);
	let commentaryKeys = $derived(
		new Set(reviewRows.filter((row) => row.observation).slice(0, 4).map((row) => row.key))
	);
	let surgeOnDate = $derived(
		store.surgeDrafts.filter((draft) => dateKey(new Date(draft.createdAt)) === activeDateKey)
	);

	$effect(() => {
		if (!selectedDate && availableDates[0]) selectedDate = availableDates[0];
	});

	function dateFromKey(key: string): Date {
		const [year, month, day] = key.split('-').map(Number);
		return new Date(year, month - 1, day, 12);
	}

	function dateLabel(key: string): string {
		return new Intl.DateTimeFormat(undefined, {
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		}).format(dateFromKey(key));
	}

	function displayTime(value: string): string {
		const minutes = timeToMinutes(value);
		const hour24 = Math.floor(minutes / 60);
		const minute = minutes % 60;
		return `${hour24 % 12 || 12}:${String(minute).padStart(2, '0')}${hour24 >= 12 ? 'p' : 'a'}`;
	}

	function commentaryFor(row: DayInterval): string {
		const observation = row.observation;
		if (!observation) return '';
		if (observation.source === 'recall') {
			return 'Recalled from memory in one broad stroke. The stretch stays one sample — sketch, not footage.';
		}
		if (observation.source === 'paper') {
			return 'Entered from the clipboard later. Carillon keeps it useful without pretending it was a live sample.';
		}

		const changed =
			Boolean(observation.plannedLabel) &&
			observation.plannedLabel?.toLocaleLowerCase() !== observation.label.toLocaleLowerCase();
		if (changed) {
			const weekday = activeDate.getDay();
			const priorChanges = store.intervalObservations.filter((candidate) => {
				if (candidate.intervalStart !== observation.intervalStart || !candidate.plannedLabel) return false;
				const candidateDate = dateFromKey(candidate.date);
				return (
					candidateDate.getDay() === weekday &&
					candidate.plannedLabel.toLocaleLowerCase() !== candidate.label.toLocaleLowerCase() &&
					candidate.date <= observation.date
				);
			}).length;
			if (priorChanges >= 3) {
				const weekdayName = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(activeDate);
				return `This is ${weekdayName}-pattern change #${priorChanges} at ${displayTime(observation.intervalStart)}. A pattern, not a verdict.`;
			}
			return `The pile said “${observation.plannedLabel}.” The sample said “${observation.label}.” Both stay in the cut.`;
		}

		return `A clean sample of “${observation.label}.” No pass/fail edit was added in post.`;
	}

	function downloadSporeExport(): void {
		const payload = buildEchoesExport(store.sporeEvents);
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const href = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = href;
		anchor.download = `carillon-spores-${dateKey(store.now)}.json`;
		anchor.click();
		URL.revokeObjectURL(href);
	}
</script>

<section class="review-page" aria-labelledby="review-heading">
	<header class="review-heading">
		<div>
			<p class="kicker">pop-up edition · observed days</p>
			<h1 id="review-heading">Retrospection with the commentary track on.</h1>
			<p>Look for repeated conditions, not evidence for a case against yourself.</p>
		</div>
		<div class="review-actions">
			<button
				type="button"
				class:active={commentaryOn}
				aria-pressed={commentaryOn}
				onclick={() => (commentaryOn = !commentaryOn)}
			>
				<span aria-hidden="true">◉</span>
				commentary {commentaryOn ? 'on' : 'off'}
			</button>
			<button type="button" onclick={downloadSporeExport}>
				<span aria-hidden="true">⇣</span>
				spores JSON
			</button>
		</div>
	</header>

	{#if availableDates.length > 0}
		<div class="edition-strip" aria-label="observed day editions">
			{#each availableDates as day, index (day)}
				<button
					type="button"
					aria-pressed={activeDateKey === day}
					class:active={activeDateKey === day}
					onclick={() => (selectedDate = day)}
				>
					<small>EDITION {String(availableDates.length - index).padStart(2, '0')}</small>
					<strong>{dateLabel(day)}</strong>
					<span>{store.getObservationsForDate(day).length} samples</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if activeObservations.length > 0}
		<div class="review-grid">
			<article class="edition-sheet">
				<header class="edition-header">
					<div>
						<p>CARILLON HOME VIDEO · BONUS FEATURES</p>
						<h2>{dateLabel(activeDateKey)}</h2>
					</div>
					<div class="edition-number">
						<span>sampled moments</span>
						<strong>{activeObservations.length}</strong>
					</div>
				</header>

				{#if surgeOnDate.length > 0 && commentaryOn}
					<aside class="surge-commentary">
						<span class="bubble-tail" aria-hidden="true"></span>
						<strong>PRODUCTION NOTE</strong>
						<p>
							{surgeOnDate[0].status === 'promoted' ? 'Surge draft later promoted from here:' : 'Surge draft captured here:'}
							“{surgeOnDate[0].title}” at
							{new Date(surgeOnDate[0].createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
						</p>
					</aside>
				{/if}

				<div class="edition-ledger">
					<div class="edition-ledger-head">
						<span>interval</span>
						<span>pile suggested</span>
						<span>observed</span>
					</div>
					{#each reviewRows as row (row.key)}
						<div class="edition-row" class:observed={Boolean(row.observation)}>
							{#if row.observation?.source === 'recall'}
								<time class="span-time">{displayTime(row.startTime)}–{displayTime(row.endTime)}</time>
							{:else}
								<time>{displayTime(row.startTime)}</time>
							{/if}
							<span class="planned">{row.observation?.plannedLabel ?? 'open'}</span>
							<span class="actual">
								{#if row.observation}
									<i data-kind={row.observation.kind}></i>
									{row.observation.label}
								{:else}
									<b>—</b>
								{/if}
							</span>
							{#if commentaryOn && commentaryKeys.has(row.key)}
								<aside class="row-commentary">
									<span class="bubble-tail" aria-hidden="true"></span>
									<strong>CARILLON SAYS</strong>
									<p>{commentaryFor(row)}</p>
								</aside>
							{/if}
						</div>
					{/each}
				</div>
			</article>

			<aside class="review-sidebar">
				<section class="shape-card">
					<p class="kicker">actual shape</p>
					<h2>Of sampled moments</h2>
					<p class="measurement-note">
						This describes the samples you took. It does not claim to reconstruct every minute.
					</p>
					<div class="distribution">
						{#each INTERVAL_KIND_OPTIONS as option (option.kind)}
							{@const count = activeStats[option.kind]}
							{#if count > 0}
								<div>
									<span>
										<b aria-hidden="true">{option.glyph}</b>
										{option.shortLabel}
									</span>
									<strong>{Math.round((count / activeObservations.length) * 100)}%</strong>
								</div>
								<progress max={activeObservations.length} value={count}>
									{count} of {activeObservations.length}
								</progress>
							{/if}
						{/each}
					</div>
				</section>

				<section class="extras-card">
					<p class="kicker">disc extras</p>
					<ul>
						<li>
							<span>live bell samples</span>
							<strong>{activeObservations.filter((item) => item.source === 'live').length}</strong>
						</li>
						<li>
							<span>paper marks</span>
							<strong>{activeObservations.filter((item) => item.source === 'paper').length}</strong>
						</li>
						<li>
							<span>recalled stretches</span>
							<strong>{activeObservations.filter((item) => item.source === 'recall').length}</strong>
						</li>
						<li>
							<span>spores generated</span>
							<strong>{activeEvents.length}</strong>
						</li>
						<li>
							<span>surge drafts</span>
							<strong>{surgeOnDate.length}</strong>
						</li>
					</ul>
				</section>
			</aside>
		</div>
	{:else}
		<div class="empty-review">
			<span aria-hidden="true">◎</span>
			<h2>The bonus track begins after the first sample.</h2>
			<p>A chaotic day is not missing footage. It is the footage.</p>
		</div>
	{/if}
</section>

<style>
	.review-page {
		display: grid;
		gap: 1rem;
	}

	.review-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.kicker {
		color: var(--car-pink);
		font-family: var(--car-mono);
		font-size: 0.61rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.review-heading h1 {
		max-width: 15ch;
		margin-top: 0.25rem;
		color: var(--car-cream);
		font-family: var(--car-display);
		font-size: clamp(2.35rem, 5vw, 4.4rem);
		font-weight: 400;
		letter-spacing: -0.04em;
		line-height: 0.95;
	}

	.review-heading > div > p:last-child {
		margin-top: 0.65rem;
		color: var(--car-mist);
		font-family: var(--car-body);
		font-size: 0.82rem;
	}

	.review-actions {
		display: flex;
		gap: 0.5rem;
	}

	.review-actions button {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--car-line);
		border-radius: 999px;
		padding: 0.5rem 0.75rem;
		color: var(--car-cream);
		font-family: var(--car-mono);
		font-size: 0.57rem;
	}

	.review-actions button.active {
		border-color: var(--car-pink);
		color: var(--car-pink);
	}

	.edition-strip {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0.15rem;
	}

	.edition-strip button {
		display: grid;
		flex: 0 0 auto;
		gap: 0.05rem;
		min-width: 9rem;
		border: 1px solid var(--car-line);
		border-radius: 0.7rem;
		padding: 0.55rem 0.7rem;
		color: var(--car-cream);
		text-align: left;
	}

	.edition-strip button.active {
		border-color: var(--car-pink);
		background: rgba(240, 154, 184, 0.1);
	}

	.edition-strip small,
	.edition-strip span {
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.45rem;
		letter-spacing: 0.07em;
	}

	.edition-strip strong {
		font-family: var(--car-body);
		font-size: 0.73rem;
		font-weight: 500;
	}

	.review-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.55fr) minmax(15rem, 0.55fr);
		gap: 1rem;
		align-items: start;
	}

	.edition-sheet,
	.review-sidebar section {
		border: 1px solid var(--car-line);
		border-radius: 1rem;
		background: var(--car-paper);
		color: var(--car-ink);
		box-shadow: 0 1.2rem 3rem var(--car-shadow);
	}

	.edition-sheet {
		position: relative;
		overflow: visible;
	}

	.edition-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.15rem;
		border-bottom: 3px double var(--car-pink-dark);
	}

	.edition-header p {
		color: var(--car-pink-dark);
		font-family: var(--car-mono);
		font-size: 0.5rem;
		letter-spacing: 0.12em;
	}

	.edition-header h2 {
		margin-top: 0.2rem;
		font-family: var(--car-display);
		font-size: 1.8rem;
		font-weight: 500;
		line-height: 1;
	}

	.edition-number {
		display: grid;
		text-align: right;
	}

	.edition-number span {
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.48rem;
		text-transform: uppercase;
	}

	.edition-number strong {
		font-family: var(--car-counter);
		font-size: 1.7rem;
		font-weight: 400;
	}

	.surge-commentary,
	.row-commentary {
		z-index: 2;
		border: 1px solid var(--car-pink-dark);
		border-radius: 0.75rem;
		background: #fff0b9;
		box-shadow: 0.35rem 0.45rem 0 rgba(68, 54, 91, 0.16);
		color: var(--car-ink);
		transform: rotate(-1deg);
	}

	.surge-commentary {
		margin: 0.8rem 1.15rem;
		padding: 0.7rem 0.8rem;
	}

	.surge-commentary strong,
	.row-commentary strong {
		color: var(--car-pink-dark);
		font-family: var(--car-mono);
		font-size: 0.45rem;
		letter-spacing: 0.1em;
	}

	.surge-commentary p,
	.row-commentary p {
		margin-top: 0.2rem;
		font-family: var(--car-body);
		font-size: 0.62rem;
		line-height: 1.35;
	}

	.edition-ledger-head,
	.edition-row {
		display: grid;
		grid-template-columns: 5.3rem minmax(7rem, 1fr) minmax(8rem, 1.1fr);
		align-items: center;
	}

	.edition-ledger-head {
		padding: 0.45rem 1rem;
		border-bottom: 1px solid rgba(68, 54, 91, 0.12);
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.45rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.edition-row {
		position: relative;
		min-height: 2.15rem;
		padding: 0.3rem 1rem;
		border-bottom: 1px solid rgba(68, 54, 91, 0.08);
	}

	.edition-row.observed {
		background: rgba(141, 49, 83, 0.035);
	}

	.edition-row time {
		color: var(--car-pink-dark);
		font-family: var(--car-counter);
		font-size: 0.9rem;
	}

	.edition-row time.span-time {
		padding-right: 0.3rem;
		font-size: 0.66rem;
		line-height: 1.15;
	}

	.edition-row .planned {
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.62rem;
	}

	.edition-row .actual {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--car-mono);
		font-size: 0.56rem;
	}

	.edition-row .actual i {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--car-pink-dark);
	}

	.edition-row .actual b {
		color: rgba(68, 54, 91, 0.22);
		font-weight: 400;
	}

	.row-commentary {
		position: absolute;
		top: -0.4rem;
		right: -11.3rem;
		width: 10.5rem;
		padding: 0.55rem 0.65rem;
	}

	.row-commentary:nth-child(even) {
		transform: rotate(1deg);
	}

	.bubble-tail {
		position: absolute;
		left: -0.45rem;
		top: 0.85rem;
		width: 0.8rem;
		height: 0.8rem;
		border-bottom: 1px solid var(--car-pink-dark);
		border-left: 1px solid var(--car-pink-dark);
		background: #fff0b9;
		transform: rotate(45deg);
	}

	.surge-commentary {
		position: relative;
	}

	.surge-commentary .bubble-tail {
		top: -0.42rem;
		left: 2rem;
		border-top: 1px solid var(--car-pink-dark);
		border-right: 1px solid var(--car-pink-dark);
		border-bottom: none;
		border-left: none;
	}

	.review-sidebar {
		display: grid;
		gap: 1rem;
		margin-right: 0;
	}

	.review-sidebar section {
		padding: 1rem;
	}

	.review-sidebar .kicker {
		color: var(--car-pink-dark);
	}

	.review-sidebar h2 {
		margin-top: 0.25rem;
		font-family: var(--car-display);
		font-size: 1.45rem;
		font-weight: 500;
	}

	.measurement-note {
		margin-top: 0.4rem;
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.62rem;
		font-style: italic;
	}

	.distribution {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.45rem 0.5rem;
		margin-top: 0.85rem;
	}

	.distribution > div {
		display: contents;
	}

	.distribution span,
	.distribution strong {
		font-family: var(--car-mono);
		font-size: 0.54rem;
	}

	.distribution span b {
		display: inline-block;
		width: 1.2rem;
		color: var(--car-pink-dark);
	}

	.distribution strong {
		font-weight: 500;
		text-align: right;
	}

	.distribution progress {
		grid-column: 1 / -1;
		width: 100%;
		height: 0.22rem;
		border: 0;
		border-radius: 999px;
		background: rgba(68, 54, 91, 0.1);
	}

	.distribution progress::-webkit-progress-bar {
		border-radius: 999px;
		background: rgba(68, 54, 91, 0.1);
	}

	.distribution progress::-webkit-progress-value {
		border-radius: 999px;
		background: var(--car-pink-dark);
	}

	.extras-card ul {
		display: grid;
		gap: 0.45rem;
		margin-top: 0.8rem;
		list-style: none;
	}

	.extras-card li {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		border-top: 1px solid rgba(68, 54, 91, 0.1);
		padding-top: 0.4rem;
		font-family: var(--car-mono);
		font-size: 0.52rem;
	}

	.extras-card li span {
		color: var(--car-ink-soft);
	}

	.empty-review {
		display: grid;
		min-height: 22rem;
		place-items: center;
		align-content: center;
		gap: 0.5rem;
		border: 1px dashed var(--car-line);
		border-radius: 1rem;
		color: var(--car-mist);
		text-align: center;
	}

	.empty-review span {
		color: var(--car-pink);
		font-size: 1.4rem;
	}

	.empty-review h2 {
		font-family: var(--car-display);
		font-size: 1.7rem;
		font-weight: 400;
	}

	.empty-review p {
		font-family: var(--car-body);
		font-size: 0.74rem;
		font-style: italic;
	}

	@media (min-width: 1120px) {
		.review-grid {
			padding-right: 11rem;
		}
	}

	@media (max-width: 1119px) {
		.row-commentary {
			position: relative;
			top: auto;
			right: auto;
			grid-column: 2 / -1;
			width: auto;
			margin: 0.35rem 0 0.45rem;
			transform: none;
		}

		.edition-row:has(.row-commentary) {
			padding-top: 0.5rem;
			padding-bottom: 0.5rem;
		}
	}

	@media (max-width: 850px) {
		.review-grid {
			grid-template-columns: 1fr;
		}

		.review-sidebar {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 620px) {
		.review-heading {
			align-items: flex-start;
			flex-direction: column;
		}

		.review-actions {
			flex-wrap: wrap;
		}

		.review-sidebar {
			grid-template-columns: 1fr;
		}

		.edition-ledger-head,
		.edition-row {
			grid-template-columns: 4.4rem minmax(5rem, 0.8fr) minmax(6rem, 1fr);
		}

		.edition-row,
		.edition-ledger-head {
			padding-right: 0.65rem;
			padding-left: 0.65rem;
		}
	}
</style>
