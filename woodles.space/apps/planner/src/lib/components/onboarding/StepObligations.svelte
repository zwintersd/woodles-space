<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { onboarding } from '$lib/onboarding.store.svelte';
	import { STEP_COPY, PLACEHOLDERS } from '$lib/onboarding.copy';
	import StepShell from './StepShell.svelte';

	const copy = STEP_COPY[1];
	const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

	let name = $state('');
	let weekdays = $state<number[]>([]);
	let startTime = $state('09:00');
	let endTime = $state('10:00');

	function toggleDay(d: number) {
		weekdays = weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d];
	}

	function addObligation() {
		if (!name.trim() || weekdays.length === 0) return;
		store.addObligation({ name: name.trim(), weekdays: [...weekdays], startTime, endTime });
		name = '';
		weekdays = [];
		startTime = '09:00';
		endTime = '10:00';
	}

	function advance() {
		onboarding.advance();
	}
</script>

<StepShell
	eyebrow={copy.eyebrow}
	heading={copy.heading}
	subprompt={copy.subprompt}
	cta={copy.cta}
	stage={2}
	onAdvance={advance}
>
	{#if store.obligations.length > 0}
		<ul class="obl-list">
			{#each store.obligations as o (o.id)}
				<li class="obl-row">
					<span class="obl-name">{o.name}</span>
					<span class="obl-meta">
						{#each o.weekdays as d}<span class="obl-day">{WEEKDAY_LABELS[d]}</span>{/each}
					</span>
					<span class="obl-time">{o.startTime}–{o.endTime}</span>
					<button class="obl-rm" onclick={() => store.removeObligation(o.id)} title="remove">×</button>
				</li>
			{/each}
		</ul>
	{/if}

	<form class="obl-form" onsubmit={(e) => { e.preventDefault(); addObligation(); }}>
		<input
			class="obl-input"
			bind:value={name}
			placeholder={PLACEHOLDERS.obligationName}
			autocomplete="off"
			spellcheck="false"
		/>

		<div class="obl-dows" role="group" aria-label="days of the week">
			{#each WEEKDAY_LABELS as label, i}
				<button
					type="button"
					class="obl-dow"
					class:active={weekdays.includes(i)}
					onclick={() => toggleDay(i)}
				>{label}</button>
			{/each}
		</div>

		<div class="obl-times">
			<input type="time" class="obl-time-input" bind:value={startTime} />
			<span class="obl-time-sep">→</span>
			<input type="time" class="obl-time-input" bind:value={endTime} />
			<button
				type="submit"
				class="obl-add"
				disabled={!name.trim() || weekdays.length === 0}
			>+ add</button>
		</div>
	</form>

	<p class="obl-hint">add as many as you like, or none — you can always come back.</p>
</StepShell>

<style>
	.obl-list {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
	}

	.obl-row {
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		gap: 0.6rem;
		align-items: center;
		padding: 0.55rem 0.8rem;
		background: var(--p-surface);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-sm);
		transition: var(--pl-transition-palette);
	}

	.obl-name {
		font-family: var(--pl-font-body);
		font-size: 0.95rem;
		color: var(--p-text);
	}

	.obl-meta {
		display: flex;
		gap: 0.18rem;
	}

	.obl-day {
		font-family: var(--pl-font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.05em;
		padding: 2px 5px;
		border-radius: 3px;
		background: var(--p-accent-soft);
		color: var(--p-accent);
	}

	.obl-time {
		font-family: var(--pl-font-mono);
		font-size: 0.62rem;
		color: var(--p-muted);
		letter-spacing: 0.06em;
	}

	.obl-rm {
		font-family: var(--pl-font-mono);
		font-size: 0.95rem;
		line-height: 1;
		color: var(--p-muted);
		opacity: 0.4;
		padding: 2px 6px;
		transition: opacity var(--pl-transition-fast), color var(--pl-transition-fast);
	}

	.obl-rm:hover { opacity: 1; color: var(--p-accent); }

	.obl-form {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 0.85rem;
		border: 1px dashed var(--p-border);
		border-radius: var(--pl-radius-md);
	}

	.obl-input {
		font-family: var(--pl-font-body);
		font-size: 1rem;
		color: var(--p-text);
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--p-border);
		padding: 6px 2px;
		transition: border-color var(--pl-transition-fast);
	}

	.obl-input::placeholder {
		font-family: var(--pl-font-body);
		font-style: italic;
		color: var(--p-muted);
		opacity: 0.5;
	}

	.obl-input:focus {
		border-color: var(--p-accent);
		outline: none;
	}

	.obl-dows {
		display: flex;
		gap: 4px;
		justify-content: flex-start;
		flex-wrap: wrap;
	}

	.obl-dow {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		color: var(--p-muted);
		border: 1px solid var(--p-border);
		padding: 5px 9px;
		border-radius: var(--pl-radius-pill);
		min-width: 2.2rem;
		transition: all var(--pl-transition-fast);
	}

	.obl-dow:hover {
		color: var(--p-accent);
		border-color: var(--p-accent);
	}

	.obl-dow.active {
		background: var(--p-accent);
		color: var(--p-bg);
		border-color: var(--p-accent);
	}

	.obl-times {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.obl-time-input {
		font-family: var(--pl-font-mono);
		font-size: 0.78rem;
		color: var(--p-text);
		background: var(--p-bg);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-sm);
		padding: 5px 7px;
		transition: border-color var(--pl-transition-fast);
	}

	.obl-time-input:focus {
		border-color: var(--p-accent);
		outline: none;
	}

	.obl-time-sep {
		font-family: var(--pl-font-mono);
		color: var(--p-muted);
		opacity: 0.5;
	}

	.obl-add {
		margin-left: auto;
		font-family: var(--pl-font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		color: var(--p-text);
		border: 1px solid var(--p-border);
		padding: 6px 12px;
		border-radius: var(--pl-radius-pill);
		transition: all var(--pl-transition-fast);
	}

	.obl-add:hover:not(:disabled) {
		border-color: var(--p-accent);
		color: var(--p-accent);
	}

	.obl-add:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.obl-hint {
		font-family: var(--pl-font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.05em;
		color: var(--p-muted);
		opacity: 0.55;
		font-style: italic;
	}
</style>
