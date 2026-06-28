<script lang="ts">
	import { onDestroy } from 'svelte';
	import { book, fmt } from '$lib/witch/book.svelte';
	import type { ArcadeActivePet } from './arcadeStats';

	interface Props {
		onclose: () => void;
		activePet?: ArcadeActivePet;
	}
	let { onclose }: Props = $props();

	type Phase = 'ready' | 'running' | 'complete';

	interface Spark {
		id: number;
		x: number;
		y: number;
		size: number;
		spin: number;
		tilt: number;
	}

	interface Pop {
		id: number;
		x: number;
		y: number;
		text: string;
		tone: 'hit' | 'miss';
	}

	const ROUND_SECONDS = 20;
	const MAX_REWARD = 24;

	let phase = $state<Phase>('ready');
	let remaining = $state(ROUND_SECONDS);
	let score = $state(0);
	let streak = $state(0);
	let bestStreak = $state(0);
	let hits = $state(0);
	let misses = $state(0);
	let awarded = $state(0);
	let rounds = $state(0);
	let lastPaceMs = $state(0);
	let sparkSeq = 0;
	let popSeq = 0;
	let target = $state<Spark>(newSpark());
	let echoes = $state<Spark[]>([]);
	let pops = $state<Pop[]>([]);
	let timer: ReturnType<typeof setInterval> | null = null;
	let popTimers: ReturnType<typeof setTimeout>[] = [];
	let endsAt = 0;
	let lastHitAt = 0;

	const timeStyle = $derived(`--time:${Math.max(0, remaining / ROUND_SECONDS).toFixed(4)}`);
	const accuracy = $derived(hits + misses === 0 ? 1 : hits / (hits + misses));
	const focusLevel = $derived(Math.min(5, Math.floor(streak / 4)));
	const flow = $derived(Math.min(1, (focusLevel / 5) * 0.62 + accuracy * 0.38));
	const fieldStyle = $derived(`--flow:${flow.toFixed(3)};--focus:${focusLevel}`);
	const previewReward = $derived(rewardFor(score, bestStreak, misses));
	const rhythmLabel = $derived.by(() => {
		if (phase === 'ready') return rounds > 0 ? 'again' : 'ready';
		if (phase === 'complete') return awarded > 0 ? 'gathered' : 'passed';
		if (streak >= 16) return 'threading';
		if (streak >= 8) return 'steady';
		if (misses > hits && hits > 0) return 'resetting';
		return 'searching';
	});
	const startLabel = $derived(phase === 'running' ? 'restart' : rounds > 0 ? 'again' : 'start');

	function newSpark(): Spark {
		return {
			id: ++sparkSeq,
			x: 10 + Math.random() * 80,
			y: 14 + Math.random() * 72,
			size: 2.1 + Math.random() * 1.2,
			spin: -18 + Math.random() * 36,
			tilt: -1 + Math.random() * 2
		};
	}

	function sparkStyle(spark: Spark): string {
		return [
			`--x:${spark.x.toFixed(2)}%`,
			`--y:${spark.y.toFixed(2)}%`,
			`--spark-size:${spark.size.toFixed(2)}rem`,
			`--spin:${spark.spin.toFixed(2)}deg`,
			`--tilt:${spark.tilt.toFixed(3)}`
		].join(';');
	}

	function placeSparks() {
		target = newSpark();
		const echoCount = streak >= 14 ? 4 : streak >= 7 ? 3 : 2;
		echoes = Array.from({ length: echoCount }, () => newSpark());
	}

	function rewardFor(points: number, chain: number, errors: number): number {
		const raw =
			Math.floor(points / 5) +
			Math.floor(chain / 5) +
			Math.floor(chain / 12) -
			Math.floor(errors / 5);
		return Math.max(0, Math.min(MAX_REWARD, raw));
	}

	function start() {
		stopTimer();
		phase = 'running';
		remaining = ROUND_SECONDS;
		score = 0;
		streak = 0;
		bestStreak = 0;
		hits = 0;
		misses = 0;
		awarded = 0;
		lastPaceMs = 0;
		pops = [];
		endsAt = Date.now() + ROUND_SECONDS * 1000;
		lastHitAt = 0;
		placeSparks();
		timer = setInterval(updateClock, 80);
	}

	function updateClock() {
		remaining = Math.max(0, (endsAt - Date.now()) / 1000);
		if (remaining <= 0) finish();
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
		awarded = rewardFor(score, bestStreak, misses);
		if (awarded > 0) {
			book.insight += awarded;
			book.persist();
		}
	}

	function addPop(x: number, y: number, text: string, tone: Pop['tone']) {
		const id = ++popSeq;
		pops = [...pops, { id, x, y, text, tone }];
		const popTimer = setTimeout(() => {
			pops = pops.filter((pop) => pop.id !== id);
		}, 620);
		popTimers.push(popTimer);
	}

	function hit(event: MouseEvent) {
		event.stopPropagation();
		if (phase !== 'running') return;
		const now = Date.now();
		if (lastHitAt > 0) lastPaceMs = now - lastHitAt;
		lastHitAt = now;
		streak += 1;
		hits += 1;
		bestStreak = Math.max(bestStreak, streak);
		const gained = 1 + Math.min(5, Math.floor(streak / 4));
		score += gained;
		addPop(target.x, target.y, `+${gained}`, 'hit');
		placeSparks();
	}

	function miss(event?: MouseEvent) {
		event?.stopPropagation();
		if (phase !== 'running') return;
		const spark = event?.currentTarget as HTMLElement | null;
		const x = Number(spark?.style.getPropertyValue('--x').replace('%', '')) || target.x;
		const y = Number(spark?.style.getPropertyValue('--y').replace('%', '')) || target.y;
		misses += 1;
		streak = 0;
		score = Math.max(0, score - 1);
		addPop(x, y, 'false', 'miss');
		placeSparks();
	}

	onDestroy(() => {
		stopTimer();
		for (const popTimer of popTimers) clearTimeout(popTimer);
	});
