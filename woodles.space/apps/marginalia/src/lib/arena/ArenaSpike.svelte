<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		ARENA_H,
		ARENA_W,
		ATTACK_ARC,
		ATTACK_RANGE,
		ENEMY_RADIUS,
		PLAYER_MAX_HP,
		PLAYER_RADIUS,
		createArenaState,
		stepArena,
		type ArenaInput
	} from './spike';

	let canvasEl: HTMLCanvasElement;
	let context: CanvasRenderingContext2D | null = null;
	let pixelRatio = 1;
	let raf = 0;
	let lastTime = 0;

	// Plain, non-reactive state driven by its own RAF loop — nothing here is
	// read from the template, so wrapping it in $state would only pay for a
	// deep proxy on every field, every frame, for no benefit (see
	// witch/world.ts for the same call made the same way).
	let state = createArenaState();
	const held = new Set<string>();
	let mouseAngle = 0;
	let attacking = false;
	let dashing = false;

	function start() {
		state = createArenaState();
		state.phase = 'running';
	}

	function configureCanvas() {
		if (!canvasEl) return;
		pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
		canvasEl.width = ARENA_W * pixelRatio;
		canvasEl.height = ARENA_H * pixelRatio;
		context = canvasEl.getContext('2d');
	}

	function pointerAngle(event: PointerEvent): number {
		const rect = canvasEl.getBoundingClientRect();
		const px = ((event.clientX - rect.left) / rect.width) * ARENA_W;
		const py = ((event.clientY - rect.top) / rect.height) * ARENA_H;
		return Math.atan2(py - state.player.pos.y, px - state.player.pos.x);
	}

	function onPointerMove(event: PointerEvent) {
		mouseAngle = pointerAngle(event);
	}

	function onPointerDown(event: PointerEvent) {
		canvasEl.setPointerCapture(event.pointerId);
		if (state.phase !== 'running') {
			start();
			return;
		}
		mouseAngle = pointerAngle(event);
		attacking = true;
	}

	function onPointerUp(event: PointerEvent) {
		if (canvasEl.hasPointerCapture(event.pointerId)) canvasEl.releasePointerCapture(event.pointerId);
		attacking = false;
	}

	function onKeyDown(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		if (key === ' ' || key === 'enter') {
			event.preventDefault();
			if (state.phase !== 'running') {
				start();
				return;
			}
			attacking = true;
		}
		if (key === 'shift') dashing = true;
		held.add(key);
	}

	function onKeyUp(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		if (key === ' ' || key === 'enter') attacking = false;
		if (key === 'shift') dashing = false;
		held.delete(key);
	}

	function axis(negKeys: string[], posKeys: string[]): number {
		const neg = negKeys.some((k) => held.has(k));
		const pos = posKeys.some((k) => held.has(k));
		return (pos ? 1 : 0) - (neg ? 1 : 0);
	}

	function loop(now: number) {
		const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
		lastTime = now;
		const input: ArenaInput = {
			moveX: axis(['a', 'arrowleft'], ['d', 'arrowright']),
			moveY: axis(['w', 'arrowup'], ['s', 'arrowdown']),
			aimAngle: mouseAngle,
			attack: attacking,
			dash: dashing
		};
		stepArena(state, dt, input);
		draw();
		raf = requestAnimationFrame(loop);
	}

	function draw() {
		const ctx = context;
		if (!ctx) return;
		ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		ctx.clearRect(0, 0, ARENA_W, ARENA_H);

		ctx.save();
		if (state.shake > 0) {
			ctx.translate((Math.random() - 0.5) * state.shake * 40, (Math.random() - 0.5) * state.shake * 40);
		}
		drawBackground(ctx);
		drawEnemies(ctx);
		drawPlayer(ctx);
		ctx.restore();

		drawHud(ctx);
		if (state.phase !== 'running') drawOverlay(ctx);
	}

	function drawBackground(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = '#f3ecda';
		ctx.fillRect(0, 0, ARENA_W, ARENA_H);
		ctx.strokeStyle = 'rgba(88, 74, 55, 0.08)';
		ctx.lineWidth = 1;
		for (let x = 40; x < ARENA_W; x += 40) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, ARENA_H);
			ctx.stroke();
		}
		for (let y = 40; y < ARENA_H; y += 40) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(ARENA_W, y);
			ctx.stroke();
		}
		ctx.strokeStyle = 'rgba(88, 74, 55, 0.35)';
		ctx.lineWidth = 4;
		ctx.strokeRect(2, 2, ARENA_W - 4, ARENA_H - 4);
	}

	function drawEnemies(ctx: CanvasRenderingContext2D) {
		for (const enemy of state.enemies) {
			ctx.save();
			ctx.fillStyle = 'rgba(30, 20, 10, 0.18)';
			ctx.beginPath();
			ctx.ellipse(enemy.pos.x, enemy.pos.y + ENEMY_RADIUS * 0.75, ENEMY_RADIUS * 0.8, ENEMY_RADIUS * 0.35, 0, 0, Math.PI * 2);
			ctx.fill();

			ctx.fillStyle = enemy.hurtFlash > 0 ? '#fdf6e3' : '#b8506c';
			ctx.strokeStyle = '#5c1f30';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(enemy.pos.x, enemy.pos.y, ENEMY_RADIUS, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.restore();
		}
	}

	function drawPlayer(ctx: CanvasRenderingContext2D) {
		const player = state.player;
		ctx.save();
		ctx.fillStyle = 'rgba(30, 20, 10, 0.2)';
		ctx.beginPath();
		ctx.ellipse(player.pos.x, player.pos.y + PLAYER_RADIUS * 0.75, PLAYER_RADIUS * 0.8, PLAYER_RADIUS * 0.35, 0, 0, Math.PI * 2);
		ctx.fill();

		if (player.attackTimer > 0) {
			ctx.fillStyle = 'rgba(181, 137, 0, 0.35)';
			ctx.beginPath();
			ctx.moveTo(player.pos.x, player.pos.y);
			ctx.arc(player.pos.x, player.pos.y, ATTACK_RANGE, player.facing - ATTACK_ARC / 2, player.facing + ATTACK_ARC / 2);
			ctx.closePath();
			ctx.fill();
		}

		ctx.fillStyle = player.hurtFlash > 0.35 ? '#fdf6e3' : '#3a3226';
		ctx.strokeStyle = player.dashTimer > 0 ? '#268bd2' : '#f3ecda';
		ctx.lineWidth = 2.4;
		ctx.beginPath();
		ctx.arc(player.pos.x, player.pos.y, PLAYER_RADIUS, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		ctx.strokeStyle = '#268bd2';
		ctx.lineWidth = 3;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(player.pos.x, player.pos.y);
		ctx.lineTo(
			player.pos.x + Math.cos(player.facing) * (PLAYER_RADIUS + 12),
			player.pos.y + Math.sin(player.facing) * (PLAYER_RADIUS + 12)
		);
		ctx.stroke();
		ctx.restore();
	}

	function drawHud(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.fillStyle = 'rgba(253, 246, 227, 0.9)';
		ctx.strokeStyle = 'rgba(88, 74, 55, 0.4)';
		ctx.lineWidth = 1;
		ctx.fillRect(14, 14, 200, 34);
		ctx.strokeRect(14, 14, 200, 34);
		const pct = Math.max(0, state.player.hp / PLAYER_MAX_HP);
		ctx.fillStyle = pct > 0.3 ? '#5f7a52' : '#b8506c';
		ctx.fillRect(18, 18, 192 * pct, 12);
		ctx.strokeRect(18, 18, 192, 12);
		ctx.fillStyle = '#3a3226';
		ctx.font = '13px var(--font-ui)';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillText(`${Math.ceil(state.player.hp)} / ${PLAYER_MAX_HP}`, 18, 34);

		ctx.fillStyle = 'rgba(253, 246, 227, 0.9)';
		ctx.fillRect(ARENA_W - 110, 14, 96, 34);
		ctx.strokeRect(ARENA_W - 110, 14, 96, 34);
		ctx.fillStyle = '#3a3226';
		ctx.textAlign = 'center';
		ctx.fillText(`kills ${state.kills}`, ARENA_W - 62, 24);
		ctx.restore();
	}

	function drawOverlay(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.fillStyle = 'rgba(243, 236, 218, 0.86)';
		ctx.fillRect(0, 0, ARENA_W, ARENA_H);
		ctx.fillStyle = '#3a3226';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = '32px var(--font-display)';
		ctx.fillText(state.phase === 'over' ? 'you fell' : 'Arena — a feel spike', ARENA_W / 2, ARENA_H / 2 - 20);
		ctx.font = '15px var(--font-ui)';
		ctx.fillText(
			state.phase === 'over'
				? `${state.kills} kills — click or press space to try again`
				: 'WASD move · mouse aim · click / space attack · shift dash',
			ARENA_W / 2,
			ARENA_H / 2 + 16
		);
		ctx.restore();
	}

	onMount(() => {
		configureCanvas();
		window.addEventListener('resize', configureCanvas);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		lastTime = performance.now();
		raf = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', configureCanvas);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
		};
	});

	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
	});
</script>

<canvas
	bind:this={canvasEl}
	class="arena-canvas"
	aria-label="Arena feel-spike: move with WASD, aim with the mouse, attack with click or space, dash with shift"
	onpointermove={onPointerMove}
	onpointerdown={onPointerDown}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
	oncontextmenu={(e) => e.preventDefault()}
	>a small top-down arena with a player circle and chasing enemies</canvas
>

<style>
	.arena-canvas {
		display: block;
		width: min(840px, calc(100vw - 2.4rem));
		aspect-ratio: 840 / 480;
		background: #f3ecda;
		border: 1px solid var(--rule, rgba(88, 74, 55, 0.4));
		border-radius: 6px;
		touch-action: none;
		user-select: none;
		cursor: crosshair;
	}
</style>
