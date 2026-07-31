<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { routineScaffoldLevel } from '$lib/instrument';
	import { dateKey } from '$lib/utils';
	import type { RoutineStepResult } from '$lib/types';

	let selectedRoutineId = $state('');
	let results = $state<Record<string, RoutineStepResult>>({});
	let loadedPracticeKey = $state('');
	let showAllSteps = $state(false);
	let notice = $state('');
	let adding = $state(false);
	let newName = $state('');
	let newCue = $state('');
	let newSteps = $state('');

	let activeRoutines = $derived(store.routines.filter((routine) => !routine.archived));
	let selectedRoutine = $derived(
		activeRoutines.find((routine) => routine.id === selectedRoutineId) ?? activeRoutines[0] ?? null
	);
	let todayKey = $derived(dateKey(store.now));
	let selectedLevel = $derived(
		selectedRoutine
			? routineScaffoldLevel(selectedRoutine.id, store.routinePractices)
			: 'full'
	);
	let selectedPractices = $derived(
		selectedRoutine
			? store.routinePractices
					.filter((practice) => practice.routineId === selectedRoutine.id)
					.sort((a, b) => b.date.localeCompare(a.date))
			: []
	);
	let averageRecent = $derived.by(() => {
		const recent = selectedPractices.slice(0, 3);
		if (recent.length === 0) return null;
		return recent.reduce((sum, practice) => sum + practice.independence, 0) / recent.length;
	});

	$effect(() => {
		if (!selectedRoutineId && activeRoutines[0]) {
			selectedRoutineId = activeRoutines[0].id;
		}
	});

	$effect(() => {
		if (!selectedRoutine) return;
		const existing = store.routinePractices.find(
			(practice) => practice.routineId === selectedRoutine.id && practice.date === todayKey
		);
		const key = `${selectedRoutine.id}:${todayKey}:${existing?.recordedAt ?? 'new'}`;
		if (loadedPracticeKey === key) return;
		results = { ...(existing?.results ?? {}) };
		loadedPracticeKey = key;
		showAllSteps = false;
		notice = '';
	});

	function chooseRoutine(id: string): void {
		selectedRoutineId = id;
	}

	function setResult(stepId: string, result: RoutineStepResult): void {
		results = { ...results, [stepId]: result };
	}

	function recordPractice(): void {
		if (!selectedRoutine) return;
		const completeResults = Object.fromEntries(
			selectedRoutine.steps.map((step) => [step.id, results[step.id] ?? 'missed'])
		) as Record<string, RoutineStepResult>;
		const practice = store.recordRoutinePractice(selectedRoutine.id, completeResults);
		if (!practice) return;
		results = completeResults;
		notice = `${Math.round(practice.independence * 100)}% independent · scaffolding recalculated`;
		queueSync();
	}

	function recordIndependentRun(): void {
		if (!selectedRoutine) return;
		const independentResults = Object.fromEntries(
			selectedRoutine.steps.map((step) => [step.id, 'independent'])
		) as Record<string, RoutineStepResult>;
		const practice = store.recordRoutinePractice(selectedRoutine.id, independentResults);
		if (!practice) return;
		results = independentResults;
		notice = 'independent run recorded · scaffolding recalculated';
		queueSync();
	}

	function addRoutine(): void {
		const routine = store.addRoutine(newName, newSteps.split(/\r?\n|,/), newCue);
		if (!routine) return;
		newName = '';
		newCue = '';
		newSteps = '';
		adding = false;
		selectedRoutineId = routine.id;
		queueSync();
	}

	function levelCopy(level: 'full' | 'faded' | 'mastered'): string {
		if (level === 'mastered') return 'quiet chip';
		if (level === 'faded') return 'prompts fading';
		return 'full task analysis';
	}
</script>

