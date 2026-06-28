<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { cappedReward, clamp, distance, type Dot } from './arcadeMath';
	import { book, fmt } from '$lib/witch/book.svelte';
	import type { ArcadeActivePet } from './arcadeStats';

	interface Props {
		onclose: () => void;
		activePet?: ArcadeActivePet;
	}
	let { onclose }: Props = $props();

	type Phase = 'ready' | 'running' | 'complete' | 'over';
	type Direction = 'left' | 'right' | 'up' | 'down';
	type BlobTone = 'cyan' | 'green' | 'violet' | 'blue' | 'orange' | 'red' | 'yellow';
	type BlobTier = 'tiny' | 'small' | 'mid' | 'massive';

	interface BlobSpec {
		tier: BlobTier;
		tone: BlobTone;
		radius: number;
		speed: number;
		points: number;
		growth: number;
	}

	interface Enemy extends Dot {
		id: number;
		vx: number;
		vy: number;
		radius: number;
		points: number;
		growth: number;
		tier: BlobTier;
		tone: BlobTone;
	}

	interface Burst extends Dot {
		id: number;
		text: string;
		tone: BlobTone | 'ink';
		life: number;
	}

	interface PlayerCopy extends Dot {
		key: string;
		primary: boolean;
	}

	const WORLD_W = 540;
	const WORLD_H = 340;
	const START_RADIUS = 12;
	const MASSIVE_RADIUS = 34;
	const MAX_PLAYER_RADIUS = 40;
	const MAX_REWARD = 28;
	const BASE_SPEED = 146;
	const MIN_SPEED = 64;
	const EDGE_MARGIN = 54;
	const MAX_ENEMIES = 28;
	const DIRECTIONS: Record<Direction, Dot> = {
		left: { x: -1, y: 0 },
		right: { x: 1, y: 0 },
		up: { x: 0, y: -1 },
		down: { x: 0, y: 1 }
	};
	const DIRECTION_KEYS: Record<Direction, string> = {
		left: 'arrowleft',
		right: 'arrowright',
		up: 'arrowup',
		down: 'arrowdown'
	};
	const KEY_TO_DIRECTION: Record<string, Direction> = {
		arrowleft: 'left',
		arrowright: 'right',
		arrowup: 'up',
		arrowdown: 'down'
	};
	const BLOB_SPECS: BlobSpec[] = [
		{ tier: 'tiny', tone: 'cyan', radius: 6, speed: 124, points: 1, growth: 0.44 },
		{ tier: 'tiny', tone: 'green', radius: 7, speed: 114, points: 1, growth: 0.5 },
		{ tier: 'small', tone: 'violet', radius: 9, speed: 98, points: 2, growth: 0.68 },
		{ tier: 'small', tone: 'blue', radius: 11, speed: 88, points: 3, growth: 0.82 },
		{ tier: 'mid', tone: 'orange', radius: 16, speed: 68, points: 6, growth: 1.28 },
		{ tier: 'mid', tone: 'red', radius: 22, speed: 52, points: 10, growth: 1.74 },
		{ tier: 'massive', tone: 'yellow', radius: MASSIVE_RADIUS, speed: 30, points: 35, growth: 0 }
	];

	const keys = new Set<string>();

	let phase = $state<Phase>('ready');
	let player = $state<Dot>({ x: WORLD_W / 2, y: WORLD_H / 2 });
	let velocity = $state<Dot>({ x: 0, y: 0 });
	let playerRadius = $state(START_RADIUS);
	let facing = $state<Direction>('right');
	let padDirection = $state<Direction | null>(null);
	let enemies = $state<Enemy[]>([]);
	let bursts = $state<Burst[]>([]);
	let score = $state(0);
	let eaten = $state(0);
	let best = $state(0);
	let awarded = $state(0);
	let rounds = $state(0);
	let elapsed = $state(0);
	let lastSnack = $state<BlobTone | null>(null);
	let raf = 0;
	let lastTime = 0;
	let spawnClock = 0;
	let enemySeq = 0;
	let burstSeq = 0;

	const growthProgress = $derived(clamp((playerRadius - START_RADIUS) / (MASSIVE_RADIUS - START_RADIUS), 0, 1));
	const progressStyle = $derived(`--left:${growthProgress.toFixed(4)}`);
	const startLabel = $derived(phase === 'running' ? 'restart' : rounds > 0 ? 'again' : 'start');
	const speedLabel = $derived(Math.round(playerSpeed()));
	const sizeLabel = $derived(playerRadius.toFixed(1));
	const rewardPreview = $derived(rewardFor(score, playerRadius, phase === 'complete'));
	const outcomeLabel = $derived.by(() => {
		if (phase === 'complete') return 'jellyworld';
		if (phase === 'over') return 'squished';
		if (rounds > 0) return 'again?';
		return 'ready?';
	});
	const hintLabel = $derived.by(() => {
		if (phase === 'complete') return 'You ate all the jelly in jellyworld.';
		if (phase === 'over') return 'strictly bigger means strictly bigger';
		if (phase === 'running') return canEatYellow() ? 'yellow is food now' : 'eat smaller, avoid bigger';
		return 'ice feet, wrap walls, strict appetite';
	});

	function rewardFor(points: number, radius: number, won: boolean): number {
		const raw = Math.floor(points / 8) + Math.floor(Math.max(0, radius - START_RADIUS) / 4) + (won ? 12 : 0);
		return cappedReward(raw, MAX_REWARD);
	}

	function canEatYellow(): boolean {
		return playerRadius > MASSIVE_RADIUS;
	}

	function playerSpeed(): number {
		const progress = clamp((playerRadius - START_RADIUS) / (MASSIVE_RADIUS - START_RADIUS), 0, 1);
		return BASE_SPEED - (BASE_SPEED - MIN_SPEED) * progress;
	}

	function playerBoxRadius(): { width: number; height: number } {
		const longSide = playerRadius * 2.18;
		const shortSide = playerRadius * 1.34;
		if (facing === 'up' || facing === 'down') return { width: shortSide, height: longSide };
		return { width: longSide, height: shortSide };
	}

	function playerCopies(): PlayerCopy[] {
		const { width, height } = playerBoxRadius();
		const margin = Math.max(width, height) + 2;
		const xOffsets = [0];
		const yOffsets = [0];
		if (player.x < margin) xOffsets.push(WORLD_W);
		if (player.x > WORLD_W - margin) xOffsets.push(-WORLD_W);
		if (player.y < margin) yOffsets.push(WORLD_H);
		if (player.y > WORLD_H - margin) yOffsets.push(-WORLD_H);

		const copies: PlayerCopy[] = [];
		for (const ox of xOffsets) {
			for (const oy of yOffsets) {
				copies.push({
					x: player.x + ox,
					y: player.y + oy,
					key: `${ox}:${oy}`,
					primary: ox === 0 && oy === 0
				});
			}
		}
		return copies;
	}

	function heldDirection(): Direction | null {
		if (padDirection) return padDirection;
		if (keys.has(DIRECTION_KEYS[facing])) return facing;
		const fallback = (Object.keys(DIRECTION_KEYS) as Direction[]).find((direction) =>
			keys.has(DIRECTION_KEYS[direction])
		);
		return fallback ?? null;
	}

	function wrap(value: number, max: number): number {
		if (value < 0) return value + max;
		if (value >= max) return value - max;
		return value;
	}

	function reset() {
		player = { x: WORLD_W / 2, y: WORLD_H / 2 };
		velocity = { x: 0, y: 0 };
		playerRadius = START_RADIUS;
		facing = 'right';
		padDirection = null;
		enemies = [];
		bursts = [];
		score = 0;
		eaten = 0;
		awarded = 0;
		elapsed = 0;
		lastSnack = null;
		spawnClock = 0.18;
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
		awarded = rewardFor(score, playerRadius, nextPhase === 'complete');
		if (awarded > 0) {
			book.insight += awarded;
			book.persist();
		}
	}

	function loop(now: number) {
		const dt = Math.min(0.034, Math.max(0, (now - lastTime) / 1000));
		lastTime = now;
		step(dt);
		if (phase === 'running') raf = requestAnimationFrame(loop);
	}

	function step(dt: number) {
		elapsed += dt;
		movePlayer(dt);
		updateSpawns(dt);
		updateEnemies(dt);
		updateBursts(dt);
	}

	function movePlayer(dt: number) {
		const direction = heldDirection();
		const speed = playerSpeed();
		let vx = velocity.x;
		let vy = velocity.y;

		if (direction) {
			const intent = DIRECTIONS[direction];
			facing = direction;
			const acceleration = speed * 5.4;
			vx += intent.x * acceleration * dt;
			vy += intent.y * acceleration * dt;
			const driftBrake = Math.pow(0.2, dt);
			if (intent.x !== 0) vy *= driftBrake;
			if (intent.y !== 0) vx *= driftBrake;
		}

		const friction = Math.pow(direction ? 0.5 : 0.07, dt);
		vx *= friction;
		vy *= friction;

		const currentSpeed = Math.hypot(vx, vy);
		if (currentSpeed > speed) {
			const scale = speed / currentSpeed;
			vx *= scale;
			vy *= scale;
		}

		velocity = { x: vx, y: vy };
		player = {
			x: wrap(player.x + vx * dt, WORLD_W),
			y: wrap(player.y + vy * dt, WORLD_H)
		};
	}

	function updateSpawns(dt: number) {
		spawnClock -= dt;
		if (spawnClock > 0) return;
		if (enemies.length < MAX_ENEMIES) enemies = [...enemies, spawnEnemy()];
		spawnClock = spawnDelay();
	}

	function spawnDelay(): number {
		const pressure = clamp(elapsed / 80, 0, 1);
		return 0.78 - pressure * 0.24 + Math.random() * 0.28;
	}

	function spawnEnemy(): Enemy {
		const spec = chooseBlobSpec();
		const side = Math.floor(Math.random() * 4);
		const wobble = 0.84 + Math.random() * 0.28;
		const speed = spec.speed * wobble;
		let x = Math.random() * WORLD_W;
		let y = Math.random() * WORLD_H;
		let vx = 0;
		let vy = 0;

		if (side === 0) {
			x = -EDGE_MARGIN;
			vx = speed;
		} else if (side === 1) {
			x = WORLD_W + EDGE_MARGIN;
			vx = -speed;
		} else if (side === 2) {
			y = -EDGE_MARGIN;
			vy = speed;
		} else {
			y = WORLD_H + EDGE_MARGIN;
			vy = -speed;
		}

		return {
			id: ++enemySeq,
			x,
			y,
			vx,
			vy,
			radius: spec.radius,
			points: spec.points,
			growth: spec.growth,
			tier: spec.tier,
			tone: spec.tone
		};
	}

	function chooseBlobSpec(): BlobSpec {
		const appetite = clamp((playerRadius - START_RADIUS) / (MASSIVE_RADIUS - START_RADIUS), 0, 1);
		const hasYellow = enemies.some((enemy) => enemy.tier === 'massive');
		const roll = Math.random();

		if (canEatYellow() && (!hasYellow || roll < 0.34)) return specFor('massive');
		if (roll < 0.045 + appetite * 0.08) return specFor('massive');
		if (roll < 0.24 + appetite * 0.22) return Math.random() < 0.62 ? specFor('mid-orange') : specFor('mid-red');
		if (roll < 0.62) return Math.random() < 0.5 ? specFor('small-violet') : specFor('small-blue');
		return Math.random() < 0.5 ? specFor('tiny-cyan') : specFor('tiny-green');
	}

	function specFor(key: string): BlobSpec {
		const index: Record<string, number> = {
			'tiny-cyan': 0,
			'tiny-green': 1,
			'small-violet': 2,
			'small-blue': 3,
			'mid-orange': 4,
			'mid-red': 5,
			massive: 6
		};
		return BLOB_SPECS[index[key] ?? 0];
	}

	function updateEnemies(dt: number) {
		const moved = enemies
			.map((enemy) => ({
				...enemy,
				x: enemy.x + enemy.vx * dt,
				y: enemy.y + enemy.vy * dt
			}))
			.filter(
				(enemy) =>
					enemy.x > -EDGE_MARGIN * 1.8 &&
					enemy.x < WORLD_W + EDGE_MARGIN * 1.8 &&
					enemy.y > -EDGE_MARGIN * 1.8 &&
					enemy.y < WORLD_H + EDGE_MARGIN * 1.8
			);

		const radiusAtImpact = playerRadius;
		const consumed: Enemy[] = [];
		let doomed = false;
		let lethal: Enemy | null = null;

		for (const enemy of moved) {
			if (!touchesPlayer(enemy)) continue;
			if (radiusAtImpact > enemy.radius) {
				consumed.push(enemy);
			} else {
				doomed = true;
				lethal = enemy;
				break;
			}
		}

		if (doomed) {
			if (lethal) addBurst(player.x, player.y, `${lethal.radius.toFixed(0)} > ${radiusAtImpact.toFixed(0)}`, 'ink');
			enemies = moved;
			finish('over');
			return;
		}

		if (consumed.length === 0) {
			enemies = moved;
			return;
		}

		const consumedIds = new Set(consumed.map((enemy) => enemy.id));
		const gained = consumed.reduce((total, enemy) => total + enemy.points, 0);
		const growth = consumed.reduce((total, enemy) => total + enemy.growth, 0);
		const won = consumed.some((enemy) => enemy.tier === 'massive');

		enemies = moved.filter((enemy) => !consumedIds.has(enemy.id));
		score += gained;
		eaten += consumed.length;
		playerRadius = Math.min(MAX_PLAYER_RADIUS, playerRadius + growth);
		lastSnack = consumed[consumed.length - 1]?.tone ?? null;
		for (const enemy of consumed) addBurst(enemy.x, enemy.y, `+${enemy.points}`, enemy.tone);

		if (won) finish('complete');
	}

	function touchesPlayer(enemy: Enemy): boolean {
		return playerCopies().some((copy) => circleTouchesPlayerBox(enemy, copy));
	}

	function circleTouchesPlayerBox(enemy: Enemy, center: Dot): boolean {
		const { width, height } = playerBoxRadius();
		const left = center.x - width / 2;
		const right = center.x + width / 2;
		const top = center.y - height / 2;
		const bottom = center.y + height / 2;
		const closest: Dot = {
			x: clamp(enemy.x, left, right),
			y: clamp(enemy.y, top, bottom)
		};
		return distance(enemy, closest) <= enemy.radius;
	}

	function updateBursts(dt: number) {
		bursts = bursts
			.map((burst) => ({ ...burst, y: burst.y - 22 * dt, life: burst.life - dt }))
			.filter((burst) => burst.life > 0);
	}

	function addBurst(x: number, y: number, text: string, tone: Burst['tone']) {
		bursts = [...bursts, { id: ++burstSeq, x, y, text, tone, life: 0.72 }];
	}

	function playerClass(copy: PlayerCopy): string {
		const snack = lastSnack ? ` snack-${lastSnack}` : '';
		const ghost = copy.primary ? '' : ' ghost';
		return `player-blob face-${facing}${snack}${ghost}`;
	}

	function enemyClass(enemy: Enemy): string {
		const danger = playerRadius > enemy.radius ? ' edible' : ' danger';
		return `enemy enemy-${enemy.tone}${danger}`;
	}

	function setPadDirection(direction: Direction | null) {
		if (phase !== 'running') start();
		padDirection = direction;
		if (!direction) return;
		facing = direction;
	}

	function onKeyDown(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		const direction = KEY_TO_DIRECTION[key];
		if (!direction) return;
		event.preventDefault();
		keys.add(key);
		if (phase !== 'running') start();
		facing = direction;
	}

	function onKeyUp(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		if (KEY_TO_DIRECTION[key]) event.preventDefault();
		keys.delete(key);
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

<div class="big-shell">
	<div class="big-bar">
		<div class="game-id">
			<span class="game-name">Get Big!</span>
			<span class="game-hint">{hintLabel}</span>
		</div>
		<div class="score-group">
			<div class="score-box">
				<span class="score-label">score</span>
				<span class="score-val">{score}</span>
			</div>
			<div class="score-box live">
				<span class="score-label">size</span>
				<span class="score-val">{sizeLabel}</span>
			</div>
			<div class="score-box">
				<span class="score-label">speed</span>
				<span class="score-val">{speedLabel}</span>
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

	<div class="grow-track" style={progressStyle} aria-label="jelly appetite">
		<span></span>
	</div>

	<svg
		class="field"
		class:active={phase === 'running'}
		viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
		role="img"
		aria-label="Get Big arena"
	>
		<defs>
			<pattern id="big-grid" width="34" height="34" patternUnits="userSpaceOnUse">
				<path d="M 34 0 L 0 0 0 34" fill="none" stroke="rgba(88, 110, 117, 0.12)" stroke-width="1" />
			</pattern>
			<filter id="jelly-wobble" x="-20%" y="-20%" width="140%" height="140%">
				<feGaussianBlur in="SourceAlpha" stdDeviation="0.65" result="blur" />
				<feOffset in="blur" dx="0" dy="1" result="shadow" />
				<feMerge>
					<feMergeNode in="shadow" />
					<feMergeNode in="SourceGraphic" />
				</feMerge>
			</filter>
		</defs>
		<rect class="field-bg" width={WORLD_W} height={WORLD_H} rx="6" />
		<rect width={WORLD_W} height={WORLD_H} fill="url(#big-grid)" opacity="0.58" />

		{#each enemies as enemy (enemy.id)}
			<circle class="enemy-shadow" cx={enemy.x} cy={enemy.y + enemy.radius * 0.34} r={enemy.radius * 0.92} />
			<circle class={enemyClass(enemy)} cx={enemy.x} cy={enemy.y} r={enemy.radius} />
			<circle class="enemy-shine" cx={enemy.x - enemy.radius * 0.32} cy={enemy.y - enemy.radius * 0.38} r={enemy.radius * 0.24} />
		{/each}

		{#each playerCopies() as copy (copy.key)}
			{@const box = playerBoxRadius()}
			<ellipse
				class="player-aura"
				cx={copy.x}
				cy={copy.y}
				rx={box.width / 2 + 5}
				ry={box.height / 2 + 5}
			/>
			<rect
				class={playerClass(copy)}
				x={copy.x - box.width / 2}
				y={copy.y - box.height / 2}
				width={box.width}
				height={box.height}
				rx={Math.min(box.width, box.height) / 2}
				filter="url(#jelly-wobble)"
			/>
			<ellipse
				class="player-shine"
				cx={copy.x - box.width * 0.18}
				cy={copy.y - box.height * 0.22}
				rx={box.width * 0.13}
				ry={box.height * 0.11}
			/>
		{/each}

		{#each bursts as burst (burst.id)}
			<text
				class={`burst burst-${burst.tone}`}
				x={burst.x}
				y={burst.y}
				text-anchor="middle"
				style={`--life:${burst.life.toFixed(3)}`}
			>
				{burst.text}
			</text>
		{/each}

		{#if phase === 'ready' || phase === 'complete' || phase === 'over'}
			<rect class="veil" width={WORLD_W} height={WORLD_H} rx="6" />
			<text class="center-title" x={WORLD_W / 2} y={WORLD_H / 2 - 14} text-anchor="middle">
				{outcomeLabel}
			</text>
			<text class="center-sub" x={WORLD_W / 2} y={WORLD_H / 2 + 20} text-anchor="middle">
				{phase === 'complete'
					? 'You ate all the jelly in jellyworld.'
					: phase === 'ready'
						? 'strictly larger or not at all'
						: `score ${score} · eaten ${eaten} · best ${best} · ${rounds} run${rounds === 1 ? '' : 's'}`}
			</text>
		{/if}
	</svg>

	<div class="pad-row" aria-label="direction controls">
		<button
			aria-label="move up"
			onpointerdown={() => setPadDirection('up')}
			onpointerup={() => setPadDirection(null)}
			onpointercancel={() => setPadDirection(null)}
			onpointerleave={() => setPadDirection(null)}
		>
			↑
		</button>
		<button
			aria-label="move left"
			onpointerdown={() => setPadDirection('left')}
			onpointerup={() => setPadDirection(null)}
			onpointercancel={() => setPadDirection(null)}
			onpointerleave={() => setPadDirection(null)}
		>
			←
		</button>
		<button
			aria-label="move right"
			onpointerdown={() => setPadDirection('right')}
			onpointerup={() => setPadDirection(null)}
			onpointercancel={() => setPadDirection(null)}
			onpointerleave={() => setPadDirection(null)}
		>
			→
		</button>
		<button
			aria-label="move down"
			onpointerdown={() => setPadDirection('down')}
			onpointerup={() => setPadDirection(null)}
			onpointercancel={() => setPadDirection(null)}
			onpointerleave={() => setPadDirection(null)}
		>
			↓
		</button>
	</div>
</div>

<style>
	.big-shell {
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}
	.big-bar {
		width: 100%;
		max-width: 560px;
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
		background: color-mix(in srgb, var(--sol-base2) 65%, var(--sol-green));
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
		width: min(560px, 100%);
		height: 0.45rem;
		border-radius: 999px;
		background: var(--sol-base2);
		overflow: hidden;
	}
	.grow-track span {
		display: block;
		width: calc(var(--left) * 100%);
		height: 100%;
		background: linear-gradient(90deg, var(--sol-cyan), var(--sol-green), var(--sol-yellow));
		transition: width 120ms linear;
	}
	.field {
		width: min(560px, calc(100vw - 3rem));
		aspect-ratio: 27 / 17;
		border: 1px solid var(--sol-base2);
		border-radius: 6px;
		background: var(--sol-base2);
		box-shadow:
			inset 0 0 0 6px rgba(7, 54, 66, 0.05),
			0 8px 24px rgba(7, 54, 66, 0.08);
		user-select: none;
	}
	.field.active {
		cursor: none;
	}
	.field-bg {
		fill: #fdf6e3;
	}
	.enemy-shadow {
		fill: rgba(7, 54, 66, 0.12);
	}
	.enemy {
		stroke: rgba(253, 246, 227, 0.9);
		stroke-width: 2.4;
	}
	.enemy.edible {
		stroke-width: 1.8;
	}
	.enemy.danger {
		stroke: rgba(7, 54, 66, 0.5);
	}
	.enemy-cyan {
		fill: var(--sol-cyan);
	}
	.enemy-green {
		fill: var(--sol-green);
	}
	.enemy-violet {
		fill: var(--sol-violet);
	}
	.enemy-blue {
		fill: var(--sol-blue);
	}
	.enemy-orange {
		fill: var(--sol-orange);
	}
	.enemy-red {
		fill: var(--sol-red);
	}
	.enemy-yellow {
		fill: var(--sol-yellow);
	}
	.enemy-shine,
	.player-shine {
		fill: rgba(253, 246, 227, 0.46);
		pointer-events: none;
	}
	.player-aura {
		fill: rgba(42, 161, 152, 0.13);
		stroke: rgba(42, 161, 152, 0.25);
		stroke-width: 1.4;
	}
	.player-blob {
		fill: var(--sol-cyan);
		stroke: var(--sol-base3);
		stroke-width: 3;
	}
	.player-blob.ghost {
		opacity: 0.55;
	}
	.player-blob.snack-green {
		fill: var(--sol-green);
	}
	.player-blob.snack-violet {
		fill: var(--sol-violet);
	}
	.player-blob.snack-blue {
		fill: var(--sol-blue);
	}
	.player-blob.snack-orange {
		fill: var(--sol-orange);
	}
	.player-blob.snack-red {
		fill: var(--sol-red);
	}
	.player-blob.snack-yellow {
		fill: var(--sol-yellow);
	}
	.burst {
		font-family: var(--font-counter);
		font-size: 17px;
		fill: var(--sol-base01);
		opacity: calc(0.2 + var(--life));
		pointer-events: none;
	}
	.burst-cyan {
		fill: var(--sol-cyan);
	}
	.burst-green {
		fill: var(--sol-green);
	}
	.burst-violet {
		fill: var(--sol-violet);
	}
	.burst-blue {
		fill: var(--sol-blue);
	}
	.burst-orange {
		fill: var(--sol-orange);
	}
	.burst-red {
		fill: var(--sol-red);
	}
	.burst-yellow {
		fill: var(--sol-yellow);
	}
	.burst-ink {
		fill: var(--sol-base01);
	}
	.veil {
		fill: rgba(253, 246, 227, 0.76);
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
		width: min(560px, 100%);
		display: grid;
		grid-template-columns: repeat(3, 3rem);
		grid-template-rows: repeat(2, 2.2rem);
		justify-content: center;
		gap: 0.35rem;
	}
	.pad-row button {
		background: var(--sol-base2);
		color: var(--sol-base0);
		font-size: 0.95rem;
		padding: 0;
		min-width: 0;
		touch-action: none;
	}
	.pad-row button:nth-child(1) {
		grid-column: 2;
		grid-row: 1;
	}
	.pad-row button:nth-child(2) {
		grid-column: 1;
		grid-row: 2;
	}
	.pad-row button:nth-child(3) {
		grid-column: 3;
		grid-row: 2;
	}
	.pad-row button:nth-child(4) {
		grid-column: 2;
		grid-row: 2;
	}
	.pad-row button:hover {
		background: var(--sol-cyan);
		color: var(--sol-base3);
	}
	@media (max-width: 560px) {
		.big-bar {
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
