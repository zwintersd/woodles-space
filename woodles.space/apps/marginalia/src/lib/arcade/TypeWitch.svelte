<script lang="ts">
	import { onDestroy } from 'svelte';
	import { book, fmt } from '$lib/witch/book.svelte';
	import { conditions } from '$lib/witch/content/conditions';
	import type { ArcadeActivePet } from './arcadeStats';

	interface Props {
		onclose: () => void;
		activePet?: ArcadeActivePet;
	}
	let { onclose }: Props = $props();

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
	let score = $state(0);
	let errors = $state(0);
	let awarded = $state(0);
	let rounds = $state(0);

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

	// per-character match state
	const charStates = $derived.by((): Array<'pending' | 'correct' | 'error'> => {
		const phrase = currentPhrase ?? '';
		return phrase.split('').map((ch, i) => {
			if (i >= typed.length) return 'pending';
			return typed[i] === ch ? 'correct' : 'error';
		});
	});

	const timeStyle = $derived(`--time:${Math.max(0, remaining / ROUND_SECONDS).toFixed(4)}`);
	const phraseTimeStyle = $derived(`--ptime:${Math.max(0, phraseRemaining / PHRASE_SECONDS).toFixed(4)}`);

	const accuracy = $derived.by(() => {
		const total = score + errors;
		return total === 0 ? 1 : score / total;
	});

	const previewReward = $derived(rewardFor(completed, score, errors));

	function rewardFor(done: number, pts: number, errs: number): number {
		const raw = done * 3 + Math.floor(pts / 4) - Math.floor(errs / 8);
		return Math.max(0, Math.min(MAX_REWARD, raw));
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
		endsAt = Date.now() + ROUND_SECONDS * 1000;
		phraseEndsAt = Date.now() + PHRASE_SECONDS * 1000;
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
		awarded = rewardFor(completed, score, errors);
		if (awarded > 0) {
			book.insight += awarded;
			book.persist();
		}
	}

	function advancePhrase(succeeded: boolean) {
		if (succeeded) {
			completed += 1;
		}
		typed = '';
		currentPhraseIdx += 1;
		phraseEndsAt = Date.now() + PHRASE_SECONDS * 1000;
		phraseRemaining = PHRASE_SECONDS;
		requestAnimationFrame(() => inputEl?.focus());
	}

	function handleInput(event: Event) {
		if (phase !== 'running') return;
		const target = event.target as HTMLInputElement;
		const val = target.value;
		const phrase = currentPhrase ?? '';

		// count new errors on each keystroke
		for (let i = typed.length; i < val.length; i++) {
			if (val[i] !== phrase[i]) errors += 1;
			else score += 1;
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

	onDestroy(() => {
		stopTimer();
	});
</script>

<div class="witch-shell">
	<div class="witch-bar">
		<div class="game-id">
			<span class="game-name">Type Witch</span>
			<span class="game-hint">transcribe Brianna's conditions before they dissolve</span>
		</div>
		<div class="score-group">
			<div class="score-box">
				<span class="score-label">done</span>
				<span class="score-val">{completed}</span>
			</div>
			<div class="score-box live">
				<span class="score-label">chars</span>
				<span class="score-val">{score}</span>
			</div>
			<div class="score-box">
				<span class="score-label">errors</span>
				<span class="score-val">{errors}</span>
			</div>
			<div class="score-box">
				<span class="score-label">prize</span>
				<span class="score-val">{fmt(phase === 'complete' ? awarded : previewReward)}</span>
			</div>
		</div>
		<div class="btn-group">
			<button class="ctrl-btn" onclick={start}>
				{phase === 'running' ? 'restart' : rounds > 0 ? 'again' : 'start'}
			</button>
			<button class="ctrl-btn back" onclick={onclose}>arcade</button>
		</div>
	</div>

	<div class="time-track" style={timeStyle} aria-label="round time remaining">
		<span></span>
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
					<span class="stat">{Math.round(accuracy * 100)}% true</span>
				</div>
			</div>
		{/if}
	</div>

	<p class="witch-note">
		{PHRASE_SECONDS}s per phrase. Complete as many as you can in {ROUND_SECONDS}s. Rewards cap at {MAX_REWARD} insight.
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

	/* ── top bar ───────────────────────────────────────────────────────────── */
	.witch-bar {
		width: 100%;
		max-width: 580px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		flex-wrap: wrap;
	}
	.game-id {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.game-name {
		font-family: var(--font-counter);
		font-size: 2rem;
		line-height: 1;
		color: var(--sol-base01);
		letter-spacing: 0.04em;
	}
	.game-hint {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--sol-base1);
	}
	.score-group {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.score-box {
		background: var(--sol-base2);
		border-radius: 3px;
		padding: 0.3rem 0.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 3.2rem;
	}
	.score-box.live {
		background: color-mix(in srgb, var(--sol-base2) 68%, var(--sol-cyan));
	}
	.score-label {
		font-family: var(--font-ui);
		font-size: 0.56rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--sol-base1);
	}
	.score-val {
		font-family: var(--font-counter);
		font-size: 1.3rem;
		color: var(--sol-base01);
		line-height: 1.1;
	}
	.btn-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		align-items: flex-end;
	}
	.ctrl-btn {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--sol-base3);
		background: var(--sol-base0);
		border-radius: 3px;
		padding: 0.24rem 0.6rem;
		white-space: nowrap;
		transition: background 0.1s;
	}
	.ctrl-btn:hover {
		background: var(--sol-base00);
	}
	.ctrl-btn.back {
		background: var(--sol-base2);
		color: var(--sol-base0);
	}
	.ctrl-btn.back:hover {
		background: var(--sol-base1);
		color: var(--sol-base3);
	}

	/* ── round timer bar ───────────────────────────────────────────────────── */
	.time-track {
		width: min(580px, 100%);
		height: 0.45rem;
		border-radius: 999px;
		background: var(--sol-base2);
		overflow: hidden;
	}
	.time-track span {
		display: block;
		width: calc(var(--time) * 100%);
		height: 100%;
		background: linear-gradient(90deg, var(--sol-green), var(--sol-yellow), var(--sol-orange));
		transition: width 80ms linear;
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
		.witch-bar {
			align-items: flex-start;
		}
		.game-name {
			font-size: 1.7rem;
		}
		.btn-group {
			flex-direction: row;
			align-items: center;
		}
		.phrase-display {
			font-size: 1.3rem;
		}
		.phrase-input {
			font-size: 0.95rem;
		}
	}
</style>
