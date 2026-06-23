<script lang="ts">
	import { book, fmt, STAGE_KNOWN } from './book.svelte';
	import { ATTENTION_START } from './tuning';

	type StepId =
		| 'open'
		| 'write'
		| 'world'
		| 'attend'
		| 'deepen'
		| 'ledger'
		| 'spend'
		| 'known'
		| 'loop';

	interface Step {
		id: StepId;
		label: string;
		title: string;
		body: string;
		action: string;
		mode?: 'web' | 'world';
	}

	const STEP_KEY = 'witch.idle.tutorial.step.v1';

	let { onclose }: { onclose: () => void } = $props();

	const steps: Step[] = [
		{
			id: 'open',
			label: 'Start',
			title: 'Open the Book',
			body: 'The idle system begins inside the Book. The Web is where you spend Essence to write conditions; the World is where those conditions become life.',
			action: 'Click "open the Book" to enter the idle loop.'
		},
		{
			id: 'write',
			label: 'Web',
			title: 'Write a condition',
			body: 'Essence is the creative budget. Each condition costs Essence, and combinations of conditions unlock emergent life.',
			action: 'Pick any available write button in tier i. "Holding" reveals life fastest; other choices may need a partner.',
			mode: 'web'
		},
		{
			id: 'world',
			label: 'World',
			title: 'See what answered',
			body: 'The World tab shows life once your conditions imply it. Some conditions reveal a life alone; others need a matching second condition.',
			action: 'If the World is still empty, return to the Web and write a condition that pairs with what you already chose.',
			mode: 'world'
		},
		{
			id: 'attend',
			label: 'Attention',
			title: 'Attend to life',
			body: 'Attention slots are the idle engine. Attended life deepens through stages over time: noticed, observed, studied, then known.',
			action: 'Click attend on one life. You start with two attention slots.',
			mode: 'world'
		},
		{
			id: 'deepen',
			label: 'Stages',
			title: 'Deepen an observation',
			body: 'A watched life advances when its progress bar fills. "Look closer" adds a small burst, but time alone also carries it forward.',
			action: 'Let the bar fill, or press look closer until the life reaches observed.',
			mode: 'world'
		},
		{
			id: 'ledger',
			label: 'Ledger',
			title: 'Read the numbers',
			body: 'Observed life starts yielding Insight each second. Favor multiplies that yield; Attention shows how many lives can deepen at once.',
			action: 'Watch the ledger until Insight is visibly climbing.',
			mode: 'world'
		},
		{
			id: 'spend',
			label: 'Advancement',
			title: 'Spend Insight deliberately',
			body: 'Insight has two early jobs: widen attention so more life can advance in parallel, or distill back into Essence to write more conditions.',
			action: `Try widening attention when you reach ${fmt(45)} Insight, or distill ${fmt(60)} Insight into Essence.`,
			mode: 'world'
		},
		{
			id: 'known',
			label: 'Known',
			title: 'Reach a decision point',
			body: 'Known life has fully revealed itself. At that point you can spend resources to intervene, or leave it witnessed and unforced.',
			action: 'Bring one life to known, then read the intervention choice that appears.',
			mode: 'world'
		},
		{
			id: 'loop',
			label: 'Loop',
			title: 'Return to the Web',
			body: 'Studied and Known stages award Essence. That closes the loop: witness life, earn creative power, then write the next shape of the world.',
			action: 'Go back to the Web when you have Essence to spend.',
			mode: 'web'
		}
	];

	const highestStage = $derived.by(() => {
		const stages = Object.values(book.observation);
		return stages.length ? Math.max(...stages) : 0;
	});

	const knownCount = $derived(
		Object.values(book.observation).filter((stage) => stage >= STAGE_KNOWN).length
	);

	function isComplete(id: StepId): boolean {
		switch (id) {
			case 'open':
				return book.bookOpen;
			case 'write':
				return book.writtenConditions.length > 0;
			case 'world':
				return book.life.length > 0 && book.mode === 'world';
			case 'attend':
				return book.attending.length > 0 || highestStage > 0;
			case 'deepen':
				return highestStage >= 1;
			case 'ledger':
				return book.insight > 0 || book.insightPerSec > 0;
			case 'spend':
				return book.attentionCapacity > ATTENTION_START || book.essence > 6;
			case 'known':
				return knownCount > 0;
			case 'loop':
				return book.writtenConditions.length > 1;
		}
	}

	const suggestedIndex = $derived.by(() => {
		const firstOpen = steps.findIndex((step) => !isComplete(step.id));
		return firstOpen === -1 ? steps.length - 1 : firstOpen;
	});

	const completedCount = $derived(steps.filter((step) => isComplete(step.id)).length);

	let index = $state(0);
	let initialized = $state(false);

	$effect(() => {
		if (!initialized) {
			const saved = localStorage.getItem(STEP_KEY);
			const savedIndex = saved ? steps.findIndex((item) => item.id === saved) : -1;
			index = savedIndex >= 0 ? savedIndex : suggestedIndex;
			initialized = true;
		}
	});

	$effect(() => {
		if (initialized) localStorage.setItem(STEP_KEY, steps[index].id);
	});

	const step = $derived(steps[index]);
	const stepDone = $derived(isComplete(step.id));

	function go(delta: number) {
		index = Math.max(0, Math.min(steps.length - 1, index + delta));
	}

	function goSuggested() {
		index = suggestedIndex;
	}

	function openBook() {
		book.openBook();
	}

	function switchMode(mode: 'web' | 'world') {
		if (book.bookOpen) book.mode = mode;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onclose();
		if (event.key === 'ArrowRight') go(1);
		if (event.key === 'ArrowLeft') go(-1);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="tutorial-backdrop" role="presentation">
	<div
		class="tutorial"
		role="dialog"
		aria-labelledby="tutorial-title"
		aria-describedby="tutorial-body"
	>
		<header class="tutorial-head">
			<div>
				<p class="eyebrow">idle tutorial</p>
				<p class="progress">{completedCount}/{steps.length} checks complete</p>
			</div>
			<button class="close" type="button" aria-label="hide tutorial" title="resume from the top bar" onclick={onclose}>hide</button>
		</header>

		<div class="step-row" aria-label="tutorial steps">
			{#each steps as item, i (item.id)}
				<button
					type="button"
					class="dot"
					class:active={i === index}
					class:done={isComplete(item.id)}
					aria-label={`${item.label}: ${isComplete(item.id) ? 'complete' : 'not complete'}`}
					onclick={() => (index = i)}
				>
					<span>{i + 1}</span>
				</button>
			{/each}
		</div>

		<section class="copy">
			<p class="label">{step.label}</p>
			<h2 id="tutorial-title">{step.title}</h2>
			<p id="tutorial-body">{step.body}</p>
			<div class="callout" class:complete={stepDone}>
				<span class="callout-label">{stepDone ? 'done' : 'next'}</span>
				<span>{stepDone ? 'This check is complete. Move on when you are ready.' : step.action}</span>
			</div>
		</section>

		<div class="quick-actions">
			{#if !book.bookOpen}
				<button type="button" class="jump" onclick={openBook}>open the Book</button>
			{/if}
			{#if step.mode && book.bookOpen}
				<button type="button" class="jump" onclick={() => switchMode(step.mode!)}>
					go to the {step.mode === 'web' ? 'Web' : 'World'}
				</button>
			{/if}
			{#if index !== suggestedIndex}
				<button type="button" class="jump ghost" onclick={goSuggested}>show current step</button>
			{/if}
		</div>

		<footer class="tutorial-actions">
			<button type="button" class="nav" disabled={index === 0} onclick={() => go(-1)}>back</button>
			<button type="button" class="nav primary" onclick={() => (index === steps.length - 1 ? onclose() : go(1))}>
				{index === steps.length - 1 ? 'finish' : 'next'}
			</button>
		</footer>
	</div>
</div>

<style>
	.tutorial-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		display: grid;
		place-items: start end;
		padding: 4.2rem 1.2rem 1.2rem;
		background: rgba(11, 11, 30, 0.42);
		backdrop-filter: blur(2px);
		pointer-events: none;
	}
	.tutorial {
		width: min(25rem, calc(100vw - 2.4rem));
		border: 1px solid rgba(108, 229, 232, 0.38);
		border-radius: 6px;
		background: color-mix(in srgb, var(--panel) 92%, var(--bg));
		box-shadow: 0 18px 60px rgba(0, 0, 0, 0.36);
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		pointer-events: auto;
	}
	.tutorial-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}
	.eyebrow,
	.progress,
	.label,
	.callout-label,
	.nav,
	.jump {
		font-family: var(--font-ui);
		text-transform: uppercase;
	}
	.eyebrow {
		margin: 0;
		font-size: 0.68rem;
		letter-spacing: 0.22em;
		color: var(--cyan);
	}
	.progress {
		margin: 0.1rem 0 0;
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		color: var(--muted);
	}
	.close {
		min-width: 2.8rem;
		height: 1.75rem;
		border: 1px solid var(--rule);
		border-radius: 4px;
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
		line-height: 1;
	}
	.close:hover {
		border-color: var(--print-pink);
		color: var(--print-pink);
	}
	.step-row {
		display: grid;
		grid-template-columns: repeat(9, minmax(0, 1fr));
		gap: 0.25rem;
	}
	.dot {
		aspect-ratio: 1;
		min-width: 0;
		border: 1px solid var(--rule);
		border-radius: 50%;
		display: grid;
		place-items: center;
		color: var(--muted);
		background: var(--bg);
	}
	.dot span {
		font-family: var(--font-counter);
		font-size: 0.9rem;
		line-height: 1;
	}
	.dot.done {
		border-color: rgba(108, 229, 232, 0.55);
		color: var(--cyan);
	}
	.dot.active {
		border-color: var(--leafeon-pink);
		color: var(--cream);
		background: var(--panel-accent);
	}
	.copy {
		border: 1px solid var(--rule);
		border-radius: 5px;
		background: rgba(26, 26, 62, 0.55);
		padding: 0.85rem;
	}
	.label {
		margin: 0 0 0.25rem;
		font-size: 0.66rem;
		letter-spacing: 0.18em;
		color: var(--periwinkle);
	}
	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.45rem;
		line-height: 1.12;
		color: var(--cream);
		margin: 0 0 0.45rem;
	}
	.copy p {
		margin: 0;
		color: var(--text);
		font-size: 0.9rem;
	}
	.callout {
		margin-top: 0.7rem;
		border-left: 2px solid var(--cyan);
		background: var(--panel-accent);
		padding: 0.55rem 0.65rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-family: var(--font-body);
		font-size: 0.84rem;
		color: var(--text);
	}
	.callout.complete {
		border-left-color: var(--leafeon-pink);
	}
	.callout-label {
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		color: var(--cyan);
	}
	.callout.complete .callout-label {
		color: var(--leafeon-pink);
	}
	.quick-actions,
	.tutorial-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}
	.jump,
	.nav {
		border: 1px solid var(--rule);
		border-radius: 4px;
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		color: var(--cream);
		padding: 0.4rem 0.65rem;
	}
	.jump:hover,
	.nav:hover:not(:disabled) {
		border-color: var(--cyan);
		color: var(--cyan);
	}
	.jump.ghost {
		color: var(--muted);
	}
	.tutorial-actions {
		justify-content: flex-end;
	}
	.nav.primary {
		border-color: var(--leafeon-pink);
		background: var(--panel-accent);
	}
	.nav.primary:hover {
		color: var(--leafeon-pink);
	}

	@media (max-width: 640px) {
		.tutorial-backdrop {
			place-items: end stretch;
			padding: 1rem;
		}
		.tutorial {
			width: 100%;
		}
	}
</style>