<section class="routines-page" aria-labelledby="routines-heading">
	<header class="page-heading">
		<div>
			<p class="kicker">prompt-fading routines</p>
			<h1 id="routines-heading">The right amount of help for today.</h1>
			<p>
				Steps become quieter when the data says they can. You can always ask to see them again.
			</p>
		</div>
		<button type="button" class="new-routine" onclick={() => (adding = !adding)}>
			{adding ? 'close' : '+ new task analysis'}
		</button>
	</header>

	{#if adding}
		<form
			class="routine-form"
			onsubmit={(event) => {
				event.preventDefault();
				addRoutine();
			}}
		>
			<label>
				<span>routine name</span>
				<input bind:value={newName} placeholder="clinic arrival" />
			</label>
			<label>
				<span>cue</span>
				<input bind:value={newCue} placeholder="after I put down my bag" />
			</label>
			<label class="steps-input">
				<span>one step per line</span>
				<textarea
					bind:value={newSteps}
					rows="5"
					placeholder={"open the note\ncheck the room\nset the first material out"}
				></textarea>
			</label>
			<button type="submit" class="save-routine" disabled={!newName.trim() || !newSteps.trim()}>
				add at full resolution
			</button>
		</form>
	{/if}

	<div class="routine-tabs" aria-label="routines">
		{#each activeRoutines as routine (routine.id)}
			{@const level = routineScaffoldLevel(routine.id, store.routinePractices)}
			<button
				type="button"
				aria-pressed={selectedRoutine?.id === routine.id}
				class:active={selectedRoutine?.id === routine.id}
				onclick={() => chooseRoutine(routine.id)}
			>
				<span>{routine.name}</span>
				<small>{levelCopy(level)}</small>
			</button>
		{/each}
	</div>

	{#if selectedRoutine}
		<div class="routine-workbench">
			<article class="analysis-card">
				<header class="analysis-header">
					<div>
						<p class="cue">{selectedRoutine.cue ?? 'self-started'}</p>
						<h2>{selectedRoutine.name}</h2>
					</div>
					<span class="level-stamp" data-level={selectedLevel}>{levelCopy(selectedLevel)}</span>
				</header>

				{#if selectedLevel === 'mastered' && !showAllSteps}
					<div class="mastered-chip">
						<span class="bell-mark" aria-hidden="true">◉</span>
						<div>
							<strong>{selectedRoutine.name}</strong>
							<small>{notice || 'mastered · one quiet prompt'}</small>
						</div>
						<div class="chip-actions">
							<button type="button" onclick={recordIndependentRun}>mark independent</button>
							<button type="button" onclick={() => (showAllSteps = true)}>
								show me the steps today
							</button>
						</div>
					</div>
				{:else}
					{#if selectedLevel === 'faded' && !showAllSteps}
						<div class="faded-prompt">
							<p>
								Begin with <strong>{selectedRoutine.steps[0]?.label}</strong>. Carillon is holding
								{Math.max(0, selectedRoutine.steps.length - 2)} middle prompts quietly.
							</p>
							<p>Finish with <strong>{selectedRoutine.steps.at(-1)?.label}</strong>.</p>
							<div class="chip-actions">
								<button type="button" onclick={recordIndependentRun}>ran without a prompt</button>
								<button type="button" onclick={() => (showAllSteps = true)}>
									open the full task analysis
								</button>
							</div>
						</div>
					{:else}
						<ol class="step-analysis">
							{#each selectedRoutine.steps as step, index (step.id)}
								<li>
									<span class="step-number">{String(index + 1).padStart(2, '0')}</span>
									<span class="step-label">{step.label}</span>
									<div class="step-results" role="group" aria-label={`${step.label} result`}>
										<button
											type="button"
											class:chosen={results[step.id] === 'independent'}
											aria-pressed={results[step.id] === 'independent'}
											onclick={() => setResult(step.id, 'independent')}
										>
											independent
										</button>
										<button
											type="button"
											class:chosen={results[step.id] === 'prompted'}
											aria-pressed={results[step.id] === 'prompted'}
											onclick={() => setResult(step.id, 'prompted')}
										>
											prompted
										</button>
										<button
											type="button"
											class:chosen={results[step.id] === 'missed'}
											aria-pressed={results[step.id] === 'missed'}
											onclick={() => setResult(step.id, 'missed')}
										>
											not today
										</button>
									</div>
								</li>
							{/each}
						</ol>
					{/if}

					{#if selectedLevel !== 'faded' || showAllSteps}
						<div class="analysis-actions">
							<p aria-live="polite">{notice || 'Record support honestly; this is not a scorecard.'}</p>
							<button type="button" onclick={recordPractice}>record today’s support</button>
						</div>
					{/if}
				{/if}
			</article>

			<aside class="fading-card">
				<p class="kicker">fading logic</p>
				<div class="criterion">
					<strong>80%</strong>
					<span>independent across three distinct days fades a prompt layer.</span>
				</div>
				<div class="track" aria-label="routine fading progress">
					<span class:active={selectedLevel === 'full'}>full</span>
					<i></i>
					<span class:active={selectedLevel === 'faded'}>faded</span>
					<i></i>
					<span class:active={selectedLevel === 'mastered'}>quiet</span>
				</div>
				<div class="recent-data">
					<span>recent three-day mean</span>
					<strong>{averageRecent === null ? 'not enough data' : `${Math.round(averageRecent * 100)}%`}</strong>
				</div>
				<ul>
					{#each selectedPractices.slice(0, 6) as practice (practice.id)}
						<li>
							<time>{practice.date}</time>
							<span>{Math.round(practice.independence * 100)}% independent</span>
						</li>
					{:else}
						<li class="empty">No practice data yet. Full steps stay visible.</li>
					{/each}
				</ul>
			</aside>
		</div>
	{:else}
		<p class="empty-state">No routines yet. Add one at the resolution you need.</p>
	{/if}
</section>

<style>
	.routines-page {
		display: grid;
		gap: 1rem;
	}

	.page-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.kicker {
		color: var(--car-pink);
		font-family: var(--car-mono);
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.page-heading h1 {
		max-width: 13ch;
		margin-top: 0.3rem;
		color: var(--car-cream);
		font-family: var(--car-display);
		font-size: clamp(2.4rem, 5vw, 4.4rem);
		font-weight: 400;
		letter-spacing: -0.04em;
		line-height: 0.95;
	}

	.page-heading p:last-child {
		max-width: 50rem;
		margin-top: 0.65rem;
		color: var(--car-mist);
		font-family: var(--car-body);
		font-size: 0.84rem;
	}

	.new-routine {
		flex: 0 0 auto;
		border: 1px solid var(--car-line);
		border-radius: 999px;
		padding: 0.55rem 0.9rem;
		color: var(--car-cream);
		font-family: var(--car-mono);
		font-size: 0.63rem;
	}

	.routine-form {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.75rem;
		align-items: end;
		border: 1px solid var(--car-line);
		border-radius: 1rem;
		background: rgba(255, 246, 218, 0.06);
		padding: 1rem;
	}

	.routine-form label {
		display: grid;
		gap: 0.35rem;
	}

	.routine-form label span {
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.54rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.routine-form input,
	.routine-form textarea {
		border: 1px solid var(--car-line);
		border-radius: 0.65rem;
		background: rgba(11, 5, 18, 0.2);
		padding: 0.65rem;
		color: var(--car-cream);
		font-family: var(--car-body);
		resize: vertical;
	}

	.routine-form .steps-input {
		grid-column: 1 / 3;
	}

	.save-routine {
		border-radius: 999px;
		background: var(--car-pink);
		padding: 0.65rem 0.9rem;
		color: var(--car-night);
		font-family: var(--car-mono);
		font-size: 0.62rem;
	}

	.routine-tabs {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0.1rem;
	}

	.routine-tabs button {
		display: grid;
		flex: 0 0 auto;
		gap: 0.12rem;
		min-width: 9rem;
		border: 1px solid var(--car-line);
		border-radius: 0.75rem;
		padding: 0.6rem 0.75rem;
		color: var(--car-cream);
		text-align: left;
	}

	.routine-tabs button.active {
		border-color: var(--car-pink);
		background: rgba(240, 154, 184, 0.1);
	}

	.routine-tabs span {
		font-family: var(--car-body);
		font-size: 0.78rem;
	}

	.routine-tabs small {
		color: var(--car-mist);
		font-family: var(--car-mono);
		font-size: 0.49rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.routine-workbench {
		display: grid;
		grid-template-columns: minmax(0, 1.65fr) minmax(15rem, 0.65fr);
		gap: 1rem;
	}

	.analysis-card,
	.fading-card {
		border: 1px solid var(--car-line);
		border-radius: 1rem;
		background: var(--car-paper);
		color: var(--car-ink);
		box-shadow: 0 1.2rem 3rem rgba(17, 7, 27, 0.2);
	}

	.analysis-card {
		overflow: hidden;
	}

	.analysis-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem;
		border-bottom: 1px solid rgba(68, 54, 91, 0.14);
	}

	.cue {
		color: var(--car-pink-dark);
		font-family: var(--car-mono);
		font-size: 0.55rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.analysis-header h2 {
		margin-top: 0.25rem;
		font-family: var(--car-display);
		font-size: 2.2rem;
		font-weight: 500;
		letter-spacing: -0.03em;
	}

	.level-stamp {
		border: 1px solid rgba(68, 54, 91, 0.2);
		border-radius: 999px;
		padding: 0.3rem 0.6rem;
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.5rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.step-analysis {
		list-style: none;
	}

	.step-analysis li {
		display: grid;
		grid-template-columns: 2.2rem minmax(8rem, 1fr) auto;
		align-items: center;
		gap: 0.65rem;
		min-height: 3.75rem;
		padding: 0.6rem 1.25rem;
		border-bottom: 1px solid rgba(68, 54, 91, 0.1);
	}

	.step-number {
		color: var(--car-pink-dark);
		font-family: var(--car-counter);
		font-size: 1rem;
	}

	.step-label {
		font-family: var(--car-body);
		font-size: 0.8rem;
	}

	.step-results {
		display: flex;
		gap: 0.25rem;
	}

	.step-results button {
		border: 1px solid rgba(68, 54, 91, 0.16);
		border-radius: 999px;
		padding: 0.28rem 0.48rem;
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.48rem;
	}

	.step-results button.chosen {
		border-color: var(--car-pink-dark);
		background: var(--car-pink-wash);
		color: var(--car-pink-dark);
	}

	.analysis-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
	}

	.analysis-actions p {
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.67rem;
		font-style: italic;
	}

	.analysis-actions button,
	.mastered-chip button,
	.faded-prompt button {
		flex: 0 0 auto;
		border-radius: 999px;
		background: var(--car-ink);
		padding: 0.45rem 0.75rem;
		color: var(--car-paper);
		font-family: var(--car-mono);
		font-size: 0.55rem;
	}

	.chip-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.4rem;
	}

	.chip-actions button + button {
		border: 1px solid rgba(68, 54, 91, 0.18);
		background: transparent;
		color: var(--car-ink);
	}

	.mastered-chip {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.75rem;
		margin: 1.25rem;
		border: 1px solid rgba(68, 54, 91, 0.16);
		border-radius: 999px;
		padding: 0.65rem 0.75rem;
	}

	.bell-mark {
		color: var(--car-pink-dark);
	}

	.mastered-chip div {
		display: grid;
	}

	.mastered-chip strong {
		font-family: var(--car-body);
		font-size: 0.78rem;
	}

	.mastered-chip small {
		color: var(--car-ink-soft);
		font-family: var(--car-mono);
		font-size: 0.49rem;
	}

	.faded-prompt {
		display: grid;
		gap: 0.7rem;
		margin: 1.25rem;
		border-left: 2px solid var(--car-pink-dark);
		padding: 0.4rem 0 0.4rem 1rem;
		font-family: var(--car-body);
		font-size: 0.8rem;
	}

	.faded-prompt button {
		justify-self: start;
		margin-top: 0.2rem;
	}

	.fading-card {
		padding: 1.15rem;
	}

	.fading-card .kicker {
		color: var(--car-pink-dark);
	}

	.criterion {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.6rem;
		align-items: start;
		margin-top: 0.75rem;
	}

	.criterion strong {
		font-family: var(--car-counter);
		font-size: 2rem;
		font-weight: 400;
		line-height: 1;
	}

	.criterion span {
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-size: 0.68rem;
	}

	.track {
		display: grid;
		grid-template-columns: auto 1fr auto 1fr auto;
		align-items: center;
		gap: 0.35rem;
		margin-top: 1.15rem;
		font-family: var(--car-mono);
		font-size: 0.48rem;
		text-transform: uppercase;
	}

	.track span {
		opacity: 0.35;
	}

	.track span.active {
		color: var(--car-pink-dark);
		opacity: 1;
	}

	.track i {
		height: 1px;
		background: rgba(68, 54, 91, 0.2);
	}

	.recent-data {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 1.2rem;
		border-top: 1px solid rgba(68, 54, 91, 0.12);
		padding-top: 0.75rem;
		font-family: var(--car-mono);
		font-size: 0.52rem;
	}

	.recent-data span {
		color: var(--car-ink-soft);
	}

	.fading-card ul {
		display: grid;
		gap: 0.4rem;
		margin-top: 0.7rem;
		list-style: none;
	}

	.fading-card li {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-family: var(--car-mono);
		font-size: 0.52rem;
	}

	.fading-card li time {
		color: var(--car-ink-soft);
	}

	.fading-card li.empty {
		display: block;
		color: var(--car-ink-soft);
		font-family: var(--car-body);
		font-style: italic;
	}

	.empty-state {
		border: 1px dashed var(--car-line);
		border-radius: 1rem;
		padding: 2rem;
		color: var(--car-mist);
		font-family: var(--car-body);
	}

	@media (max-width: 850px) {
		.routine-workbench {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 650px) {
		.page-heading {
			align-items: flex-start;
			flex-direction: column;
		}

		.routine-form {
			grid-template-columns: 1fr;
		}

		.routine-form .steps-input {
			grid-column: auto;
		}

		.step-analysis li {
			grid-template-columns: 1.8rem 1fr;
		}

		.step-results {
			grid-column: 2;
			flex-wrap: wrap;
		}

		.analysis-actions,
		.mastered-chip {
			align-items: flex-start;
			grid-template-columns: 1fr;
			flex-direction: column;
		}
	}
</style>