</script>

<div class="rush-shell">
	<div class="rush-bar">
		<div class="game-id">
			<span class="game-name">Insight Rush</span>
			<span class="game-hint">tap the bright mark before the moment closes</span>
		</div>
		<div class="score-group">
			<div class="score-box">
				<span class="score-label">score</span>
				<span class="score-val">{score}</span>
			</div>
			<div class="score-box live">
				<span class="score-label">now</span>
				<span class="score-val">{streak}</span>
			</div>
			<div class="score-box">
				<span class="score-label">best</span>
				<span class="score-val">{bestStreak}</span>
			</div>
			<div class="score-box">
				<span class="score-label">prize</span>
				<span class="score-val">{fmt(phase === 'complete' ? awarded : previewReward)}</span>
			</div>
		</div>
		<div class="btn-group">
			<button class="ctrl-btn" onclick={start}>{startLabel}</button>
			<button class="ctrl-btn back" onclick={onclose}>arcade</button>
		</div>
	</div>

	<div class="focus-row" aria-label="focus">
		<span class="rhythm">{rhythmLabel}</span>
		<div class="focus-pips" aria-hidden="true">
			{#each Array.from({ length: 5 }) as _, i}
				<span class:lit={i < focusLevel}></span>
			{/each}
		</div>
		<span>{Math.round(accuracy * 100)}%</span>
	</div>

	<div class="time-track" style={timeStyle} aria-label="time remaining">
		<span></span>
	</div>

	<div
		class="rush-field"
		class:idle={phase !== 'running'}
		style={fieldStyle}
	>
		{#if phase === 'ready'}
			<span class="field-message">
				<strong>{rounds > 0 ? 'again?' : 'ready?'}</strong>
				<em>{rounds > 0 ? `${rounds} round${rounds === 1 ? '' : 's'} held` : 'the true insight is the bright one.'}</em>
			</span>
		{:else if phase === 'complete'}
			<span class="field-message">
				<strong>{awarded > 0 ? `+${fmt(awarded)} insight` : 'the moment passed'}</strong>
				<em>
					score {score} · best {bestStreak} · {Math.round(accuracy * 100)}% true{#if lastPaceMs > 0} · {lastPaceMs}ms{/if}
				</em>
			</span>
		{:else}
			<span class="breath-ring" aria-hidden="true"></span>
			{#each echoes as echo (echo.id)}
				<button
					class="spark echo"
					style={sparkStyle(echo)}
					onclick={miss}
					type="button"
					aria-label="Avoid the false insight"
				></button>
			{/each}
			<button
				class="spark target"
				style={sparkStyle(target)}
				onclick={hit}
				type="button"
				aria-label="Catch the insight"
			>
				<span class="spark-core"></span>
			</button>
			{#each pops as pop (pop.id)}
				<span class="point-pop {pop.tone}" style={`--x:${pop.x}%;--y:${pop.y}%`}>
					{pop.text}
				</span>
			{/each}
			<span class="timer-readout">{Math.ceil(remaining)}</span>
		{/if}
	</div>

	<p class="rush-note">
		A quick burst only. Rewards are capped at {MAX_REWARD} insight, but the drill will let
		you keep taking sets.
	</p>
</div>

<style>
	.rush-shell {
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}

	.rush-bar {
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
		min-width: 3.2rem;
	}
	.score-box.live {
		background: color-mix(in srgb, var(--sol-base2) 68%, var(--sol-yellow));
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

	.focus-row {
		width: min(520px, 100%);
		display: grid;
		grid-template-columns: 5.2rem minmax(6rem, 1fr) 3rem;
		align-items: center;
		gap: 0.7rem;
		font-family: var(--font-ui);
		font-size: 0.64rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--sol-base1);
	}
	.rhythm {
		color: var(--sol-base0);
	}
	.focus-pips {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 0.32rem;
	}
	.focus-pips span {
		height: 0.34rem;
		border-radius: 999px;
		background: var(--sol-base2);
		box-shadow: inset 0 0 0 1px rgba(88, 110, 117, 0.12);
	}
	.focus-pips span.lit {
		background: var(--sol-yellow);
		box-shadow: 0 0 10px rgba(181, 137, 0, 0.28);
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
		width: calc(var(--time) * 100%);
		height: 100%;
		background: linear-gradient(90deg, var(--sol-green), var(--sol-yellow), var(--sol-orange));
		transition: width 80ms linear;
	}

	.rush-field {
		position: relative;
		width: min(520px, calc(100vw - 3rem));
		aspect-ratio: 16 / 10;
		overflow: hidden;
		border-radius: 6px;
		border: 1px solid var(--sol-base2);
		background:
			radial-gradient(circle at 50% 44%, rgba(181, 137, 0, calc(0.08 + var(--flow) * 0.2)), transparent 30%),
			radial-gradient(circle at 50% 54%, rgba(42, 161, 152, calc(0.08 + var(--flow) * 0.18)), transparent 42%),
			linear-gradient(135deg, #eee8d5 0%, #fdf6e3 45%, #e7dfc7 100%);
		box-shadow:
			inset 0 0 0 6px rgba(7, 54, 66, 0.05),
			inset 0 0 calc(12px + var(--flow) * 30px) rgba(181, 137, 0, calc(var(--flow) * 0.12));
		cursor: default;
		touch-action: manipulation;
	}
	.rush-field::before {
		content: '';
		position: absolute;
		inset: 1rem;
		border: 1px dashed rgba(88, 110, 117, 0.22);
		border-radius: 4px;
		pointer-events: none;
	}
	.rush-field::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			linear-gradient(90deg, transparent 0 48%, rgba(7, 54, 66, 0.04) 49% 51%, transparent 52%),
			linear-gradient(0deg, transparent 0 48%, rgba(7, 54, 66, 0.04) 49% 51%, transparent 52%);
		background-size: calc(9rem - var(--flow) * 2rem) calc(9rem - var(--flow) * 2rem);
		opacity: calc(0.26 + var(--flow) * 0.22);
		pointer-events: none;
	}
	.field-message {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		gap: 0.35rem;
		text-align: center;
		padding: 1rem;
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
	.breath-ring {
		position: absolute;
		left: 50%;
		top: 50%;
		width: calc(8rem + var(--flow) * 7rem);
		aspect-ratio: 1;
		border-radius: 50%;
		border: 1px solid rgba(181, 137, 0, calc(0.16 + var(--flow) * 0.24));
		transform: translate(-50%, -50%);
		box-shadow: 0 0 22px rgba(181, 137, 0, calc(var(--flow) * 0.15));
		pointer-events: none;
		animation: breathe 1.9s ease-in-out infinite;
	}
	.spark {
		position: absolute;
		left: var(--x);
		top: var(--y);
		width: var(--spark-size);
		height: var(--spark-size);
		transform: translate(-50%, -50%) rotate(var(--spin));
		border-radius: 48% 52% 46% 54%;
		z-index: 2;
	}
	.spark.echo {
		background:
			radial-gradient(circle at 40% 35%, rgba(253, 246, 227, 0.3), transparent 34%),
			rgba(147, 161, 161, 0.36);
		border: 1px solid rgba(88, 110, 117, 0.18);
		box-shadow: 0 0 0 4px rgba(147, 161, 161, 0.1);
		cursor: pointer;
		animation: drift calc(1.7s + var(--tilt) * 0.2s) ease-in-out infinite alternate;
	}
	.spark.target {
		display: grid;
		place-items: center;
		background:
			radial-gradient(circle at 42% 34%, #fdf6e3 0 12%, transparent 15%),
			var(--sol-yellow);
		box-shadow:
			0 0 0 calc(5px + var(--flow) * 3px) rgba(181, 137, 0, calc(0.16 + var(--flow) * 0.08)),
			0 0 calc(20px + var(--flow) * 22px) rgba(181, 137, 0, calc(0.46 + var(--flow) * 0.18));
		cursor: pointer;
		animation: pulse calc(620ms - var(--flow) * 180ms) ease-in-out infinite alternate;
	}
	.spark-core {
		width: 34%;
		height: 34%;
		border-radius: 50%;
		background: var(--sol-base3);
		box-shadow: 0 0 10px rgba(253, 246, 227, 0.82);
		pointer-events: none;
	}
	.point-pop {
		position: absolute;
		left: var(--x);
		top: var(--y);
		z-index: 4;
		transform: translate(-50%, -50%);
		font-family: var(--font-counter);
		font-size: 1.35rem;
		line-height: 1;
		color: var(--sol-yellow);
		text-shadow: 0 0 10px rgba(181, 137, 0, 0.4);
		pointer-events: none;
		animation: point-pop 620ms ease-out forwards;
	}
	.point-pop.miss {
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--sol-base0);
		text-shadow: none;
	}
	.timer-readout {
		position: absolute;
		right: 0.8rem;
		bottom: 0.6rem;
		font-family: var(--font-counter);
		font-size: 2rem;
		color: rgba(7, 54, 66, 0.24);
		pointer-events: none;
	}
	.rush-note {
		max-width: 520px;
		margin: 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.8rem;
		color: var(--sol-base1);
		text-align: center;
	}
	@keyframes pulse {
		from {
			transform: translate(-50%, -50%) rotate(var(--spin)) scale(0.95);
		}
		to {
			transform: translate(-50%, -50%) rotate(var(--spin)) scale(1.08);
		}
	}
	@keyframes drift {
		from {
			transform: translate(-50%, -50%) rotate(var(--spin)) translateY(-2px);
		}
		to {
			transform: translate(calc(-50% + var(--tilt) * 5px), calc(-50% + 4px)) rotate(calc(var(--spin) * -1));
		}
	}
	@keyframes breathe {
		0%, 100% {
			opacity: 0.4;
			transform: translate(-50%, -50%) scale(0.95);
		}
		50% {
			opacity: 0.88;
			transform: translate(-50%, -50%) scale(1.04);
		}
	}
	@keyframes point-pop {
		0% {
			opacity: 0;
			transform: translate(-50%, -34%) scale(0.8);
		}
		18% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -95%) scale(0.92);
		}
	}

	@media (max-width: 520px) {
		.rush-bar {
			align-items: flex-start;
		}
		.game-name {
			font-size: 1.7rem;
		}
		.btn-group {
			flex-direction: row;
			align-items: center;
		}
		.focus-row {
			grid-template-columns: 4.8rem minmax(5rem, 1fr) 2.8rem;
			gap: 0.45rem;
			font-size: 0.58rem;
		}
		.field-message strong {
			font-size: 2rem;
		}
	}
</style>
