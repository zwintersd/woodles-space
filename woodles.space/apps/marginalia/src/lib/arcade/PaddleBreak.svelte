<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ArcadeHud from './ArcadeHud.svelte';
	import ArcadeProgress from './ArcadeProgress.svelte';
	import { clamp, type Dot } from './arcadeMath';
	import { fmt } from '$lib/witch/book.svelte';
	import { payReward, previewReward } from './arcadeRewards';
	import type { ArcadeActivePet } from './arcadeStats';

	interface Props {
		onclose: () => void;
		activePet?: ArcadeActivePet;
	}
	let { onclose }: Props = $props();

	type Phase = 'ready' | 'running' | 'complete' | 'over';

	interface Ball extends Dot {
		vx: number;
		vy: number;
	}

	interface Brick {
		id: number;
		x: number;
		y: number;
		w: number;
		h: number;
		tone: number;
	}

	interface Burst extends Dot {
		id: number;
		text: string;
		life: number;
	}

	const WORLD_W = 520;
	const WORLD_H = 340;
	const PADDLE_W = 78;
	const PADDLE_H = 12;
	const PADDLE_Y = WORLD_H - 32;
	const BALL_R = 6;
	const BRICK_COLS = 9;
	const BRICK_ROWS = 5;
	const BRICK_W = 46;
	const BRICK_H = 16;
	const BRICK_GAP = 7;
	const MAX_REWARD = 22;

	const keys = new Set<string>();

	let phase = $state<Phase>('ready');
	let paddleX = $state(WORLD_W / 2 - PADDLE_W / 2);
	let ball = $state<Ball>(freshBall());
	let bricks = $state<Brick[]>(freshBricks());
	let bursts = $state<Burst[]>([]);
	let score = $state(0);
	let combo = $state(0);
	let best = $state(0);
	let awarded = $state(0);
	let rounds = $state(0);
	let saves = $state(0);
	let misses = $state(0);
	let raf = 0;
	let lastTime = 0;
	let burstSeq = 0;
	let fieldEl: SVGSVGElement;
	let pointerDown = false;

	const wallProgress = $derived((BRICK_COLS * BRICK_ROWS - bricks.length) / (BRICK_COLS * BRICK_ROWS));
	const startLabel = $derived(phase === 'running' ? 'restart' : rounds > 0 ? 'again' : 'start');
	const rewardPreview = $derived(rewardFor(score, saves, phase === 'complete'));
	const outcomeLabel = $derived.by(() => {
		if (phase === 'complete') return awarded > 0 ? `+${fmt(awarded)} insight` : 'clear';
		if (phase === 'over') return 'dropped';
		if (rounds > 0) return 'again?';
		return 'ready?';
	});
	const hintLabel = $derived.by(() => {
		if (phase === 'running') return 'arrow keys, a/d, pointer, or buttons';
		if (phase === 'complete') return 'the wall came loose';
		if (phase === 'over') return 'the ball slipped through the margin';
		return 'keep the ball in play, break the wall';
	});

	function freshBall(): Ball {
		return {
			x: WORLD_W / 2,
			y: PADDLE_Y - 22,
			vx: 128,
			vy: -176
		};
	}

	function freshBricks(): Brick[] {
		const width = BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP;
		const left = (WORLD_W - width) / 2;
		return Array.from({ length: BRICK_ROWS * BRICK_COLS }, (_, index) => {
			const col = index % BRICK_COLS;
			const row = Math.floor(index / BRICK_COLS);
			return {
				id: index + 1,
				x: left + col * (BRICK_W + BRICK_GAP),
				y: 38 + row * (BRICK_H + BRICK_GAP),
				w: BRICK_W,
				h: BRICK_H,
				tone: row
			};
		});
	}

	function rewardFor(points: number, rescued: number, cleared: boolean): number {
		const raw = Math.floor(points / 7) + Math.floor(rescued / 3) + (cleared ? 7 : 0);
		return previewReward(raw, MAX_REWARD);
	}

	function reset() {
		paddleX = WORLD_W / 2 - PADDLE_W / 2;
		ball = freshBall();
		bricks = freshBricks();
		bursts = [];
		score = 0;
		combo = 0;
		awarded = 0;
		saves = 0;
		misses = 0;
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
		awarded = payReward(rewardFor(score, saves, nextPhase === 'complete'), MAX_REWARD);
	}

	function loop(now: number) {
		const dt = Math.min(0.034, Math.max(0, (now - lastTime) / 1000));
		lastTime = now;
		step(dt);
		if (phase === 'running') raf = requestAnimationFrame(loop);
	}

	function step(dt: number) {
		movePaddle(dt);
		updateBall(dt);
		updateBursts(dt);
	}

	function movePaddle(dt: number) {
		let dx = 0;
		if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
		if (keys.has('arrowright') || keys.has('d')) dx += 1;
		if (dx === 0) return;
		paddleX = clamp(paddleX + dx * 245 * dt, 0, WORLD_W - PADDLE_W);
	}

	function updateBall(dt: number) {
		let next: Ball = { ...ball, x: ball.x + ball.vx * dt, y: ball.y + ball.vy * dt };

		if (next.x <= BALL_R) {
			next = { ...next, x: BALL_R, vx: Math.abs(next.vx) };
		} else if (next.x >= WORLD_W - BALL_R) {
			next = { ...next, x: WORLD_W - BALL_R, vx: -Math.abs(next.vx) };
		}
		if (next.y <= BALL_R) {
			next = { ...next, y: BALL_R, vy: Math.abs(next.vy) };
		}

		if (
			next.vy > 0 &&
			next.y + BALL_R >= PADDLE_Y &&
			next.y - BALL_R <= PADDLE_Y + PADDLE_H &&
			next.x >= paddleX - BALL_R &&
			next.x <= paddleX + PADDLE_W + BALL_R
		) {
			const paddleCenter = paddleX + PADDLE_W / 2;
			const hit = clamp((next.x - paddleCenter) / (PADDLE_W / 2), -1, 1);
			const speed = Math.min(310, Math.hypot(next.vx, next.vy) + 6);
			next = {
				...next,
				y: PADDLE_Y - BALL_R - 0.5,
				vx: hit * 170,
				vy: -Math.sqrt(Math.max(90 * 90, speed * speed - (hit * 170) ** 2))
			};
			saves += 1;
			combo = 0;
			addBurst(next.x, PADDLE_Y - 8, 'save');
		}

		const brickIndex = bricks.findIndex((brick) => overlapsBrick(next, brick));
		if (brickIndex >= 0) {
			const brick = bricks[brickIndex];
			const nextBricks = bricks.filter((item) => item.id !== brick.id);
			const gained = 1 + brick.tone + Math.min(4, Math.floor(combo / 4));
			bricks = nextBricks;
			score += gained;
			combo += 1;
			addBurst(brick.x + brick.w / 2, brick.y + brick.h / 2, `+${gained}`);

			const previousX = ball.x;
			const previousY = ball.y;
			const hitFromSide = previousX <= brick.x || previousX >= brick.x + brick.w;
			next = hitFromSide ? { ...next, vx: -next.vx } : { ...next, vy: -next.vy };
			if (nextBricks.length === 0) {
				ball = next;
				finish('complete');
				return;
			}
		}

		if (next.y > WORLD_H + BALL_R) {
			misses += 1;
			finish('over');
			return;
		}

		ball = next;
	}

	function overlapsBrick(nextBall: Ball, brick: Brick): boolean {
		const nearestX = clamp(nextBall.x, brick.x, brick.x + brick.w);
		const nearestY = clamp(nextBall.y, brick.y, brick.y + brick.h);
		return Math.hypot(nextBall.x - nearestX, nextBall.y - nearestY) <= BALL_R;
	}

	function addBurst(x: number, y: number, text: string) {
		bursts = [...bursts, { id: ++burstSeq, x, y, text, life: 0.68 }];
	}

	function updateBursts(dt: number) {
		bursts = bursts
			.map((burst) => ({ ...burst, y: burst.y - 19 * dt, life: burst.life - dt }))
			.filter((burst) => burst.life > 0);
	}

	function pointerToPaddle(event: PointerEvent) {
		if (phase !== 'running') return;
		const rect = fieldEl.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * WORLD_W;
		paddleX = clamp(x - PADDLE_W / 2, 0, WORLD_W - PADDLE_W);
	}

	function onPointerDown(event: PointerEvent) {
		pointerDown = true;
		fieldEl.setPointerCapture(event.pointerId);
		pointerToPaddle(event);
	}

	function onPointerMove(event: PointerEvent) {
		if (pointerDown) pointerToPaddle(event);
	}

	function onPointerUp(event: PointerEvent) {
		pointerDown = false;
		fieldEl.releasePointerCapture(event.pointerId);
	}

	function press(direction: -1 | 1) {
		if (phase !== 'running') start();
		paddleX = clamp(paddleX + direction * 28, 0, WORLD_W - PADDLE_W);
	}

	function onKeyDown(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) {
			event.preventDefault();
			keys.add(key);
		}
		if (key === ' ' && phase !== 'running') {
			event.preventDefault();
			start();
		}
	}

	function onKeyUp(event: KeyboardEvent) {
		keys.delete(event.key.toLowerCase());
	}

	onMount(() => {
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
	});

	onDestroy(() => {
		stop();
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
		}
	});
