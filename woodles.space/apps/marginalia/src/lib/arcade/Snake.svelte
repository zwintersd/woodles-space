<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { cappedReward, type Dot } from './arcadeMath';
	import { book, fmt } from '$lib/witch/book.svelte';

	interface Props {
		onclose: () => void;
	}
	let { onclose }: Props = $props();

	type Phase = 'ready' | 'running' | 'complete' | 'over';

	interface Cell extends Dot {}

	const COLS = 22;
	const ROWS = 16;
	const CELL = 20;
	const WORLD_W = COLS * CELL;
	const WORLD_H = ROWS * CELL;
	const START_LENGTH = 4;
	const MAX_REWARD = 18;
	const WIN_SCORE = 18;

	let phase = $state<Phase>('ready');
	let snake = $state<Cell[]>(freshSnake());
	let food = $state<Cell>({ x: 15, y: 8 });
	let dir = $state<Cell>({ x: 1, y: 0 });
	let nextDir = $state<Cell>({ x: 1, y: 0 });
	let score = $state(0);
	let best = $state(0);
	let awarded = $state(0);
	let rounds = $state(0);
	let wraps = $state(0);
	let raf = 0;
	let lastTime = 0;
	let stepClock = 0;
	let pulse = $state(0);

	const speedMs = $derived(Math.max(86, 170 - score * 4));
	const progressStyle = $derived(`--left:${Math.min(1, score / WIN_SCORE).toFixed(4)}`);
	const startLabel = $derived(phase === 'running' ? 'restart' : rounds > 0 ? 'again' : 'start');
	const rewardPreview = $derived(rewardFor(score, phase === 'complete'));
	const outcomeLabel = $derived.by(() => {
		if (phase === 'complete') return awarded > 0 ? `+${fmt(awarded)} insight` : 'full';
		if (phase === 'over') return 'knotted';
		if (rounds > 0) return 'again?';
		return 'ready?';
	});
	const hintLabel = $derived.by(() => {
		if (phase === 'running') return 'arrow keys, wasd, or swipe';
		if (phase === 'complete') return 'the little line made a loop';
		if (phase === 'over') return 'the little line met itself';
		return 'eat marks, do not bite the line';
	});

	function freshSnake(): Cell[] {
		const startX = Math.floor(COLS / 2) - 2;
		const startY = Math.floor(ROWS / 2);
		return Array.from({ length: START_LENGTH }, (_, index) => ({ x: startX - index, y: startY }));
	}

	function rewardFor(points: number, cleared: boolean): number {
		return cappedReward(Math.floor(points / 3) + (cleared ? 6 : 0), MAX_REWARD);
	}

	function sameCell(a: Cell, b: Cell): boolean {
		return a.x === b.x && a.y === b.y;
	}

	function cellKey(cell: Cell): string {
		return `${cell.x}:${cell.y}`;
	}

	function randomFood(body: Cell[]): Cell {
		const occupied = new Set(body.map(cellKey));
		const open: Cell[] = [];
		for (let y = 0; y < ROWS; y += 1) {
			for (let x = 0; x < COLS; x += 1) {
				const cell = { x, y };
				if (!occupied.has(cellKey(cell))) open.push(cell);
			}
		}
		return open[Math.floor(Math.random() * open.length)] ?? { x: 0, y: 0 };
	}

	function reset() {
		const body = freshSnake();
		snake = body;
		food = randomFood(body);
		dir = { x: 1, y: 0 };
		nextDir = { x: 1, y: 0 };
		score = 0;
		awarded = 0;
		wraps = 0;
		stepClock = 0;
		pulse = 0;
	}

	function start() {
		stop();
		reset();
		phase = 'running';
		lastTime = performance.now();
		raf = requestAnimationFrame(loop);
	}

	function stop() {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}

	function finish(nextPhase: 'complete' | 'over') {
		if (phase !== 'running') return;
		phase = nextPhase;
		stop();
		rounds += 1;
		best = Math.max(best, score);
		awarded = rewardFor(score, nextPhase === 'complete');
		if (awarded > 0) {
			book.insight += awarded;
			book.persist();
		}
	}

	function loop(now: number) {
		const dt = Math.min(0.05, Math.max(0, now - lastTime));
		lastTime = now;
		stepClock += dt;
		pulse = Math.max(0, pulse - dt / 220);
		while (stepClock >= speedMs && phase === 'running') {
			stepClock -= speedMs;
			tick();
		}
		if (phase === 'running') raf = requestAnimationFrame(loop);
	}

	function tick() {
		dir = nextDir;
		const head = snake[0];
		let nextHead = { x: head.x + dir.x, y: head.y + dir.y };
		let wrapped = false;

		if (nextHead.x < 0) {
			nextHead = { ...nextHead, x: COLS - 1 };
			wrapped = true;
		} else if (nextHead.x >= COLS) {
			nextHead = { ...nextHead, x: 0 };
			wrapped = true;
		}
		if (nextHead.y < 0) {
			nextHead = { ...nextHead, y: ROWS - 1 };
			wrapped = true;
		} else if (nextHead.y >= ROWS) {
			nextHead = { ...nextHead, y: 0 };
			wrapped = true;
		}

		const ate = sameCell(nextHead, food);
		const nextBody = ate ? [nextHead, ...snake] : [nextHead, ...snake.slice(0, -1)];
		const bodyToCheck = ate ? snake : snake.slice(0, -1);
		if (bodyToCheck.some((cell) => sameCell(cell, nextHead))) {
			finish('over');
			return;
		}

		snake = nextBody;
		if (wrapped) wraps += 1;
		if (ate) {
			const nextScore = score + 1;
			score = nextScore;
			pulse = 1;
			if (nextScore >= WIN_SCORE) {
				finish('complete');
				return;
			}
			food = randomFood(nextBody);
		}
	}

	function setDirection(next: Cell) {
		if (phase !== 'running') return;
		if (dir.x + next.x === 0 && dir.y + next.y === 0) return;
		nextDir = next;
	}

	function onKeyDown(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		const directions: Record<string, Cell> = {
			arrowleft: { x: -1, y: 0 },
			a: { x: -1, y: 0 },
			arrowright: { x: 1, y: 0 },
			d: { x: 1, y: 0 },
			arrowup: { x: 0, y: -1 },
			w: { x: 0, y: -1 },
			arrowdown: { x: 0, y: 1 },
			s: { x: 0, y: 1 }
		};
		const next = directions[key];
		if (!next) return;
		event.preventDefault();
		setDirection(next);
	}

	let touchStart: Cell | null = null;
	function onPointerDown(event: PointerEvent) {
		touchStart = { x: event.clientX, y: event.clientY };
	}

	function onPointerUp(event: PointerEvent) {
		if (!touchStart) return;
		const dx = event.clientX - touchStart.x;
		const dy = event.clientY - touchStart.y;
		touchStart = null;
		if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
		if (Math.abs(dx) > Math.abs(dy)) {
			setDirection({ x: dx > 0 ? 1 : -1, y: 0 });
		} else {
			setDirection({ x: 0, y: dy > 0 ? 1 : -1 });
		}
	}

	function cellX(cell: Cell): number {
		return cell.x * CELL;
	}

	function cellY(cell: Cell): number {
		return cell.y * CELL;
	}

	onMount(() => window.addEventListener('keydown', onKeyDown));

	onDestroy(() => {
		stop();
		if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeyDown);
	});
