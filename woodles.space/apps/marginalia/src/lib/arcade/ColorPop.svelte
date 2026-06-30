<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ArcadePetPerks from './ArcadePetPerks.svelte';
	import { loadArcadeRecord, recordArcadeRun } from './arcadeRecords';
	import { scoreOnlyReason } from './arcadeRewards';
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

	type MatterApi = {
		Bodies: Record<string, (...args: any[]) => any>;
		Body: Record<string, (...args: any[]) => any>;
		Composite: Record<string, (...args: any[]) => any>;
		Engine: Record<string, (...args: any[]) => any>;
		Events: Record<string, (...args: any[]) => any>;
		Render: Record<string, (...args: any[]) => any>;
		Runner: Record<string, (...args: any[]) => any>;
		World: Record<string, (...args: any[]) => any>;
	};

	type MatterBody = any;
	type MatterPair = { bodyA: MatterBody; bodyB: MatterBody };
	type PopData = { tier: number; bornAt: number; merging: boolean };
	type MergeJob = {
		first: MatterBody;
		second: MatterBody;
		tier: number;
		x: number;
		y: number;
	};
	type Tier = {
		radius: number;
		color: string;
		density: number;
		points: number;
	};

	const WIDTH = 400;
	const HEIGHT = 600;
	const WALL = 42;
	const FLOOR = 44;
	const GAME_OVER_Y = 110;
	const GAME_ID = 'color-pop';
	const DROP_COOLDOWN_MS = 1000;
	const BODY_DENSITY = 0.00235;
	const SETTLE_AGE_MS = 1700;
	const SETTLE_SPEED = 0.16;
	const scoreOnlyLabel = scoreOnlyReason(GAME_ID) ? 'score only' : '-';

	const tiers: Tier[] = [
		{ radius: 15, color: '#2aa198', density: BODY_DENSITY, points: 20 },
		{ radius: 24, color: '#268bd2', density: BODY_DENSITY, points: 40 },
		{ radius: 35, color: '#6c71c4', density: BODY_DENSITY, points: 80 },
		{ radius: 48, color: '#d33682', density: BODY_DENSITY, points: 160 },
		{ radius: 64, color: '#dc322f', density: BODY_DENSITY, points: 320 },
		{ radius: 82, color: '#cb4b16', density: BODY_DENSITY, points: 640 },
		{ radius: 102, color: '#b58900', density: BODY_DENSITY, points: 1280 },
		{ radius: 124, color: '#859900', density: BODY_DENSITY, points: 2560 },
		{ radius: 148, color: '#16a085', density: BODY_DENSITY, points: 5120 },
		{ radius: 170, color: '#8e44ad', density: BODY_DENSITY, points: 10240 },
		{ radius: 188, color: '#073642', density: BODY_DENSITY, points: 20480 }
	];

	let canvasEl: HTMLCanvasElement;
	let M: MatterApi | null = null;
	let engine: any = null;
	let render: any = null;
	let runner: any = null;
	let collisionHandler: ((event: { pairs: MatterPair[] }) => void) | null = null;
	let afterUpdateHandler: (() => void) | null = null;
	let afterRenderHandler: (() => void) | null = null;
	let uiTimer: ReturnType<typeof setInterval> | null = null;
	let pendingMerges: MergeJob[] = [];
	let mounted = false;

	let matterReady = $state(false);
	let loadError = $state('');
	let score = $state(0);
	let merges = $state(0);
	let highTier = $state(0);
	let bodyCount = $state(0);
	let cursorX = $state(WIDTH / 2);
	let nextTier = $state(randomDropTier());
	let nextPreviewTier = $state(randomDropTier());
	let readyAt = $state(0);
	let now = $state(Date.now());
	let gameOver = $state(false);
	let lastPopTier = $state<number | null>(null);
	let best = $state(loadArcadeRecord(GAME_ID).bestScore);
	let settleSaves = $state(0);
	let settleSavesUsed = $state(0);
	let recordedRun = false;

	const bodyTier = $derived(statTier(coreStatValue(activePet, 'body')));
	const mindTier = $derived(statTier(coreStatValue(activePet, 'mind')));
	const graceTier = $derived(statTier(coreStatValue(activePet, 'grace')));
	const heartTier = $derived(statTier(coreStatValue(activePet, 'heart')));
	const dropCooldownMs = $derived(Math.max(620, DROP_COOLDOWN_MS - graceTier * 110));
	const cooldownSeconds = $derived(Math.max(0, (readyAt - now) / 1000));
	const readyLabel = $derived.by(() => {
		if (loadError) return 'offline';
		if (!matterReady) return 'loading';
		if (gameOver) return 'over';
		if (cooldownSeconds > 0) return cooldownSeconds.toFixed(1);
		return 'ready';
	});
	const nextTierStyle = $derived(`background:${tiers[nextTier].color}`);
	const nextPreviewTierStyle = $derived(`background:${tiers[nextPreviewTier].color}`);
	const highTierStyle = $derived(`background:${tiers[Math.max(0, highTier)].color}`);
	const statEffects = $derived<ArcadeStatEffects>({
		body: (_value, tier) => (tier > 0 ? `pop impulse +${tier}` : 'normal pop'),
		mind: (_value, tier) => (tier > 0 ? 'next drop preview' : 'single drop'),
		grace: (_value, tier) => (tier > 0 ? `cooldown -${tier * 110}ms` : 'standard cooldown'),
		heart: (_value, tier) => (tier > 0 ? `${tier} settle save${tier === 1 ? '' : 's'}` : 'hard ceiling')
	});

	function randomDropTier(): number {
		return Math.floor(Math.random() * 5);
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}

	function matterGlobal(): MatterApi | undefined {
		return (window as unknown as { Matter?: MatterApi }).Matter;
	}

	async function localMatter(): Promise<MatterApi | null> {
		try {
			const matterModule = await import('matter-js');
			const moduleWithDefault = matterModule as unknown as { default?: MatterApi };
			return moduleWithDefault.default ?? (matterModule as unknown as MatterApi);
		} catch {
			return null;
		}
	}

	async function waitForMatter(): Promise<MatterApi | null> {
		const localApi = await localMatter();
		if (localApi) return localApi;

		for (let attempt = 0; attempt < 80; attempt++) {
			const api = matterGlobal();
			if (api) return api;
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		return null;
	}

	function circleData(body: MatterBody): PopData | null {
		return body?.plugin?.colorPop ?? null;
	}

	function circleTier(body: MatterBody): number | null {
		return circleData(body)?.tier ?? null;
	}

	function allCircles(): MatterBody[] {
		if (!M || !engine) return [];
		return M.Composite.allBodies(engine.world).filter((body: MatterBody) => circleTier(body) !== null);
	}

	function refreshBodyCount() {
		bodyCount = allCircles().length;
	}

	function bodyInWorld(body: MatterBody): boolean {
		return allCircles().includes(body);
	}

	function createBox() {
		if (!M || !engine) return;
		const wallOptions = {
			isStatic: true,
			friction: 0,
			restitution: 0.1,
			render: {
				fillStyle: '#073642',
				strokeStyle: '#073642',
				lineWidth: 0
			}
		};

		// The top stays open. The side walls extend above the canvas so no fast circle
		// can slip through the upper corners while the player is dropping.
		M.World.add(engine.world, [
			M.Bodies.rectangle(-WALL / 2, HEIGHT / 2, WALL, HEIGHT * 2, wallOptions),
			M.Bodies.rectangle(WIDTH + WALL / 2, HEIGHT / 2, WALL, HEIGHT * 2, wallOptions),
			M.Bodies.rectangle(WIDTH / 2, HEIGHT + FLOOR / 2, WIDTH + WALL * 2, FLOOR, wallOptions)
		]);
	}

	function makeCircle(tier: number, x: number, y: number): MatterBody {
		if (!M) return null;
		const spec = tiers[tier];
		const body = M.Bodies.circle(x, y, spec.radius, {
			density: spec.density,
			friction: 0.05,
			frictionAir: 0,
			restitution: 0.3,
			slop: 0.02,
			render: {
				fillStyle: spec.color,
				strokeStyle: tier >= 9 ? '#fdf6e3' : '#073642',
				lineWidth: tier >= 6 ? 2 : 1
			}
		});

		body.label = 'color-pop-circle';
		body.plugin = {
			...body.plugin,
			colorPop: {
				tier,
				bornAt: Date.now(),
				merging: false
			}
		};
		return body;
	}

	function setupMatter() {
		if (!M || !canvasEl) return;

		engine = M.Engine.create();
		engine.gravity.y = 1.08;
		createBox();

		render = M.Render.create({
			canvas: canvasEl,
			engine,
			options: {
				width: WIDTH,
				height: HEIGHT,
				wireframes: false,
				background: '#fdf6e3',
				pixelRatio: window.devicePixelRatio || 1
			}
		});

		runner = M.Runner.create();
		collisionHandler = handleCollisionStart;
		afterUpdateHandler = handleAfterUpdate;
		afterRenderHandler = drawCanvasOverlay;

		M.Events.on(engine, 'collisionStart', collisionHandler);
		M.Events.on(engine, 'afterUpdate', afterUpdateHandler);
		M.Events.on(render, 'afterRender', afterRenderHandler);
		M.Render.run(render);
		M.Runner.run(runner, engine);

		matterReady = true;
		loadError = '';
		refreshBodyCount();
	}

	function cleanupMatter() {
		if (!M) return;
		if (engine && collisionHandler) M.Events.off(engine, 'collisionStart', collisionHandler);
		if (engine && afterUpdateHandler) M.Events.off(engine, 'afterUpdate', afterUpdateHandler);
		if (render && afterRenderHandler) M.Events.off(render, 'afterRender', afterRenderHandler);
		if (runner) M.Runner.stop(runner);
		if (render) M.Render.stop(render);
		if (engine) {
			M.World.clear(engine.world, false);
			M.Engine.clear(engine);
		}

		engine = null;
		render = null;
		runner = null;
		collisionHandler = null;
		afterUpdateHandler = null;
		afterRenderHandler = null;
		pendingMerges = [];
		matterReady = false;
	}

	function resetGame() {
		score = 0;
		merges = 0;
		highTier = 0;
		bodyCount = 0;
		lastPopTier = null;
		gameOver = false;
		readyAt = 0;
		nextTier = randomDropTier();
		nextPreviewTier = randomDropTier();
		settleSaves = heartTier;
		settleSavesUsed = 0;
		recordedRun = false;
		pendingMerges = [];

		if (!M || !engine || !runner) return;
		M.Runner.stop(runner);
		M.World.clear(engine.world, false);
		M.Engine.clear(engine);
		createBox();
		M.Runner.run(runner, engine);
	}

	function trackPointer(event: PointerEvent) {
		if (!canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		const rawX = ((event.clientX - rect.left) / rect.width) * WIDTH;
		const radius = tiers[nextTier].radius;
		cursorX = clamp(rawX, radius + 6, WIDTH - radius - 6);
	}

	function drop(event: PointerEvent) {
		event.preventDefault();
		trackPointer(event);
		if (!M || !engine || !matterReady || gameOver || Date.now() < readyAt) return;

		const tier = nextTier;
		const radius = tiers[tier].radius;
		const x = clamp(cursorX, radius + 6, WIDTH - radius - 6);
		const y = radius + 12;
		const body = makeCircle(tier, x, y);

		M.World.add(engine.world, body);
		M.Body.setVelocity(body, {
			x: (Math.random() - 0.5) * (0.4 + bodyTier * 0.05),
			y: 0.35 + bodyTier * 0.08
		});
		readyAt = Date.now() + dropCooldownMs;
		nextTier = nextPreviewTier;
		nextPreviewTier = randomDropTier();
		refreshBodyCount();
	}

	function handleCollisionStart(event: { pairs: MatterPair[] }) {
		if (gameOver) return;

		for (const pair of event.pairs) {
			const firstTier = circleTier(pair.bodyA);
			const secondTier = circleTier(pair.bodyB);
			if (firstTier === null || secondTier === null) continue;
			if (firstTier !== secondTier || firstTier >= tiers.length - 1) continue;

			const firstData = circleData(pair.bodyA);
			const secondData = circleData(pair.bodyB);
			if (!firstData || !secondData || firstData.merging || secondData.merging) continue;

			// Mark first, remove later. Deferring the world edit keeps Matter's
			// collision iteration stable when several pairs report in the same tick.
			firstData.merging = true;
			secondData.merging = true;
			pendingMerges.push({
				first: pair.bodyA,
				second: pair.bodyB,
				tier: firstTier,
				x: (pair.bodyA.position.x + pair.bodyB.position.x) / 2,
				y: (pair.bodyA.position.y + pair.bodyB.position.y) / 2
			});
		}
	}

	function handleAfterUpdate() {
		if (pendingMerges.length > 0) resolveMerges();
		checkGameOver();
	}

	function resolveMerges() {
		if (!M || !engine) return;
		const jobs = pendingMerges;
		pendingMerges = [];

		for (const job of jobs) {
			if (!bodyInWorld(job.first) || !bodyInWorld(job.second)) continue;

			const next = job.tier + 1;
			const radius = tiers[next].radius;
			const x = clamp(job.x, radius + 6, WIDTH - radius - 6);
			const y = clamp(job.y, radius + 8, HEIGHT - radius - 8);
			const merged = makeCircle(next, x, y);

			M.World.remove(engine.world, [job.first, job.second]);
			M.World.add(engine.world, merged);
			score += tiers[next].points;
			merges += 1;
			highTier = Math.max(highTier, next);
			lastPopTier = next;
			applyPopEnergy(merged, x, y);
		}
		refreshBodyCount();
	}

	function applyPopEnergy(merged: MatterBody, x: number, y: number) {
		if (!M || !engine) return;
		const mergedTier = circleTier(merged);
		if (mergedTier === null) return;

		// A new larger body already separates overlaps naturally. The extra impulse
		// below gives nearby circles a visible Color POP jostle without turning the
		// pile into chaos.
		M.Body.setVelocity(merged, {
			x: (Math.random() - 0.5) * 1.4,
			y: -1.1 - Math.random() * 0.55
		});

		for (const body of allCircles()) {
			if (body === merged) continue;
			const tier = circleTier(body);
			if (tier === null) continue;

			const dx = body.position.x - x;
			const dy = body.position.y - y;
			const dist = Math.max(1, Math.hypot(dx, dy));
			const range = tiers[mergedTier].radius + tiers[tier].radius + 88;
			if (dist > range) continue;

			const strength = 1 - dist / range;
			const force = 0.00085 * (1 + bodyTier * 0.18) * body.mass * strength;
			M.Body.applyForce(body, body.position, {
				x: (dx / dist) * force,
				y: (dy / dist) * force - 0.00018 * body.mass * strength
			});
		}
	}

	function checkGameOver() {
		if (!M || !runner || gameOver) return;
		const current = Date.now();
		const settledTooHigh = allCircles().find((body) => {
			const data = circleData(body);
			if (!data || data.merging || current - data.bornAt < SETTLE_AGE_MS) return false;
			const speed = Math.hypot(body.velocity.x, body.velocity.y);
			return body.position.y < GAME_OVER_Y && speed < SETTLE_SPEED;
		});

		if (settledTooHigh) {
			if (settleSaves > 0) {
				const tier = circleTier(settledTooHigh) ?? 0;
				const radius = settledTooHigh.circleRadius ?? tiers[tier].radius;
				const data = circleData(settledTooHigh);
				if (data) data.bornAt = current;
				settleSaves -= 1;
				settleSavesUsed += 1;
				lastPopTier = tier;
				M.Body.setPosition(settledTooHigh, {
					x: settledTooHigh.position.x,
					y: GAME_OVER_Y + radius + 12
				});
				M.Body.setVelocity(settledTooHigh, {
					x: settledTooHigh.velocity.x * 0.25,
					y: 2.2
				});
				refreshBodyCount();
				return;
			}
			gameOver = true;
			M.Runner.stop(runner);
			refreshBodyCount();
			recordRun();
		}
	}

	function recordRun() {
		if (recordedRun) return;
		recordedRun = true;
		const record = recordArcadeRun(GAME_ID, {
			score,
			summary: {
				merges,
				highTier,
				circles: bodyCount,
				settleSaves: settleSavesUsed,
				scoreOnly: true
			}
		});
		best = record.bestScore;
	}

	function drawCanvasOverlay() {
		if (!render) return;
		const context = render.context as CanvasRenderingContext2D;
		const radius = tiers[nextTier].radius;
		const ghostX = clamp(cursorX, radius + 6, WIDTH - radius - 6);
		const ghostY = radius + 12;

		context.save();

		context.setLineDash([7, 8]);
		context.strokeStyle = 'rgba(220, 50, 47, 0.58)';
		context.lineWidth = 2;
		context.beginPath();
		context.moveTo(0, GAME_OVER_Y);
		context.lineTo(WIDTH, GAME_OVER_Y);
		context.stroke();
		context.setLineDash([]);

		if (!gameOver) {
			context.globalAlpha = cooldownSeconds > 0 ? 0.28 : 0.58;
			context.fillStyle = tiers[nextTier].color;
			context.strokeStyle = '#073642';
			context.lineWidth = 2;
			context.beginPath();
			context.arc(ghostX, ghostY, radius, 0, Math.PI * 2);
			context.fill();
			context.stroke();

			context.globalAlpha = cooldownSeconds > 0 ? 0.12 : 0.2;
			context.strokeStyle = '#073642';
			context.beginPath();
			context.moveTo(ghostX, ghostY + radius + 6);
			context.lineTo(ghostX, HEIGHT - 14);
			context.stroke();
		}

		context.restore();
	}

	onMount(() => {
		mounted = true;
		uiTimer = setInterval(() => {
			now = Date.now();
			refreshBodyCount();
		}, 120);

		void (async () => {
			const api = await waitForMatter();
			if (!mounted) return;
			if (!api) {
				loadError = 'Matter.js did not load.';
				return;
			}
			M = api;
			setupMatter();
		})();
	});

	onDestroy(() => {
		mounted = false;
		if (uiTimer) clearInterval(uiTimer);
		cleanupMatter();
	});
</script>

<div class="pop-shell">
	<div class="pop-bar">
		<div class="game-id">
			<span class="game-name">Color POP!</span>
			<span class="game-hint">match colors into heavier circles</span>
		</div>
		<div class="score-group">
			<div class="score-box">
				<span class="score-label">score</span>
				<span class="score-val">{score}</span>
			</div>
			<div class="score-box">
				<span class="score-label">merges</span>
				<span class="score-val">{merges}</span>
			</div>
			<div class="score-box">
				<span class="score-label">best</span>
				<span class="score-val">{Math.max(score, best)}</span>
			</div>
			<div class="score-box">
				<span class="score-label">drop</span>
				<span class="score-val">{readyLabel}</span>
			</div>
			<div class="score-box">
				<span class="score-label">save</span>
				<span class="score-val">{settleSaves}</span>
			</div>
			<div class="score-box">
				<span class="score-label">prize</span>
				<span class="score-val policy">{scoreOnlyLabel}</span>
			</div>
			<div class="score-box swatch-box">
				<span class="score-label">next</span>
				<span class="swatch" style={nextTierStyle} aria-label="next tier color"></span>
			</div>
			{#if mindTier > 0}
				<div class="score-box swatch-box">
					<span class="score-label">after</span>
					<span class="swatch ghost" style={nextPreviewTierStyle} aria-label="following tier color"></span>
				</div>
			{/if}
		</div>
		<div class="btn-group">
			<button class="ctrl-btn" onclick={resetGame}>new game</button>
			<button class="ctrl-btn back" onclick={onclose}>arcade</button>
		</div>
	</div>

	<div class="perks-wrap">
		<ArcadePetPerks creature={activePet} effects={statEffects} />
	</div>

	<div class="stat-row" aria-label="Color POP status">
		<span>tier <b>{highTier}</b><i style={highTierStyle}></i></span>
		<span>circles <b>{bodyCount}</b></span>
		<span>{settleSavesUsed > 0 ? 'saved' : 'last'} <b>{settleSavesUsed > 0 ? settleSavesUsed : (lastPopTier ?? '-')}</b></span>
	</div>

	<div
		class="canvas-frame"
		class:cooling={cooldownSeconds > 0}
		class:stopped={gameOver || Boolean(loadError)}
		onpointermove={trackPointer}
		onpointerdown={drop}
		role="application"
		aria-label="Color POP physics board"
	>
		<canvas bind:this={canvasEl} width={WIDTH} height={HEIGHT}></canvas>
		{#if loadError}
			<div class="game-overlay">
				<p class="overlay-title">not loaded</p>
				<p class="overlay-sub">{loadError}</p>
				<button onclick={resetGame}>retry</button>
			</div>
		{:else if gameOver}
			<div class="game-overlay">
				<p class="overlay-title">game over</p>
				<p class="overlay-sub">score {score} · {merges} merges · tier {highTier}</p>
				<button onclick={resetGame}>play again</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.pop-shell {
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.85rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}

	.pop-bar {
		width: 100%;
		max-width: 660px;
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
		justify-content: center;
	}

	.score-box {
		background: var(--sol-base2);
		border-radius: 3px;
		padding: 0.3rem 0.58rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 3.1rem;
		min-height: 2.75rem;
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
		font-size: 1.25rem;
		color: var(--sol-base01);
		line-height: 1.1;
	}

	.score-val.policy {
		font-family: var(--font-ui);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.swatch-box {
		min-width: 3rem;
	}

	.swatch {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		border: 2px solid rgba(7, 54, 66, 0.28);
		box-shadow: inset 0 -3px 0 rgba(7, 54, 66, 0.16);
	}

	.swatch.ghost {
		opacity: 0.58;
	}

	.perks-wrap {
		width: min(400px, calc(100vw - 3rem));
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

	.stat-row {
		width: min(400px, calc(100vw - 3rem));
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.stat-row span {
		min-height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		border: 1px solid var(--sol-base2);
		border-radius: 3px;
		background: rgba(238, 232, 213, 0.42);
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--sol-base1);
	}

	.stat-row b {
		font-family: var(--font-counter);
		font-size: 1.1rem;
		font-weight: 400;
		color: var(--sol-base01);
		letter-spacing: 0;
	}

	.stat-row i {
		width: 0.74rem;
		height: 0.74rem;
		border-radius: 50%;
		border: 1px solid rgba(7, 54, 66, 0.24);
	}

	.canvas-frame {
		position: relative;
		width: min(400px, calc(100vw - 3rem));
		aspect-ratio: 2 / 3;
		border: 1px solid var(--sol-base2);
		border-radius: 6px;
		overflow: hidden;
		background: var(--sol-base3);
		box-shadow:
			inset 0 0 0 7px rgba(7, 54, 66, 0.06),
			0 18px 48px rgba(7, 54, 66, 0.1);
		cursor: crosshair;
		touch-action: none;
		user-select: none;
	}

	.canvas-frame::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			linear-gradient(90deg, rgba(7, 54, 66, 0.04) 1px, transparent 1px),
			linear-gradient(0deg, rgba(7, 54, 66, 0.04) 1px, transparent 1px);
		background-size: 40px 40px;
		mix-blend-mode: multiply;
		opacity: 0.5;
	}

	.canvas-frame.cooling {
		cursor: wait;
	}

	.canvas-frame.stopped {
		cursor: default;
	}

	canvas {
		width: 100% !important;
		height: 100% !important;
		display: block;
	}

	.game-overlay {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		text-align: center;
		padding: 1.5rem;
		background: rgba(7, 54, 66, 0.84);
		color: var(--sol-base3);
	}

	.overlay-title {
		font-family: var(--font-counter);
		font-size: 3rem;
		line-height: 1;
		margin: 0;
	}

	.overlay-sub {
		font-family: var(--font-body);
		font-size: 0.9rem;
		font-style: italic;
		color: rgba(253, 246, 227, 0.82);
		margin: 0;
	}

	.game-overlay button {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		background: rgba(253, 246, 227, 0.18);
		color: var(--sol-base3);
		border: 1px solid rgba(253, 246, 227, 0.46);
		border-radius: 3px;
		padding: 0.34rem 0.72rem;
	}

	.game-overlay button:hover {
		background: rgba(253, 246, 227, 0.32);
	}

	@media (max-width: 520px) {
		.pop-bar,
		.btn-group,
		.game-id {
			align-items: center;
		}

		.pop-bar {
			justify-content: center;
			text-align: center;
		}

		.btn-group {
			flex-direction: row;
		}

		.game-name {
			font-size: 1.7rem;
		}

		.score-box {
			min-width: 2.8rem;
			padding-inline: 0.48rem;
		}
	}
</style>
