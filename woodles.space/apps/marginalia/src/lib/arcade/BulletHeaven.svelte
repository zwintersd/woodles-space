<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ArcadeHud from './ArcadeHud.svelte';
	import ArcadePetPerks from './ArcadePetPerks.svelte';
	import ArcadeProgress from './ArcadeProgress.svelte';
	import SvgArena from './SvgArena.svelte';
	import { clamp, distance, normalize, starPath, type Dot } from './arcadeMath';
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

	interface Enemy extends Dot {
		id: number;
		size: number;
		speed: number;
	}

	interface Shot extends Dot {
		id: number;
		vx: number;
		vy: number;
	}

	interface Burst extends Dot {
		id: number;
		text: string;
		life: number;
	}

	const WORLD_W = 520;
	const WORLD_H = 340;
	const GAME_ID = 'bullet-dot';
	const PLAYER_R = 9;
	const ROUND_SECONDS = 45;
	const MAX_REWARD = 18;

	// A quiet, fixed backdrop of twinkling points. Purely decorative — never
	// touched by game state — so it costs nothing to keep off to the side of
	// where enemies actually spawn and travel.
	const STARFIELD: { x: number; y: number; r: number; delay: number }[] = [
		{ x: 36, y: 42, r: 1.4, delay: 0 },
		{ x: 92, y: 268, r: 1.1, delay: 0.6 },
		{ x: 168, y: 56, r: 1.6, delay: 1.2 },
		{ x: 244, y: 300, r: 1.2, delay: 1.8 },
		{ x: 318, y: 44, r: 1.3, delay: 0.3 },
		{ x: 388, y: 268, r: 1.5, delay: 2.1 },
		{ x: 462, y: 60, r: 1.2, delay: 0.9 },
		{ x: 492, y: 236, r: 1.4, delay: 1.5 },
		{ x: 60, y: 148, r: 1.1, delay: 2.4 },
		{ x: 432, y: 158, r: 1.3, delay: 0.5 }
	];

	// Enemies are colored embers in one of three warm tones. Kept as a small
	// stable spread rather than one flat hue so the swarm reads with a little
	// more life without losing the "this is an enemy" read at a glance.
	const EMBER_TONES = ['ember-a', 'ember-b', 'ember-c'] as const;

	let phase = $state<Phase>('ready');
	let player = $state<Dot>({ x: WORLD_W / 2, y: WORLD_H / 2 });
	let enemies = $state<Enemy[]>([]);
	let shots = $state<Shot[]>([]);
	let bursts = $state<Burst[]>([]);
	let health = $state(3);
	let kills = $state(0);
	let elapsed = $state(0);
	let awarded = $state(0);
	let rounds = $state(0);
	let best = $state(loadArcadeRecord(GAME_ID).bestScore);
	let shields = $state(0);
	let shieldsUsed = $state(0);
	let fieldEl = $state<SVGSVGElement>();
	let raf = 0;
	let lastTime = 0;
	let shotClock = 0;
	let spawnClock = 0;
	let hurtClock = $state(0);
	let enemySeq = 0;
	let shotSeq = 0;
	let burstSeq = 0;
	let pointerDown = false;
	let pointerGoal = $state<Dot | null>(null);

	const keys = new Set<string>();

	const remaining = $derived(Math.max(0, ROUND_SECONDS - elapsed));
	const timeProgress = $derived(Math.max(0, remaining / ROUND_SECONDS));
	const bodyTier = $derived(statTier(coreStatValue(activePet, 'body')));
	const mindTier = $derived(statTier(coreStatValue(activePet, 'mind')));
	const graceTier = $derived(statTier(coreStatValue(activePet, 'grace')));
	const heartTier = $derived(statTier(coreStatValue(activePet, 'heart')));
	const playerHitRadius = $derived(Math.max(6, PLAYER_R - graceTier));
	const moveSpeed = $derived(128 + bodyTier * 12);
	const startLabel = $derived(arcadeStartLabel(phase, rounds));
	const outcomeLabel = $derived.by(() => {
		if (phase === 'complete') return awarded > 0 ? `+${fmt(awarded)} insight` : 'clear';
		if (phase === 'over') return 'overrun';
		if (rounds > 0) return 'again?';
		return 'ready?';
	});
	const prizePreview = $derived(rewardFor(kills, elapsed, phase === 'complete'));
	const currentTarget = $derived.by(() => pickTarget());
	const statEffects = $derived<ArcadeStatEffects>({
		body: (_value, tier) => (tier > 0 ? `speed +${tier}` : 'standard speed'),
		mind: (_value, tier) => (tier > 0 ? 'lead targeting line' : 'nearest target'),
		grace: (_value, tier) => (tier > 0 ? `hitbox -${tier}` : 'standard hitbox'),
		heart: (_value, tier) => (tier > 0 ? `${tier} shield${tier === 1 ? '' : 's'}` : 'health only')
	});

	function rewardFor(defeated: number, seconds: number, cleared: boolean): number {
		const raw = Math.floor(defeated / 8) + Math.floor(seconds / 14) + (cleared ? 5 : 0);
		return previewReward(raw, MAX_REWARD);
	}

	function edgeSpawn(): Enemy {
		const side = Math.floor(Math.random() * 4);
		const margin = 24;
		let x = Math.random() * WORLD_W;
		let y = Math.random() * WORLD_H;
		if (side === 0) y = -margin;
		if (side === 1) x = WORLD_W + margin;
		if (side === 2) y = WORLD_H + margin;
		if (side === 3) x = -margin;
		return {
			id: ++enemySeq,
			x,
			y,
			size: 7 + Math.random() * 4,
			speed: 32 + Math.min(26, elapsed * 0.58) + Math.random() * 12
		};
	}

	function addBurst(x: number, y: number, text: string) {
		bursts = [...bursts, { id: ++burstSeq, x, y, text, life: 0.62 }];
	}

	function reset() {
		player = { x: WORLD_W / 2, y: WORLD_H / 2 };
		enemies = [];
		shots = [];
		bursts = [];
		health = 3;
		health += bodyTier;
		shields = heartTier;
		shieldsUsed = 0;
		kills = 0;
		elapsed = 0;
		awarded = 0;
		shotClock = 0;
		spawnClock = 0;
		hurtClock = 0;
		pointerGoal = null;
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
		const record = recordArcadeRun(GAME_ID, {
			score: kills,
			summary: {
				seconds: Math.round(elapsed),
				health,
				cleared: nextPhase === 'complete',
				shields: shieldsUsed,
				awarded: rewardFor(kills, elapsed, nextPhase === 'complete')
			}
		});
		best = record.bestScore;
		awarded = payReward(rewardFor(kills, elapsed, nextPhase === 'complete'), MAX_REWARD);
	}

	function loop(now: number) {
		const dt = Math.min(0.034, Math.max(0, (now - lastTime) / 1000));
		lastTime = now;
		step(dt);
		if (phase === 'running') raf = requestAnimationFrame(loop);
	}

	function step(dt: number) {
		elapsed = Math.min(ROUND_SECONDS, elapsed + dt);
		hurtClock = Math.max(0, hurtClock - dt);
		movePlayer(dt);
		spawnClock -= dt;
		shotClock -= dt;

		if (spawnClock <= 0) {
			enemies = [...enemies, edgeSpawn()];
			spawnClock = Math.max(0.28, 1.05 - elapsed / 72);
		}

		if (shotClock <= 0) {
			fireAtNearest();
			shotClock = Math.max(0.18, 0.44 - elapsed / 280);
		}

		updateShots(dt);
		updateEnemies(dt);
		updateBursts(dt);

		if (elapsed >= ROUND_SECONDS) finish('complete');
	}

	function movePlayer(dt: number) {
		let dx = 0;
		let dy = 0;
		if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
		if (keys.has('arrowright') || keys.has('d')) dx += 1;
		if (keys.has('arrowup') || keys.has('w')) dy -= 1;
		if (keys.has('arrowdown') || keys.has('s')) dy += 1;

		if (dx === 0 && dy === 0 && pointerGoal) {
			dx = pointerGoal.x - player.x;
			dy = pointerGoal.y - player.y;
			if (Math.hypot(dx, dy) < 5) {
				dx = 0;
				dy = 0;
			}
		}

		if (dx === 0 && dy === 0) return;
		const dir = normalize(dx, dy);
		player = {
			x: clamp(player.x + dir.x * moveSpeed * dt, PLAYER_R, WORLD_W - PLAYER_R),
			y: clamp(player.y + dir.y * moveSpeed * dt, PLAYER_R, WORLD_H - PLAYER_R)
		};
	}

	function fireAtNearest() {
		const target = pickTarget();
		if (!target) return;
		const targetPoint = predictedTarget(target);
		const dir = normalize(targetPoint.x - player.x, targetPoint.y - player.y);
		const speed = 235;
		shots = [
			...shots,
			{
				id: ++shotSeq,
				x: player.x + dir.x * 12,
				y: player.y + dir.y * 12,
				vx: dir.x * speed,
				vy: dir.y * speed
			}
		];
	}

	function pickTarget(): Enemy | null {
		if (enemies.length === 0) return null;
		let target = enemies[0];
		let bestScore = targetScore(target);
		for (const enemy of enemies) {
			const nextScore = targetScore(enemy);
			if (nextScore < bestScore) {
				target = enemy;
				bestScore = nextScore;
			}
		}
		return target;
	}

	function targetScore(enemy: Enemy): number {
		const closeness = distance(player, enemy);
		return closeness - mindTier * enemy.speed * 0.25;
	}

	function predictedTarget(enemy: Enemy): Dot {
		if (mindTier === 0) return enemy;
		const leadSeconds = 0.08 + mindTier * 0.05;
		const chase = normalize(player.x - enemy.x, player.y - enemy.y);
		return {
			x: enemy.x + chase.x * enemy.speed * leadSeconds,
			y: enemy.y + chase.y * enemy.speed * leadSeconds
		};
	}

	function enemyHeadingDeg(enemy: Enemy): number {
		const dir = normalize(player.x - enemy.x, player.y - enemy.y);
		return (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
	}

	function updateShots(dt: number) {
		shots = shots
			.map((shot) => ({ ...shot, x: shot.x + shot.vx * dt, y: shot.y + shot.vy * dt }))
			.filter((shot) => shot.x > -20 && shot.x < WORLD_W + 20 && shot.y > -20 && shot.y < WORLD_H + 20);
	}

	function updateEnemies(dt: number) {
		const liveEnemies: Enemy[] = [];
		const liveShots = [...shots];
		let defeated = 0;
		let tookHit = false;
		let blockedHit = false;

		for (const enemy of enemies) {
			const dir = normalize(player.x - enemy.x, player.y - enemy.y);
			const next = {
				...enemy,
				x: enemy.x + dir.x * enemy.speed * dt,
				y: enemy.y + dir.y * enemy.speed * dt
			};
			const shotIndex = liveShots.findIndex((shot) => distance(shot, next) < next.size + 4);
			if (shotIndex >= 0) {
				liveShots.splice(shotIndex, 1);
				defeated += 1;
				addBurst(next.x, next.y, '+1');
				continue;
			}
			if (distance(next, player) < next.size + playerHitRadius && hurtClock <= 0) {
				tookHit = true;
				hurtClock = 1 + heartTier * 0.22;
				if (shields > 0) {
					shields -= 1;
					shieldsUsed += 1;
					blockedHit = true;
					addBurst(player.x, player.y, 'shield');
				} else {
					addBurst(player.x, player.y, '-heart');
				}
				continue;
			}
			liveEnemies.push(next);
		}

		if (defeated > 0) kills += defeated;
		if (tookHit) {
			if (!blockedHit) health -= 1;
			if (health <= 0) finish('over');
		}
		enemies = liveEnemies;
		shots = liveShots;
	}

	function updateBursts(dt: number) {
		bursts = bursts
			.map((burst) => ({ ...burst, y: burst.y - 20 * dt, life: burst.life - dt }))
			.filter((burst) => burst.life > 0);
	}

	function pointerToWorld(event: PointerEvent): Dot {
		const rect = fieldEl?.getBoundingClientRect();
		if (!rect) return { x: player.x, y: player.y };
		return {
			x: clamp(((event.clientX - rect.left) / rect.width) * WORLD_W, 0, WORLD_W),
			y: clamp(((event.clientY - rect.top) / rect.height) * WORLD_H, 0, WORLD_H)
		};
	}

	function setPointerGoal(event: PointerEvent) {
		if (phase !== 'running') return;
		pointerGoal = pointerToWorld(event);
	}

	function onPointerDown(event: PointerEvent) {
		pointerDown = true;
		fieldEl?.setPointerCapture(event.pointerId);
		setPointerGoal(event);
	}

	function onPointerMove(event: PointerEvent) {
		if (pointerDown) setPointerGoal(event);
	}

	function onPointerUp(event: PointerEvent) {
		pointerDown = false;
		if (fieldEl?.hasPointerCapture(event.pointerId)) fieldEl.releasePointerCapture(event.pointerId);
	}

	function onKeyDown(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(key)) {
			event.preventDefault();
			keys.add(key);
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

<div class="heaven-shell">
	<ArcadeHud
		title="Bullet Dot"
		hint="a small star wards off drifting sparks"
		scores={[
			{ label: 'time', value: Math.ceil(remaining) },
			{ label: 'hearts', value: health, live: true, tone: 'red' },
			{ label: 'shield', value: shields, live: shields > 0, tone: 'green' },
			{ label: 'score', value: kills },
			{ label: 'best', value: Math.max(kills, best) },
			{ label: 'prize', value: fmt(phase === 'complete' || phase === 'over' ? awarded : prizePreview) }
		]}
		{startLabel}
		onstart={start}
		onclose={onclose}
	/>

	<ArcadeProgress value={timeProgress} label="time remaining" />

	<div class="perks-wrap">
		<ArcadePetPerks creature={activePet} effects={statEffects} />
	</div>

	<SvgArena
		bind:element={fieldEl}
		width={WORLD_W}
		height={WORLD_H}
		ariaLabel="Bullet Dot arena"
		active={phase === 'running'}
		gridId="heaven-grid"
		gridOpacity={0.62}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
	>
		<defs>
			<radialGradient id="heaven-star-glow" cx="50%" cy="50%" r="50%">
				<stop offset="0%" class="glow-stop-star-a" />
				<stop offset="100%" class="glow-stop-star-b" />
			</radialGradient>
			<radialGradient id="heaven-ember-glow" cx="50%" cy="50%" r="50%">
				<stop offset="0%" class="glow-stop-ember-a" />
				<stop offset="100%" class="glow-stop-ember-b" />
			</radialGradient>
		</defs>

		{#each STARFIELD as star, index (index)}
			<circle
				class="bg-star"
				cx={star.x}
				cy={star.y}
				r={star.r}
				style={`animation-delay:-${star.delay}s`}
			/>
		{/each}

		<rect class="hit-flash" class:active={hurtClock > 0} width={WORLD_W} height={WORLD_H} rx="6" />
		{#if phase === 'running' && pointerGoal}
			<circle class="pointer-goal" cx={pointerGoal.x} cy={pointerGoal.y} r="11" />
		{/if}
		{#if phase === 'running' && currentTarget && mindTier > 0}
			{@const targetPoint = predictedTarget(currentTarget)}
			<line class="target-line" x1={player.x} y1={player.y} x2={targetPoint.x} y2={targetPoint.y} />
			<circle class="target-mark" cx={targetPoint.x} cy={targetPoint.y} r="7" />
		{/if}

		{#if phase === 'ready' || phase === 'complete' || phase === 'over'}
			<text class="center-title" x={WORLD_W / 2} y={WORLD_H / 2 - 10} text-anchor="middle">
				{outcomeLabel}
			</text>
			<text class="center-sub" x={WORLD_W / 2} y={WORLD_H / 2 + 22} text-anchor="middle">
				{phase === 'ready'
					? 'one small star, one shower of sparks, one button'
					: `score ${kills} · best ${best} · ${rounds} run${rounds === 1 ? '' : 's'}`}
			</text>
		{/if}

		{#each shots as shot (shot.id)}
			<path
				class="shot"
				d={starPath(4, 5, 1.6)}
				transform={`translate(${shot.x} ${shot.y}) rotate(${(Math.atan2(shot.vy, shot.vx) * 180) / Math.PI})`}
			/>
		{/each}
		{#each enemies as enemy (enemy.id)}
			{@const heading = enemyHeadingDeg(enemy)}
			<g
				class={`ember ${EMBER_TONES[enemy.id % EMBER_TONES.length]}`}
				transform={`translate(${enemy.x} ${enemy.y}) rotate(${heading})`}
			>
				<path
					class="ember-tail"
					d={`M ${-enemy.size * 2.6} 0 Q ${-enemy.size * 1.2} ${enemy.size * 0.55} 0 0 Q ${-enemy.size * 1.2} ${-enemy.size * 0.55} ${-enemy.size * 2.6} 0 Z`}
				/>
				<circle class="ember-glow" r={enemy.size * 2.1} />
				<circle class="ember-core" r={enemy.size * 0.6} />
			</g>
		{/each}
		{#each bursts as burst (burst.id)}
			<text class="burst" x={burst.x} y={burst.y} text-anchor="middle">{burst.text}</text>
		{/each}
		{#if phase === 'running'}
			<g class="wandering-star" class:hurt={hurtClock > 0} transform={`translate(${player.x} ${player.y})`}>
				<circle class="star-halo" r={hurtClock > 0 ? 25 : 19} />
				<path class="star-body" d={starPath(5, playerHitRadius * 1.6, playerHitRadius * 0.64)} />
				<circle class="star-core" r={playerHitRadius * 0.4} />
			</g>
		{/if}
	</SvgArena>

	<p class="heaven-note">
		Survive {ROUND_SECONDS} seconds. The dot fires on its own, because sometimes mercy is automation.
	</p>
</div>

<style>
	.heaven-shell {
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}
	.hit-flash {
		fill: var(--sol-red);
		opacity: 0;
		pointer-events: none;
	}
	.hit-flash.active {
		opacity: 0.2;
	}
	.perks-wrap {
		width: min(540px, 100%);
	}
	.pointer-goal {
		fill: none;
		stroke: rgba(38, 139, 210, 0.5);
		stroke-width: 1.5;
		stroke-dasharray: 3 3;
	}
	.target-line {
		stroke: rgba(108, 113, 196, 0.52);
		stroke-width: 1.6;
		stroke-dasharray: 5 5;
		pointer-events: none;
	}
	.target-mark {
		fill: none;
		stroke: rgba(108, 113, 196, 0.72);
		stroke-width: 2;
		pointer-events: none;
	}
	.glow-stop-star-a {
		stop-color: var(--sol-blue);
		stop-opacity: 0.5;
	}
	.glow-stop-star-b {
		stop-color: var(--sol-blue);
		stop-opacity: 0;
	}
	.glow-stop-ember-a {
		stop-color: var(--sol-orange);
		stop-opacity: 0.55;
	}
	.glow-stop-ember-b {
		stop-color: var(--sol-orange);
		stop-opacity: 0;
	}
	.bg-star {
		fill: var(--sol-yellow);
		opacity: 0.4;
		animation: bg-twinkle 4.6s ease-in-out infinite;
		pointer-events: none;
	}
	.ember {
		pointer-events: none;
	}
	.ember-tail {
		fill: var(--sol-orange);
		opacity: 0.45;
	}
	.ember.ember-b .ember-tail,
	.ember.ember-b .ember-core {
		fill: var(--sol-red);
	}
	.ember.ember-c .ember-tail,
	.ember.ember-c .ember-core {
		fill: var(--sol-yellow);
	}
	.ember-glow {
		fill: url(#heaven-ember-glow);
	}
	.ember-core {
		fill: var(--sol-orange);
		stroke: rgba(253, 246, 227, 0.85);
		stroke-width: 1.2;
	}
	.shot {
		fill: var(--sol-cyan);
		stroke: var(--sol-base3);
		stroke-width: 1;
		pointer-events: none;
	}
	.wandering-star {
		pointer-events: none;
	}
	.star-halo {
		fill: url(#heaven-star-glow);
	}
	.wandering-star.hurt .star-halo {
		fill: rgba(220, 50, 47, 0.32);
	}
	.star-body {
		fill: var(--sol-blue);
		stroke: var(--sol-base3);
		stroke-width: 2;
		animation: star-spin 22s linear infinite;
		transform-origin: 0 0;
	}
	.star-core {
		fill: rgba(253, 246, 227, 0.92);
		animation: star-twinkle 2.3s ease-in-out infinite;
		transform-origin: 0 0;
	}
	@keyframes bg-twinkle {
		0%,
		100% {
			opacity: 0.18;
		}
		50% {
			opacity: 0.55;
		}
	}
	@keyframes star-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes star-twinkle {
		0%,
		100% {
			opacity: 0.6;
			transform: scale(0.86);
		}
		50% {
			opacity: 1;
			transform: scale(1.18);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bg-star,
		.star-body,
		.star-core {
			animation: none;
		}
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
	.burst {
		font-family: var(--font-counter);
		font-size: 17px;
		fill: var(--sol-yellow);
		pointer-events: none;
	}
	.heaven-note {
		max-width: 540px;
		margin: 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.8rem;
		color: var(--sol-base1);
		text-align: center;
	}
	@media (max-width: 560px) {
		.center-title {
			font-size: 34px;
		}
	}
</style>
