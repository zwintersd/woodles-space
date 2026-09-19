<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import {
		SIGNAL_KIND_OPTIONS,
		activeCustomSignals,
		activeIllnessEntry,
		cycleRead,
		illnessRead,
		paydayRead,
		signalLabel
	} from '$lib/signals';
	import { dateKey } from '$lib/utils';
	import type { SignalKind, SleepQuality } from '$lib/types';


	let todayKey = $derived(dateKey(store.now));
	let sleep = $derived(store.getSleepLog(todayKey));
	let editingSleep = $state(false);

	let cycle = $derived(cycleRead(store.signalEntries, todayKey));
	let payday = $derived(paydayRead(store.signalEntries, todayKey));
	let illnessEntry = $derived(activeIllnessEntry(store.signalEntries, todayKey));
	let illness = $derived(illnessRead(store.signalEntries, todayKey));
	let customActive = $derived(activeCustomSignals(store.signalEntries, todayKey));
	let hasOngoing = $derived(
		Boolean(cycle || payday || illness) || customActive.length > 0
	);

	let logOpen = $state(false);
	let newKind = $state<SignalKind>('cycle');
	// Set for real by openLogForm() before the form ever shows — this initial
	// value only avoids an uninitialized-input flash.
	let newDate = $state('');
	let newEndDate = $state('');
	let newLabel = $state('');
	let newNote = $state('');
	let feedback = $state('');
	let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

	function say(message: string): void {
		feedback = message;
		if (feedbackTimer) clearTimeout(feedbackTimer);
		feedbackTimer = setTimeout(() => (feedback = ''), 4000);
	}

	function logSleep(quality: SleepQuality): void {
		store.recordSleep(quality, todayKey);
		queueSync();
		editingSleep = false;
	}

	function openLogForm(kind?: SignalKind): void {
		logOpen = true;
		newKind = kind ?? 'cycle';
		newDate = todayKey;
		newEndDate = '';
		newLabel = '';
		newNote = '';
	}

	function submitSignal(event: Event): void {
		event.preventDefault();
		const entry = store.addSignalEntry({
			kind: newKind,
			date: newDate,
			endDate: newEndDate || undefined,
			label: newLabel || undefined,
			note: newNote || undefined
		});
		if (!entry) {
			say('give it a name first');
			return;
		}
		queueSync();
		say(`${signalLabel(entry)} logged`);
		logOpen = false;
	}

	function endSpan(id: string): void {
		store.endSignalEntry(id, todayKey);
		queueSync();
		say('marked as ended today');
	}

	function removeEntry(id: string): void {
		store.removeSignalEntry(id);
		queueSync();
	}
</script>

