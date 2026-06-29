<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ArcadeHud from './ArcadeHud.svelte';
	import ArcadePetPerks from './ArcadePetPerks.svelte';
	import ArcadeProgress from './ArcadeProgress.svelte';
	import type { Dot } from './arcadeMath';
	import { arcadeStartLabel } from './arcadeLabels';
	import { fmt } from '$lib/witch/book.svelte';
	import { payReward, previewReward } from './arcadeRewards';
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

	type Phase = 'ready' | 'running' | 'complete' | 'over';

	interface Cell extends Dot {}

	const COLS = 22;
	const ROWS = 16;
	const GAME_ID = 'margin-snake';
	const CELL = 20;
	const WORLD_W = COLS * CELL;
	const WORLD_H = ROWS * CELL;
	const START_LENGTH = 4;
	const MAX_REWARD = 18;
	const WIN_SCORE = 18;

	let phase = $state<Phase>('ready');
	let snake = $state<Cell[]>(freshSnake());
	let food = $state<Cell>({ x: 15, y: 8 });
	let nextFood = $state<Cell>({ x: 6, y: 6 });
	let dir = $state<Cell>({ x: 1, y: 0 });
	let nextDir = $state<Cell>({ x: 1, y: 0 });
	let queuedDir = $state<Cell | null>(null);
	let score = $state(0);
	let best = $state(loadArcadeRecord(GAME_ID).bestScore);
	let awarded = $state(0);
	let rounds = $state(0);
	let wraps = $state(0);
	let tailSheds = $state(0);
	let tailShedsUsed = $state(0);
	let raf = 0;
	let lastTime = 0;
	let stepClock = 0;
	let pulse = $state(0);

	const bodyTier = $derived(statTier(coreStatValue(activePet, 'body')));
	const mindTier = $derived(statTier(coreStatValue(activePet, 'mind')));
	const graceTier = $derived(statTier(coreStatValue(activePet, 'grace')));
	const heartTier = $derived(statTier(coreStatValue(activePet, 'heart')));
	const speedMs = $derived(
		Math.max(94 + bodyTier * 8, 170 + bodyTier * 10 - score * Math.max(2.2, 4 - bodyTier * 0.45))
	);
	const growthProgress = $derived(Math.min(1, score / WIN_SCORE));
	const startLabel = $derived(arcadeStartLabel(phase, rounds));
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
	const queueLabel = $derived(
		queuedDir ? `queued ${directionName(queuedDir)}` : nextDir ? `next ${directionName(nextDir)}` : 'steady'
	);
	const statEffects = $derived<ArcadeStatEffects>({
		body: (_value, tier) => (tier > 0 ? 'slower speed ramp' : 'normal speed ramp'),
		mind: (_value, tier) => (tier > 1 ? 'head + food preview' : tier > 0 ? 'head preview' : 'no preview'),
		grace: (_value, tier) => (tier > 0 ? 'queued turns visible' : 'single turn buffer'),
		heart: (_value, tier) => (tier > 0 ? `${tier} tail shed${tier === 1 ? '' : 's'}` : 'self-bite ends')
	});

	function freshSnake(): Cell[] {
		const startX = Math.floor(COLS / 2) - 2;
		const startY = Math.floor(ROWS / 2);
		return Array.from({ length: START_LENGTH }, (_, index) => ({ x: startX - index, y: startY }));
	}

	function rewardFor(points: number, cleared: boolean): number {
		return previewReward(Math.floor(points / 3) + (cleared ? 6 : 0), MAX_REWARD);
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

	function reset(initialDir: Cell = { x: 1, y: 0 }) {
		const body = freshSnake();
		const firstFood = randomFood(body);
		snake = body;
		food = firstFood;
		nextFood = randomFood([...body, firstFood]);
		dir = initialDir;
		nextDir = initialDir;
		queuedDir = null;
		score = 0;
		awarded = 0;
		wraps = 0;
		tailSheds = heartTier;
		tailShedsUsed = 0;
		stepClock = 0;
		pulse = 0;
	}

	function start() {
		startRun();
	}

	function startRun(initialDir: Cell = { x: 1, y: 0 }) {
		stop();
		reset(initialDir);
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
		const record = recordArcadeRun(GAME_ID, {
			score,
			summary: {
				length: snake.length,
				wraps,
				cleared: nextPhase === 'complete',
				tailSheds: tailShedsUsed,
				awarded: rewardFor(score, nextPhase === 'complete')
			}
		});
		best = record.bestScore;
		awarded = payReward(rewardFor(score, nextPhase === 'complete'), MAX_REWARD);
	}

	function loop(now: number) {
		const dt = Math.min(50, Math.max(0, now - lastTime));
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
			if (tailSheds > 0 && nextBody.length > START_LENGTH + 1) {
				tailSheds -= 1;
				tailShedsUsed += 1;
				snake = nextBody.slice(0, Math.max(START_LENGTH, nextBody.length - 3));
				pulse = 1;
				if (queuedDir && !isReverse(queuedDir, dir)) {
					nextDir = queuedDir;
					queuedDir = null;
				}
				return;
			}
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
			food = nextFood;
			nextFood = randomFood([...nextBody, nextFood]);
		}

		if (queuedDir && !isReverse(queuedDir, dir)) {
			nextDir = queuedDir;
			queuedDir = null;
		}
	}

	function setDirection(next: Cell) {
		if (phase !== 'running') {
			startRun(next);
			return;
		}
		if (isReverse(next, dir)) return;
		if (
			graceTier > 0 &&
			!sameCell(nextDir, dir) &&
			!sameCell(next, nextDir) &&
			!isReverse(next, nextDir)
		) {
			queuedDir = next;
			return;
		}
		nextDir = next;
		queuedDir = null;
	}

	function isReverse(a: Cell, b: Cell): boolean {
		return a.x + b.x === 0 && a.y + b.y === 0;
	}

	function directionName(cell: Cell): string {
		if (cell.x < 0) return 'left';
		if (cell.x > 0) return 'right';
		if (cell.y < 0) return 'up';
		return 'down';
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

	function nextHeadPreview(): Cell {
		const head = snake[0];
		let x = head.x + nextDir.x;
		let y = head.y + nextDir.y;
		if (x < 0) x = COLS - 1;
		if (x >= COLS) x = 0;
		if (y < 0) y = ROWS - 1;
		if (y >= ROWS) y = 0;
		return { x, y };
	}

	onMount(() => window.addEventListener('keydown', onKeyDown));

	onDestroy(() => {
		stop();
		if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeyDown);
	});
