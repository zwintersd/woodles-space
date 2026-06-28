<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fmt } from '$lib/witch/book.svelte';
	import type { BestiaryCreature } from '$lib/witch/bestiaryDb';
	import { cappedReward } from './arcadeMath';
	import { creditInsight } from './arcadeRewards';
	import { dailyLimit } from './dailyLimit';

	interface Props {
		onclose: () => void;
		creatures: BestiaryCreature[];
		activePet?: BestiaryCreature | null;
	}
	let { onclose, creatures }: Props = $props();

	// ── constants ──────────────────────────────────────────────────────────────
	const DAILY_LIMIT = 5;
	const REVEAL_SECONDS = 30;
	const MAX_GUESSES = 3;
	const MAX_REWARD = 20;
	const GUESS_MULT = [1.0, 0.66, 0.33];
	const MATCH_THRESHOLD = 0.8;

	// ── daily limit ────────────────────────────────────────────────────────────
	const limit = dailyLimit('inkblot', DAILY_LIMIT);

	// ── state ──────────────────────────────────────────────────────────────────
	type Phase = 'intro' | 'revealing' | 'paused' | 'correct' | 'failed' | 'summary';

	let phase = $state<Phase>('intro');
	let creature = $state<BestiaryCreature | null>(null);
	let guessCount = $state(0);
	let guessInput = $state('');
	let guessError = $state('');
	let elapsedMs = $state(0);
	let awarded = $state(0);
	let roundsPlayed = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);

	let startedAt = 0;
	let rafId = 0;
	let pausedElapsed = 0;

	// canvas
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let spriteImg: HTMLImageElement | null = null;

	// ── derived ────────────────────────────────────────────────────────────────
	const revealProgress = $derived(Math.min(1, elapsedMs / (REVEAL_SECONDS * 1000)));
	const timeScore = $derived(Math.round(1000 * (1 - revealProgress)));
	const canPlay = $derived(limit.canPlay && creatures.length > 0);
	const remainingPlays = $derived(limit.remaining);

	// ── fuzzy match ────────────────────────────────────────────────────────────
	function similarity(a: string, b: string): number {
		a = a.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
		b = b.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
		if (a === b) return 1;
		if (a.length === 0 || b.length === 0) return 0;
		const maxLen = Math.max(a.length, b.length);
		// Levenshtein distance
		const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
			Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
		);
		for (let i = 1; i <= a.length; i++) {
			for (let j = 1; j <= b.length; j++) {
				dp[i][j] =
					a[i - 1] === b[j - 1]
						? dp[i - 1][j - 1]
						: 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
			}
		}
		return 1 - dp[a.length][b.length] / maxLen;
	}

	// ── canvas rendering ───────────────────────────────────────────────────────
	function drawFrame(progress: number) {
		if (!canvasEl || !spriteImg) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		const W = canvasEl.width;
		const H = canvasEl.height;

		// pixelation: 64px blocks at start → 1px (sharp) at end
		const blockSize = Math.max(1, Math.round(64 * (1 - progress) + 1));
		const sw = Math.max(1, Math.round(W / blockSize));
		const sh = Math.max(1, Math.round(H / blockSize));

		ctx.clearRect(0, 0, W, H);
		ctx.imageSmoothingEnabled = false;

		const offscreen = new OffscreenCanvas(sw, sh);
		const offCtx = offscreen.getContext('2d')!;
		offCtx.imageSmoothingEnabled = false;
		offCtx.drawImage(spriteImg, 0, 0, sw, sh);
		ctx.drawImage(offscreen, 0, 0, W, H);

		// blur fades out as reveal progresses
		const blurPx = Math.max(0, (1 - progress) * 6);
		canvasEl.style.filter = blurPx > 0.2 ? `blur(${blurPx.toFixed(1)}px) sepia(0.4)` : 'sepia(0.15)';
	}

	function loadSprite(c: BestiaryCreature): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = reject;
			img.src = (c.isolatedSprite ?? c.sprite) as string;
		});
	}

	// ── animation loop ─────────────────────────────────────────────────────────
	function loop() {
		if (phase !== 'revealing') return;
		elapsedMs = pausedElapsed + (Date.now() - startedAt);
		drawFrame(revealProgress);
		if (elapsedMs >= REVEAL_SECONDS * 1000) {
			elapsedMs = REVEAL_SECONDS * 1000;
			drawFrame(1);
			endRound(false);
			return;
		}
		rafId = requestAnimationFrame(loop);
	}

	function stopLoop() {
		if (rafId) cancelAnimationFrame(rafId);
		rafId = 0;
	}

	// ── game flow ──────────────────────────────────────────────────────────────
	async function startRound() {
		if (!canPlay) return;
		const pool = creatures.filter((c) => c.isolatedSprite ?? c.sprite);
		if (!pool.length) return;

		limit.increment();
		creature = pool[Math.floor(Math.random() * pool.length)];
		guessCount = 0;
		guessInput = '';
		guessError = '';
		elapsedMs = 0;
		pausedElapsed = 0;
		awarded = 0;
		phase = 'revealing';

		spriteImg = await loadSprite(creature);
		drawFrame(0);
		startedAt = Date.now();
		rafId = requestAnimationFrame(loop);
	}

	function pause() {
		if (phase !== 'revealing') return;
		stopLoop();
		pausedElapsed = elapsedMs;
		phase = 'paused';
		// focus input after DOM updates
		setTimeout(() => inputEl?.focus(), 30);
	}

	function resume() {
		if (phase !== 'paused') return;
		guessInput = '';
		guessError = '';
		phase = 'revealing';
		startedAt = Date.now();
		rafId = requestAnimationFrame(loop);
	}

	function submitGuess() {
		if (phase !== 'paused' || !creature) return;
		const guess = guessInput.trim();
		if (!guess) return;

		const score = similarity(guess, creature.name);
		if (score >= MATCH_THRESHOLD) {
			endRound(true);
		} else {
			guessCount += 1;
			if (guessCount >= MAX_GUESSES) {
				endRound(false);
			} else {
				guessError = `not quite — ${MAX_GUESSES - guessCount} guess${MAX_GUESSES - guessCount === 1 ? '' : 'es'} left`;
				guessInput = '';
				resume();
			}
		}
	}

	function endRound(correct: boolean) {
		stopLoop();
		roundsPlayed += 1;

		if (correct) {
			const mult = GUESS_MULT[guessCount] ?? GUESS_MULT[GUESS_MULT.length - 1];
			const raw = Math.round(timeScore * mult * MAX_REWARD / 1000);
			awarded = Math.max(1, cappedReward(raw, MAX_REWARD));
			creditInsight(awarded);
			phase = 'correct';
		} else {
			awarded = 0;
			phase = 'failed';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (phase === 'revealing' && e.code === 'Space') {
			e.preventDefault();
			pause();
		} else if (phase === 'paused' && e.code === 'Escape') {
			resume();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		stopLoop();
		window.removeEventListener('keydown', handleKeydown);
	});

	// draw static frame when paused/complete
	$effect(() => {
		if ((phase === 'paused' || phase === 'correct' || phase === 'failed') && spriteImg) {
			drawFrame(revealProgress);
		}
	});

	// ── display helpers ────────────────────────────────────────────────────────
	const guessLabel = $derived(
		guessCount === 0 ? '1st guess' : guessCount === 1 ? '2nd guess' : '3rd guess'
	);
	const multiplierLabel = $derived(
		guessCount === 0 ? '100%' : guessCount === 1 ? '66%' : '33%'
	);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="inkblot-shell" onkeydown={handleKeydown}>
	<div class="inkblot-bar">
		<div class="game-id">
			<span class="game-name">Inkblot</span>
			<span class="game-hint">press space to pause and guess</span>
		</div>
		<div class="score-group">
			<div class="score-box">
				<span class="score-label">plays</span>
				<span class="score-val">{remainingPlays}/{DAILY_LIMIT}</span>
			</div>
			{#if phase === 'correct' || phase === 'failed'}
			<div class="score-box" class:earned={awarded > 0}>
				<span class="score-label">earned</span>
				<span class="score-val">{awarded > 0 ? `+${fmt(awarded)}` : '—'}</span>
			</div>
			{/if}
		</div>
		<div class="btn-group">
			{#if (phase === 'correct' || phase === 'failed') && remainingPlays > 0}
				<button class="ctrl-btn" onclick={startRound}>next</button>
			{/if}
			<button class="ctrl-btn back" onclick={onclose}>arcade</button>
		</div>
	</div>

	<!-- reveal progress bar -->
	{#if phase === 'revealing' || phase === 'paused'}
	<div class="time-track" style="--prog:{revealProgress.toFixed(4)}">
		<span></span>
	</div>
	{/if}

	<!-- main field -->
	<div class="inkblot-field">
		<!-- single persistent canvas — always bound, never recreated -->
		<canvas
			bind:this={canvasEl}
			class="creature-canvas"
			class:hidden={phase === 'intro'}
			width="400"
			height="400"
		></canvas>

		<!-- phase overlays -->
		{#if phase === 'intro'}
			{#if !canPlay}
				{#if creatures.length === 0}
					<div class="field-message">
						<strong>no creatures yet</strong>
						<em>head to the bestiary and discover some creatures — then come back to test your eye.</em>
					</div>
				{:else}
					<div class="field-message">
						<strong>all {DAILY_LIMIT} plays used</strong>
						<em>the ink dries overnight. come back tomorrow for more.</em>
					</div>
				{/if}
			{:else}
				<div class="field-message">
					<strong>ready to look?</strong>
					<em>an image will slowly bloom. press <kbd>space</kbd> at any time to pause and guess. earlier is worth more.</em>
					<button class="start-btn" onclick={startRound}>begin</button>
					<span class="plays-note">{remainingPlays} of {DAILY_LIMIT} plays remaining today</span>
				</div>
			{/if}
		{:else if phase === 'revealing'}
			<div class="space-hint">
				<kbd>space</kbd> to pause & guess
			</div>
		{:else if phase === 'paused'}
			<div class="guess-overlay">
				<form class="guess-form" onsubmit={(e) => { e.preventDefault(); submitGuess(); }}>
					<label class="guess-label-text" for="guess-input">{guessLabel} · {multiplierLabel} multiplier</label>
					<div class="guess-row">
						<input
							id="guess-input"
							bind:this={inputEl}
							bind:value={guessInput}
							class="guess-input"
							type="text"
							placeholder="name the creature…"
							autocomplete="off"
							spellcheck="false"
						/>
						<button class="guess-btn" type="submit">guess</button>
					</div>
					{#if guessError}
						<span class="guess-error">{guessError}</span>
					{/if}
					<button class="resume-link" type="button" onclick={resume}>keep watching ↩</button>
				</form>
			</div>
		{:else if phase === 'correct'}
			<div class="result-overlay correct">
				<strong class="result-verdict">recognized</strong>
				<span class="result-name">{creature?.name}</span>
				<span class="result-detail">
					guess {guessCount + 1} · {multiplierLabel} · +{fmt(awarded)} insight
				</span>
			</div>
		{:else if phase === 'failed'}
			<div class="result-overlay failed">
				<strong class="result-verdict">unrecognized</strong>
				<span class="result-name">{creature?.name}</span>
				<span class="result-detail">it fully resolved — no insight earned</span>
			</div>
		{/if}
	</div>

	<p class="inkblot-note">
		{#if phase === 'intro' && canPlay}
			Five chances per day. Guess on the first try for full marks.
		{:else if phase === 'correct' || phase === 'failed'}
			{remainingPlays > 0 ? `${remainingPlays} play${remainingPlays === 1 ? '' : 's'} left today.` : 'No plays remaining — the ink rests until tomorrow.'}
		{:else}
			The image resolves over {REVEAL_SECONDS} seconds. Wrong guesses return you to the reveal.
		{/if}
	</p>
</div>

<style>
	.inkblot-shell {
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}

	.inkblot-bar {
		width: 100%;
		max-width: 520px;
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
		min-width: 3.6rem;
	}
	.score-box.earned {
		background: color-mix(in srgb, var(--sol-base2) 55%, var(--sol-cyan));
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
	.ctrl-btn:hover { background: var(--sol-base00); }
	.ctrl-btn.back {
		background: var(--sol-base2);
		color: var(--sol-base0);
	}
	.ctrl-btn.back:hover {
		background: var(--sol-base1);
		color: var(--sol-base3);
	}

	.time-track {
		width: min(520px, 100%);
		height: 0.45rem;
		border-radius: 999px;
		background: var(--sol-base2);
		overflow: hidden;
	}
	.time-track span {
		display: block;
		width: calc(var(--prog) * 100%);
		height: 100%;
		background: linear-gradient(90deg, var(--sol-cyan), var(--sol-blue), var(--sol-violet));
		transition: width 80ms linear;
	}

	.inkblot-field {
		position: relative;
		width: min(420px, calc(100vw - 3rem));
		aspect-ratio: 1;
		border-radius: 6px;
		border: 1px solid var(--sol-base2);
		overflow: hidden;
		background: #f5eed8;
	}

	.creature-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		transition: filter 0.12s ease;
	}
	.creature-canvas.hidden {
		visibility: hidden;
	}

	.space-hint {
		position: absolute;
		bottom: 0.7rem;
		left: 50%;
		transform: translateX(-50%);
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(7, 54, 66, 0.4);
		pointer-events: none;
		white-space: nowrap;
	}

	kbd {
		font-family: var(--font-counter);
		font-size: 0.75em;
		background: var(--sol-base2);
		color: var(--sol-base01);
		border-radius: 3px;
		padding: 0.05em 0.35em;
		border: 1px solid var(--sol-base1);
	}

	/* guess overlay */
	.guess-overlay {
		position: absolute;
		inset: 0;
		background: rgba(253, 246, 227, 0.88);
		backdrop-filter: blur(2px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.2rem;
	}
	.guess-form {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 100%;
		max-width: 320px;
		align-items: center;
	}
	.guess-label-text {
		font-family: var(--font-ui);
		font-size: 0.64rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--sol-base0);
	}
	.guess-row {
		display: flex;
		gap: 0.4rem;
		width: 100%;
	}
	.guess-input {
		flex: 1;
		font-family: var(--font-body);
		font-size: 1rem;
		color: var(--sol-base01);
		background: var(--sol-base3);
		border: 1.5px solid var(--sol-base1);
		border-radius: 4px;
		padding: 0.45rem 0.65rem;
		outline: none;
	}
	.guess-input:focus {
		border-color: var(--sol-blue);
		box-shadow: 0 0 0 2px rgba(38, 139, 210, 0.18);
	}
	.guess-btn {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		background: var(--sol-blue);
		color: var(--sol-base3);
		border-radius: 4px;
		padding: 0.45rem 0.8rem;
		transition: background 0.1s;
		white-space: nowrap;
	}
	.guess-btn:hover { background: var(--sol-violet); }
	.guess-error {
		font-family: var(--font-ui);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--sol-orange);
	}
	.resume-link {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.78rem;
		color: var(--sol-base1);
		background: none;
		text-decoration: underline;
		cursor: pointer;
	}
	.resume-link:hover { color: var(--sol-base0); }

	/* field message (intro/locked states) */
	.field-message {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		text-align: center;
		padding: 1.5rem;
		background: #f5eed8;
	}
	.field-message strong {
		font-family: var(--font-counter);
		font-size: 2rem;
		line-height: 1;
		color: var(--sol-base01);
		font-weight: 400;
	}
	.field-message em {
		font-family: var(--font-body);
		font-size: 0.88rem;
		line-height: 1.5;
		color: var(--sol-base0);
	}
	.start-btn {
		margin-top: 0.4rem;
		font-family: var(--font-ui);
		font-size: 0.74rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		background: var(--sol-blue);
		color: var(--sol-base3);
		border-radius: 3px;
		padding: 0.4rem 1.2rem;
		transition: background 0.1s;
	}
	.start-btn:hover { background: var(--sol-violet); }
	.plays-note {
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--sol-base1);
	}

	/* result states */
	.result-overlay {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		padding-bottom: 1.4rem;
		gap: 0.2rem;
		background: linear-gradient(to top, rgba(7, 36, 46, 0.72) 0%, transparent 55%);
	}
	.result-verdict {
		font-family: var(--font-counter);
		font-size: 1.6rem;
		font-weight: 400;
		line-height: 1;
	}
	.result-overlay.correct .result-verdict { color: var(--sol-cyan); }
	.result-overlay.failed .result-verdict { color: var(--sol-orange); }
	.result-name {
		font-family: var(--font-body);
		font-size: 1.05rem;
		color: var(--sol-base3);
	}
	.result-detail {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(253, 246, 227, 0.65);
	}

	.inkblot-note {
		max-width: 520px;
		margin: 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.8rem;
		color: var(--sol-base1);
		text-align: center;
	}

	@media (max-width: 520px) {
		.inkblot-bar { align-items: flex-start; }
		.game-name { font-size: 1.7rem; }
		.btn-group { flex-direction: row; align-items: center; }
	}
</style>