<section class="capacity" aria-label="Sleep and context" data-testid="context-card">
<header class="cap-heading"><h2>Sleep and context</h2></header>
	<div class="sleep-row">
		{#if sleep && !editingSleep}
			<button type="button" class="sleep-said" onclick={() => (editingSleep = true)}>
				<span>slept</span>
				<strong>{sleep.quality}</strong>
				<small>change</small>
			</button>
		{:else}
			<div class="sleep-ask">
				<span>how was your sleep?</span>
				<div class="sleep-chips" role="group" aria-label="sleep quality">
					<button type="button" onclick={() => logSleep('rough')}>rough</button>
					<button type="button" onclick={() => logSleep('okay')}>okay</button>
					<button type="button" onclick={() => logSleep('good')}>good</button>
				</div>
			</div>
		{/if}
	</div>

	<div class="ongoing">
		{#if hasOngoing}
			<div class="ongoing-chips">
				{#if cycle}
					<span class="ongoing-chip">
						cycle day {cycle.dayOfCycle}{cycle.estimated ? ' · estimated' : ''}
					</span>
				{/if}
				{#if payday}
					<span class="ongoing-chip">
						{payday.daysUntil === 0 ? 'payday today' : `${payday.daysUntil}d to payday`}
					</span>
				{/if}
				{#if illness && illnessEntry}
					<span class="ongoing-chip warn">
						{illness.daysSick === 1 ? 'unwell today' : `day ${illness.daysSick} unwell`}
						<button type="button" onclick={() => endSpan(illnessEntry.id)}>recovered</button>
					</span>
				{/if}
				{#each customActive as entry (entry.id)}
					<span class="ongoing-chip">
						{signalLabel(entry)}
						{#if !entry.endDate}
							<button type="button" onclick={() => endSpan(entry.id)}>end today</button>
						{/if}
						<button
							type="button"
							class="remove"
							aria-label={`remove ${signalLabel(entry)}`}
							onclick={() => removeEntry(entry.id)}>×</button
						>
					</span>
				{/each}
			</div>
		{/if}

		<button type="button" class="log-toggle" onclick={() => (logOpen ? (logOpen = false) : openLogForm())}>
			{logOpen ? 'close' : '+ log something ongoing'}
		</button>

		{#if logOpen}
			<form class="signal-form" onsubmit={submitSignal}>
				<div class="signal-kinds" role="group" aria-label="what kind of thing">
					{#each SIGNAL_KIND_OPTIONS as option (option.kind)}
						<button
							type="button"
							class:active={newKind === option.kind}
							aria-pressed={newKind === option.kind}
							onclick={() => (newKind = option.kind)}
						>
							<span aria-hidden="true">{option.glyph}</span>
							{option.label}
						</button>
					{/each}
				</div>
				<p class="signal-hint">
					{SIGNAL_KIND_OPTIONS.find((option) => option.kind === newKind)?.hint}
				</p>

				<div class="signal-fields">
					<label>
						<span>date</span>
						<input type="date" bind:value={newDate} required />
					</label>
					{#if newKind === 'illness' || newKind === 'custom'}
						<label>
							<span>ends (optional)</span>
							<input type="date" bind:value={newEndDate} />
						</label>
					{/if}
					{#if newKind === 'custom'}
						<label class="wide">
							<span>what is it?</span>
							<input bind:value={newLabel} placeholder="started new medication, travel…" />
						</label>
					{/if}
				</div>
				<button type="submit" class="save-signal">log it</button>
			</form>
		{/if}
	</div>

	<p class="cap-feedback" aria-live="polite">{feedback}</p>
</section>

<style>
	.capacity {
		display: grid;
		gap: 0.85rem;
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

	.cap-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.cap-heading h2 {
		margin-top: 0.35rem;
		font-family: var(--car-display);
		font-size: clamp(1.4rem, 3vw, 2.1rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1.05;
	}

	.sleep-row {
		display: flex;
	}

	.sleep-said {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		border: 1px solid rgba(68, 54, 91, 0.2);
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		color: var(--car-ink);
		font-family: var(--car-body);
		font-size: 0.75rem;
	}

	.sleep-said small {
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.52rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.sleep-ask {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.sleep-ask > span {
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.78rem;
	}

	.sleep-chips {
		display: flex;
		gap: 0.4rem;
	}

	.sleep-chips button {
		border: 1px solid rgba(68, 54, 91, 0.2);
		border-radius: 999px;
		padding: 0.3rem 0.75rem;
		color: var(--car-ink);
		font-family: var(--car-mono);
		font-size: 0.62rem;
		text-transform: lowercase;
		transition:
			border-color 150ms ease,
			background 150ms ease;
	}

	.sleep-chips button:hover {
		border-color: var(--car-pink-dark);
		background: var(--car-pink-wash);
	}

	.ongoing {
		display: grid;
		gap: 0.6rem;
		border-top: 1px dashed rgba(68, 54, 91, 0.2);
		padding-top: 0.75rem;
	}

	.ongoing-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.ongoing-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid rgba(68, 54, 91, 0.2);
		border-radius: 999px;
		padding: 0.3rem 0.65rem;
		color: var(--car-ink);
		font-family: var(--car-mono);
		font-size: 0.58rem;
		letter-spacing: 0.02em;
	}

	.ongoing-chip.warn {
		border-color: var(--car-pink-dark);
		background: var(--car-pink-wash);
		color: var(--car-pink-dark);
	}

	.ongoing-chip button {
		color: var(--car-pink-dark);
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	.ongoing-chip button.remove {
		text-decoration: none;
		color: var(--car-ink-soft);
		font-size: 0.75rem;
	}

	.log-toggle {
		justify-self: start;
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
	}

	.log-toggle:hover {
		color: var(--car-pink-dark);
	}

	.signal-form {
		display: grid;
		gap: 0.6rem;
		border: 1px dashed rgba(68, 54, 91, 0.24);
		border-radius: 0.75rem;
		padding: 0.75rem;
	}

	.signal-kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.signal-kinds button {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: 1px solid rgba(68, 54, 91, 0.2);
		border-radius: 999px;
		padding: 0.3rem 0.65rem;
		color: var(--car-ink);
		font-family: var(--car-mono);
		font-size: 0.58rem;
	}

	.signal-kinds button.active {
		border-color: var(--car-pink-dark);
		background: var(--car-pink-wash);
	}

	.signal-hint {
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.68rem;
		font-style: italic;
	}

	.signal-fields {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.signal-fields label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.signal-fields label.wide {
		flex: 1;
		min-width: 12rem;
	}

	.signal-fields label span {
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.52rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.signal-fields input {
		border-bottom: 1px solid rgba(68, 54, 91, 0.28);
		background: transparent;
		padding: 0.25rem 0.1rem;
		color: var(--car-ink);
		font-family: var(--car-body);
	}

	.save-signal {
		justify-self: start;
		border-radius: 999px;
		background: var(--car-ink);
		padding: 0.35rem 0.85rem;
		color: var(--car-paper);
		font-family: var(--car-mono);
		font-size: 0.62rem;
	}

	.cap-feedback {
		min-height: 1em;
		color: var(--car-pink-dark);
		font-family: var(--car-mono);
		font-size: 0.58rem;
	}

	@media (prefers-reduced-motion: reduce) {
		 .sleep-chips button { transition: none; }
	}
</style>