</script>

<div class="snake-shell">
	<ArcadeHud
		title="Margin Snake"
		hint={hintLabel}
		scores={[
			{ label: 'score', value: score },
			{ label: 'length', value: snake.length, live: true, tone: 'cyan' },
			{ label: 'speed', value: `${Math.round(speedMs)}ms` },
			{ label: 'shed', value: tailSheds, live: tailSheds > 0, tone: 'green' },
			{ label: 'best', value: best },
			{ label: 'prize', value: fmt(phase === 'complete' || phase === 'over' ? awarded : rewardPreview) }
		]}
		{startLabel}
		onstart={start}
		onclose={onclose}
	/>

	<ArcadeProgress value={growthProgress} label="growth progress" />

	<div class="perks-wrap">
		<ArcadePetPerks creature={activePet} effects={statEffects} />
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
		{#if phase === 'running' && mindTier > 0}
			{@const preview = nextHeadPreview()}
			<rect class="head-preview" x={cellX(preview) + 3} y={cellY(preview) + 3} width={CELL - 6} height={CELL - 6} rx="5" />
		{/if}
		{#if phase === 'running' && mindTier > 1}
			<rect class="next-food-preview" x={cellX(nextFood) + 5} y={cellY(nextFood) + 5} width={CELL - 10} height={CELL - 10} rx="4" />
		{/if}
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
		<button class:pressed={directionName(nextDir) === 'up' || directionName(queuedDir ?? nextDir) === 'up'} onclick={() => setDirection({ x: 0, y: -1 })}>up</button>
		<button class:pressed={directionName(nextDir) === 'left' || directionName(queuedDir ?? nextDir) === 'left'} onclick={() => setDirection({ x: -1, y: 0 })}>left</button>
		<button class:pressed={directionName(nextDir) === 'right' || directionName(queuedDir ?? nextDir) === 'right'} onclick={() => setDirection({ x: 1, y: 0 })}>right</button>
		<button class:pressed={directionName(nextDir) === 'down' || directionName(queuedDir ?? nextDir) === 'down'} onclick={() => setDirection({ x: 0, y: 1 })}>down</button>
		<span>{queueLabel}</span>
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
	.pad-row button:hover {
		background: var(--sol-base00);
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
	.perks-wrap {
		width: min(540px, 100%);
	}
	.head-preview {
		fill: rgba(38, 139, 210, 0.13);
		stroke: rgba(38, 139, 210, 0.45);
		stroke-width: 1.5;
		stroke-dasharray: 3 3;
	}
	.next-food-preview {
		fill: rgba(108, 113, 196, 0.12);
		stroke: rgba(108, 113, 196, 0.42);
		stroke-width: 1.5;
		stroke-dasharray: 2 3;
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
		align-items: center;
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
	.pad-row button:active,
	.pad-row button.pressed {
		background: var(--sol-violet);
		color: var(--sol-base3);
		transform: translateY(1px);
	}
	.pad-row span {
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--sol-base1);
	}
	@media (max-width: 560px) {
		.center-title {
			font-size: 34px;
		}
	}
</style>
