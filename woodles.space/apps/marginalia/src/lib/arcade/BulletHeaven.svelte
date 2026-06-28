<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { cappedReward, clamp, distance, normalize, type Dot } from './arcadeMath';
	import { book, fmt } from '$lib/witch/book.svelte';

	interface Props {
		onclose: () => void;
	}
	let { onclose }: Props = $props();

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
	const PLAYER_R = 9;
	const ROUND_SECONDS = 45;
	const MAX_REWARD = 18;

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
	let best = $state(0);
	let fieldEl: SVGSVGElement;
	let raf = 0;
	let lastTime = 0;
	let shotClock = 0;
	let spawnClock = 0;
	let hurtClock = $state(0);
	let enemySeq = 0;
	let shotSeq = 0;
	let burstSeq = 0;
	let pointerDown = false;
	let pointerGoal: Dot | null = null;

	const keys = new Set<string>();

	const remaining = $derived(Math.max(0, ROUND_SECONDS - elapsed));
	const progressStyle = $derived(`--left:${Math.max(0, remaining / ROUND_SECONDS).toFixed(4)}`);
	const startLabel = $derived(phase === 'running' ? 'restart' : rounds > 0 ? 'again' : 'start');
	const outcomeLabel = $derived.by(() => {
		if (phase === 'complete') return awarded > 0 ? `+${fmt(awarded)} insight` : 'clear';
		if (phase === 'over') return 'overrun';
		if (rounds > 0) return 'again?';
		return 'ready?';
	});
	const prizePreview = $derived(rewardFor(kills, elapsed, phase === 'complete'));

	function rewardFor(defeated: number, seconds: number, cleared: boolean): number {
		const raw = Math.floor(defeated / 8) + Math.floor(seconds / 14) + (cleared ? 5 : 0);
		return cappedReward(raw, MAX_REWARD);
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
		best = Math.max(best, kills);
		awarded = rewardFor(kills, elapsed, nextPhase === 'complete');
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
		const speed = 128;
		player = {
			x: clamp(player.x + dir.x * speed * dt, PLAYER_R, WORLD_W - PLAYER_R),
			y: clamp(player.y + dir.y * speed * dt, PLAYER_R, WORLD_H - PLAYER_R)
		};
	}

	function fireAtNearest() {
		if (enemies.length === 0) return;
		let target = enemies[0];
		let bestDistance = distance(player, target);
		for (const enemy of enemies) {
			const nextDistance = distance(player, enemy);
			if (nextDistance < bestDistance) {
				target = enemy;
				bestDistance = nextDistance;
			}
		}
		const dir = normalize(target.x - player.x, target.y - player.y);
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
			if (distance(next, player) < next.size + PLAYER_R && hurtClock <= 0) {
				tookHit = true;
				hurtClock = 1;
				addBurst(player.x, player.y, '-heart');
				continue;
			}
			liveEnemies.push(next);
		}

		if (defeated > 0) kills += defeated;
		if (tookHit) {
			health -= 1;
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
		const rect = fieldEl.getBoundingClientRect();
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
		fieldEl.setPointerCapture(event.pointerId);
		setPointerGoal(event);
	}

	function onPointerMove(event: PointerEvent) {
		if (pointerDown) setPointerGoal(event);
	}

	function onPointerUp(event: PointerEvent) {
		pointerDown = false;
		fieldEl.releasePointerCapture(event.pointerId);
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
	<div class="heaven-bar">
		<div class="game-id">
			<span class="game-name">Bullet Dot</span>
			<span class="game-hint">small arena survival</span>
		</div>
		<div class="score-group">
			<div class="score-box">
				<span class="score-label">time</span>
				<span class="score-val">{Math.ceil(remaining)}</span>
			</div>
			<div class="score-box live">
				<span class="score-label">hearts</span>
				<span class="score-val">{health}</span>
			</div>
			<div class="score-box">
				<span class="score-label">score</span>
				<span class="score-val">{kills}</span>
			</div>
			<div class="score-box">
				<span class="score-label">prize</span>
				<span class="score-val">{fmt(phase === 'complete' || phase === 'over' ? awarded : prizePreview)}</span>
			</div>
		</div>
		<div class="btn-group">
			<button class="ctrl-btn" onclick={start}>{startLabel}</button>
			<button class="ctrl-btn back" onclick={onclose}>arcade</button>
		</div>
	</div>

	<div class="time-track" style={progressStyle} aria-label="time remaining">
		<span></span>
	</div>

	<svg
		bind:this={fieldEl}
		class="field"
		class:active={phase === 'running'}
		class:hit={hurtClock > 0}
		viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
		role="img"
		aria-label="Bullet Dot arena"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
	>
		<defs>
			<pattern id="heaven-grid" width="32" height="32" patternUnits="userSpaceOnUse">
				<path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(88, 110, 117, 0.12)" stroke-width="1" />
			</pattern>
		</defs>
		<rect class="field-bg" width={WORLD_W} height={WORLD_H} rx="6" />
		<rect width={WORLD_W} height={WORLD_H} fill="url(#heaven-grid)" opacity="0.62" />

		{#if phase === 'ready' || phase === 'complete' || phase === 'over'}
			<text class="center-title" x={WORLD_W / 2} y={WORLD_H / 2 - 10} text-anchor="middle">
				{outcomeLabel}
			</text>
			<text class="center-sub" x={WORLD_W / 2} y={WORLD_H / 2 + 22} text-anchor="middle">
				{phase === 'ready'
					? 'one dot, one swarm, one button'
					: `score ${kills} · best ${best} · ${rounds} run${rounds === 1 ? '' : 's'}`}
			</text>
		{/if}

		{#each shots as shot (shot.id)}
			<circle class="shot" cx={shot.x} cy={shot.y} r="3.5" />
		{/each}
		{#each enemies as enemy (enemy.id)}
			<circle class="enemy" cx={enemy.x} cy={enemy.y} r={enemy.size} />
		{/each}
		{#each bursts as burst (burst.id)}
			<text class="burst" x={burst.x} y={burst.y} text-anchor="middle">{burst.text}</text>
		{/each}
		{#if phase === 'running'}
			<circle class="player-aura" cx={player.x} cy={player.y} r={hurtClock > 0 ? 23 : 18} />
			<circle class="player" cx={player.x} cy={player.y} r={PLAYER_R} />
		{/if}
	</svg>

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
	.heaven-bar {
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
		background: color-mix(in srgb, var(--sol-base2) 70%, var(--sol-red));
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
	.ctrl-btn {
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
	.time-track {
		width: min(540px, 100%);
		height: 0.45rem;
		border-radius: 999px;
		background: var(--sol-base2);
		overflow: hidden;
	}
	.time-track span {
		display: block;
		width: calc(var(--left) * 100%);
		height: 100%;
		background: linear-gradient(90deg, var(--sol-green), var(--sol-cyan), var(--sol-blue));
		transition: width 100ms linear;
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
		cursor: crosshair;
	}
	.field-bg {
		fill: #fdf6e3;
	}
	.field.hit .field-bg {
		fill: color-mix(in srgb, #fdf6e3 80%, var(--sol-red));
	}
	.enemy {
		fill: var(--sol-orange);
		stroke: rgba(253, 246, 227, 0.8);
		stroke-width: 1.5;
	}
	.shot {
		fill: var(--sol-cyan);
		stroke: var(--sol-base3);
		stroke-width: 1.5;
	}
	.player-aura {
		fill: rgba(38, 139, 210, 0.14);
		stroke: rgba(38, 139, 210, 0.42);
		stroke-width: 1.5;
	}
	.player {
		fill: var(--sol-blue);
		stroke: var(--sol-base3);
		stroke-width: 3;
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
		.heaven-bar {
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
