<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ArcadeHud from './ArcadeHud.svelte';
	import ArcadePetPerks from './ArcadePetPerks.svelte';
	import ArcadeProgress from './ArcadeProgress.svelte';
	import {
		coreStatValue,
		statTier,
		type ArcadeActivePet,
		type ArcadeStatEffects
	} from './arcadeStats';
	import { payReward, previewReward } from './arcadeRewards';
	import { loadArcadeRecord, recordArcadeRun } from './arcadeRecords';
	import {
		MARGIN_MINER_CLOCK_UPGRADE_SECONDS,
		MARGIN_MINER_MAX_REWARD,
		MARGIN_MINER_RIG_UPGRADES,
		marginMinerLootPlan,
		marginMinerRawReward,
		marginMinerSeconds,
		marginMinerTarget,
		marginMinerUnstableCacheValue,
		type MarginMinerLootKind,
		type MarginMinerRigUpgrade
	} from './marginMinerTuning';
	import { fmt } from '$lib/witch/book.svelte';

	interface Props {
		onclose: () => void;
		activePet?: ArcadeActivePet;
	}
	let { onclose, activePet = null }: Props = $props();

	type ClawMode = 'swinging' | 'firing' | 'reeling';
	type RoundPhase = 'ready' | 'playing' | 'paused' | 'level-clear' | 'game-over';
	type MineKind = MarginMinerLootKind;
	type WeightClass = 'Very Light' | 'Light' | 'Medium' | 'Heavy' | 'Very Heavy' | 'Unknown';
	type RigUpgrade = MarginMinerRigUpgrade;

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
		age: number;
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
	const EXTENSION_SECONDS = 12;
	const EXTENSION_THRESHOLD = 0.6;

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
		},
		'unstable-cache': {
			name: 'Unstable Cache',
			value: 800,
			weight: weights.medium,
			weightClass: 'Medium',
			radius: 24,
			collisionRadius: 25
		},
		'anchored-ore': {
			name: 'Anchored Ore',
			value: 900,
			weight: 11.5,
			weightClass: 'Very Heavy',
			radius: 31,
			collisionRadius: 32
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
	let objectSeq = 0;
	let floaterSeq = 0;

	let phase = $state<RoundPhase>('ready');
	let clawMode = $state<ClawMode>('swinging');
	let level = $state(1);
	let score = $state(0);
	let targetScore = $state(marginMinerTarget(1));
	let remaining = $state(marginMinerSeconds(0));
	let lastHaul = $state('Click, tap, or press Down to fire.');
	let awarded = $state(0);
	const initialRecord = loadArcadeRecord(GAME_ID);
	let best = $state(initialRecord.bestScore);
	let bestLevel = $state(recordNumber(initialRecord.highlights.bestLevel) ?? 0);
	let fastestClearSeconds = $state(recordNumber(initialRecord.highlights.fastestClearSeconds));
	let extensions = $state(0);
	let extensionsUsed = $state(0);
	let rigUpgrades = $state<Record<RigUpgrade, number>>({ motor: 0, grip: 0, clock: 0 });

	const bodyTier = $derived(statTier(coreStatValue(activePet, 'body')));
	const mindTier = $derived(statTier(coreStatValue(activePet, 'mind')));
	const graceTier = $derived(statTier(coreStatValue(activePet, 'grace')));
	const heartTier = $derived(statTier(coreStatValue(activePet, 'heart')));

	// Body reels faster and shrugs off weight; Grace widens the grab and calms the
	// swing; Mind scans nearby loot; Heart banks near-miss time extensions.
	const reelBonus = $derived(bodyTier * 36 + rigUpgrades.motor * 24);
	const weightPenalty = $derived(Math.max(18, WEIGHT_MULTIPLIER - bodyTier * 8));
	const grabRadius = $derived(CLAW_RADIUS + graceTier * 3 + rigUpgrades.grip * 2);
	const swingSpeed = $derived(Math.max(1, SWING_SPEED - graceTier * 0.12));
	const scanRadius = $derived(mindTier > 0 ? 64 + mindTier * 34 : 0);
	const levelSeconds = $derived(marginMinerSeconds(rigUpgrades.clock));

	const scoreText = $derived(formatMoney(score));
	const targetText = $derived(formatMoney(targetScore));
	const timerText = $derived(Math.ceil(remaining).toString().padStart(2, '0'));
	const targetProgress = $derived(targetScore > 0 ? Math.min(1, score / targetScore) : 0);
	const rewardPreview = $derived(rewardForLevel(level, true));
	const stateLabel = $derived.by(() => {
		if (phase === 'ready') return 'READY';
		if (phase === 'paused') return 'PAUSED';
		if (phase === 'level-clear') return 'CLEAR';
		if (phase === 'game-over') return 'GAME OVER';
		return clawMode.toUpperCase();
	});
	const modeClass = $derived(`mode-${phase === 'playing' ? clawMode : phase}`);
	const shortfallText = $derived(formatMoney(Math.max(0, targetScore - score)));
	const primaryLabel = $derived.by(() => {
		if (phase === 'ready') return 'start dig';
		if (phase === 'playing') return 'pause';
		if (phase === 'paused') return 'resume';
		return 'new run';
	});
	const rigSummary = $derived(
		`motor ${rigUpgrades.motor} · grip ${rigUpgrades.grip} · clock +${rigUpgrades.clock * MARGIN_MINER_CLOCK_UPGRADE_SECONDS}s`
	);
	const fastestClearText = $derived(
		fastestClearSeconds === null ? '—' : `${fastestClearSeconds.toFixed(1)}s`
	);
	const targetHint = $derived.by(() => {
		if (phase === 'ready') return `You have ${levelSeconds}s. A large gold nugget meets this first target.`;
		if (phase === 'paused') return `${formatMoney(Math.max(0, targetScore - score))} left when you resume.`;
		if (score >= targetScore) return 'Target met — finish the reel, then choose a rig upgrade.';
		return `${formatMoney(Math.max(0, targetScore - score))} still needed.`;
	});
	const scanReadout = $derived.by(() => {
		if (mindTier <= 0 || phase !== 'playing') return 'Mind scan: no nearby readout.';
		const tip = clawPosition();
		const nearby = objects
			.filter(
				(object) =>
					!object.captured && Math.hypot(tip.x - object.x, tip.y - object.y) <= scanRadius + object.radius
			)
			.slice(0, 3)
			.map((object) => `${object.name} ${formatMoney(object.value)}${mindTier > 1 ? `, ${object.weightClass}` : ''}`);
		return nearby.length > 0 ? `Mind scan: ${nearby.join(' · ')}` : 'Mind scan: no loot in range.';
	});
	const statEffects = $derived<ArcadeStatEffects>({
		body: (_value, tier) => (tier > 0 ? `reel +${tier}` : 'standard reel'),
		mind: (_value, tier) => (tier > 1 ? 'scan value+weight' : tier > 0 ? 'scan value' : 'no scan'),
		grace: (_value, tier) => (tier > 0 ? `grab +${tier}` : 'standard grab'),
		heart: (_value, tier) =>
			tier > 0 ? `${tier} extension${tier === 1 ? '' : 's'}` : 'no extension'
	});

	function rewardForLevel(forLevel: number, cleared: boolean): number {
		return previewReward(marginMinerRawReward(forLevel, cleared), MARGIN_MINER_MAX_REWARD);
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
		if (!object) return EMPTY_RETRACT_SPEED + reelBonus;
		return Math.max(MIN_RETRACT_SPEED, BASE_RETRACT_SPEED + reelBonus - object.weight * weightPenalty);
	}

	function recordNumber(value: unknown): number | null {
		return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
	}

	function objectValue(object: MineObject): number {
		return object.kind === 'unstable-cache'
			? marginMinerUnstableCacheValue(object.age)
			: object.value;
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
			age: 0,
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
				const padding =
					object.kind === 'large-rock' ||
					object.kind === 'anchored-ore' ||
					other.kind === 'large-rock' ||
					other.kind === 'anchored-ore'
						? 15
						: 10;
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
		const plan = marginMinerLootPlan(forLevel);

		for (const [kind, count] of plan) {
			for (let i = 0; i < count; i += 1) addPlacedObject(result, kind);
		}

		return result.sort((a, b) => a.y - b.y);
	}

	function stageLevel(nextLevel: number) {
		level = nextLevel;
		targetScore = marginMinerTarget(nextLevel);
		remaining = levelSeconds;
		clawMode = 'swinging';
		currentLength = IDLE_LENGTH;
		caughtObject = null;
		objects = spawnObjects(nextLevel);
		floaters = [];
		extensions = heartTier;
	}

	function startLevel() {
		phase = 'playing';
		lastFrameAt = performance.now();
		lastHaul = `Level ${level}: ${levelSeconds}s on the clock. Time the release.`;
	}

	function resetRun() {
		score = 0;
		swingTime = 0;
		lockedAngle = Math.PI / 2;
		objectSeq = 0;
		floaterSeq = 0;
		awarded = 0;
		extensionsUsed = 0;
		rigUpgrades = { motor: 0, grip: 0, clock: 0 };
		stageLevel(1);
		phase = 'ready';
		lastHaul = 'Study the loot, then start the dig.';
	}

	function chooseUpgrade(upgrade: RigUpgrade) {
		rigUpgrades = { ...rigUpgrades, [upgrade]: rigUpgrades[upgrade] + 1 };
		stageLevel(level + 1);
		startLevel();
	}

	function handlePrimaryAction() {
		if (phase === 'ready') {
			startLevel();
			return;
		}
		if (phase === 'playing') {
			phase = 'paused';
			lastHaul = 'Clock paused. Resume when you are ready.';
			return;
		}
		if (phase === 'paused') {
			startLevel();
			return;
		}
		resetRun();
	}

	function recordRun(cleared: boolean, clearSeconds: number | null = null) {
		const current = loadArcadeRecord(GAME_ID);
		const priorBestLevel = recordNumber(current.highlights.bestLevel) ?? 0;
		const priorFastest = recordNumber(current.highlights.fastestClearSeconds);
		const nextFastest =
			cleared && clearSeconds !== null
				? priorFastest === null
					? clearSeconds
					: Math.min(priorFastest, clearSeconds)
				: priorFastest;
		const record = recordArcadeRun(GAME_ID, {
			score,
			summary: {
				level,
				cleared,
				haul: score,
				clearSeconds,
				extensions: extensionsUsed,
				awarded
			},
			highlights: cleared
				? { bestLevel: Math.max(priorBestLevel, level), fastestClearSeconds: nextFastest }
				: undefined
		});
		best = record.bestScore;
		bestLevel = recordNumber(record.highlights.bestLevel) ?? 0;
		fastestClearSeconds = recordNumber(record.highlights.fastestClearSeconds);
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
		if (event.key !== 'ArrowDown' && event.key !== ' ' && event.key !== 'Enter') return;
		event.preventDefault();
		fireClaw();
	}

	function finishLevel() {
		if (phase !== 'playing') return;

		if (score >= targetScore) {
			const clearSeconds = Math.max(0, levelSeconds - remaining);
			remaining = 0;
			phase = 'level-clear';
			awarded = rewardForLevel(level, true);
			payReward(awarded, MARGIN_MINER_MAX_REWARD);
			recordRun(true, clearSeconds);
			lastHaul = `Level ${level} cleared. Choose one rig upgrade for the next dig.`;
			return;
		}

		// Heart: a near-miss grants one extra stretch of time before the run ends.
		if (extensions > 0 && score >= targetScore * EXTENSION_THRESHOLD) {
			extensions -= 1;
			extensionsUsed += 1;
			remaining = EXTENSION_SECONDS;
			addFloater(ORIGIN_X, ORIGIN_Y + 44, `+${EXTENSION_SECONDS}s`, 'good');
			lastHaul = `Heart held the line: ${EXTENSION_SECONDS} more seconds.`;
			return;
		}

		remaining = 0;
		phase = 'game-over';
		awarded = rewardForLevel(level, false);
		payReward(awarded, MARGIN_MINER_MAX_REWARD);
		recordRun(false);
		lastHaul = `Short by ${formatMoney(targetScore - score)}.`;
	}

	function beginReel(object: MineObject | null) {
		caughtObject = object;
		if (caughtObject) {
			caughtObject.captured = true;
			lastHaul = `${caughtObject.name}: ${formatMoney(objectValue(caughtObject))} / ${caughtObject.weightClass}.`;
		} else {
			lastHaul = 'Nothing but air.';
		}
		clawMode = 'reeling';
	}

	function completeReel() {
		currentLength = IDLE_LENGTH;

		if (caughtObject) {
			const haulValue = objectValue(caughtObject);
			score += haulValue;
			addFloater(ORIGIN_X, ORIGIN_Y + 16, `+${formatMoney(haulValue)}`, haulValue <= 20 ? 'bad' : 'good');
			objects = objects.filter((object) => object.id !== caughtObject?.id);
			lastHaul = `${caughtObject.name} banked for ${formatMoney(haulValue)}.`;
			caughtObject = null;
		}

		clawMode = 'swinging';
		if (score >= targetScore) finishLevel();
	}

	function addFloater(x: number, y: number, text: string, tone: FloatingText['tone']) {
		floaters = [...floaters, { id: ++floaterSeq, x, y, text, age: 0, tone }];
	}

	function updateFloaters(dt: number) {
		floaters = floaters
			.map((floater) => ({ ...floater, age: floater.age + dt, y: floater.y - 20 * dt }))
			.filter((floater) => floater.age < 1.1);
	}

	function updateObjects(dt: number) {
		// A cache stops decaying once the claw has it, so its displayed value is the haul value.
		objects = objects.map((object) =>
			object.kind === 'unstable-cache' && !object.captured
				? { ...object, age: object.age + dt }
				: object
		);
	}

	function updateGame(dt: number) {
		updateFloaters(dt);
		if (phase !== 'playing') return;

		remaining = Math.max(0, remaining - dt);
		if (remaining <= 0) {
			finishLevel();
			return;
		}
		updateObjects(dt);

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
				return Math.hypot(nextClaw.x - object.x, nextClaw.y - object.y) <= grabRadius + object.collisionRadius;
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
		drawLineAndClaw(ctx);
		drawScan(ctx);
		drawFloaters(ctx);
		drawCanvasHud(ctx);
		if (phase !== 'playing') drawCanvasEndState(ctx);
	}

	function drawScan(ctx: CanvasRenderingContext2D) {
		if (scanRadius <= 0 || phase !== 'playing') return;
		const tip = clawPosition();

		ctx.save();
		ctx.strokeStyle = 'rgba(38, 139, 210, 0.4)';
		ctx.lineWidth = 1.5;
		ctx.setLineDash([5, 6]);
		ctx.beginPath();
		ctx.arc(tip.x, tip.y, scanRadius, 0, Math.PI * 2);
		ctx.stroke();
		ctx.setLineDash([]);

		ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (const object of objects) {
			if (object.captured) continue;
			if (Math.hypot(tip.x - object.x, tip.y - object.y) > scanRadius + object.radius) continue;

			const label =
				mindTier > 1
					? `${formatMoney(objectValue(object))} · ${object.weightClass}`
					: formatMoney(objectValue(object));
			const width = ctx.measureText(label).width + 12;
			const tagY = object.y - object.radius - 13;

			ctx.fillStyle = 'rgba(7, 54, 66, 0.86)';
			ctx.fillRect(object.x - width / 2, tagY - 9, width, 18);
			ctx.fillStyle = '#fdf6e3';
			ctx.fillText(label, object.x, tagY);
		}
		ctx.restore();
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
		} else if (object.kind === 'unstable-cache') {
			const pulse = 0.56 + Math.sin(object.age * 7) * 0.22;
			ctx.fillStyle = `rgba(211, 54, 130, ${pulse})`;
			ctx.strokeStyle = '#6c1f4a';
			ctx.lineWidth = 2;
			ctx.fillRect(-object.radius * 0.76, -object.radius * 0.62, object.radius * 1.52, object.radius * 1.24);
			ctx.strokeRect(-object.radius * 0.76, -object.radius * 0.62, object.radius * 1.52, object.radius * 1.24);
			ctx.fillStyle = '#fdf6e3';
			ctx.fillRect(-object.radius * 0.44, -object.radius * 0.28, object.radius * 0.88, object.radius * 0.12);
			ctx.font = '700 17px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('!', 0, object.radius * 0.24);
		} else if (object.kind === 'anchored-ore') {
			ctx.fillStyle = '#586e75';
			ctx.strokeStyle = '#073642';
			ctx.lineWidth = 3;
			ctx.beginPath();
			for (let i = 0; i < 7; i += 1) {
				const angle = (i / 7) * Math.PI * 2;
				const radius = object.radius * (0.78 + (i % 2) * 0.14);
				if (i === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
				else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
			}
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.strokeStyle = '#fdf6e3';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(0, -object.radius * 0.58);
			ctx.lineTo(0, object.radius * 0.38);
			ctx.moveTo(-object.radius * 0.48, object.radius * 0.08);
			ctx.lineTo(0, object.radius * 0.52);
			ctx.lineTo(object.radius * 0.48, object.radius * 0.08);
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
		const title =
			phase === 'ready'
				? 'READY TO DIG'
				: phase === 'paused'
					? 'CLOCK PAUSED'
					: phase === 'level-clear'
						? 'LEVEL CLEAR'
						: 'CAME UP SHORT';
		const subtitle =
			phase === 'ready'
				? `${levelSeconds} seconds. Reach ${targetText}.`
				: phase === 'paused'
					? `${timerText} seconds remain.`
					: phase === 'level-clear'
						? `Score ${scoreText}. Choose a rig upgrade for level ${level + 1}.`
						: `Score ${scoreText}. Short by ${shortfallText}.`;
		ctx.save();
		ctx.fillStyle = 'rgba(7, 54, 66, 0.76)';
		ctx.fillRect(0, UI_HEIGHT, WIDTH, HEIGHT - UI_HEIGHT);
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#fdf6e3';
		ctx.font = '700 52px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
		ctx.fillText(title, WIDTH / 2, 276);
		ctx.font = '22px ui-serif, Georgia, serif';
		ctx.fillText(subtitle, WIDTH / 2, 324);
		ctx.restore();
	}

	function loop(timestamp: number) {
		if (!lastFrameAt) lastFrameAt = timestamp;
		const dt = Math.min(0.05, (timestamp - lastFrameAt) / 1000);
		lastFrameAt = timestamp;
		updateGame(dt);
		draw();
		rafId = requestAnimationFrame(loop);
	}

	onMount(() => {
		context = canvasEl.getContext('2d');
		const record = loadArcadeRecord(GAME_ID);
		best = record.bestScore;
		bestLevel = recordNumber(record.highlights.bestLevel) ?? 0;
		fastestClearSeconds = recordNumber(record.highlights.fastestClearSeconds);
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
	<ArcadeHud
		title="Margin Miner"
		hint="pendulum claw, hard weights, fifteen seconds"
		maxWidth="800px"
		scores={[
			{ label: 'score', value: scoreText },
			{ label: 'target', value: targetText },
			{ label: 'time', value: timerText, live: true, tone: 'yellow' },
			{
				label: 'prize',
				value: fmt(phase === 'playing' ? rewardPreview : awarded),
				earned: phase !== 'playing' && awarded > 0
			},
			{ label: 'state', value: stateLabel }
		]}
		startLabel={primaryLabel}
		onstart={handlePrimaryAction}
		{onclose}
	/>

	<ArcadePetPerks creature={activePet} effects={statEffects} />

	<div class="status-row" aria-label="Margin Miner status">
		<span>level <b>{level}</b></span>
		<span>best haul <b>{fmt(best)}</b></span>
		<span class:lit={extensions > 0}>stretch <b>{extensions}</b></span>
		<span class={modeClass} aria-live="polite">{lastHaul}</span>
	</div>
	<div class="mastery-row" aria-label="Margin Miner mastery records">
		<span>best level <b>{bestLevel || '—'}</b></span>
		<span>fastest clear <b>{fastestClearText}</b></span>
	</div>

	<ArcadeProgress value={targetProgress} label="haul toward target" tone="yellow" maxWidth="800px" />
	<p class="target-hint">{targetHint}</p>
	<p class="rig-summary" aria-label="run-scoped rig upgrades">{rigSummary}</p>

	<div class="loot-guide" aria-label="loot value and weight guide">
		<span><b>diamond</b> $600 · very light</span>
		<span><b>large gold</b> $500 · medium</span>
		<span><b>small gold</b> $50 · light</span>
		<span><b>rocks</b> $11–20 · heavy</span>
		<span><b>unstable cache</b> $800 → $200 · decays</span>
		<span><b>anchored ore</b> $900 · very heavy</span>
		<span><b>mystery</b> unknown</span>
	</div>
	{#if mindTier > 0}
		<p class="scan-readout">{scanReadout}</p>
	{/if}

	<div
		class="canvas-frame"
		class:ended={phase !== 'playing'}
		onpointerdown={handlePointer}
		role="application"
		aria-label="Margin Miner canvas game"
	>
		<canvas bind:this={canvasEl} width={WIDTH} height={HEIGHT} aria-label="the claw machine: a pendulum swinging over objects of varying value and weight"
			>a claw machine: a pendulum swinging over objects of varying value and weight</canvas
		>
		{#if phase !== 'playing'}
			<div class="game-overlay">
				<p class="overlay-title">
					{phase === 'ready'
						? 'ready to dig'
						: phase === 'paused'
							? 'clock paused'
							: phase === 'level-clear'
								? 'level clear'
								: 'came up short'}
				</p>
				<p class="overlay-sub">
					{phase === 'ready'
						? `You have ${levelSeconds} seconds to reach ${targetText}. Large gold or a diamond starts you strong.`
						: phase === 'paused'
							? `${timerText} seconds remain. The claw and clock will wait.`
							: phase === 'level-clear'
								? `Score ${scoreText}. +${fmt(awarded)} insight. Choose one rig upgrade for level ${level + 1}.`
								: `Score ${scoreText}. Short by ${shortfallText}. +${fmt(awarded)} insight.`}
				</p>
				{#if phase === 'level-clear'}
					<div class="upgrade-grid" aria-label="choose one rig upgrade">
						{#each MARGIN_MINER_RIG_UPGRADES as upgrade (upgrade.id)}
							<button class="upgrade-choice" onclick={() => chooseUpgrade(upgrade.id)}>
								<b>{upgrade.title}</b>
								<span>{upgrade.description}</span>
							</button>
						{/each}
					</div>
				{:else}
					<p class="overlay-meta">
						best haul {formatMoney(best)}{#if extensionsUsed > 0} · {extensionsUsed} stretch used{/if}
					</p>
					<button onclick={phase === 'ready' || phase === 'paused' ? startLevel : resetRun}>
						{phase === 'ready' ? 'start dig' : phase === 'paused' ? 'resume' : 'try again'}
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<button
		class="drop-control"
		onclick={fireClaw}
		disabled={phase !== 'playing' || clawMode !== 'swinging'}
		aria-describedby="miner-controls"
		aria-keyshortcuts="ArrowDown Space Enter"
	>
		drop claw
	</button>

	<p class="control-hint" id="miner-controls">
		Click, tap, Down, Space, or Enter drops the claw. The claw swings on its own —
		time the release.
	</p>
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

	.miner-shell :global(.pet-perks) {
		width: min(800px, calc(100vw - 3rem));
	}

	.control-hint {
		width: min(800px, calc(100vw - 3rem));
		margin: 0;
		text-align: center;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.8rem;
		color: var(--sol-base1);
	}

	.target-hint,
	.rig-summary,
	.scan-readout {
		width: min(800px, calc(100vw - 3rem));
		margin: -0.35rem 0 0;
		text-align: center;
		font-family: var(--font-body);
		font-size: 0.78rem;
		color: var(--sol-base1);
	}

	.rig-summary {
		font-family: var(--font-ui);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--sol-base0);
	}

	.scan-readout {
		color: var(--sol-blue);
	}

	.loot-guide {
		width: min(800px, calc(100vw - 3rem));
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.25rem 0.5rem;
		font-family: var(--font-ui);
		font-size: 0.56rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--sol-base1);
	}

	.loot-guide span {
		padding: 0.2rem 0.35rem;
		border: 1px solid var(--sol-base2);
		border-radius: 3px;
		background: rgba(238, 232, 213, 0.32);
	}

	.loot-guide b {
		color: var(--sol-base01);
	}

	.overlay-meta {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(253, 246, 227, 0.72);
		margin: 0;
	}

	.status-row {
		width: min(800px, calc(100vw - 3rem));
		display: grid;
		grid-template-columns: 5rem 6.4rem 6rem minmax(0, 1fr);
		gap: 0.4rem;
	}

	.status-row span.lit {
		border-color: rgba(42, 161, 152, 0.5);
		background: rgba(42, 161, 152, 0.12);
		color: var(--sol-base00);
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
		touch-action: none;
		user-select: none;
	}

	.canvas-frame.ended {
		cursor: default;
	}

	.drop-control:focus-visible {
		outline: 3px solid var(--sol-yellow);
		outline-offset: 3px;
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

	.mastery-row {
		width: min(800px, calc(100vw - 3rem));
		display: flex;
		justify-content: center;
		gap: 0.4rem;
	}

	.mastery-row span {
		padding: 0.26rem 0.5rem;
		border: 1px solid var(--sol-base2);
		border-radius: 3px;
		background: rgba(238, 232, 213, 0.32);
		font-family: var(--font-ui);
		font-size: 0.56rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--sol-base1);
	}

	.mastery-row b {
		font-family: var(--font-counter);
		font-size: 0.9rem;
		font-weight: 400;
		letter-spacing: 0;
		color: var(--sol-base01);
	}

	.upgrade-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
		width: min(620px, 100%);
	}

	.game-overlay .upgrade-choice {
		display: flex;
		flex-direction: column;
		gap: 0.24rem;
		align-items: flex-start;
		text-align: left;
		padding: 0.6rem;
	}

	.upgrade-choice b {
		font-family: var(--font-ui);
		font-size: 0.64rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.upgrade-choice span {
		font-family: var(--font-body);
		font-size: 0.74rem;
		font-style: italic;
		color: rgba(253, 246, 227, 0.8);
	}

	.game-overlay button:hover {
		background: rgba(253, 246, 227, 0.32);
	}

	.drop-control {
		min-width: min(18rem, calc(100vw - 3rem));
		min-height: 3rem;
		border: 1px solid var(--sol-base1);
		border-radius: 4px;
		background: var(--sol-yellow);
		color: var(--sol-base03);
		font-family: var(--font-ui);
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.drop-control:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	@media (max-width: 740px) {
		.status-row {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.status-row span:last-child {
			grid-column: 1 / -1;
			justify-content: center;
		}

		.upgrade-grid {
			grid-template-columns: 1fr;
			max-width: 290px;
		}

		.control-hint {
			font-size: 0.76rem;
		}
	}
</style>
