<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { onboarding } from '$lib/onboarding.store.svelte';
	import { STEP_COPY, PLACEHOLDERS } from '$lib/onboarding.copy';
	import StepShell from './StepShell.svelte';

	const copy = STEP_COPY[2];

	let name = $state('');
	let startTime = $state('07:00');
	let endTime = $state('07:30');

	function addRitual() {
		if (!name.trim()) return;
		store.addRitual({ name: name.trim(), startTime, endTime });
		name = '';
		startTime = '07:00';
		endTime = '07:30';
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
	stage={3}
	onAdvance={advance}
>
	{#if store.rituals.length > 0}
		<ul class="rit-list">
			{#each store.rituals as r (r.id)}
				<li class="rit-row">
					<span class="rit-name">{r.name}</span>
					<span class="rit-time">{r.startTime}–{r.endTime}</span>
					<button class="rit-rm" onclick={() => store.removeRitual(r.id)} title="remove">×</button>
				</li>
			{/each}
		</ul>
	{/if}

	<form class="rit-form" onsubmit={(e) => { e.preventDefault(); addRitual(); }}>
		<input
			class="rit-input"
			bind:value={name}
			placeholder={PLACEHOLDERS.ritualName}
			autocomplete="off"
			spellcheck="false"
		/>

		<div class="rit-times">
			<input type="time" class="rit-time-input" bind:value={startTime} />
			<span class="rit-time-sep">→</span>
			<input type="time" class="rit-time-input" bind:value={endTime} />
			<button type="submit" class="rit-add" disabled={!name.trim()}>+ add</button>
		</div>
	</form>

	<p class="rit-hint">applies to every day. you can override on any single date later.</p>
</StepShell>

<style>
	.rit-list {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
	}

	.rit-row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 0.6rem;
		align-items: center;
		padding: 0.55rem 0.8rem;
		background: var(--p-surface);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-sm);
		transition: var(--pl-transition-palette);
	}

	.rit-name {
		font-family: var(--pl-font-body);
		font-size: 0.95rem;
		color: var(--p-text);
	}

	.rit-time {
		font-family: var(--pl-font-mono);
		font-size: 0.62rem;
		color: var(--p-muted);
		letter-spacing: 0.06em;
	}

	.rit-rm {
		font-family: var(--pl-font-mono);
		font-size: 0.95rem;
		line-height: 1;
		color: var(--p-muted);
		opacity: 0.4;
		padding: 2px 6px;
	}

	.rit-rm:hover { opacity: 1; color: var(--p-accent); }

	.rit-form {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.85rem;
		border: 1px dashed var(--p-border);
		border-radius: var(--pl-radius-md);
	}

	.rit-input {
		font-family: var(--pl-font-body);
		font-size: 1rem;
		color: var(--p-text);
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--p-border);
		padding: 6px 2px;
		transition: border-color var(--pl-transition-fast);
	}

	.rit-input::placeholder {
		font-family: var(--pl-font-body);
		font-style: italic;
		color: var(--p-muted);
		opacity: 0.5;
	}

	.rit-input:focus {
		border-color: var(--p-accent);
		outline: none;
	}

	.rit-times {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.rit-time-input {
		font-family: var(--pl-font-mono);
		font-size: 0.78rem;
		color: var(--p-text);
		background: var(--p-bg);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-sm);
		padding: 5px 7px;
	}

	.rit-time-input:focus {
		border-color: var(--p-accent);
		outline: none;
	}

	.rit-time-sep {
		font-family: var(--pl-font-mono);
		color: var(--p-muted);
		opacity: 0.5;
	}

	.rit-add {
		margin-left: auto;
		font-family: var(--pl-font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		color: var(--p-text);
		border: 1px solid var(--p-border);
		padding: 6px 12px;
		border-radius: var(--pl-radius-pill);
	}

	.rit-add:hover:not(:disabled) {
		border-color: var(--p-accent);
		color: var(--p-accent);
	}

	.rit-add:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.rit-hint {
		font-family: var(--pl-font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.05em;
		color: var(--p-muted);
		opacity: 0.55;
		font-style: italic;
	}
</style>