</script>

<div class="paddle-shell">
	<ArcadeHud
		title="Paddle Break"
		hint={hintLabel}
		scores={[
			{ label: 'score', value: score },
			{ label: 'combo', value: combo, live: true, tone: 'yellow' },
			{ label: 'wall', value: BRICK_COLS * BRICK_ROWS - bricks.length },
			{ label: 'prize', value: fmt(phase === 'complete' || phase === 'over' ? awarded : rewardPreview) }
		]}
		{startLabel}
		onstart={start}
		onclose={onclose}
	/>

	<ArcadeProgress value={wallProgress} label="wall cleared" tone="violet" />

	<svg
		bind:this={fieldEl}
		class="field"
		class:active={phase === 'running'}
		viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
		role="img"
		aria-label="Paddle Break arena"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
	>
		<defs>
			<pattern id="paddle-grid" width="32" height="32" patternUnits="userSpaceOnUse">
				<path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(88, 110, 117, 0.12)" stroke-width="1" />
			</pattern>
		</defs>
		<rect class="field-bg" width={WORLD_W} height={WORLD_H} rx="6" />
		<rect width={WORLD_W} height={WORLD_H} fill="url(#paddle-grid)" opacity="0.62" />
		<line class="danger-line" x1="0" y1={WORLD_H - 10} x2={WORLD_W} y2={WORLD_H - 10} />

		{#each bricks as brick (brick.id)}
			<rect
				class="brick tone-{brick.tone}"
				x={brick.x}
				y={brick.y}
				width={brick.w}
				height={brick.h}
				rx="3"
			/>
		{/each}

		<rect class="paddle-shadow" x={paddleX - 6} y={PADDLE_Y + 8} width={PADDLE_W + 12} height="7" rx="3.5" />
		<rect class="paddle" x={paddleX} y={PADDLE_Y} width={PADDLE_W} height={PADDLE_H} rx="6" />
		<circle class="ball-aura" cx={ball.x} cy={ball.y} r="15" />
		<circle class="ball" cx={ball.x} cy={ball.y} r={BALL_R} />

		{#each bursts as burst (burst.id)}
			<text class="burst" x={burst.x} y={burst.y} text-anchor="middle">{burst.text}</text>
		{/each}

		{#if phase === 'ready' || phase === 'complete' || phase === 'over'}
			<rect class="veil" width={WORLD_W} height={WORLD_H} rx="6" />
			<text class="center-title" x={WORLD_W / 2} y={WORLD_H / 2 - 10} text-anchor="middle">
				{outcomeLabel}
			</text>
			<text class="center-sub" x={WORLD_W / 2} y={WORLD_H / 2 + 22} text-anchor="middle">
				{phase === 'ready'
					? 'pong hands, breakout wall'
					: `score ${score} · best ${best} · ${rounds} run${rounds === 1 ? '' : 's'}`}
			</text>
		{/if}
	</svg>

	<div class="pad-row" aria-label="paddle controls">
		<button onclick={() => press(-1)}>left</button>
		<button onclick={() => press(1)}>right</button>
		<span>{saves} saves · {misses} drops</span>
	</div>
</div>

<style>
	.paddle-shell {
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
		aspect-ratio: 26 / 17;
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
		cursor: ew-resize;
	}
	.field-bg {
		fill: #fdf6e3;
	}
	.danger-line {
		stroke: rgba(220, 50, 47, 0.32);
		stroke-width: 2;
		stroke-dasharray: 7 6;
	}
	.brick {
		stroke: rgba(253, 246, 227, 0.86);
		stroke-width: 1.5;
	}
	.brick.tone-0 {
		fill: var(--sol-violet);
	}
	.brick.tone-1 {
		fill: var(--sol-blue);
	}
	.brick.tone-2 {
		fill: var(--sol-cyan);
	}
	.brick.tone-3 {
		fill: var(--sol-green);
	}
	.brick.tone-4 {
		fill: var(--sol-yellow);
	}
	.paddle-shadow {
		fill: rgba(7, 54, 66, 0.12);
	}
	.paddle {
		fill: var(--sol-base00);
		stroke: var(--sol-base3);
		stroke-width: 2.5;
	}
	.ball-aura {
		fill: rgba(181, 137, 0, 0.15);
		stroke: rgba(181, 137, 0, 0.3);
		stroke-width: 1;
	}
	.ball {
		fill: var(--sol-yellow);
		stroke: var(--sol-base3);
		stroke-width: 2.5;
	}
	.burst {
		font-family: var(--font-counter);
		font-size: 16px;
		fill: var(--sol-orange);
		pointer-events: none;
	}
	.veil {
		fill: rgba(253, 246, 227, 0.74);
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
		font-family: var(--font-ui);
		font-size: 0.62rem;
		text-transform: uppercase;
		color: var(--sol-base1);
	}
	.pad-row button {
		background: var(--sol-base2);
		color: var(--sol-base0);
		min-width: 4.2rem;
	}
	.pad-row button:hover {
		background: var(--sol-blue);
		color: var(--sol-base3);
	}
	@media (max-width: 560px) {
		.center-title {
			font-size: 34px;
		}
	}
</style>
