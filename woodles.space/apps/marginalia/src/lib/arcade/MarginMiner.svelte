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

	type ClawMode = 'swinging' | 'firing' | 'reeling';
	type RoundPhase = 'playing' | 'level-clear' | 'game-over';
	type MineKind = 'small-gold' | 'large-gold' | 'small-rock' | 'large-rock' | 'diamond' | 'mystery-bag';
	type WeightClass = 'Very Light' | 'Light' | 'Medium' | 'Heavy' | 'Very Heavy' | 'Unknown';

	interface MineObject {
		id: number;
		kind: MineKind;
		name: string;
		value: number;
		weight: number;
		weightClass: WeightClass;
		x: number;
		y: number;
		radius: number;
		collisionRadius: number;
		spin: number;
		captured: boolean;
	}

	interface FloatingText {
		id: number;
		x: number;
		y: number;
		text: string;
		age: number;
		tone: 'good' | 'bad' | 'plain';
	}

	const WIDTH = 800;
	const HEIGHT = 600;
	const LEVEL_SECONDS = 60;
	const UI_HEIGHT = 58;
	const SURFACE_Y = 128;
	const ORIGIN_X = WIDTH / 2;
	const ORIGIN_Y = 104;
	const IDLE_LENGTH = 58;
	const CLAW_RADIUS = 13;
	const MAX_SWING = (70 * Math.PI) / 180;
	const SWING_SPEED = 1.62;
	const FIRE_SPEED = 520;
	const EMPTY_RETRACT_SPEED = 560;
	const BASE_RETRACT_SPEED = 430;
	const WEIGHT_MULTIPLIER = 52;
	const MIN_RETRACT_SPEED = 42;
	const GAME_ID = 'margin-miner';
	const scoreOnlyLabel = scoreOnlyReason(GAME_ID) ? 'score only' : '-';

	const weights = {
		veryLight: 0.25,
		light: 1.2,
		medium: 4.6,
		heavy: 6.5,
		veryHeavy: 7.25
	};

	const mineSpecs: Record<
		Exclude<MineKind, 'mystery-bag'>,
		{
			name: string;
			value: number;
			weight: number;
			weightClass: WeightClass;
			radius: number;
			collisionRadius: number;
		}
	> = {
		'small-gold': {
			name: 'Small Gold',
			value: 50,
			weight: weights.light,
			weightClass: 'Light',
			radius: 18,
			collisionRadius: 19
		},
		'large-gold': {
			name: 'Large Gold',
			value: 500,
			weight: weights.medium,
			weightClass: 'Medium',
			radius: 35,
			collisionRadius: 36
		},
		'small-rock': {
			name: 'Small Rock',
			value: 11,
			weight: weights.heavy,
			weightClass: 'Heavy',
			radius: 21,
			collisionRadius: 22
		},
		'large-rock': {
			name: 'Large Rock',
			value: 20,
			weight: weights.veryHeavy,
			weightClass: 'Very Heavy',
			radius: 37,
			collisionRadius: 38
		},
		diamond: {
			name: 'Diamond',
			value: 600,
			weight: weights.veryLight,
			weightClass: 'Very Light',
			radius: 14,
			collisionRadius: 16
		}
	};

	let canvasEl: HTMLCanvasElement;
	let context: CanvasRenderingContext2D | null = null;
	let rafId: number | null = null;
	let lastFrameAt = 0;
	let swingTime = 0;
	let lockedAngle = Math.PI / 2;
	let currentLength = IDLE_LENGTH;
	let caughtObject: MineObject | null = null;
	let objects: MineObject[] = [];
	let floaters: FloatingText[] = [];
	let levelEndsAt = 0;
	let objectSeq = 0;
	let floaterSeq = 0;

	let phase = $state<RoundPhase>('playing');
	let clawMode = $state<ClawMode>('swinging');
	let level = $state(1);
	let score = $state(0);
	let targetScore = $state(targetForLevel(1));
	let best = $state(loadArcadeRecord(GAME_ID).bestScore);
	let remaining = $state(LEVEL_SECONDS);
	let objectCount = $state(0);
	let lastHaul = $state('Click, tap, or press Down to fire.');
	let extensions = $state(0);
	let extensionsUsed = $state(0);

	const bodyTier = $derived(statTier(coreStatValue(activePet, 'body')));
	const mindTier = $derived(statTier(coreStatValue(activePet, 'mind')));
	const graceTier = $derived(statTier(coreStatValue(activePet, 'grace')));
	const heartTier = $derived(statTier(coreStatValue(activePet, 'heart')));
	const swingSpeed = $derived(SWING_SPEED * (1 - graceTier * 0.07));
	const clawCatchRadius = $derived(CLAW_RADIUS + graceTier * 3);
	const extensionSeconds = $derived(5 + heartTier * 2);
	const extensionMargin = $derived(180 + heartTier * 140);
	const scoreText = $derived(formatMoney(score));
	const targetText = $derived(formatMoney(targetScore));
	const bestText = $derived(formatMoney(Math.max(score, best)));
	const timerText = $derived(Math.ceil(remaining).toString().padStart(2, '0'));
	const stateLabel = $derived.by(() => {
		if (phase === 'level-clear') return 'CLEAR';
		if (phase === 'game-over') return 'GAME OVER';
		return clawMode.toUpperCase();
	});
	const modeClass = $derived(`mode-${phase === 'playing' ? clawMode : phase}`);
	const nextTargetText = $derived(formatMoney(targetForLevel(level + 1)));
	const shortfallText = $derived(formatMoney(Math.max(0, targetScore - score)));
	const scanLabel = $derived.by(() => {
		const scan = scannedObject();
		if (!scan) return mindTier > 0 ? 'scan waiting' : 'scan hidden';
		return `${scan.name}: ${formatMoney(scan.value)} / ${scan.weightClass}`;
	});
	const statEffects = $derived<ArcadeStatEffects>({
		body: (_value, tier) => (tier > 0 ? `heavy reel +${tier}` : 'standard reel'),
		mind: (_value, tier) => (tier > 0 ? 'value/weight scan' : 'no scan'),
		grace: (_value, tier) => (tier > 0 ? `catch radius +${tier * 3}` : 'sharp claw'),
		heart: (_value, tier) => (tier > 0 ? 'close-target extension' : 'strict timer')
	});

	function targetForLevel(value: number): number {
		return Math.round(650 + (value - 1) * 850 + Math.pow(value - 1, 2) * 180);
	}

	function formatMoney(value: number): string {
		return `$${Math.round(value).toLocaleString()}`;
	}

	function randomBetween(min: number, max: number): number {
		return min + Math.random() * (max - min);
	}

	function randomInt(min: number, max: number): number {
		return Math.floor(randomBetween(min, max + 1));
	}

	function currentFireAngle(): number {
		return Math.PI / 2 + Math.sin(swingTime * swingSpeed) * MAX_SWING;
	}

	function clawAngle(): number {
		return clawMode === 'swinging' ? currentFireAngle() : lockedAngle;
	}

	function clawPosition() {
		const angle = clawAngle();
		return {
			x: ORIGIN_X + Math.cos(angle) * currentLength,
			y: ORIGIN_Y + Math.sin(angle) * currentLength
		};
	}

	function reelSpeed(object: MineObject | null): number {
		if (!object) return EMPTY_RETRACT_SPEED;
		return Math.max(
			MIN_RETRACT_SPEED,
			BASE_RETRACT_SPEED + bodyTier * 38 - object.weight * WEIGHT_MULTIPLIER
		);
	}

	function scannedObject(): MineObject | null {
		if (mindTier === 0 || phase !== 'playing' || clawMode !== 'swinging') return null;
		const angle = currentFireAngle();
		const ux = Math.cos(angle);
		const uy = Math.sin(angle);
		let bestObject: MineObject | null = null;
		let bestProjection = Number.POSITIVE_INFINITY;

		for (const object of objects) {
			if (object.captured) continue;
			const dx = object.x - ORIGIN_X;
			const dy = object.y - ORIGIN_Y;
			const projection = dx * ux + dy * uy;
			if (projection < IDLE_LENGTH || projection > HEIGHT - ORIGIN_Y) continue;
			const perpendicular = Math.abs(dx * -uy + dy * ux);
			if (perpendicular > object.collisionRadius + 18 + mindTier * 8) continue;
			if (projection < bestProjection) {
				bestProjection = projection;
				bestObject = object;
			}
		}

		return bestObject;
	}

	function createMineObject(kind: MineKind): MineObject {
		const spec =
			kind === 'mystery-bag'
				? {
						name: 'Mystery Bag',
						value: randomInt(2, 800),
						weight: randomBetween(0.4, 7.4),
						weightClass: 'Unknown' as WeightClass,
						radius: 22,
						collisionRadius: 23
					}
				: mineSpecs[kind];

		return {
			id: ++objectSeq,
			kind,
			name: spec.name,
			value: spec.value,
			weight: spec.weight,
			weightClass: spec.weightClass,
			x: 0,
			y: 0,
			radius: spec.radius,
			collisionRadius: spec.collisionRadius,
			spin: randomBetween(-0.7, 0.7),
			captured: false
		};
	}

	function addPlacedObject(result: MineObject[], kind: MineKind) {
		const object = createMineObject(kind);
		const minY = SURFACE_Y + object.radius + 38;
		const maxY = HEIGHT - object.radius - 18;
		const minX = object.radius + 22;
		const maxX = WIDTH - object.radius - 22;

		for (let attempt = 0; attempt < 280; attempt += 1) {
			const x = randomBetween(minX, maxX);
			const y = randomBetween(minY, maxY);
			const separated = result.every((other) => {
				const padding = object.kind === 'large-rock' || other.kind === 'large-rock' ? 15 : 10;
				return Math.hypot(x - other.x, y - other.y) > object.radius + other.radius + padding;
			});

			if (separated) {
				object.x = x;
				object.y = y;
				result.push(object);
				return;
			}
		}

		object.x = randomBetween(minX, maxX);
		object.y = randomBetween(minY, maxY);
		result.push(object);
	}

	function spawnObjects(forLevel: number): MineObject[] {
		const result: MineObject[] = [];
		const plan: Array<[MineKind, number]> = [
			['small-gold', 6 + forLevel],
			['large-gold', 2 + Math.ceil(forLevel / 2)],
			['small-rock', 4 + forLevel],
			['large-rock', 2 + Math.floor(forLevel / 2)],
			['diamond', 1 + Math.floor(forLevel / 3)],
			['mystery-bag', 1 + Math.floor(forLevel / 2)]
		];

		for (const [kind, count] of plan) {
			for (let i = 0; i < count; i += 1) addPlacedObject(result, kind);
		}

		return result.sort((a, b) => a.y - b.y);
	}

	function startLevel(nextLevel: number) {
		level = nextLevel;
		targetScore = targetForLevel(nextLevel);
		remaining = LEVEL_SECONDS;
		phase = 'playing';
		clawMode = 'swinging';
		currentLength = IDLE_LENGTH;
		caughtObject = null;
		objects = spawnObjects(nextLevel);
		objectCount = objects.length;
		floaters = [];
		levelEndsAt = performance.now() + LEVEL_SECONDS * 1000;
		lastHaul = 'Click, tap, or press Down to fire.';
		extensions = heartTier > 0 ? 1 : 0;
		extensionsUsed = 0;
	}

	function resetRun() {
		score = 0;
		swingTime = 0;
		lockedAngle = Math.PI / 2;
		objectSeq = 0;
		floaterSeq = 0;
		startLevel(1);
	}

	function fireClaw() {
		if (phase !== 'playing' || clawMode !== 'swinging') return;
		lockedAngle = currentFireAngle();
		currentLength = IDLE_LENGTH;
		caughtObject = null;
		clawMode = 'firing';
		lastHaul = 'Claw away.';
	}

	function handlePointer(event: PointerEvent) {
		event.preventDefault();
		fireClaw();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowDown') return;
		event.preventDefault();
		fireClaw();
	}

	function finishLevel() {
		if (phase !== 'playing') return;
		remaining = 0;
		if (score >= targetScore) {
			phase = 'level-clear';
			lastHaul = `Level ${level} cleared. Next target ${formatMoney(targetForLevel(level + 1))}.`;
			recordRun('level-clear');
		} else {
			const shortfall = targetScore - score;
			if (extensions > 0 && shortfall <= extensionMargin) {
				extensions -= 1;
				extensionsUsed += 1;
				remaining = extensionSeconds;
				levelEndsAt = performance.now() + extensionSeconds * 1000;
				lastHaul = `Heart extension: ${extensionSeconds}s to find ${formatMoney(shortfall)}.`;
				addFloater(ORIGIN_X, ORIGIN_Y + 34, `+${extensionSeconds}s`, 'plain');
				return;
			}
			phase = 'game-over';
			lastHaul = `Short by ${formatMoney(targetScore - score)}.`;
			recordRun('game-over');
		}
	}

	function recordRun(outcome: Exclude<RoundPhase, 'playing'>) {
		const record = recordArcadeRun(GAME_ID, {
			score,
			summary: {
				level,
				target: targetScore,
				outcome,
				objects: objectCount,
				extensions: extensionsUsed,
				scoreOnly: true
			}
		});
		best = record.bestScore;
	}

	function beginReel(object: MineObject | null) {
		caughtObject = object;
		if (caughtObject) {
			caughtObject.captured = true;
			lastHaul = `${caughtObject.name}: ${formatMoney(caughtObject.value)} / ${caughtObject.weightClass}.`;
		} else {
			lastHaul = 'Nothing but air.';
		}
		clawMode = 'reeling';
	}

	function completeReel() {
		currentLength = IDLE_LENGTH;

		if (caughtObject) {
			score += caughtObject.value;
			addFloater(ORIGIN_X, ORIGIN_Y + 16, `+${formatMoney(caughtObject.value)}`, caughtObject.value <= 20 ? 'bad' : 'good');
			objects = objects.filter((object) => object.id !== caughtObject?.id);
			objectCount = objects.length;
			lastHaul = `${caughtObject.name} banked for ${formatMoney(caughtObject.value)}.`;
			caughtObject = null;
		}

		clawMode = 'swinging';
	}

	function addFloater(x: number, y: number, text: string, tone: FloatingText['tone']) {
		floaters = [...floaters, { id: ++floaterSeq, x, y, text, age: 0, tone }];
	}

	function updateFloaters(dt: number) {
		floaters = floaters
			.map((floater) => ({ ...floater, age: floater.age + dt, y: floater.y - 20 * dt }))
			.filter((floater) => floater.age < 1.1);
	}

	function updateGame(dt: number, timestamp: number) {
		updateFloaters(dt);
		if (phase !== 'playing') return;

		remaining = Math.max(0, (levelEndsAt - timestamp) / 1000);
		if (remaining <= 0) {
			finishLevel();
			return;
		}

		if (clawMode === 'swinging') {
			swingTime += dt;
			return;
		}

		const angle = clawAngle();

		if (clawMode === 'firing') {
			currentLength += FIRE_SPEED * dt;

			const nextClaw = clawPosition();
			const hit = objects.find((object) => {
				if (object.captured) return false;
				return Math.hypot(nextClaw.x - object.x, nextClaw.y - object.y) <= clawCatchRadius + object.collisionRadius;
			});

			if (hit) {
				beginReel(hit);
				return;
			}

			if (
				nextClaw.x <= CLAW_RADIUS ||
				nextClaw.x >= WIDTH - CLAW_RADIUS ||
				nextClaw.y <= UI_HEIGHT ||
				nextClaw.y >= HEIGHT - CLAW_RADIUS
			) {
				beginReel(null);
			}

			return;
		}

		if (clawMode === 'reeling') {
			const speed = reelSpeed(caughtObject);
			currentLength -= speed * dt;
			if (caughtObject) {
				caughtObject.x = ORIGIN_X + Math.cos(angle) * currentLength;
				caughtObject.y = ORIGIN_Y + Math.sin(angle) * currentLength + caughtObject.radius * 0.12;
			}

			if (currentLength <= IDLE_LENGTH) completeReel();
		}
	}

	function draw() {
		if (!context) return;
		const ctx = context;
		ctx.clearRect(0, 0, WIDTH, HEIGHT);
		drawWorld(ctx);
		drawObjects(ctx);
		drawWinch(ctx);
		drawScan(ctx);
		drawLineAndClaw(ctx);
		drawFloaters(ctx);
		drawCanvasHud(ctx);
		if (phase !== 'playing') drawCanvasEndState(ctx);
	}

	function drawWorld(ctx: CanvasRenderingContext2D) {
		const sky = ctx.createLinearGradient(0, UI_HEIGHT, 0, SURFACE_Y);
		sky.addColorStop(0, '#fdf6e3');
		sky.addColorStop(1, '#eee8d5');
		ctx.fillStyle = sky;
		ctx.fillRect(0, UI_HEIGHT, WIDTH, SURFACE_Y - UI_HEIGHT);

		ctx.fillStyle = '#073642';
		ctx.fillRect(0, SURFACE_Y - 8, WIDTH, 12);

		const soil = ctx.createLinearGradient(0, SURFACE_Y, 0, HEIGHT);
		soil.addColorStop(0, '#b58900');
		soil.addColorStop(0.4, '#8d6a19');
		soil.addColorStop(1, '#473516');
		ctx.fillStyle = soil;
		ctx.fillRect(0, SURFACE_Y, WIDTH, HEIGHT - SURFACE_Y);

		ctx.globalAlpha = 0.18;
		ctx.strokeStyle = '#fdf6e3';
		ctx.lineWidth = 1;
		for (let y = SURFACE_Y + 42; y < HEIGHT; y += 54) {
			ctx.beginPath();
			for (let x = 0; x <= WIDTH; x += 48) {
				const wave = Math.sin(x * 0.025 + y * 0.03) * 5;
				if (x === 0) ctx.moveTo(x, y + wave);
				else ctx.lineTo(x, y + wave);
			}
			ctx.stroke();
		}
		ctx.globalAlpha = 1;

		ctx.fillStyle = '#2aa198';
		ctx.fillRect(0, SURFACE_Y - 3, WIDTH, 6);
	}

	function drawCanvasHud(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = '#073642';
		ctx.fillRect(0, 0, WIDTH, UI_HEIGHT);
		ctx.fillStyle = '#0f4653';
		ctx.fillRect(0, UI_HEIGHT - 5, WIDTH, 5);
		ctx.fillStyle = '#fdf6e3';
		ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
		ctx.textBaseline = 'middle';
		ctx.fillText(`SCORE ${scoreText}`, 24, 29);
		ctx.fillText(`TARGET ${targetText}`, 252, 29);
		ctx.fillText(`TIME ${timerText}`, 520, 29);
		ctx.fillText(`LEVEL ${level}`, 680, 29);
	}

	function drawWinch(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.translate(ORIGIN_X, ORIGIN_Y);

		ctx.fillStyle = '#eee8d5';
		ctx.strokeStyle = '#073642';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(-54, 24);
		ctx.lineTo(54, 24);
		ctx.lineTo(42, -22);
		ctx.lineTo(-42, -22);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();

		ctx.fillStyle = '#cb4b16';
		ctx.fillRect(-66, 24, 132, 12);
		ctx.strokeRect(-66, 24, 132, 12);

		ctx.fillStyle = '#586e75';
		ctx.beginPath();
		ctx.arc(0, 0, 25, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		ctx.strokeStyle = '#fdf6e3';
		ctx.lineWidth = 3;
		for (let spoke = 0; spoke < 6; spoke += 1) {
			const angle = spoke * (Math.PI / 3) + swingTime * 0.4;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(Math.cos(angle) * 21, Math.sin(angle) * 21);
			ctx.stroke();
		}

		ctx.restore();
	}

	function drawScan(ctx: CanvasRenderingContext2D) {
		const scan = scannedObject();
		if (!scan) return;
		ctx.save();
		ctx.strokeStyle = 'rgba(42, 161, 152, 0.58)';
		ctx.fillStyle = 'rgba(42, 161, 152, 0.16)';
		ctx.lineWidth = 2;
		ctx.setLineDash([7, 6]);
		ctx.beginPath();
		ctx.moveTo(ORIGIN_X, ORIGIN_Y);
		ctx.lineTo(scan.x, scan.y);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.arc(scan.x, scan.y, scan.collisionRadius + 8, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}

	function drawLineAndClaw(ctx: CanvasRenderingContext2D) {
		const claw = clawPosition();
		const angle = clawAngle();

		ctx.strokeStyle = '#1e1b13';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(ORIGIN_X, ORIGIN_Y);
		ctx.lineTo(claw.x, claw.y);
		ctx.stroke();

		ctx.save();
		ctx.translate(claw.x, claw.y);
		ctx.rotate(angle - Math.PI / 2);

		ctx.strokeStyle = '#073642';
		ctx.lineWidth = 5;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(0, -18);
		ctx.lineTo(0, 4);
		ctx.stroke();

		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(0, 3);
		ctx.quadraticCurveTo(-19, 12, -18, 28);
		ctx.moveTo(0, 3);
		ctx.quadraticCurveTo(19, 12, 18, 28);
		ctx.stroke();

		ctx.fillStyle = '#eee8d5';
		ctx.strokeStyle = '#073642';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(0, 2, 9, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		ctx.restore();
	}

	function drawObjects(ctx: CanvasRenderingContext2D) {
		for (const object of objects) drawMineObject(ctx, object);
	}

	function drawMineObject(ctx: CanvasRenderingContext2D, object: MineObject) {
		ctx.save();
		ctx.translate(object.x, object.y);
		ctx.rotate(object.spin);

		if (object.kind === 'small-gold' || object.kind === 'large-gold') {
			const gradient = ctx.createRadialGradient(-object.radius * 0.35, -object.radius * 0.35, 3, 0, 0, object.radius);
			gradient.addColorStop(0, '#fff4a7');
			gradient.addColorStop(0.38, '#ffd447');
			gradient.addColorStop(1, '#b58900');
			ctx.fillStyle = gradient;
			ctx.strokeStyle = '#6f5300';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(0, 0, object.radius, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = 'rgba(253, 246, 227, 0.58)';
			ctx.beginPath();
			ctx.arc(-object.radius * 0.35, -object.radius * 0.38, object.radius * 0.24, 0, Math.PI * 2);
			ctx.fill();
		} else if (object.kind === 'small-rock' || object.kind === 'large-rock') {
			ctx.fillStyle = object.kind === 'large-rock' ? '#657b83' : '#93a1a1';
			ctx.strokeStyle = '#073642';
			ctx.lineWidth = 2;
			ctx.beginPath();
			const sides = object.kind === 'large-rock' ? 8 : 7;
			for (let i = 0; i < sides; i += 1) {
				const angle = (i / sides) * Math.PI * 2;
				const wobble = object.radius * (0.78 + (i % 3) * 0.11);
				const x = Math.cos(angle) * wobble;
				const y = Math.sin(angle) * wobble;
				if (i === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		} else if (object.kind === 'diamond') {
			ctx.fillStyle = '#8ee9ff';
			ctx.strokeStyle = '#268bd2';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(0, -object.radius);
			ctx.lineTo(object.radius * 0.86, 0);
			ctx.lineTo(0, object.radius);
			ctx.lineTo(-object.radius * 0.86, 0);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.strokeStyle = 'rgba(253, 246, 227, 0.85)';
			ctx.beginPath();
			ctx.moveTo(0, -object.radius + 3);
			ctx.lineTo(0, object.radius - 4);
			ctx.stroke();
		} else {
			ctx.fillStyle = '#d33682';
			ctx.strokeStyle = '#073642';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.ellipse(0, 4, object.radius * 0.78, object.radius * 0.95, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = '#eee8d5';
			ctx.fillRect(-object.radius * 0.5, -object.radius * 0.62, object.radius, object.radius * 0.3);
			ctx.strokeRect(-object.radius * 0.5, -object.radius * 0.62, object.radius, object.radius * 0.3);
			ctx.fillStyle = '#073642';
			ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('?', 0, 7);
		}

		ctx.restore();
	}

	function drawFloaters(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = '700 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
		for (const floater of floaters) {
			const alpha = Math.max(0, 1 - floater.age / 1.1);
			ctx.globalAlpha = alpha;
			ctx.fillStyle = floater.tone === 'good' ? '#fdf6e3' : floater.tone === 'bad' ? '#dc322f' : '#93a1a1';
			ctx.strokeStyle = 'rgba(7, 54, 66, 0.72)';
			ctx.lineWidth = 4;
			ctx.strokeText(floater.text, floater.x, floater.y);
			ctx.fillText(floater.text, floater.x, floater.y);
		}
		ctx.restore();
	}

	function drawCanvasEndState(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.fillStyle = 'rgba(7, 54, 66, 0.76)';
		ctx.fillRect(0, UI_HEIGHT, WIDTH, HEIGHT - UI_HEIGHT);
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#fdf6e3';
		ctx.font = '700 52px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
		ctx.fillText(phase === 'level-clear' ? 'LEVEL CLEAR' : 'GAME OVER', WIDTH / 2, 276);
		ctx.font = '22px ui-serif, Georgia, serif';
		ctx.fillText(
			phase === 'level-clear'
				? `Score ${scoreText}. Next target ${nextTargetText}.`
				: `Score ${scoreText}. Short by ${shortfallText}.`,
			WIDTH / 2,
			324
		);
		ctx.restore();
	}

	function loop(timestamp: number) {
		if (!lastFrameAt) lastFrameAt = timestamp;
		const dt = Math.min(0.05, (timestamp - lastFrameAt) / 1000);
		lastFrameAt = timestamp;
		updateGame(dt, timestamp);
		draw();
		rafId = requestAnimationFrame(loop);
	}

	onMount(() => {
		context = canvasEl.getContext('2d');
		resetRun();
		window.addEventListener('keydown', handleKeydown);
		rafId = requestAnimationFrame(loop);
	});

	onDestroy(() => {
		if (rafId !== null) cancelAnimationFrame(rafId);
		window.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="miner-shell">
	<div class="miner-bar">
		<div class="game-id">
			<span class="game-name">Margin Miner</span>
			<span class="game-hint">pendulum claw, hard weights, sixty seconds</span>
		</div>
		<div class="score-group">
			<div class="score-box">
				<span class="score-label">score</span>
				<span class="score-val">{scoreText}</span>
			</div>
			<div class="score-box">
				<span class="score-label">target</span>
				<span class="score-val">{targetText}</span>
			</div>
			<div class="score-box">
				<span class="score-label">best</span>
				<span class="score-val">{bestText}</span>
			</div>
			<div class="score-box live">
				<span class="score-label">time</span>
				<span class="score-val">{timerText}</span>
			</div>
			<div class="score-box">
				<span class="score-label">prize</span>
				<span class="score-val policy">{scoreOnlyLabel}</span>
			</div>
			<div class="score-box">
				<span class="score-label">state</span>
				<span class="score-val state">{stateLabel}</span>
			</div>
			<div class="score-box">
				<span class="score-label">extend</span>
				<span class="score-val">{extensions}</span>
			</div>
		</div>
		<div class="btn-group">
			{#if phase === 'level-clear'}
				<button class="ctrl-btn" onclick={() => startLevel(level + 1)}>next level</button>
			{:else}
				<button class="ctrl-btn" onclick={resetRun}>new game</button>
			{/if}
			<button class="ctrl-btn back" onclick={onclose}>arcade</button>
		</div>
	</div>

	<div class="perks-wrap">
		<ArcadePetPerks creature={activePet} effects={statEffects} />
	</div>

	<div class="status-row" aria-label="Margin Miner status">
		<span>level <b>{level}</b></span>
		<span>objects <b>{objectCount}</b></span>
		<span class={modeClass}>{mindTier > 0 && clawMode === 'swinging' ? scanLabel : lastHaul}</span>
	</div>

	<div
		class="canvas-frame"
		class:ended={phase !== 'playing'}
		onpointerdown={handlePointer}
		role="application"
		aria-label="Margin Miner canvas game"
	>
		<canvas bind:this={canvasEl} width={WIDTH} height={HEIGHT}></canvas>
		{#if phase !== 'playing'}
			<div class="game-overlay">
				<p class="overlay-title">{phase === 'level-clear' ? 'level clear' : 'game over'}</p>
				<p class="overlay-sub">
					{phase === 'level-clear'
						? `Score ${scoreText}. Next target ${nextTargetText}.`
						: `Score ${scoreText}. Short by ${shortfallText}.`}
				</p>
				{#if phase === 'level-clear'}
					<button onclick={() => startLevel(level + 1)}>next level</button>
				{:else}
					<button onclick={resetRun}>try again</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.miner-shell {
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.85rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}

	.miner-bar {
		width: 100%;
		max-width: 800px;
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
		min-width: 3.6rem;
		min-height: 2.75rem;
	}

	.score-box.live {
		background: color-mix(in srgb, var(--sol-base2) 70%, var(--sol-yellow));
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
		font-size: 1.2rem;
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

	.score-val.state {
		font-size: 0.92rem;
		letter-spacing: 0.04em;
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

	.status-row {
		width: min(800px, calc(100vw - 3rem));
		display: grid;
		grid-template-columns: 5.2rem 6.2rem minmax(0, 1fr);
		gap: 0.4rem;
	}

	.perks-wrap {
		width: min(800px, calc(100vw - 3rem));
	}

	.status-row span {
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
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--sol-base1);
		text-align: center;
	}

	.status-row span:last-child {
		justify-content: flex-start;
		padding: 0 0.7rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--sol-base0);
	}

	.status-row span.mode-reeling {
		color: var(--sol-orange);
	}

	.status-row span.mode-level-clear {
		color: var(--sol-green);
	}

	.status-row span.mode-game-over {
		color: var(--sol-red);
	}

	.status-row b {
		font-family: var(--font-counter);
		font-size: 1.1rem;
		font-weight: 400;
		color: var(--sol-base01);
		letter-spacing: 0;
	}

	.canvas-frame {
		position: relative;
		width: min(800px, calc(100vw - 3rem));
		aspect-ratio: 4 / 3;
		border: 1px solid var(--sol-base2);
		border-radius: 6px;
		overflow: hidden;
		background: #073642;
		box-shadow:
			inset 0 0 0 7px rgba(7, 54, 66, 0.06),
			0 18px 48px rgba(7, 54, 66, 0.1);
		cursor: crosshair;
		touch-action: manipulation;
		user-select: none;
	}

	.canvas-frame.ended {
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
		background: rgba(7, 54, 66, 0.68);
		color: var(--sol-base3);
		pointer-events: auto;
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
		color: rgba(253, 246, 227, 0.84);
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

	@media (max-width: 740px) {
		.miner-bar,
		.btn-group,
		.game-id {
			align-items: center;
		}

		.miner-bar {
			justify-content: center;
			text-align: center;
		}

		.btn-group {
			flex-direction: row;
		}

		.status-row {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.status-row span:last-child {
			grid-column: 1 / -1;
			justify-content: center;
		}

		.game-name {
			font-size: 1.7rem;
		}

		.score-box {
			min-width: 3.2rem;
			padding-inline: 0.48rem;
		}
	}
</style>
