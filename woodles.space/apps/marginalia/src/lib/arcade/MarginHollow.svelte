<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ArcadeHud from './ArcadeHud.svelte';
	import ArcadeProgress from './ArcadeProgress.svelte';
	import { clamp, type Dot } from './arcadeMath';
	import { fmt } from '$lib/witch/book.svelte';
	import { awardArcadeReward, previewArcadeReward } from './arcadeRewards';

	interface Props {
		onclose: () => void;
	}
	let { onclose }: Props = $props();

	type Phase = 'ready' | 'running' | 'complete' | 'over';
	type Facing = 'left' | 'right';
	type Requirement = 'wing' | 'key';
	type PickupKind = 'glyph' | 'wing' | 'key';

	interface Rect extends Dot {
		w: number;
		h: number;
	}

	interface Platform extends Rect {
		id: string;
	}

	interface Gate extends Rect {
		id: string;
		requires: Requirement;
		label: string;
	}

	interface Door extends Rect {
		id: string;
		to?: number;
		spawn?: Dot;
		requires?: Requirement;
		exit?: boolean;
		label: string;
	}

	interface Pickup extends Dot {
		id: string;
		kind: PickupKind;
		label: string;
	}

	interface Hazard extends Rect {
		id: string;
	}

	interface Room {
		id: string;
		title: string;
		hint: string;
		spawn: Dot;
		platforms: Platform[];
		gates: Gate[];
		doors: Door[];
		pickups: Pickup[];
		hazards: Hazard[];
	}

	interface Player extends Dot {
		vx: number;
		vy: number;
	}

	const WORLD_W = 540;
	const WORLD_H = 320;
	const PLAYER_W = 16;
	const PLAYER_H = 24;
	const MOVE_SPEED = 150;
	const AIR_SPEED = 132;
	const JUMP_SPEED = -420;
	const GRAVITY = 1150;
	const MAX_FALL = 520;
	const PICKUP_SIZE = 16;
	const START_LIVES = 3;
	const MAX_REWARD = 24;

	const ROOMS: Room[] = [
		{
			id: 'foyer',
			title: 'Foyer',
			hint: 'find the wing, then press right',
			spawn: { x: 42, y: 272 },
			platforms: [
				{ id: 'floor', x: 0, y: 296, w: 540, h: 24 },
				{ id: 'low-shelf', x: 104, y: 242, w: 100, h: 12 },
				{ id: 'ink-shelf', x: 250, y: 198, w: 116, h: 12 },
				{ id: 'door-shelf', x: 414, y: 258, w: 86, h: 12 }
			],
			gates: [],
			doors: [
				{ id: 'to-shaft', x: 510, y: 236, w: 30, h: 60, to: 1, spawn: { x: 34, y: 272 }, label: 'east sill' }
			],
			pickups: [
				{ id: 'foyer-glyph-1', kind: 'glyph', x: 138, y: 216, label: 'glyph' },
				{ id: 'foyer-wing', kind: 'wing', x: 302, y: 170, label: 'wing' },
				{ id: 'foyer-glyph-2', kind: 'glyph', x: 438, y: 230, label: 'glyph' }
			],
			hazards: []
		},
		{
			id: 'shaft',
			title: 'Sill Shaft',
			hint: 'double jump through the high gate',
			spawn: { x: 34, y: 272 },
			platforms: [
				{ id: 'floor', x: 0, y: 296, w: 540, h: 24 },
				{ id: 'left-step', x: 72, y: 252, w: 92, h: 12 },
				{ id: 'middle-step', x: 206, y: 218, w: 92, h: 12 },
				{ id: 'high-step', x: 344, y: 184, w: 92, h: 12 },
				{ id: 'gate-step', x: 430, y: 210, w: 76, h: 12 }
			],
			gates: [
				{ id: 'wing-gate', x: 504, y: 148, w: 14, h: 70, requires: 'wing', label: 'wing gate' }
			],
			doors: [
				{ id: 'back-foyer', x: 0, y: 236, w: 30, h: 60, to: 0, spawn: { x: 468, y: 272 }, label: 'west sill' },
				{
					id: 'to-alcove',
					x: 510,
					y: 150,
					w: 30,
					h: 68,
					to: 2,
					spawn: { x: 38, y: 272 },
					requires: 'wing',
					label: 'wing gate'
				}
			],
			pickups: [
				{ id: 'shaft-glyph-1', kind: 'glyph', x: 236, y: 190, label: 'glyph' },
				{ id: 'shaft-glyph-2', kind: 'glyph', x: 374, y: 156, label: 'glyph' }
			],
			hazards: [{ id: 'shaft-thorns', x: 236, y: 284, w: 92, h: 12 }]
		},
		{
			id: 'alcove',
			title: 'Key Alcove',
			hint: 'cross the thorns and take the key',
			spawn: { x: 38, y: 272 },
			platforms: [
				{ id: 'floor-left', x: 0, y: 296, w: 150, h: 24 },
				{ id: 'floor-right', x: 392, y: 296, w: 148, h: 24 },
				{ id: 'bridge-a', x: 170, y: 246, w: 82, h: 12 },
				{ id: 'bridge-b', x: 294, y: 214, w: 82, h: 12 },
				{ id: 'key-shelf', x: 382, y: 174, w: 88, h: 12 }
			],
			gates: [
				{ id: 'key-gate', x: 504, y: 236, w: 14, h: 60, requires: 'key', label: 'key gate' }
			],
			doors: [
				{ id: 'back-shaft', x: 0, y: 236, w: 30, h: 60, to: 1, spawn: { x: 470, y: 188 }, label: 'west sill' },
				{
					id: 'to-vault',
					x: 510,
					y: 236,
					w: 30,
					h: 60,
					to: 3,
					spawn: { x: 36, y: 272 },
					requires: 'key',
					label: 'key gate'
				}
			],
			pickups: [
				{ id: 'alcove-glyph-1', kind: 'glyph', x: 204, y: 218, label: 'glyph' },
				{ id: 'alcove-key', kind: 'key', x: 416, y: 146, label: 'key' }
			],
			hazards: [
				{ id: 'pit-a', x: 156, y: 286, w: 76, h: 10 },
				{ id: 'pit-b', x: 262, y: 286, w: 96, h: 10 }
			]
		},
		{
			id: 'vault',
			title: 'Small Vault',
			hint: 'reach the right margin',
			spawn: { x: 36, y: 272 },
			platforms: [
				{ id: 'floor', x: 0, y: 296, w: 540, h: 24 },
				{ id: 'first', x: 92, y: 250, w: 90, h: 12 },
				{ id: 'second', x: 226, y: 214, w: 90, h: 12 },
				{ id: 'third', x: 360, y: 178, w: 90, h: 12 }
			],
			gates: [],
			doors: [
				{ id: 'back-alcove', x: 0, y: 236, w: 30, h: 60, to: 2, spawn: { x: 468, y: 272 }, label: 'west sill' },
				{ id: 'exit', x: 508, y: 130, w: 32, h: 78, requires: 'key', exit: true, label: 'archive door' }
			],
			pickups: [
				{ id: 'vault-glyph-1', kind: 'glyph', x: 120, y: 222, label: 'glyph' },
				{ id: 'vault-glyph-2', kind: 'glyph', x: 256, y: 186, label: 'glyph' },
				{ id: 'vault-glyph-3', kind: 'glyph', x: 392, y: 150, label: 'glyph' }
			],
			hazards: [{ id: 'last-thorns', x: 258, y: 286, w: 76, h: 10 }]
		}
	];

	const TOTAL_GLYPHS = ROOMS.flatMap((room) => room.pickups).filter((pickup) => pickup.kind === 'glyph').length;
	const keys = new Set<string>();

	let phase = $state<Phase>('ready');
	let roomIndex = $state(0);
	let player = $state<Player>({ x: ROOMS[0].spawn.x, y: ROOMS[0].spawn.y, vx: 0, vy: 0 });
	let facing = $state<Facing>('right');
	let onGround = $state(false);
	let jumpsUsed = $state(0);
	let hasWing = $state(false);
	let hasKey = $state(false);
	let lives = $state(START_LIVES);
	let glyphs = $state(0);
	let deaths = $state(0);
	let awarded = $state(0);
	let rounds = $state(0);
	let best = $state(0);
	let collected = $state<string[]>([]);
	let message = $state('find the wing');
	let messageClock = $state(0);
	let hurtClock = $state(0);
	let padX = $state(0);
	let jumpQueued = false;
	let raf = 0;
	let lastTime = 0;

	const currentRoom = $derived(ROOMS[roomIndex]);
	const progress = $derived(
		clamp((roomIndex + glyphs / Math.max(1, TOTAL_GLYPHS) + (hasWing ? 0.45 : 0) + (hasKey ? 0.55 : 0)) / 5, 0, 1)
	);
	const startLabel = $derived(phase === 'running' ? 'restart' : rounds > 0 ? 'again' : 'start');
	const rewardPreview = $derived(rewardFor(glyphs, hasWing, hasKey, phase === 'complete'));
	const hintLabel = $derived(messageClock > 0 ? message : currentRoom.hint);
	const roomLabel = $derived(`${roomIndex + 1}/${ROOMS.length}`);
	const outcomeLabel = $derived.by(() => {
		if (phase === 'complete') return awarded > 0 ? `+${fmt(awarded)} insight` : 'opened';
		if (phase === 'over') return 'sent back';
		if (rounds > 0) return 'again?';
		return 'ready?';
	});

	function rewardFor(foundGlyphs: number, wing: boolean, key: boolean, complete: boolean): number {
		const raw = foundGlyphs * 2 + (wing ? 3 : 0) + (key ? 4 : 0) + (complete ? 7 : 0);
		return previewArcadeReward(raw, MAX_REWARD);
	}

	function playerRect(next: Player = player): Rect {
		return { x: next.x, y: next.y, w: PLAYER_W, h: PLAYER_H };
	}

	function pickupRect(pickup: Pickup): Rect {
		return { x: pickup.x, y: pickup.y, w: PICKUP_SIZE, h: PICKUP_SIZE };
	}

	function overlaps(a: Rect, b: Rect): boolean {
		return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
	}

	function requirementMet(requirement?: Requirement): boolean {
		if (!requirement) return true;
		if (requirement === 'wing') return hasWing;
		return hasKey;
	}

	function blockingSolids(): Rect[] {
		return [
			...currentRoom.platforms,
			...currentRoom.gates.filter((gate) => !requirementMet(gate.requires))
		];
	}

	function showMessage(next: string, seconds = 1.4) {
		message = next;
		messageClock = seconds;
	}

	function resetRun() {
		roomIndex = 0;
		player = { x: ROOMS[0].spawn.x, y: ROOMS[0].spawn.y, vx: 0, vy: 0 };
		facing = 'right';
		onGround = false;
		jumpsUsed = 0;
		hasWing = false;
		hasKey = false;
		lives = START_LIVES;
		glyphs = 0;
		deaths = 0;
		awarded = 0;
		collected = [];
		hurtClock = 0;
		message = 'find the wing';
		messageClock = 0;
		keys.clear();
		padX = 0;
		jumpQueued = false;
	}

	function start() {
		stop();
		resetRun();
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
		best = Math.max(best, glyphs);
		awarded = awardArcadeReward('margin-hollow', rewardFor(glyphs, hasWing, hasKey, nextPhase === 'complete'), MAX_REWARD);
	}

	function loop(now: number) {
		const dt = Math.min(0.034, Math.max(0, (now - lastTime) / 1000));
		lastTime = now;
		step(dt);
		if (phase === 'running') raf = requestAnimationFrame(loop);
	}

	function step(dt: number) {
		messageClock = Math.max(0, messageClock - dt);
		hurtClock = Math.max(0, hurtClock - dt);
		movePlayer(dt);
		collectPickups();
		checkHazards();
		checkDoors();
	}

	function horizontalIntent(): number {
		let intent = 0;
		if (keys.has('arrowleft') || keys.has('a')) intent -= 1;
		if (keys.has('arrowright') || keys.has('d')) intent += 1;
		intent += padX;
		return clamp(intent, -1, 1);
	}

	function movePlayer(dt: number) {
		const intent = horizontalIntent();
		const speed = onGround ? MOVE_SPEED : AIR_SPEED;
		const targetVx = intent * speed;
		const blend = onGround ? 0.42 : 0.22;
		let next = {
			...player,
			vx: player.vx + (targetVx - player.vx) * blend,
			vy: clamp(player.vy + GRAVITY * dt, JUMP_SPEED, MAX_FALL)
		};

		if (intent < 0) facing = 'left';
		if (intent > 0) facing = 'right';

		if (jumpQueued) {
			jumpQueued = false;
			if (onGround) {
				next.vy = JUMP_SPEED;
				onGround = false;
				jumpsUsed = 1;
			} else if (hasWing && jumpsUsed < 2) {
				next.vy = JUMP_SPEED * 0.92;
				jumpsUsed += 1;
				showMessage('wing step', 0.7);
			}
		}

		player = next;
		moveX(player.vx * dt);
		moveY(player.vy * dt);
	}

	function moveX(amount: number) {
		if (amount === 0) return;
		let nextX = player.x + amount;
		let nextVx = player.vx;

		if (nextX < 0) {
			nextX = 0;
			nextVx = 0;
		}
		if (nextX > WORLD_W - PLAYER_W) {
			nextX = WORLD_W - PLAYER_W;
			nextVx = 0;
		}

		let nextRect = playerRect({ ...player, x: nextX, vx: nextVx });
		for (const solid of blockingSolids()) {
			if (!overlaps(nextRect, solid)) continue;
			if (amount > 0) nextX = solid.x - PLAYER_W;
			if (amount < 0) nextX = solid.x + solid.w;
			nextVx = 0;
			nextRect = playerRect({ ...player, x: nextX, vx: nextVx });
		}

		player = { ...player, x: nextX, vx: nextVx };
	}

	function moveY(amount: number) {
		let nextY = player.y + amount;
		let nextVy = player.vy;
		let landed = false;

		if (nextY < 0) {
			nextY = 0;
			nextVy = 0;
		}
		if (nextY > WORLD_H - PLAYER_H) {
			nextY = WORLD_H - PLAYER_H;
			nextVy = 0;
			landed = true;
		}

		let nextRect = playerRect({ ...player, y: nextY, vy: nextVy });
		for (const solid of blockingSolids()) {
			if (!overlaps(nextRect, solid)) continue;
			if (amount > 0) {
				nextY = solid.y - PLAYER_H;
				landed = true;
			}
			if (amount < 0) nextY = solid.y + solid.h;
			nextVy = 0;
			nextRect = playerRect({ ...player, y: nextY, vy: nextVy });
		}

		onGround = landed;
		if (landed) jumpsUsed = 0;
		player = { ...player, y: nextY, vy: nextVy };
	}

	function collectPickups() {
		const rect = playerRect();
		for (const pickup of currentRoom.pickups) {
			if (collected.includes(pickup.id) || !overlaps(rect, pickupRect(pickup))) continue;
			collected = [...collected, pickup.id];
			if (pickup.kind === 'glyph') {
				glyphs += 1;
				showMessage('glyph kept');
			} else if (pickup.kind === 'wing') {
				hasWing = true;
				showMessage('double jump unlocked');
			} else {
				hasKey = true;
				showMessage('key kept');
			}
		}
	}

	function checkHazards() {
		if (hurtClock > 0) return;
		const rect = playerRect();
		if (!currentRoom.hazards.some((hazard) => overlaps(rect, hazard))) return;
		hurtClock = 1.1;
		deaths += 1;
		lives -= 1;
		if (lives <= 0) {
			finish('over');
			return;
		}
		const spawn = currentRoom.spawn;
		player = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 };
		onGround = false;
		jumpsUsed = 0;
		showMessage('thorns bite');
	}

	function checkDoors() {
		const rect = playerRect();
		const door = currentRoom.doors.find((candidate) => overlaps(rect, candidate));
		if (!door) return;
		if (!requirementMet(door.requires)) {
			showMessage(door.requires === 'wing' ? 'needs wing' : 'needs key', 0.4);
			return;
		}
		if (door.exit) {
			finish('complete');
			return;
		}
		if (door.to === undefined || !door.spawn) return;
		roomIndex = door.to;
		player = { x: door.spawn.x, y: door.spawn.y, vx: 0, vy: 0 };
		onGround = false;
		jumpsUsed = 0;
		showMessage(ROOMS[door.to].title.toLowerCase(), 1.1);
	}

	function queueJump() {
		if (phase !== 'running') start();
		jumpQueued = true;
	}

	function setPad(next: number) {
		if (phase !== 'running') start();
		padX = next;
	}

	function onKeyDown(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) {
			event.preventDefault();
			if (phase !== 'running') start();
			keys.add(key);
		}
		if (['arrowup', 'w', ' '].includes(key)) {
			event.preventDefault();
			queueJump();
		}
	}

	function onKeyUp(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) {
			event.preventDefault();
			keys.delete(key);
		}
	}

	function pickupClass(pickup: Pickup): string {
		return `pickup pickup-${pickup.kind}`;
	}

	function playerClass(): string {
		return `player face-${facing}${hurtClock > 0 ? ' hurt' : ''}`;
	}

	function gateClass(gate: Gate): string {
		return `gate ${requirementMet(gate.requires) ? 'open' : 'closed'}`;
	}

	function pickupPoints(pickup: Pickup): string {
		const mid = PICKUP_SIZE / 2;
		return `${pickup.x + mid},${pickup.y} ${pickup.x + PICKUP_SIZE},${pickup.y + mid} ${pickup.x + mid},${pickup.y + PICKUP_SIZE} ${pickup.x},${pickup.y + mid}`;
	}

	function hazardPoints(hazard: Hazard): string {
		const step = hazard.w / 4;
		return [
			`${hazard.x},${hazard.y + hazard.h}`,
			`${hazard.x + step * 0.5},${hazard.y}`,
			`${hazard.x + step},${hazard.y + hazard.h}`,
			`${hazard.x + step * 1.5},${hazard.y}`,
			`${hazard.x + step * 2},${hazard.y + hazard.h}`,
			`${hazard.x + step * 2.5},${hazard.y}`,
			`${hazard.x + step * 3},${hazard.y + hazard.h}`,
			`${hazard.x + step * 3.5},${hazard.y}`,
			`${hazard.x + hazard.w},${hazard.y + hazard.h}`
		].join(' ');
	}

	function clearControls() {
		keys.clear();
		padX = 0;
	}

	onMount(() => {
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('blur', clearControls);
	});

	onDestroy(() => {
		stop();
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', clearControls);
		}
	});
