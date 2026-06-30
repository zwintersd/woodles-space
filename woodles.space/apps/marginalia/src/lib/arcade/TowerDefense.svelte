<script lang="ts">
	import { onDestroy } from 'svelte';
	import ArcadeHud from './ArcadeHud.svelte';
	import ArcadePetPerks from './ArcadePetPerks.svelte';
	import ArcadeProgress from './ArcadeProgress.svelte';
	import SvgArena from './SvgArena.svelte';
	import { clamp, distance, normalize, type Dot } from './arcadeMath';
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

	type Phase = 'ready' | 'running' | 'building' | 'complete' | 'over';

	interface Pad extends Dot {
		id: string;
	}

	interface Tower extends Dot {
		id: number;
		padId: string;
		level: number;
		cooldown: number;
	}

	interface Enemy extends Dot {
		id: number;
		pathIndex: number;
		hp: number;
		maxHp: number;
		speed: number;
		size: number;
	}

	interface Shot extends Dot {
		id: number;
		vx: number;
		vy: number;
		damage: number;
	}

	interface Burst extends Dot {
		id: number;
		text: string;
		life: number;
	}

	const WORLD_W = 520;
	const WORLD_H = 340;
	const WAVE_COUNT = 5;
	const STARTING_COINS = 12;
	const STARTING_LIVES = 8;
	const TOWER_COST = 4;
	const UPGRADE_COST = 5;
	const MAX_REWARD = 20;
	const BUILD_TIME = 3.2;
	const GAME_ID = 'margin-defense';

	const PATH: Dot[] = [
		{ x: 18, y: 74 },
		{ x: 154, y: 74 },
		{ x: 154, y: 244 },
		{ x: 352, y: 244 },
		{ x: 352, y: 126 },
		{ x: 502, y: 126 }
	];

	const PADS: Pad[] = [
		{ id: 'a', x: 84, y: 38 },
		{ id: 'b', x: 226, y: 92 },
		{ id: 'c', x: 86, y: 166 },
		{ id: 'd', x: 226, y: 208 },
		{ id: 'e', x: 305, y: 294 },
		{ id: 'f', x: 420, y: 82 },
		{ id: 'g', x: 432, y: 178 },
		{ id: 'h', x: 260, y: 34 }
	];

	let phase = $state<Phase>('ready');
	let towers = $state<Tower[]>([]);
	let enemies = $state<Enemy[]>([]);
	let shots = $state<Shot[]>([]);
	let bursts = $state<Burst[]>([]);
	let coins = $state(STARTING_COINS);
	let lives = $state(STARTING_LIVES);
	let wave = $state(1);
	let pendingWave = $state(2);
	let buildClock = $state(0);
	let spawnRemaining = $state(0);
	let spawnedThisWave = $state(0);
	let kills = $state(0);
	let leakRefund = $state(0);
	let awarded = $state(0);
	let rounds = $state(0);
	let best = $state(loadArcadeRecord(GAME_ID).bestScore);
	let raf = 0;
	let lastTime = 0;
	let spawnClock = 0;
	let towerSeq = 0;
	let enemySeq = 0;
	let shotSeq = 0;
	let burstSeq = 0;

	const pathPoints = PATH.map((point) => `${point.x},${point.y}`).join(' ');
	const waveSize = $derived(4 + wave * 3);
	const waveDone = $derived(Math.max(0, waveSize - spawnRemaining));
	const waveProgress = $derived(
		phase === 'complete'
			? 1
			: Math.min(1, (wave - 1 + waveDone / Math.max(1, waveSize)) / WAVE_COUNT)
	);
	const bodyTier = $derived(statTier(coreStatValue(activePet, 'body')));
	const mindTier = $derived(statTier(coreStatValue(activePet, 'mind')));
	const graceTier = $derived(statTier(coreStatValue(activePet, 'grace')));
	const heartTier = $derived(statTier(coreStatValue(activePet, 'heart')));
	// Body banks extra lives, grace widens tower range, heart refunds coins on a
	// leak, and mind reveals the next wave's size/strength during the build gap.
	const startingLives = $derived(STARTING_LIVES + bodyTier);
	const statEffects = $derived<ArcadeStatEffects>({
		body: (_value, tier) => (tier > 0 ? `+${tier} lives` : 'standard lives'),
		mind: (_value, tier) => (tier > 0 ? 'next-wave preview' : 'surprise waves'),
		grace: (_value, tier) => (tier > 0 ? `range +${tier * 10}` : 'standard range'),
		heart: (_value, tier) => (tier > 0 ? `leak refund +${tier}` : 'no leak refund')
	});
	const startLabel = $derived(phase === 'building' ? 'restart' : arcadeStartLabel(phase, rounds));
	const rewardPreview = $derived(rewardFor(kills, wave, phase === 'complete'));
	const outcomeLabel = $derived.by(() => {
		if (phase === 'complete') return awarded > 0 ? `+${fmt(awarded)} insight` : 'held';
		if (phase === 'over') return 'breached';
		if (rounds > 0) return 'again?';
		return 'ready?';
	});
	const nextWavePreview = $derived.by(() => {
		if (phase !== 'building') return null;
		const count = 4 + pendingWave * 3;
		if (mindTier <= 0) return `wave ${pendingWave} incoming`;
		const hp = 1 + Math.floor(pendingWave / 2);
		return mindTier >= 2
			? `wave ${pendingWave}: ${count} marks, ${hp} hp each`
			: `wave ${pendingWave}: ${count} marks`;
	});
	const hudHint = $derived(
		phase === 'building' ? `${nextWavePreview} · ${buildClock.toFixed(1)}s` : 'click sigils, hold the path'
	);
	const buildHint = $derived.by(() => {
		if (phase === 'complete') return 'the route is held';
		if (phase === 'over') return 'the route broke';
		if (phase === 'building') return 'build or upgrade before the next wave';
		if (coins < TOWER_COST) return 'earn coins from defeated marks';
		return `place ${TOWER_COST} coin towers on open sigils`;
	});

	function rewardFor(defeated: number, reachedWave: number, cleared: boolean): number {
		const raw = Math.floor(defeated / 5) + reachedWave + (cleared ? 6 : 0);
		return previewReward(raw, MAX_REWARD);
	}

	function resetMap() {
		stop();
		phase = 'ready';
		towers = [];
		enemies = [];
		shots = [];
		bursts = [];
		coins = STARTING_COINS;
		lives = startingLives;
		wave = 1;
		pendingWave = 2;
		buildClock = 0;
		spawnRemaining = 0;
		spawnedThisWave = 0;
		kills = 0;
		leakRefund = 0;
		awarded = 0;
		spawnClock = 0;
	}

	function start() {
		resetMap();
		phase = 'running';
		startWave(1);
		lastTime = performance.now();
		raf = requestAnimationFrame(loop);
	}

	function stop() {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}

	function startWave(nextWave: number) {
		wave = nextWave;
		spawnRemaining = 4 + nextWave * 3;
		spawnedThisWave = 0;
		spawnClock = 0.15;
	}

	function finish(nextPhase: 'complete' | 'over') {
		if (phase !== 'running') return;
		phase = nextPhase;
		stop();
		rounds += 1;
		awarded = payReward(rewardFor(kills, wave, nextPhase === 'complete'), MAX_REWARD);
		const record = recordArcadeRun(GAME_ID, {
			score: kills,
			summary: {
				wave,
				cleared: nextPhase === 'complete',
				coins,
				livesLeft: lives,
				leakRefund,
				awarded
			}
		});
		best = record.bestScore;
	}

	function enterBuild(nextWave: number) {
		phase = 'building';
		pendingWave = nextWave;
		buildClock = BUILD_TIME;
	}

	function sendWaveNow() {
		if (phase === 'building') buildClock = 0;
	}

	function loop(now: number) {
		const dt = Math.min(0.034, Math.max(0, (now - lastTime) / 1000));
		lastTime = now;
		step(dt);
		if (phase === 'running' || phase === 'building') raf = requestAnimationFrame(loop);
	}

	function step(dt: number) {
		if (phase === 'building') {
			updateBursts(dt);
			buildClock = Math.max(0, buildClock - dt);
			if (buildClock <= 0) {
				phase = 'running';
				startWave(pendingWave);
			}
			return;
		}

		spawnClock -= dt;
		if (spawnRemaining > 0 && spawnClock <= 0) {
			spawnEnemy();
			spawnRemaining -= 1;
			spawnedThisWave += 1;
			spawnClock = Math.max(0.34, 0.9 - wave * 0.07);
		}

		updateTowers(dt);
		updateShots(dt);
		updateEnemies(dt);
		updateBursts(dt);

		if (phase !== 'running') return;
		if (spawnRemaining === 0 && enemies.length === 0) {
			if (wave >= WAVE_COUNT) {
				finish('complete');
			} else {
				coins += 3;
				addBurst(WORLD_W / 2, 38, '+wave');
				enterBuild(wave + 1);
			}
		}
	}

	function spawnEnemy() {
		const hp = 1 + Math.floor(wave / 2);
		const start = PATH[0];
		enemies = [
			...enemies,
			{
				id: ++enemySeq,
				x: start.x,
				y: start.y,
				pathIndex: 1,
				hp,
				maxHp: hp,
				speed: 34 + wave * 5,
				size: 8 + Math.min(4, wave)
			}
		];
	}

	function addBurst(x: number, y: number, text: string) {
		bursts = [...bursts, { id: ++burstSeq, x, y, text, life: 0.72 }];
	}

	function towerRange(tower: Tower): number {
		return 86 + tower.level * 12 + graceTier * 10;
	}

	function towerDamage(tower: Tower): number {
		return tower.level >= 3 ? 2 : 1;
	}

	function towerCooldown(tower: Tower): number {
		return Math.max(0.34, 0.8 - tower.level * 0.12);
	}

	function towerForPad(padId: string): Tower | undefined {
		return towers.find((tower) => tower.padId === padId);
	}

	function padLabel(pad: Pad): string {
		const tower = towerForPad(pad.id);
		if (!tower) return coins >= TOWER_COST ? `Build tower on pad ${pad.id}` : `Pad ${pad.id}, need coins`;
		if (tower.level >= 3) return `Tower ${pad.id} is fully inked`;
		return coins >= UPGRADE_COST ? `Upgrade tower ${pad.id}` : `Tower ${pad.id}, need coins`;
	}

	function usePad(pad: Pad) {
		if (phase === 'complete' || phase === 'over') return;
		const tower = towerForPad(pad.id);
		if (!tower) {
			if (coins < TOWER_COST) {
				addBurst(pad.x, pad.y - 16, 'coins');
				return;
			}
			coins -= TOWER_COST;
			towers = [...towers, { id: ++towerSeq, padId: pad.id, x: pad.x, y: pad.y, level: 1, cooldown: 0 }];
			addBurst(pad.x, pad.y - 18, 'built');
			return;
		}
		if (tower.level >= 3) return;
		if (coins < UPGRADE_COST) {
			addBurst(pad.x, pad.y - 16, 'coins');
			return;
		}
		coins -= UPGRADE_COST;
		towers = towers.map((item) =>
			item.id === tower.id ? { ...item, level: item.level + 1, cooldown: 0 } : item
		);
		addBurst(pad.x, pad.y - 18, '+range');
	}

	function onPadKey(event: KeyboardEvent, pad: Pad) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			usePad(pad);
		}
	}

	function updateTowers(dt: number) {
		if (towers.length === 0 || enemies.length === 0) {
			towers = towers.map((tower) => ({ ...tower, cooldown: Math.max(0, tower.cooldown - dt) }));
			return;
		}
		const nextShots = [...shots];
		towers = towers.map((tower) => {
			let cooldown = Math.max(0, tower.cooldown - dt);
			if (cooldown > 0) return { ...tower, cooldown };

			let target: Enemy | null = null;
			let nearest = Number.POSITIVE_INFINITY;
			for (const enemy of enemies) {
				const nextDistance = distance(tower, enemy);
				if (nextDistance <= towerRange(tower) && nextDistance < nearest) {
					target = enemy;
					nearest = nextDistance;
				}
			}
			if (!target) return { ...tower, cooldown };

			const dir = normalize(target.x - tower.x, target.y - tower.y);
			const speed = 250;
			nextShots.push({
				id: ++shotSeq,
				x: tower.x + dir.x * 12,
				y: tower.y + dir.y * 12,
				vx: dir.x * speed,
				vy: dir.y * speed,
				damage: towerDamage(tower)
			});
			cooldown = towerCooldown(tower);
			return { ...tower, cooldown };
		});
		shots = nextShots;
	}

	function updateShots(dt: number) {
		const liveEnemies = enemies.map((enemy) => ({ ...enemy }));
		const liveShots: Shot[] = [];
		let defeated = 0;

		for (const shot of shots) {
			const next = { ...shot, x: shot.x + shot.vx * dt, y: shot.y + shot.vy * dt };
			if (next.x < -18 || next.x > WORLD_W + 18 || next.y < -18 || next.y > WORLD_H + 18) continue;

			const hitIndex = liveEnemies.findIndex((enemy) => distance(next, enemy) < enemy.size + 4);
			if (hitIndex === -1) {
				liveShots.push(next);
				continue;
			}

			const hit = liveEnemies[hitIndex];
			hit.hp -= next.damage;
			addBurst(hit.x, hit.y - hit.size, hit.hp <= 0 ? '+1' : 'hit');
			if (hit.hp <= 0) {
				liveEnemies.splice(hitIndex, 1);
				defeated += 1;
			}
		}

		if (defeated > 0) {
			kills += defeated;
			coins += defeated;
		}
		enemies = liveEnemies;
		shots = liveShots;
	}

	function updateEnemies(dt: number) {
		const liveEnemies: Enemy[] = [];
		let leaked = 0;

		for (const enemy of enemies) {
			let next = { ...enemy };
			let travel = next.speed * dt;
			while (travel > 0 && next.pathIndex < PATH.length) {
				const target = PATH[next.pathIndex];
				const remaining = distance(next, target);
				if (remaining <= travel) {
					next = { ...next, x: target.x, y: target.y, pathIndex: next.pathIndex + 1 };
					travel -= remaining;
				} else {
					const dir = normalize(target.x - next.x, target.y - next.y);
					next = { ...next, x: next.x + dir.x * travel, y: next.y + dir.y * travel };
					travel = 0;
				}
			}

			if (next.pathIndex >= PATH.length) {
				leaked += 1;
				addBurst(PATH[PATH.length - 1].x - 10, PATH[PATH.length - 1].y - 14, '-life');
			} else {
				liveEnemies.push(next);
			}
		}

		if (leaked > 0) {
			if (heartTier > 0) {
				const refund = heartTier * leaked;
				coins += refund;
				leakRefund += refund;
				addBurst(PATH[PATH.length - 1].x - 10, PATH[PATH.length - 1].y - 30, `+${refund}`);
			}
			lives = clamp(lives - leaked, 0, startingLives);
			if (lives <= 0) {
				enemies = liveEnemies;
				finish('over');
				return;
			}
		}
		enemies = liveEnemies;
	}

	function updateBursts(dt: number) {
		bursts = bursts
			.map((burst) => ({ ...burst, y: burst.y - 20 * dt, life: burst.life - dt }))
			.filter((burst) => burst.life > 0);
	}

	onDestroy(() => stop());
