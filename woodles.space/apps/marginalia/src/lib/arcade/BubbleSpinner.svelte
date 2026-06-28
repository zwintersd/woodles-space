<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		axialToPoint,
		clamp,
		distance,
		hexDistance,
		hexKey,
		hexNeighbors,
		hexesWithinRadius,
		normalize,
		pointToHex,
		rotate,
		type CubeHex,
		type Dot
	} from './arcadeMath';
	import { fmt } from '$lib/witch/book.svelte';
	import { payReward, previewReward } from './arcadeRewards';
	import type { ArcadeActivePet } from './arcadeStats';

	interface Props {
		onclose: () => void;
		activePet?: ArcadeActivePet;
	}
	let { onclose }: Props = $props();

	const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'] as const;
	type BubbleColor = (typeof COLORS)[number];
	type Phase = 'ready' | 'running' | 'complete' | 'over';
	type FlashTone = BubbleColor | 'ink';

	interface Bubble extends CubeHex {
		id: string;
		color: BubbleColor;
	}

	interface Projectile extends Dot {
		vx: number;
		vy: number;
		color: BubbleColor;
	}

	interface FallingBubble extends Dot {
		id: number;
		vx: number;
		vy: number;
		color: BubbleColor;
		life: number;
		radius: number;
	}

	interface Flash {
		text: string;
		tone: FlashTone;
		life: number;
	}

	interface GameState {
		bubbles: Map<string, Bubble>;
		angle: number;
		angularVelocity: number;
		foulCount: number;
		phase: Phase;
		projectile: Projectile | null;
		loadedColor: BubbleColor;
		nextColor: BubbleColor;
		falling: FallingBubble[];
		flash: Flash | null;
		score: number;
		matches: number;
		orphans: number;
		shots: number;
	}

	const CANVAS_SIZE = 600;
	const CENTER: Dot = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
	const ORIGIN: CubeHex = { q: 0, r: 0, s: 0 };
	const SHOOTER: Dot = { x: CANVAS_SIZE / 2, y: 42 };
	const BUBBLE_R = 17.5;
	const HEX_SIZE = 20.25;
	const SHOT_SPEED = 430;
	const FOUL_LIMIT = 5;
	const MAX_REWARD = 30;
	const IMPACT_TORQUE = 0.000012;
	const MAX_SPIN = 3.1;
	const SAFE_PADDING = 10;
	const DAMPING_PER_FRAME = 0.98;
	const MIN_AIM = 0.22;
	const MAX_AIM = Math.PI - 0.22;
	const COLOR_SWATCHES: Record<BubbleColor, { name: string; fill: string; light: string; dark: string }> = {
		red: { name: 'red', fill: '#dc322f', light: '#ff8a76', dark: '#8f1d22' },
		blue: { name: 'blue', fill: '#268bd2', light: '#91d5ff', dark: '#12507f' },
		green: { name: 'green', fill: '#2aa198', light: '#7ee6d8', dark: '#17645f' },
		yellow: { name: 'yellow', fill: '#b58900', light: '#ffe08a', dark: '#735600' },
		purple: { name: 'purple', fill: '#6c71c4', light: '#b8baf2', dark: '#3e438d' }
	};

	let game = $state<GameState>(createState('ready'));
	let aimAngle = $state(Math.PI / 2);
	let rounds = $state(0);
	let best = $state(0);
	let awarded = $state(0);
	let canvasEl: HTMLCanvasElement;
	let context: CanvasRenderingContext2D | null = null;
	let raf = 0;
	let lastTime = 0;
	let pixelRatio = 1;
	let fallingSeq = 0;

	const startLabel = $derived(game.phase === 'running' ? 'restart' : rounds > 0 ? 'again' : 'start');
	const rewardPreview = $derived(rewardFor(game.score, game.bubbles.size === 0));
	const prizeLabel = $derived(fmt(game.phase === 'running' ? rewardPreview : awarded));
	const bubbleCount = $derived(game.bubbles.size);
	const spinLabel = $derived(Math.abs(game.angularVelocity).toFixed(2));
	const hintLabel = $derived.by(() => {
		if (game.phase === 'complete') return 'the center held';
		if (game.phase === 'over') return 'the ring touched the glass';
		if (game.phase === 'running') return game.projectile ? 'shot in flight' : 'cluster spinning';
		return 'pivot ready';
	});

	function createState(phase: Phase): GameState {
		return {
			bubbles: seedBubbles(),
			angle: 0,
			angularVelocity: 0,
			foulCount: FOUL_LIMIT,
			phase,
			projectile: null,
			loadedColor: randomColor(),
			nextColor: randomColor(),
			falling: [],
			flash: null,
			score: 0,
			matches: 0,
			orphans: 0,
			shots: 0
		};
	}

	function seedBubbles(): Map<string, Bubble> {
		const seeded = new Map<string, Bubble>();
		const inner = hexesWithinRadius(2).filter((hex) => hexDistance(hex) > 0);
		const outer = hexesWithinRadius(3).filter((hex, index) => hexDistance(hex) === 3 && index % 2 === 0);
		[...inner, ...outer].forEach((hex, index) => {
			const color = COLORS[Math.abs(hex.q * 13 + hex.r * 7 + hex.s * 3 + index) % COLORS.length] ?? COLORS[0];
			addBubble(seeded, hex, color);
		});
		return seeded;
	}

	function addBubble(map: Map<string, Bubble>, hex: CubeHex, color: BubbleColor) {
		const id = hexKey(hex);
		map.set(id, { ...hex, id, color });
	}

	function randomColor(): BubbleColor {
		return COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0];
	}

	function rewardFor(score: number, cleared: boolean): number {
		return previewReward(Math.floor(score / 85) + (cleared ? 12 : 0), MAX_REWARD);
	}

	function safeAimAngle(): number {
		return Number.isFinite(aimAngle) ? aimAngle : Math.PI / 2;
	}

	function start() {
		stop();
		game = createState('running');
		aimAngle = Math.PI / 2;
		awarded = 0;
		lastTime = performance.now();
		raf = requestAnimationFrame(loop);
		draw();
	}

	function stop() {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}

	function finish(nextPhase: 'complete' | 'over') {
		if (game.phase !== 'running') return;
		game.phase = nextPhase;
		game.projectile = null;
		stop();
		rounds += 1;
		best = Math.max(best, game.score);
		awarded = payReward(rewardFor(game.score, nextPhase === 'complete'), MAX_REWARD);
		draw();
	}

	function loop(now: number) {
		const dt = Math.min(0.034, Math.max(0, (now - lastTime) / 1000));
		lastTime = now;
		step(dt);
		draw();
		if (game.phase === 'running') raf = requestAnimationFrame(loop);
	}

	function step(dt: number) {
		game.angle += game.angularVelocity * dt;
		game.angularVelocity *= Math.pow(DAMPING_PER_FRAME, dt * 60);
		if (Math.abs(game.angularVelocity) < 0.002) game.angularVelocity = 0;
		updateProjectile(dt);
		updateFalling(dt);
		updateFlash(dt);
		checkGameOver();
	}

	function updateProjectile(dt: number) {
		if (!game.projectile || game.phase !== 'running') return;
		let nextProjectile: Projectile = {
			...game.projectile,
			x: game.projectile.x + game.projectile.vx * dt,
			y: game.projectile.y + game.projectile.vy * dt
		};

		if (nextProjectile.x <= BUBBLE_R + SAFE_PADDING) {
			nextProjectile = { ...nextProjectile, x: BUBBLE_R + SAFE_PADDING, vx: Math.abs(nextProjectile.vx) };
		} else if (nextProjectile.x >= CANVAS_SIZE - BUBBLE_R - SAFE_PADDING) {
			nextProjectile = {
				...nextProjectile,
				x: CANVAS_SIZE - BUBBLE_R - SAFE_PADDING,
				vx: -Math.abs(nextProjectile.vx)
			};
		}

		const collided = collisionBubble(nextProjectile);
		if (collided) {
			placeProjectile(nextProjectile, collided);
			return;
		}

		if (nextProjectile.y > CANVAS_SIZE + BUBBLE_R) {
			game.projectile = null;
			registerFoul('miss');
			return;
		}

		game.projectile = nextProjectile;
	}

	function collisionBubble(projectile: Projectile): Bubble | null {
		let hit: Bubble | null = null;
		let hitDistance = Number.POSITIVE_INFINITY;
		for (const bubble of game.bubbles.values()) {
			const center = worldPointForHex(bubble);
			const gap = distance(projectile, center);
			if (gap <= BUBBLE_R * 2 - 1 && gap < hitDistance) {
				hit = bubble;
				hitDistance = gap;
			}
		}
		return hit;
	}

	function placeProjectile(projectile: Projectile, collided: Bubble) {
		applyImpactTorque(projectile);
		game.projectile = null;
		const target = snapTargetFor(projectile, collided);
		if (!target) {
			registerFoul('jam');
			return;
		}

		const nextBubbles = new Map(game.bubbles);
		addBubble(nextBubbles, target, projectile.color);
		game.bubbles = nextBubbles;
		game.shots += 1;
		resolvePlacement(nextBubbles.get(hexKey(target)));
	}

	function applyImpactTorque(projectile: Projectile) {
		const arm = { x: projectile.x - CENTER.x, y: projectile.y - CENTER.y };
		const cross = arm.x * projectile.vy - arm.y * projectile.vx;
		game.angularVelocity = clamp(game.angularVelocity + cross * IMPACT_TORQUE, -MAX_SPIN, MAX_SPIN);
	}

	function snapTargetFor(projectile: Projectile, collided: Bubble): CubeHex | null {
		const localPoint = screenToLocal(projectile);
		const desired = pointToHex(localPoint, HEX_SIZE);
		const direct = nearestEmptyHex(hexNeighbors(collided), localPoint, desired);
		if (direct) return direct;

		const perimeter = new Map<string, CubeHex>();
		for (const bubble of game.bubbles.values()) {
			for (const neighbor of hexNeighbors(bubble)) {
				if (!isOpenBubbleHex(neighbor)) continue;
				perimeter.set(hexKey(neighbor), neighbor);
			}
		}
		return nearestEmptyHex(Array.from(perimeter.values()), localPoint, desired);
	}

	function nearestEmptyHex(candidates: CubeHex[], localPoint: Dot, desired: CubeHex): CubeHex | null {
		let target: CubeHex | null = null;
		let bestScore = Number.POSITIVE_INFINITY;
		for (const candidate of candidates) {
			if (!isOpenBubbleHex(candidate)) continue;
			const center = axialToPoint(candidate, HEX_SIZE);
			const score = distance(center, localPoint) + hexDistance(candidate, desired) * 5;
			if (score < bestScore) {
				target = candidate;
				bestScore = score;
			}
		}
		return target;
	}

	function isOpenBubbleHex(hex: CubeHex): boolean {
		return hexDistance(hex) > 0 && !game.bubbles.has(hexKey(hex));
	}

	function resolvePlacement(placed: Bubble | undefined) {
		if (!placed) return;
		const cluster = matchingCluster(placed);
		if (cluster.length < 3) {
			setFlash('no match', placed.color);
			registerFoul('foul');
			return;
		}

		const nextBubbles = new Map(game.bubbles);
		for (const bubble of cluster) nextBubbles.delete(bubble.id);
		game.bubbles = nextBubbles;
		game.matches += 1;
		game.score += cluster.length * 12;
		setFlash(`match ${cluster.length}`, placed.color);

		const orphans = collectOrphans();
		if (orphans.length > 0) {
			const anchored = new Map(game.bubbles);
			for (const orphan of orphans) anchored.delete(orphan.id);
			game.bubbles = anchored;
			game.orphans += orphans.length;
			game.score += orphans.length * 18;
			game.falling = [...game.falling, ...orphans.map((bubble) => fallingFrom(bubble))];
			setFlash(`drop ${orphans.length}`, 'ink');
		}

		if (game.bubbles.size === 0) {
			finish('complete');
			return;
		}
		checkGameOver();
	}

	function matchingCluster(start: Bubble): Bubble[] {
		const cluster: Bubble[] = [];
		const seen = new Set<string>();
		const queue: Bubble[] = [start];

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current || seen.has(current.id)) continue;
			seen.add(current.id);
			cluster.push(current);
			for (const neighbor of hexNeighbors(current)) {
				const match = game.bubbles.get(hexKey(neighbor));
				if (match && match.color === start.color && !seen.has(match.id)) queue.push(match);
			}
		}

		return cluster;
	}

	function collectOrphans(): Bubble[] {
		const anchored = anchoredKeys();
		return Array.from(game.bubbles.values()).filter((bubble) => !anchored.has(bubble.id));
	}

	function anchoredKeys(): Set<string> {
		const anchored = new Set<string>();
		const seen = new Set<string>([hexKey(ORIGIN)]);
		const queue: CubeHex[] = [ORIGIN];

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) continue;
			for (const neighbor of hexNeighbors(current)) {
				const key = hexKey(neighbor);
				if (seen.has(key)) continue;
				const bubble = game.bubbles.get(key);
				if (!bubble) continue;
				seen.add(key);
				anchored.add(key);
				queue.push(bubble);
			}
		}

		return anchored;
	}

	function registerFoul(label: string) {
		if (game.phase !== 'running') return;
		game.foulCount -= 1;
		setFlash(label, 'ink');
		if (game.foulCount > 0) {
			checkGameOver();
			return;
		}

		game.foulCount = FOUL_LIMIT;
		const added = spawnPenaltyLayer();
		const direction = Math.random() < 0.5 ? -1 : 1;
		game.angularVelocity = clamp(game.angularVelocity + direction * (0.34 + added * 0.018), -MAX_SPIN, MAX_SPIN);
		setFlash(`layer ${added}`, 'ink');
		checkGameOver();
	}

	function spawnPenaltyLayer(): number {
		const nextBubbles = new Map(game.bubbles);
		const radii = Array.from(nextBubbles.values()).map((bubble) => hexDistance(bubble));
		const outerRadius = Math.max(1, ...radii);
		const perimeter = new Map<string, CubeHex>();

		for (const bubble of nextBubbles.values()) {
			for (const neighbor of hexNeighbors(bubble)) {
				if (hexDistance(neighbor) < outerRadius) continue;
				if (hexDistance(neighbor) === 0) continue;
				const key = hexKey(neighbor);
				if (nextBubbles.has(key)) continue;
				perimeter.set(key, neighbor);
			}
		}

		const ordered = Array.from(perimeter.values()).sort((a, b) => {
			const pa = axialToPoint(a, HEX_SIZE);
			const pb = axialToPoint(b, HEX_SIZE);
			return Math.atan2(pa.y, pa.x) - Math.atan2(pb.y, pb.x);
		});

		for (const hex of ordered) addBubble(nextBubbles, hex, randomColor());
		game.bubbles = nextBubbles;
		return ordered.length;
	}

	function fallingFrom(bubble: Bubble): FallingBubble {
		const spot = worldPointForHex(bubble);
		return {
			id: ++fallingSeq,
			x: spot.x,
			y: spot.y,
			vx: (Math.random() - 0.5) * 94,
			vy: 72 + Math.random() * 96,
			color: bubble.color,
			life: 1.35,
			radius: BUBBLE_R
		};
	}

	function updateFalling(dt: number) {
		if (game.falling.length === 0) return;
		game.falling = game.falling
			.map((bubble) => ({
				...bubble,
				x: bubble.x + bubble.vx * dt,
				y: bubble.y + bubble.vy * dt,
				vy: bubble.vy + 320 * dt,
				life: bubble.life - dt
			}))
			.filter((bubble) => bubble.life > 0 && bubble.y < CANVAS_SIZE + 90);
	}

	function updateFlash(dt: number) {
		if (!game.flash) return;
		const next = { ...game.flash, life: game.flash.life - dt };
		game.flash = next.life > 0 ? next : null;
	}

	function setFlash(text: string, tone: FlashTone) {
		game.flash = { text, tone, life: 0.92 };
	}

	function checkGameOver() {
		if (game.phase !== 'running') return;
		for (const bubble of game.bubbles.values()) {
			const point = worldPointForHex(bubble);
			if (
				point.x - BUBBLE_R < SAFE_PADDING ||
				point.x + BUBBLE_R > CANVAS_SIZE - SAFE_PADDING ||
				point.y - BUBBLE_R < SAFE_PADDING ||
				point.y + BUBBLE_R > CANVAS_SIZE - SAFE_PADDING
			) {
				finish('over');
				return;
			}
		}
	}

	function fire() {
		if (game.phase !== 'running') {
			start();
			return;
		}
		if (game.projectile) return;
		aimAngle = safeAimAngle();
		const direction = normalize(Math.cos(aimAngle), Math.sin(aimAngle));
		game.projectile = {
			x: SHOOTER.x + direction.x * 28,
			y: SHOOTER.y + direction.y * 28,
			vx: direction.x * SHOT_SPEED,
			vy: direction.y * SHOT_SPEED,
			color: game.loadedColor
		};
		game.loadedColor = game.nextColor;
		game.nextColor = randomColor();
		draw();
	}

	function nudgeAim(direction: -1 | 1) {
		aimAngle = clamp(safeAimAngle() + direction * 0.15, MIN_AIM, MAX_AIM);
		draw();
	}

	function pointerToCanvas(event: PointerEvent): Dot {
		const rect = canvasEl.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE,
			y: ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE
		};
	}

	function setAim(point: Dot) {
		if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
		if (point.y <= SHOOTER.y + 10) return;
		const nextAngle = Math.atan2(point.y - SHOOTER.y, point.x - SHOOTER.x);
		if (!Number.isFinite(nextAngle)) return;
		aimAngle = clamp(nextAngle, MIN_AIM, MAX_AIM);
		draw();
	}

	function onPointerMove(event: PointerEvent) {
		setAim(pointerToCanvas(event));
	}

	function onPointerDown(event: PointerEvent) {
		canvasEl.setPointerCapture(event.pointerId);
		setAim(pointerToCanvas(event));
		if (game.phase !== 'running') {
			start();
			return;
		}
		fire();
	}

	function onPointerUp(event: PointerEvent) {
		if (canvasEl.hasPointerCapture(event.pointerId)) canvasEl.releasePointerCapture(event.pointerId);
	}

	function onKeyDown(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		if (key === 'arrowleft' || key === 'a') {
			event.preventDefault();
			nudgeAim(-1);
			return;
		}
		if (key === 'arrowright' || key === 'd') {
			event.preventDefault();
			nudgeAim(1);
			return;
		}
		if (key === ' ' || key === 'enter') {
			event.preventDefault();
			fire();
		}
	}

	function localPointForHex(hex: CubeHex): Dot {
		return axialToPoint(hex, HEX_SIZE);
	}

	function worldPointForHex(hex: CubeHex): Dot {
		const spun = rotate(localPointForHex(hex), game.angle);
		return { x: CENTER.x + spun.x, y: CENTER.y + spun.y };
	}

	function screenToLocal(point: Dot): Dot {
		return rotate({ x: point.x - CENTER.x, y: point.y - CENTER.y }, -game.angle);
	}

	function configureCanvas() {
		if (!canvasEl) return;
		pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
		canvasEl.width = CANVAS_SIZE * pixelRatio;
		canvasEl.height = CANVAS_SIZE * pixelRatio;
		context = canvasEl.getContext('2d');
		draw();
	}

	function draw() {
		const ctx = context;
		if (!ctx) return;
		ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		drawBackground(ctx);
		drawAimGuide(ctx);
		drawLinks(ctx);
		drawPivot(ctx);
		drawCluster(ctx);
		drawFalling(ctx);
		drawProjectile(ctx);
		drawShooter(ctx);
		drawCanvasHud(ctx);
		drawPhaseOverlay(ctx);
	}

	function drawBackground(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = '#fdf6e3';
		ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		ctx.strokeStyle = 'rgba(88, 110, 117, 0.14)';
		ctx.lineWidth = 1;
		for (let x = 34; x < CANVAS_SIZE; x += 34) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, CANVAS_SIZE);
			ctx.stroke();
		}
		for (let y = 34; y < CANVAS_SIZE; y += 34) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(CANVAS_SIZE, y);
			ctx.stroke();
		}

		ctx.save();
		ctx.translate(CENTER.x, CENTER.y);
		ctx.strokeStyle = 'rgba(181, 137, 0, 0.22)';
		ctx.lineWidth = 1.2;
		for (let radius = HEX_SIZE * Math.sqrt(3); radius < CANVAS_SIZE / 2 - 26; radius += HEX_SIZE * Math.sqrt(3)) {
			ctx.beginPath();
			ctx.arc(0, 0, radius, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.restore();

		ctx.strokeStyle = 'rgba(7, 54, 66, 0.45)';
		ctx.lineWidth = 3;
		roundedRect(ctx, SAFE_PADDING, SAFE_PADDING, CANVAS_SIZE - SAFE_PADDING * 2, CANVAS_SIZE - SAFE_PADDING * 2, 8);
		ctx.stroke();
	}

	function drawAimGuide(ctx: CanvasRenderingContext2D) {
		if (game.phase !== 'running' || game.projectile) return;
		const points = traceAimGuide();
		ctx.save();
		ctx.strokeStyle = 'rgba(38, 139, 210, 0.42)';
		ctx.lineWidth = 2.2;
		ctx.setLineDash([8, 8]);
		ctx.beginPath();
		points.forEach((point, index) => {
			if (index === 0) ctx.moveTo(point.x, point.y);
			else ctx.lineTo(point.x, point.y);
		});
		ctx.stroke();
		ctx.restore();
	}

	function traceAimGuide(): Dot[] {
		const points: Dot[] = [{ x: SHOOTER.x, y: SHOOTER.y }];
		let x = SHOOTER.x;
		let y = SHOOTER.y;
		const angle = safeAimAngle();
		let vx = Math.cos(angle) * 22;
		const vy = Math.sin(angle) * 22;
		for (let step = 0; step < 23; step += 1) {
			x += vx;
			y += vy;
			if (x <= BUBBLE_R + SAFE_PADDING) {
				x = BUBBLE_R + SAFE_PADDING;
				vx = Math.abs(vx);
			} else if (x >= CANVAS_SIZE - BUBBLE_R - SAFE_PADDING) {
				x = CANVAS_SIZE - BUBBLE_R - SAFE_PADDING;
				vx = -Math.abs(vx);
			}
			points.push({ x, y });
		}
		return points;
	}

	function drawLinks(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.strokeStyle = 'rgba(101, 123, 131, 0.22)';
		ctx.lineWidth = 2;
		for (const bubble of game.bubbles.values()) {
			const from = worldPointForHex(bubble);
			if (hexDistance(bubble) === 1) {
				ctx.beginPath();
				ctx.moveTo(CENTER.x, CENTER.y);
				ctx.lineTo(from.x, from.y);
				ctx.stroke();
			}
			for (const neighbor of hexNeighbors(bubble)) {
				const next = game.bubbles.get(hexKey(neighbor));
				if (!next || next.id <= bubble.id) continue;
				const to = worldPointForHex(next);
				ctx.beginPath();
				ctx.moveTo(from.x, from.y);
				ctx.lineTo(to.x, to.y);
				ctx.stroke();
			}
		}
		ctx.restore();
	}

	function drawPivot(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.translate(CENTER.x, CENTER.y);
		ctx.rotate(game.angle * 0.72);
		ctx.fillStyle = '#eee8d5';
		ctx.strokeStyle = '#073642';
		ctx.lineWidth = 3;
		ctx.beginPath();
		for (let i = 0; i < 6; i += 1) {
			const angle = -Math.PI / 6 + (Math.PI * 2 * i) / 6;
			const x = Math.cos(angle) * 18;
			const y = Math.sin(angle) * 18;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}

	function drawCluster(ctx: CanvasRenderingContext2D) {
		for (const bubble of game.bubbles.values()) {
			const point = worldPointForHex(bubble);
			drawBubble(ctx, point.x, point.y, bubble.color, BUBBLE_R, 1);
		}
	}

	function drawFalling(ctx: CanvasRenderingContext2D) {
		for (const bubble of game.falling) {
			drawBubble(ctx, bubble.x, bubble.y, bubble.color, bubble.radius, clamp(bubble.life, 0, 1));
		}
	}

	function drawProjectile(ctx: CanvasRenderingContext2D) {
		if (!game.projectile) return;
		drawBubble(ctx, game.projectile.x, game.projectile.y, game.projectile.color, BUBBLE_R, 1);
	}

	function drawShooter(ctx: CanvasRenderingContext2D) {
		const angle = safeAimAngle();
		const direction = normalize(Math.cos(angle), Math.sin(angle));
		ctx.save();
		ctx.strokeStyle = '#586e75';
		ctx.lineWidth = 11;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(SHOOTER.x, SHOOTER.y);
		ctx.lineTo(SHOOTER.x + direction.x * 46, SHOOTER.y + direction.y * 46);
		ctx.stroke();
		ctx.fillStyle = '#073642';
		ctx.beginPath();
		ctx.arc(SHOOTER.x, SHOOTER.y, 20, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = 'rgba(253, 246, 227, 0.86)';
		ctx.lineWidth = 3;
		ctx.stroke();
		ctx.restore();

		drawBubble(ctx, SHOOTER.x + direction.x * 30, SHOOTER.y + direction.y * 30, game.loadedColor, BUBBLE_R - 1, 1);
	}

	function drawCanvasHud(ctx: CanvasRenderingContext2D) {
		drawHudBox(ctx, 18, 18, 152, 72);
		drawHudText(ctx, 'score', 34, 43, 11);
		drawHudText(ctx, `${game.score}`, 34, 72, 26, '#073642', 'counter');

		drawHudBox(ctx, CANVAS_SIZE - 190, 18, 172, 72);
		drawHudText(ctx, 'next', CANVAS_SIZE - 174, 43, 11);
		drawBubble(ctx, CANVAS_SIZE - 126, 60, game.nextColor, 11, 1);
		drawHudText(ctx, COLOR_SWATCHES[game.nextColor].name, CANVAS_SIZE - 106, 65, 17, '#073642', 'counter');

		drawHudBox(ctx, 18, CANVAS_SIZE - 78, 158, 58);
		drawHudText(ctx, 'fouls', 34, CANVAS_SIZE - 53, 11);
		drawHudText(ctx, `${game.foulCount}/${FOUL_LIMIT}`, 92, CANVAS_SIZE - 43, 24, '#073642', 'counter');

		if (game.flash) {
			const alpha = clamp(game.flash.life, 0, 1);
			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.fillStyle = game.flash.tone === 'ink' ? '#073642' : COLOR_SWATCHES[game.flash.tone].dark;
			ctx.font = '26px var(--font-counter)';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(game.flash.text, CENTER.x, CENTER.y - 54);
			ctx.restore();
		}
	}

	function drawHudBox(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
		ctx.save();
		ctx.fillStyle = 'rgba(253, 246, 227, 0.88)';
		ctx.strokeStyle = 'rgba(101, 123, 131, 0.34)';
		ctx.lineWidth = 1.4;
		roundedRect(ctx, x, y, width, height, 6);
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}

	function drawHudText(
		ctx: CanvasRenderingContext2D,
		text: string,
		x: number,
		y: number,
		size: number,
		color = '#657b83',
		family: 'ui' | 'counter' = 'ui'
	) {
		ctx.save();
		ctx.fillStyle = color;
		ctx.font = `${size}px var(${family === 'counter' ? '--font-counter' : '--font-ui'})`;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, x, y);
		ctx.restore();
	}

	function drawPhaseOverlay(ctx: CanvasRenderingContext2D) {
		if (game.phase === 'running') return;
		ctx.save();
		ctx.fillStyle = 'rgba(253, 246, 227, 0.78)';
		ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		ctx.fillStyle = '#073642';
		ctx.font = '46px var(--font-counter)';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(centerTitle(), CENTER.x, CENTER.y - 18);
		ctx.font = '16px var(--font-body)';
		ctx.fillStyle = '#586e75';
		ctx.fillText(centerSubtitle(), CENTER.x, CENTER.y + 26);
		ctx.restore();
	}

	function centerTitle(): string {
		if (game.phase === 'complete') return awarded > 0 ? `+${fmt(awarded)} insight` : 'clear';
		if (game.phase === 'over') return 'game over';
		return 'Bubble Spinner';
	}

	function centerSubtitle(): string {
		if (game.phase === 'ready') return `${bubbleCount} bubbles at the pivot`;
		return `score ${game.score} / best ${best} / rounds ${rounds}`;
	}

	function drawBubble(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		color: BubbleColor,
		radius: number,
		alpha: number
	) {
		const swatch = COLOR_SWATCHES[color];
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.fillStyle = 'rgba(7, 54, 66, 0.14)';
		ctx.beginPath();
		ctx.ellipse(x, y + radius * 0.28, radius * 0.86, radius * 0.62, 0, 0, Math.PI * 2);
		ctx.fill();
		const gradient = ctx.createRadialGradient(
			x - radius * 0.38,
			y - radius * 0.44,
			radius * 0.12,
			x,
			y,
			radius
		);
		gradient.addColorStop(0, '#fff8d8');
		gradient.addColorStop(0.26, swatch.light);
		gradient.addColorStop(0.72, swatch.fill);
		gradient.addColorStop(1, swatch.dark);
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = 'rgba(253, 246, 227, 0.9)';
		ctx.lineWidth = 2.2;
		ctx.stroke();
		ctx.fillStyle = 'rgba(253, 246, 227, 0.55)';
		ctx.beginPath();
		ctx.arc(x - radius * 0.34, y - radius * 0.4, radius * 0.22, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
		const r = Math.min(radius, width / 2, height / 2);
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + width - r, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + r);
		ctx.lineTo(x + width, y + height - r);
		ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
		ctx.lineTo(x + r, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
	}

	onMount(() => {
		configureCanvas();
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('resize', configureCanvas);
		return () => {
			stop();
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('resize', configureCanvas);
		};
	});

	onDestroy(() => {
		stop();
	});
</script>

<div class="spinner-shell">
	<div class="spinner-bar">
		<div class="game-id">
			<span class="game-name">Bubble Spinner</span>
			<span class="game-hint">{hintLabel}</span>
		</div>
		<div class="score-group">
			<div class="score-box">
				<span class="score-label">score</span>
				<span class="score-val">{game.score}</span>
			</div>
			<div class="score-box live">
				<span class="score-label">fouls</span>
				<span class="score-val">{game.foulCount}</span>
			</div>
			<div class="score-box">
				<span class="score-label">spin</span>
				<span class="score-val">{spinLabel}</span>
			</div>
			<div class="score-box">
				<span class="score-label">prize</span>
				<span class="score-val">{prizeLabel}</span>
			</div>
		</div>
		<div class="btn-group">
			<button class="ctrl-btn" onclick={start}>{startLabel}</button>
			<button class="ctrl-btn back" onclick={onclose}>arcade</button>
		</div>
	</div>

	<canvas
		bind:this={canvasEl}
		class="spinner-canvas"
		class:active={game.phase === 'running'}
		aria-label="Bubble Spinner arena"
		onpointermove={onPointerMove}
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
	></canvas>

	<div class="control-row" aria-label="spinner controls">
		<button onclick={() => nudgeAim(-1)}>left</button>
		<button class="fire-btn" onclick={fire}>fire</button>
		<button onclick={() => nudgeAim(1)}>right</button>
	</div>
</div>

<style>
	.spinner-shell {
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}
	.spinner-bar {
		width: 100%;
		max-width: 620px;
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
		background: color-mix(in srgb, var(--sol-base2) 68%, var(--sol-yellow));
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
	.control-row button {
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
	.control-row button:hover {
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
	.spinner-canvas {
		width: min(600px, calc(100vw - 3rem));
		aspect-ratio: 1 / 1;
		border: 1px solid var(--sol-base2);
		border-radius: 6px;
		background: var(--sol-base2);
		box-shadow:
			inset 0 0 0 6px rgba(7, 54, 66, 0.05),
			0 8px 24px rgba(7, 54, 66, 0.08);
		touch-action: none;
		user-select: none;
	}
	.spinner-canvas.active {
		cursor: crosshair;
	}
	.control-row {
		width: min(600px, 100%);
		display: flex;
		justify-content: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.control-row button {
		background: var(--sol-base2);
		color: var(--sol-base0);
		min-width: 5.2rem;
	}
	.control-row button:hover {
		background: var(--sol-blue);
		color: var(--sol-base3);
	}
	.control-row .fire-btn {
		background: var(--sol-yellow);
		color: var(--sol-base3);
	}
	.control-row .fire-btn:hover {
		background: var(--sol-orange);
	}
	@media (max-width: 560px) {
		.spinner-bar {
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
	}
</style>