</script>

<div class="hollow-shell">
	<ArcadeHud
		title="Margin Hollow"
		hint={hintLabel}
		maxWidth="560px"
		scores={[
			{ label: 'room', value: roomLabel },
			{ label: 'lives', value: lives, live: true, tone: 'green' },
			{ label: 'glyphs', value: `${glyphs}/${TOTAL_GLYPHS}` },
			{ label: 'wing', value: hasWing ? 'yes' : 'no' },
			{ label: 'prize', value: fmt(phase === 'complete' || phase === 'over' ? awarded : rewardPreview) }
		]}
		{startLabel}
		onstart={start}
		onclose={onclose}
	/>

	<ArcadeProgress value={progress} label="map progress" tone="magic" maxWidth="560px" />

	<svg
		class="field"
		class:active={phase === 'running'}
		class:hit={hurtClock > 0}
		viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
		role="img"
		aria-label="Margin Hollow map"
	>
		<defs>
			<pattern id="hollow-grid" width="30" height="30" patternUnits="userSpaceOnUse">
				<path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(88, 110, 117, 0.12)" stroke-width="1" />
			</pattern>
		</defs>
		<rect class="field-bg" width={WORLD_W} height={WORLD_H} rx="6" />
		<rect width={WORLD_W} height={WORLD_H} fill="url(#hollow-grid)" opacity="0.66" />
		<text class="room-title" x="18" y="28">{currentRoom.title}</text>

		{#each currentRoom.doors as door (door.id)}
			<rect
				class="door"
				class:locked={!requirementMet(door.requires)}
				x={door.x}
				y={door.y}
				width={door.w}
				height={door.h}
				rx="3"
			/>
			<text class="door-label" x={door.x + door.w / 2} y={door.y - 8} text-anchor="middle">{door.label}</text>
		{/each}

		{#each currentRoom.platforms as platform (platform.id)}
			<rect
				class="platform-shadow"
				x={platform.x}
				y={platform.y + 4}
				width={platform.w}
				height={platform.h}
				rx="3"
			/>
			<rect class="platform" x={platform.x} y={platform.y} width={platform.w} height={platform.h} rx="3" />
		{/each}

		{#each currentRoom.gates as gate (gate.id)}
			<rect class={gateClass(gate)} x={gate.x} y={gate.y} width={gate.w} height={gate.h} rx="4" />
			<text class="gate-label" x={gate.x - 4} y={gate.y + gate.h / 2} text-anchor="end">{gate.label}</text>
		{/each}

		{#each currentRoom.hazards as hazard (hazard.id)}
			<polygon class="hazard" points={hazardPoints(hazard)} />
		{/each}

		{#each currentRoom.pickups as pickup (pickup.id)}
			{#if !collected.includes(pickup.id)}
				<polygon class={pickupClass(pickup)} points={pickupPoints(pickup)} />
				<text class="pickup-label" x={pickup.x + PICKUP_SIZE / 2} y={pickup.y - 6} text-anchor="middle">
					{pickup.label}
				</text>
			{/if}
		{/each}

		<ellipse class="player-shadow" cx={player.x + PLAYER_W / 2} cy={player.y + PLAYER_H + 3} rx="12" ry="4" />
		<rect class={playerClass()} x={player.x} y={player.y} width={PLAYER_W} height={PLAYER_H} rx="5" />
		<circle
			class="player-eye"
			cx={facing === 'right' ? player.x + 11 : player.x + 5}
			cy={player.y + 8}
			r="1.8"
		/>
		{#if hasWing}
			<path class="wing left" d={`M ${player.x + 2} ${player.y + 10} q -12 -4 -15 8 q 10 -2 15 -8`} />
			<path class="wing right" d={`M ${player.x + PLAYER_W - 2} ${player.y + 10} q 12 -4 15 8 q -10 -2 -15 -8`} />
		{/if}

		{#if phase === 'ready' || phase === 'complete' || phase === 'over'}
			<rect class="veil" width={WORLD_W} height={WORLD_H} rx="6" />
			<text class="center-title" x={WORLD_W / 2} y={WORLD_H / 2 - 12} text-anchor="middle">
				{outcomeLabel}
			</text>
			<text class="center-sub" x={WORLD_W / 2} y={WORLD_H / 2 + 20} text-anchor="middle">
				{phase === 'ready'
					? 'run, jump, pick up, open the margin'
					: `glyphs ${glyphs}/${TOTAL_GLYPHS} - falls ${deaths} - best ${best}`}
			</text>
		{/if}
	</svg>

	<div class="pad-row" aria-label="platform controls">
		<button
			onpointerdown={() => setPad(-1)}
			onpointerup={() => setPad(0)}
			onpointercancel={() => setPad(0)}
			onpointerleave={() => setPad(0)}
		>
			left
		</button>
		<button onclick={queueJump}>jump</button>
		<button
			onpointerdown={() => setPad(1)}
			onpointerup={() => setPad(0)}
			onpointercancel={() => setPad(0)}
			onpointerleave={() => setPad(0)}
		>
			right
		</button>
	</div>
</div>

<style>
	.hollow-shell {
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
		touch-action: none;
	}
	.pad-row button:hover {
		background: var(--sol-base00);
	}
	.field {
		width: min(560px, calc(100vw - 3rem));
		aspect-ratio: 27 / 16;
		border: 1px solid var(--sol-base2);
		border-radius: 6px;
		background: var(--sol-base2);
		box-shadow:
			inset 0 0 0 6px rgba(7, 54, 66, 0.05),
			0 8px 24px rgba(7, 54, 66, 0.08);
		user-select: none;
	}
	.field.active {
		cursor: crosshair;
	}
	.field-bg {
		fill: #fdf6e3;
	}
	.field.hit .field-bg {
		fill: color-mix(in srgb, #fdf6e3 82%, var(--sol-red));
	}
	.room-title,
	.door-label,
	.gate-label,
	.pickup-label {
		font-family: var(--font-ui);
		font-size: 10px;
		text-transform: uppercase;
		fill: var(--sol-base1);
		pointer-events: none;
	}
	.platform-shadow {
		fill: rgba(7, 54, 66, 0.1);
	}
	.platform {
		fill: var(--sol-base2);
		stroke: rgba(88, 110, 117, 0.32);
		stroke-width: 1.5;
	}
	.door {
		fill: rgba(42, 161, 152, 0.22);
		stroke: var(--sol-cyan);
		stroke-width: 2;
	}
	.door.locked {
		fill: rgba(181, 137, 0, 0.16);
		stroke: var(--sol-yellow);
		stroke-dasharray: 5 4;
	}
	.gate {
		stroke: var(--sol-base3);
		stroke-width: 2;
	}
	.gate.closed {
		fill: var(--sol-orange);
	}
	.gate.open {
		fill: rgba(42, 161, 152, 0.16);
		stroke: rgba(42, 161, 152, 0.35);
		stroke-dasharray: 4 5;
	}
	.hazard {
		fill: var(--sol-red);
		stroke: var(--sol-base3);
		stroke-width: 1.5;
	}
	.pickup {
		stroke: var(--sol-base3);
		stroke-width: 2;
	}
	.pickup-glyph {
		fill: var(--sol-cyan);
	}
	.pickup-wing {
		fill: var(--sol-violet);
	}
	.pickup-key {
		fill: var(--sol-yellow);
	}
	.player-shadow {
		fill: rgba(7, 54, 66, 0.12);
	}
	.player {
		fill: var(--sol-blue);
		stroke: var(--sol-base3);
		stroke-width: 2.5;
	}
	.player.hurt {
		fill: var(--sol-red);
	}
	.player-eye {
		fill: var(--sol-base3);
	}
	.wing {
		fill: none;
		stroke: var(--sol-violet);
		stroke-width: 2;
		stroke-linecap: round;
		opacity: 0.82;
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
		display: flex;
		justify-content: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.pad-row button {
		background: var(--sol-base2);
		color: var(--sol-base0);
		min-width: 4.2rem;
	}
	.pad-row button:hover {
		background: var(--sol-cyan);
		color: var(--sol-base3);
	}
	@media (max-width: 560px) {
		.center-title {
			font-size: 34px;
		}
	}
</style>
