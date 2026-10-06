<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { onboarding } from '$lib/onboarding.store.svelte';
	import { STEP_COPY, PLACEHOLDERS } from '$lib/onboarding.copy';
	import { queueSync } from '$lib/sync.svelte';
	import { timeToMinutes } from '$lib/utils';
	import StepShell from './StepShell.svelte';

	const copy = STEP_COPY[2];

	let routineName = $state('');
	let cue = $state('');
	let steps = $state('');
	let routineNameInput: HTMLInputElement;
	let stepsInput: HTMLTextAreaElement;
	let notice = $state('');
	const routines = $derived(store.routines.filter(r => !r.archived && !r.deletedAt));
	function addRoutine() {
		if (!store.addRoutine(routineName, steps.split('\n'), cue)) {
			notice = 'Add a routine name and at least one step.';
			if (!routineName.trim()) routineNameInput.focus();
			else stepsInput.focus();
			return false;
		}
		routineName = ''; cue = ''; steps = '';
		queueSync();
		notice = 'Routine added.';
		return true;
	}
	let name = $state('');
	let startTime = $state('07:00');
	let endTime = $state('07:30');
	let activityForm: HTMLFormElement;
	let dailyActivities: HTMLDetailsElement;
	let activityNameInput: HTMLInputElement;
	let activityEndInput: HTMLInputElement;

	function addRitual() {
		dailyActivities.open = true;
		activityNameInput.setCustomValidity(name.trim() ? '' : 'Enter an activity name.');
		activityEndInput.setCustomValidity(startTime && endTime && timeToMinutes(endTime) <= timeToMinutes(startTime)
			? 'Choose an end time after the start time.' : '');
		if (!activityForm.reportValidity()) return false;
		store.addRitual({ name: name.trim(), startTime, endTime });
		name = '';
		startTime = '07:00';
		endTime = '07:30';
		queueSync();
		return true;
	}

	function advance() {
		if ((routineName.trim() || cue.trim() || steps.trim()) && !addRoutine()) return;
		if (name.trim() || startTime !== '07:00' || endTime !== '07:30') {
			dailyActivities.open = true;
			if (!addRitual()) {
				return;
			}
		}
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
	<section class="wb-card routines-card" aria-label="Reusable routines">
		<h2>Reusable routines</h2>
		<p>Run these checklists from Routines or link them to a day pile activity.</p>
		<div class="routine-list">
			{#each routines as routine (routine.id)}
				<details class="routine-item"><summary>{routine.name} · {routine.steps.length} {routine.steps.length === 1 ? 'step' : 'steps'}</summary>
					<div class="routine-preview">
						{#if routine.cue}<p><strong>Cue:</strong> {routine.cue}</p>{/if}
						<ol>{#each routine.steps as step (step.id)}<li>{step.label}</li>{/each}</ol>
					</div>
				</details>
			{:else}
				<p>No routines yet. Add one below, or continue and create one later.</p>
			{/each}
		</div>
		<form class="wb-list routine-form" aria-label="Add a routine" onsubmit={(e) => { e.preventDefault(); addRoutine(); }}>
			<h3>Add a routine</h3>
			<label>Routine name<input required bind:this={routineNameInput} bind:value={routineName} placeholder="e.g. Start work" /></label>
			<label>Cue<input bind:value={cue} aria-describedby="routine-cue-hint" placeholder="e.g. After breakfast" /></label>
			<p id="routine-cue-hint" class="field-hint">Optional: what reminds you to begin?</p>
			<label>Steps, one per line<textarea required rows="4" bind:this={stepsInput} bind:value={steps} placeholder={'Open notebook\nChoose one task\nGather what you need'}></textarea></label>
			<button type="submit" disabled={!routineName.trim() || !steps.trim()}>+ Add routine</button>
		</form>
		<p class="routine-notice" role="status">{notice}</p>
		<p class="wb-note">Edit, reorder, archive, or delete routines later in Routines. Saved practice records keep their original steps.</p>
	</section>
	<details class="wb-card daily-activities" bind:this={dailyActivities}><summary>Daily activities at a fixed time (optional)</summary>
	<p>These appear every day, separately from routine checklists and day piles.</p>
	{#if store.rituals.length > 0}
		<ul class="rit-list">
			{#each store.rituals as r (r.id)}
				<li class="rit-row">
					<span class="rit-name">{r.name}</span>
					<span class="rit-time">{r.startTime}–{r.endTime}</span>
					<button class="rit-rm" onclick={() => { store.removeRitual(r.id); queueSync(); }} aria-label={`Remove daily activity ${r.name}`}>×</button>
				</li>
			{/each}
		</ul>
	{/if}

	<form class="rit-form" bind:this={activityForm} aria-label="Add a daily activity" onsubmit={(e) => { e.preventDefault(); addRitual(); }}>
		<label>Activity name
		<input
			class="rit-input"
			bind:this={activityNameInput}
			bind:value={name}
			oninput={() => activityNameInput.setCustomValidity('')}
			placeholder={PLACEHOLDERS.ritualName}
			autocomplete="off"
			spellcheck="false"
			required
		/>
		</label>

		<div class="rit-times">
			<label>Starts at<input type="time" class="rit-time-input" required bind:value={startTime} oninput={() => activityEndInput.setCustomValidity('')} /></label>
			<label>Ends at<input type="time" class="rit-time-input" required bind:this={activityEndInput} bind:value={endTime} oninput={() => activityEndInput.setCustomValidity('')} /></label>
			<button type="submit" class="rit-add" disabled={!name.trim() || !startTime || !endTime}>+ Add daily activity</button>
		</div>
	</form>

	<p class="rit-hint">applies to every day. you can override on any single date later.</p>
</details>
</StepShell>

<style>
	.routines-card { display: grid; gap: .8rem; }
	.routine-list { display: grid; gap: .5rem; }
	.routine-item { border: 1px solid var(--p-border); border-radius: var(--pl-radius-sm); padding: 0 .75rem; }
	.routine-preview { padding-bottom: .5rem; }
	.routine-form { border-top: 1px solid var(--p-border); padding-top: 1rem; }
	.routine-form button { justify-self: start; }
	.routine-form .field-hint { margin-top: -.55rem; }
	.routine-notice:empty { display: none; }
	.daily-activities { display: grid; gap: .8rem; }
	.daily-activities:not([open]) { display: block; }
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
		overflow-wrap: anywhere;
		min-width: 0;
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
		opacity: 1;
	}

	.rit-input:focus {
		border-color: var(--p-accent);
		outline: none;
	}

	.rit-times {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		align-items: end;
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
		font-style: italic;
	}
</style>