</script>

<div class="defense-shell">
	<ArcadeHud
		title="Margin Defense"
		hint={hudHint}
		scores={[
			{ label: 'wave', value: phase === 'building' ? `${pendingWave}/${WAVE_COUNT}` : `${wave}/${WAVE_COUNT}` },
			{ label: 'lives', value: lives, live: true, tone: 'green' },
			{ label: 'coins', value: coins },
			{ label: 'prize', value: fmt(phase === 'complete' || phase === 'over' ? awarded : rewardPreview) }
		]}
		{startLabel}
		onstart={start}
		onclose={onclose}
	/>

	<ArcadeProgress value={waveProgress} label="wave progress" tone="green" />

	<div class="perks-wrap">
		<ArcadePetPerks creature={activePet} effects={statEffects} />
	</div>

	<SvgArena
		width={WORLD_W}
		height={WORLD_H}
		ariaLabel="Margin Defense map"
		active={phase === 'running'}
		gridId="defense-grid"
		gridOpacity={0.58}
	>
		<polyline class="route-shadow" points={pathPoints} />
		<polyline class="route" points={pathPoints} />
		<circle class="gate start" cx={PATH[0].x} cy={PATH[0].y} r="12" />
		<circle class="gate end" cx={PATH[PATH.length - 1].x} cy={PATH[PATH.length - 1].y} r="12" />

		{#each PADS as pad (pad.id)}
			{@const tower = towerForPad(pad.id)}
			<g
				class="pad"
				class:buildable={!tower && coins >= TOWER_COST}
				class:occupied={Boolean(tower)}
				role="button"
				tabindex="0"
				aria-label={padLabel(pad)}
				onclick={() => usePad(pad)}
				onkeydown={(event) => onPadKey(event, pad)}
			>
				<circle class="pad-ring" cx={pad.x} cy={pad.y} r="17" />
				<circle class="pad-core" cx={pad.x} cy={pad.y} r="8" />
				{#if tower}
					<circle class="tower-range" cx={tower.x} cy={tower.y} r={towerRange(tower)} />
					<circle class="tower-body" cx={tower.x} cy={tower.y} r={9 + tower.level} />
					<text class="tower-level" x={tower.x} y={tower.y + 4} text-anchor="middle">{tower.level}</text>
				{/if}
			</g>
		{/each}

		{#each shots as shot (shot.id)}
			<circle class="shot" cx={shot.x} cy={shot.y} r="3.6" />
		{/each}
		{#each enemies as enemy (enemy.id)}
			<g>
				<circle class="enemy" cx={enemy.x} cy={enemy.y} r={enemy.size} />
				<rect
					class="hp-bg"
					x={enemy.x - 10}
					y={enemy.y - enemy.size - 9}
					width="20"
					height="3"
					rx="1.5"
				/>
				<rect
					class="hp"
					x={enemy.x - 10}
					y={enemy.y - enemy.size - 9}
					width={(20 * enemy.hp) / enemy.maxHp}
					height="3"
					rx="1.5"
				/>
			</g>
		{/each}
		{#each bursts as burst (burst.id)}
			<text class="burst" x={burst.x} y={burst.y} text-anchor="middle">{burst.text}</text>
		{/each}

		{#if phase === 'building'}
			<text class="build-banner" x={WORLD_W / 2} y={24} text-anchor="middle">{nextWavePreview}</text>
		{/if}

		{#if phase === 'ready' || phase === 'complete' || phase === 'over'}
			<text class="center-title" x={WORLD_W / 2} y={WORLD_H / 2 - 10} text-anchor="middle">
				{outcomeLabel}
			</text>
			<text class="center-sub" x={WORLD_W / 2} y={WORLD_H / 2 + 22} text-anchor="middle">
				{phase === 'ready'
					? 'build before or during the run'
					: `score ${kills} · best ${best} · ${rounds} map${rounds === 1 ? '' : 's'}${leakRefund > 0 ? ` · ${leakRefund} refunded` : ''}`}
			</text>
		{/if}
	</SvgArena>

	<div class="build-row" aria-label="build status">
		<span>{buildHint}</span>
		{#if phase === 'building'}
			<button class="skip-build" onclick={sendWaveNow}>send wave now</button>
		{/if}
		<span>tower {TOWER_COST} / upgrade {UPGRADE_COST}</span>
	</div>
</div>

<style>
	.defense-shell {
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}
	.route-shadow,
	.route {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.route-shadow {
		stroke: rgba(7, 54, 66, 0.12);
		stroke-width: 31;
	}
	.route {
		stroke: rgba(181, 137, 0, 0.52);
		stroke-width: 20;
	}
	.gate {
		stroke: var(--sol-base3);
		stroke-width: 3;
	}
	.gate.start {
		fill: var(--sol-cyan);
	}
	.gate.end {
		fill: var(--sol-red);
	}
	.pad {
		cursor: pointer;
		outline: none;
	}
	.pad-ring {
		fill: rgba(253, 246, 227, 0.72);
		stroke: rgba(88, 110, 117, 0.38);
		stroke-width: 2;
	}
	.pad-core {
		fill: rgba(88, 110, 117, 0.22);
	}
	.pad.buildable .pad-ring {
		stroke: var(--sol-cyan);
	}
	.pad:focus-visible .pad-ring,
	.pad:hover .pad-ring {
		stroke: var(--sol-blue);
		stroke-width: 3;
	}
	.tower-range {
		fill: rgba(38, 139, 210, 0.08);
		stroke: rgba(38, 139, 210, 0.16);
		stroke-width: 1;
		pointer-events: none;
	}
	.tower-body {
		fill: var(--sol-blue);
		stroke: var(--sol-base3);
		stroke-width: 3;
		pointer-events: none;
	}
	.tower-level {
		font-family: var(--font-counter);
		font-size: 10px;
		fill: var(--sol-base3);
		pointer-events: none;
	}
	.enemy {
		fill: var(--sol-orange);
		stroke: rgba(253, 246, 227, 0.82);
		stroke-width: 1.5;
	}
	.hp-bg {
		fill: rgba(7, 54, 66, 0.18);
	}
	.hp {
		fill: var(--sol-green);
	}
	.shot {
		fill: var(--sol-cyan);
		stroke: var(--sol-base3);
		stroke-width: 1.5;
	}
	.burst {
		font-family: var(--font-counter);
		font-size: 16px;
		fill: var(--sol-yellow);
		pointer-events: none;
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
	.build-banner {
		font-family: var(--font-ui);
		font-size: 11px;
		text-transform: uppercase;
		fill: var(--sol-violet);
		pointer-events: none;
	}
	.perks-wrap {
		width: min(540px, 100%);
	}
	.build-row {
		width: min(540px, 100%);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		flex-wrap: wrap;
		font-family: var(--font-ui);
		font-size: 0.62rem;
		text-transform: uppercase;
		color: var(--sol-base1);
	}
	.build-row span:first-child {
		color: var(--sol-base0);
	}
	.skip-build {
		font-family: var(--font-ui);
		font-size: 0.6rem;
		text-transform: uppercase;
		color: var(--sol-base3);
		background: var(--sol-violet);
		border-radius: 3px;
		padding: 0.22rem 0.5rem;
		white-space: nowrap;
	}
	.skip-build:hover {
		background: var(--sol-blue);
	}
	@media (max-width: 560px) {
		.center-title {
			font-size: 34px;
		}
	}
</style>