</script>

<div class="snake-shell">
	<div class="snake-bar">
		<div class="game-id">
			<span class="game-name">Margin Snake</span>
			<span class="game-hint">{hintLabel}</span>
		</div>
		<div class="score-group">
			<div class="score-box">
				<span class="score-label">score</span>
				<span class="score-val">{score}</span>
			</div>
			<div class="score-box live">
				<span class="score-label">length</span>
				<span class="score-val">{snake.length}</span>
			</div>
			<div class="score-box">
				<span class="score-label">best</span>
				<span class="score-val">{best}</span>
			</div>
			<div class="score-box">
				<span class="score-label">prize</span>
				<span class="score-val">{fmt(phase === 'complete' || phase === 'over' ? awarded : rewardPreview)}</span>
			</div>
		</div>
		<div class="btn-group">
			<button class="ctrl-btn" onclick={start}>{startLabel}</button>
			<button class="ctrl-btn back" onclick={onclose}>arcade</button>
		</div>
	</div>

	<div class="grow-track" style={progressStyle} aria-label="growth progress">
		<span></span>
	</div>

	<svg
		class="field"
		class:active={phase === 'running'}
		style={`--pulse:${pulse.toFixed(3)}`}
		viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
		role="img"
		aria-label="Margin Snake board"
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
	>
		<defs>
			<pattern id="snake-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
				<path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="rgba(88, 110, 117, 0.12)" stroke-width="1" />
			</pattern>
		</defs>
		<rect class="field-bg" width={WORLD_W} height={WORLD_H} rx="6" />
		<rect width={WORLD_W} height={WORLD_H} fill="url(#snake-grid)" opacity="0.72" />
		<rect class="food-aura" x={cellX(food) + 2} y={cellY(food) + 2} width={CELL - 4} height={CELL - 4} rx="5" />
		<rect class="food" x={cellX(food) + 6} y={cellY(food) + 6} width={CELL - 12} height={CELL - 12} rx="3" />

		{#each snake as part, index (`${part.x}:${part.y}:${index}`)}
			<rect
				class="snake-cell"
				class:head={index === 0}
				x={cellX(part) + 2}
				y={cellY(part) + 2}
				width={CELL - 4}
				height={CELL - 4}
				rx={index === 0 ? 6 : 4}
			/>
		{/each}

		{#if phase === 'ready' || phase === 'complete' || phase === 'over'}
			<rect class="veil" width={WORLD_W} height={WORLD_H} rx="6" />
			<text class="center-title" x={WORLD_W / 2} y={WORLD_H / 2 - 10} text-anchor="middle">
				{outcomeLabel}
			</text>
			<text class="center-sub" x={WORLD_W / 2} y={WORLD_H / 2 + 22} text-anchor="middle">
				{phase === 'ready'
					? 'classic line, tiny appetite'
					: `score ${score} · wraps ${wraps} · ${rounds} coil${rounds === 1 ? '' : 's'}`}
			</text>
		{/if}
	</svg>

	<div class="pad-row" aria-label="direction controls">
		<button onclick={() => setDirection({ x: 0, y: -1 })}>up</button>
		<button onclick={() => setDirection({ x: -1, y: 0 })}>left</button>
		<button onclick={() => setDirection({ x: 1, y: 0 })}>right</button>
		<button onclick={() => setDirection({ x: 0, y: 1 })}>down</button>
	</div>
</div>

<style>
	.snake-shell {
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}
	.snake-bar {
		width: 100%;
		max-width: 540px;
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
	}
	.game-hint {
		font-family: var(--font-ui);
		font-size: 0.62rem;
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
	.ctrl-btn,
	.pad-row button {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		text-transform: uppercase;
		color: var(--sol-base3);
		background: var(--sol-base0);
		border-radius: 3px;
		padding: 0.24rem 0.6rem;
		white-space: nowrap;
		transition: background 0.1s;
	}
	.ctrl-btn:hover,
	.pad-row button:hover {
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
	.grow-track {
		width: min(540px, 100%);
		height: 0.45rem;
		border-radius: 999px;
		background: var(--sol-base2);
		overflow: hidden;
	}
	.grow-track span {
		display: block;
		width: calc(var(--left) * 100%);
		height: 100%;
		background: linear-gradient(90deg, var(--sol-green), var(--sol-cyan), var(--sol-blue));
		transition: width 120ms linear;
	}
	.field {
		width: min(540px, calc(100vw - 3rem));
		aspect-ratio: 11 / 8;
		border: 1px solid var(--sol-base2);
		border-radius: 6px;
		background: var(--sol-base2);
		box-shadow:
			inset 0 0 0 6px rgba(7, 54, 66, 0.05),
			0 8px 24px rgba(7, 54, 66, 0.08);
		touch-action: none;
		user-select: none;
	}
	.field.active {
		cursor: grab;
	}
	.field-bg {
		fill: #fdf6e3;
	}
	.food-aura {
		fill: rgba(181, 137, 0, calc(0.2 + var(--pulse) * 0.26));
	}
	.food {
		fill: var(--sol-yellow);
		stroke: var(--sol-base3);
		stroke-width: 2;
	}
	.snake-cell {
		fill: var(--sol-green);
		stroke: rgba(253, 246, 227, 0.88);
		stroke-width: 1.5;
	}
	.snake-cell.head {
		fill: var(--sol-cyan);
		stroke-width: 2.5;
	}
	.veil {
		fill: rgba(253, 246, 227, 0.72);
	}
	.center-title {
		font-family: var(--font-counter);
		font-size: 42px;
		fill: var(--sol-base01);
	}
	.center-sub {
		font-family: var(--font-body);
		font-size: 14px;
		font-style: italic;
		fill: var(--sol-base0);
	}
	.pad-row {
		width: min(540px, 100%);
		display: flex;
		justify-content: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.pad-row button {
		background: var(--sol-base2);
		color: var(--sol-base0);
		min-width: 3.8rem;
	}
	.pad-row button:hover {
		background: var(--sol-cyan);
		color: var(--sol-base3);
	}
	@media (max-width: 560px) {
		.snake-bar {
			align-items: flex-start;
		}
		.btn-group {
			flex-direction: row;
			align-items: center;
		}
		.game-name {
			font-size: 1.7rem;
		}
		.score-box {
			min-width: 2.85rem;
			padding-inline: 0.48rem;
		}
		.center-title {
			font-size: 34px;
		}
	}
</style>
