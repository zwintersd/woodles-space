<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ArcadeHud from './ArcadeHud.svelte';
	import ArcadePetPerks from './ArcadePetPerks.svelte';
	import ArcadeProgress from './ArcadeProgress.svelte';
	import { fmt } from '$lib/witch/book.svelte';
	import { conditions } from '$lib/witch/content/conditions';
	import { payReward, previewReward as previewArcadeReward } from './arcadeRewards';
	import { loadArcadeRecord, recordArcadeRun } from './arcadeRecords';
	import {
		coreStatValue,
		statTier,
		type ArcadeActivePet,
		type ArcadeStatEffects
	} from './arcadeStats';

	interface Props {
		onclose: () => void;
		activePet?: ArcadeActivePet;
	}
	let { onclose, activePet = null }: Props = $props();

	type Phase = 'ready' | 'running' | 'complete';

	const ROUND_SECONDS = 60;
	const PHRASE_SECONDS = 12;
	const MAX_REWARD = 32;

	// shuffled pool of condition phrases
	const phrases = conditions.map((c) => c.phrase);

	let phase = $state<Phase>('ready');
	let remaining = $state(ROUND_SECONDS);
	let phraseRemaining = $state(PHRASE_SECONDS);
	let typed = $state('');
	let currentIndex = $state(0);
	let currentPhraseIdx = $state(0);
	let completed = $state(0);
	let bestCompleted = $state(loadArcadeRecord('type-witch').bestScore);
	let score = $state(0);
	let errors = $state(0);
	let awarded = $state(0);
	let rounds = $state(0);
	let combo = $state(0);
	let bestCombo = $state(0);
	let phraseForgivenessLeft = $state(0);
	let comboShields = $state(0);
	let preservedCombos = $state(0);
	let forgivenTypos = $state(0);

	let timer: ReturnType<typeof setInterval> | null = null;
	let inputEl = $state<HTMLInputElement | null>(null);
	let endsAt = 0;
	let phraseEndsAt = 0;

	const phraseOrder = $derived.by(() => shufflePool(phrases));

	function shufflePool(arr: string[]): string[] {
		const copy = [...arr];
		for (let i = copy.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[copy[i], copy[j]] = [copy[j], copy[i]];
		}
		return copy;
	}

	let pool = phrases.slice();

	const currentPhrase = $derived(pool[currentPhraseIdx % pool.length]);
	const nextPhrase = $derived(pool[(currentPhraseIdx + 1) % pool.length]);
	const bodyTier = $derived(statTier(coreStatValue(activePet, 'body')));
	const mindTier = $derived(statTier(coreStatValue(activePet, 'mind')));
	const graceTier = $derived(statTier(coreStatValue(activePet, 'grace')));
	const heartTier = $derived(statTier(coreStatValue(activePet, 'heart')));
	const effectivePhraseSeconds = $derived(PHRASE_SECONDS + bodyTier);
	const nextPhrasePreview = $derived.by(() => {
		if (mindTier === 0 || phase !== 'running') return '';
		const limit = mindTier === 1 ? 16 : mindTier === 2 ? 28 : nextPhrase.length;
		return nextPhrase.length > limit ? `${nextPhrase.slice(0, limit)}...` : nextPhrase;
	});
	const statEffects = $derived<ArcadeStatEffects>({
		body: (_value, tier) => (tier > 0 ? `+${tier}s phrase time` : 'normal phrase time'),
		mind: (_value, tier) => (tier > 0 ? 'next phrase preview' : 'no preview'),
		grace: (_value, tier) => (tier > 0 ? `${tier} typo grace` : 'strict typos'),
		heart: (_value, tier) => (tier > 0 ? `${tier} combo shield` : 'combo drops')
	});

	// per-character match state
	const charStates = $derived.by((): Array<'pending' | 'correct' | 'error'> => {
		const phrase = currentPhrase ?? '';
		return phrase.split('').map((ch, i) => {
			if (i >= typed.length) return 'pending';
			return typed[i] === ch ? 'correct' : 'error';
		});
	});

	const timeProgress = $derived(Math.max(0, remaining / ROUND_SECONDS));
	const phraseTimeStyle = $derived(
		`--ptime:${Math.max(0, phraseRemaining / effectivePhraseSeconds).toFixed(4)}`
	);

	const accuracy = $derived.by(() => {
		const total = score + errors;
		return total === 0 ? 1 : score / total;
	});

	const previewReward = $derived(rewardFor(completed, score, errors));
	const startLabel = $derived(phase === 'running' ? 'restart' : rounds > 0 ? 'again' : 'start');

	function rewardFor(done: number, pts: number, errs: number): number {
		const raw = done * 3 + Math.floor(pts / 4) - Math.floor(errs / 8);
		return previewArcadeReward(raw, MAX_REWARD);
	}

	function start() {
		stopTimer();
		pool = shufflePool(phrases);
		phase = 'running';
		remaining = ROUND_SECONDS;
		phraseRemaining = PHRASE_SECONDS;
		typed = '';
		currentPhraseIdx = 0;
		completed = 0;
		score = 0;
		errors = 0;
		awarded = 0;
		combo = 0;
		bestCombo = 0;
		phraseForgivenessLeft = graceTier;
		comboShields = heartTier;
		preservedCombos = 0;
		forgivenTypos = 0;
		endsAt = Date.now() + ROUND_SECONDS * 1000;
		phraseEndsAt = Date.now() + effectivePhraseSeconds * 1000;
		timer = setInterval(tick, 80);
		requestAnimationFrame(() => inputEl?.focus());
	}

	function tick() {
		const now = Date.now();
		remaining = Math.max(0, (endsAt - now) / 1000);
		phraseRemaining = Math.max(0, (phraseEndsAt - now) / 1000);
		if (remaining <= 0) {
			finish();
		} else if (phraseRemaining <= 0) {
			advancePhrase(false);
		}
	}

	function stopTimer() {
		if (timer) clearInterval(timer);
		timer = null;
	}

	function finish() {
		if (phase !== 'running') return;
		stopTimer();
		remaining = 0;
		phase = 'complete';
		rounds += 1;
		awarded = payReward(rewardFor(completed, score, errors), MAX_REWARD);
		const record = recordArcadeRun('type-witch', {
			score: completed,
			summary: {
				chars: score,
				errors,
				accuracy: Math.round(accuracy * 100),
				combo: bestCombo,
				forgivenTypos,
				preservedCombos,
				awarded
			}
		});
		bestCompleted = record.bestScore;
	}

	function advancePhrase(succeeded: boolean) {
		if (succeeded) {
			completed += 1;
			combo += 1;
			bestCombo = Math.max(bestCombo, combo);
		} else if (combo > 0 && comboShields > 0) {
			comboShields -= 1;
			preservedCombos += 1;
		} else {
			combo = 0;
		}
		typed = '';
		currentPhraseIdx += 1;
		phraseForgivenessLeft = graceTier;
		phraseEndsAt = Date.now() + effectivePhraseSeconds * 1000;
		phraseRemaining = effectivePhraseSeconds;
		requestAnimationFrame(() => inputEl?.focus());
	}

	function handleInput(event: Event) {
		if (phase !== 'running') return;
		const target = event.target as HTMLInputElement;
		const val = target.value;
		const phrase = currentPhrase ?? '';

		// count new errors on each keystroke
		for (let i = typed.length; i < val.length; i++) {
			if (val[i] !== phrase[i]) {
				if (phraseForgivenessLeft > 0) {
					phraseForgivenessLeft -= 1;
					forgivenTypos += 1;
				} else {
					errors += 1;
				}
			} else score += 1;
		}

		typed = val;

		if (typed === phrase) {
			advancePhrase(true);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		// prevent backspace from leaving the field empty silently
		if (event.key === 'Escape' && phase === 'running') {
			finish();
		}
	}

	onMount(() => {
		bestCompleted = loadArcadeRecord('type-witch').bestScore;
	});

	onDestroy(() => {
		stopTimer();
	});
</script>

<div class="witch-shell">
	<ArcadeHud
		title="Type Witch"
		hint="transcribe Brianna's conditions before they dissolve"
		maxWidth="580px"
		scores={[
			{ label: 'done', value: completed },
			{ label: 'best', value: Math.max(completed, bestCompleted) },
			{ label: 'combo', value: combo, live: combo > 0, tone: 'yellow' },
			{ label: 'chars', value: score, live: true, tone: 'cyan' },
			{ label: 'errors', value: errors },
			{ label: 'prize', value: fmt(phase === 'complete' ? awarded : previewReward) }
		]}
		{startLabel}
		onstart={start}
		onclose={onclose}
	/>

	<ArcadeProgress value={timeProgress} label="round time remaining" tone="yellow" maxWidth="580px" />

	<div class="perks-wrap">
		<ArcadePetPerks creature={activePet} effects={statEffects} />
	</div>

	<div class="witch-field" class:idle={phase !== 'running'}>
		{#if phase === 'ready'}
			<div class="field-message">
				<strong>{rounds > 0 ? 'again?' : 'ready?'}</strong>
				<em>
					{rounds > 0
						? `${rounds} round${rounds === 1 ? '' : 's'} complete`
						: 'type each condition as it appears. they dissolve if you wait.'}
				</em>
			</div>
		{:else if phase === 'complete'}
			<div class="field-message">
				<strong>{awarded > 0 ? `+${fmt(awarded)} insight` : 'the words dissolved'}</strong>
				<em>
					{completed} condition{completed === 1 ? '' : 's'} · {score} chars · {Math.round(accuracy * 100)}% true
				</em>
			</div>
		{:else}
			<div class="phrase-area">
				<div class="phrase-bar" style={phraseTimeStyle} aria-label="phrase time remaining">
					<span></span>
				</div>
				<p class="prompt-label">transcribe:</p>
				{#if nextPhrasePreview}
					<p class="next-preview">next: {nextPhrasePreview}</p>
				{/if}
				<p class="phrase-display" aria-live="polite">
					{#each (currentPhrase ?? '').split('') as ch, i (i)}
						<span
							class="char"
							class:correct={charStates[i] === 'correct'}
							class:error={charStates[i] === 'error'}
							class:cursor={i === typed.length}
						>{ch}</span>
					{/each}
				</p>
				<input
					bind:this={inputEl}
					class="phrase-input"
					type="text"
					autocomplete="off"
					autocorrect="off"
					autocapitalize="off"
					spellcheck="false"
					aria-label="Type the condition phrase"
					value={typed}
					oninput={handleInput}
					onkeydown={handleKeydown}
					placeholder="begin typing…"
				/>
				<div class="stats-row">
					<span class="stat">{Math.ceil(remaining)}s left</span>
					<span class="stat accent">{completed} done</span>
					<span class="stat">{phraseForgivenessLeft} grace</span>
					<span class="stat">{comboShields} shield</span>
					<span class="stat">{Math.round(accuracy * 100)}% true</span>
				</div>
			</div>
		{/if}
	</div>

	<p class="witch-note">
		Each phrase dissolves on its own timer. Complete as many as you can in {ROUND_SECONDS}s. Rewards cap at {MAX_REWARD} insight.
	</p>
</div>

<style>
	.witch-shell {
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}

	/* ── main field ────────────────────────────────────────────────────────── */
	.witch-field {
		width: min(580px, calc(100vw - 3rem));
		border-radius: 6px;
		border: 1px solid var(--sol-base2);
		background: linear-gradient(135deg, #eee8d5 0%, #fdf6e3 45%, #e7dfc7 100%);
		overflow: hidden;
	}
	.witch-field.idle {
		display: grid;
		place-items: center;
		min-height: 14rem;
	}
	.perks-wrap {
		width: min(580px, 100%);
	}
	.field-message {
		display: grid;
		gap: 0.35rem;
		text-align: center;
		padding: 2rem 1.4rem;
	}
	.field-message strong {
		font-family: var(--font-counter);
		font-size: 2.5rem;
		line-height: 1;
		color: var(--sol-base01);
		font-weight: 400;
	}
	.field-message em {
		font-family: var(--font-body);
		font-size: 0.9rem;
		color: var(--sol-base0);
	}

	/* ── active phrase area ────────────────────────────────────────────────── */
	.phrase-area {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1.4rem 1.6rem 1.2rem;
	}

	/* per-phrase dissolve bar */
	.phrase-bar {
		width: 100%;
		height: 0.28rem;
		border-radius: 999px;
		background: var(--sol-base2);
		overflow: hidden;
	}
	.phrase-bar span {
		display: block;
		width: calc(var(--ptime) * 100%);
		height: 100%;
		background: linear-gradient(90deg, var(--sol-cyan), var(--sol-blue));
		transition: width 80ms linear;
	}

	.prompt-label {
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--sol-base1);
		margin: 0;
	}
	.next-preview {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--sol-violet);
		background: rgba(108, 113, 196, 0.1);
		border: 1px solid rgba(108, 113, 196, 0.2);
		border-radius: 3px;
		padding: 0.3rem 0.5rem;
		margin: -0.1rem 0 0;
	}

	.phrase-display {
		font-family: var(--font-body);
		font-size: 1.55rem;
		line-height: 1.5;
		letter-spacing: 0.02em;
		color: var(--sol-base1);
		margin: 0;
		word-break: break-word;
	}
	.char {
		position: relative;
		transition: color 0.06s;
	}
	.char.correct {
		color: var(--sol-green);
	}
	.char.error {
		color: var(--sol-red);
		text-decoration: underline wavy var(--sol-red);
		text-underline-offset: 2px;
	}
	.char.cursor::after {
		content: '';
		position: absolute;
		bottom: 0.1em;
		left: 0;
		width: 2px;
		height: 1.1em;
		background: var(--sol-cyan);
		animation: blink 1.1s step-end infinite;
	}

	.phrase-input {
		width: 100%;
		background: var(--sol-base3);
		border: 1px solid var(--sol-base2);
		border-radius: 4px;
		padding: 0.55rem 0.8rem;
		font-family: var(--font-body);
		font-size: 1.05rem;
		color: var(--sol-base01);
		outline: none;
		transition: border-color 0.1s, box-shadow 0.1s;
	}
	.phrase-input:focus {
		border-color: var(--sol-cyan);
		box-shadow: 0 0 0 2px rgba(42, 161, 152, 0.18);
	}
	.phrase-input::placeholder {
		color: var(--sol-base1);
		font-style: italic;
	}

	.stats-row {
		display: flex;
		gap: 1.1rem;
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--sol-base1);
	}
	.stat.accent {
		color: var(--sol-cyan);
	}

	/* ── footer note ───────────────────────────────────────────────────────── */
	.witch-note {
		max-width: 580px;
		margin: 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.8rem;
		color: var(--sol-base1);
		text-align: center;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}

	@media (max-width: 520px) {
		.phrase-display {
			font-size: 1.3rem;
		}
		.phrase-input {
			font-size: 0.95rem;
		}
	}
</style>
