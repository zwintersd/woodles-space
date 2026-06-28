<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ArcadeHud from './ArcadeHud.svelte';
	import ArcadeProgress from './ArcadeProgress.svelte';
	import { clamp, distance, type Dot } from './arcadeMath';
	import { fmt } from '$lib/witch/book.svelte';
	import { awardArcadeReward, previewArcadeReward } from './arcadeRewards';

	interface Props {
		onclose: () => void;
	}
	let { onclose }: Props = $props();

	type Phase = 'ready' | 'running' | 'complete' | 'over';
	type BubbleColor = 'sun' | 'sea' | 'leaf' | 'violet';

	interface Bubble {
		row: number;
		col: number;
		color: BubbleColor;
	}

	interface Shot extends Dot {
		vx: number;
		vy: number;
		color: BubbleColor;
	}

	interface Burst extends Dot {
		id: number;
		text: string;
		life: number;
		tone: BubbleColor | 'ink';
	}

	const COLORS: BubbleColor[] = ['sun', 'sea', 'leaf', 'violet'];
	const WORLD_W = 520;
	const WORLD_H = 360;
	const COLS = 11;
	const ROWS = 11;
	const BUBBLE_R = 17;
	const BUBBLE_DIAM = BUBBLE_R * 2;
	const ROW_STEP = 29;
	const GRID_LEFT = 73;
	const GRID_TOP = 26;
	const SHOOTER: Dot = { x: WORLD_W / 2, y: WORLD_H - 22 };
	const SHOT_SPEED = 340;
	const SHOTS_PER_DROP = 5;
	const MAX_REWARD = 24;
	const MIN_ANGLE = -2.72;
	const MAX_ANGLE = -0.42;
	const AIM_SPEED = 2.2;
	const WALL_LEFT = BUBBLE_R + 6;
	const WALL_RIGHT = WORLD_W - BUBBLE_R - 6;
	const DANGER_Y = GRID_TOP + (ROWS - 1) * ROW_STEP + BUBBLE_R - ROW_STEP / 2;
	const EVEN_NEIGHBORS = [
		{ row: 0, col: -1 },
		{ row: 0, col: 1 },
		{ row: -1, col: -1 },
		{ row: -1, col: 0 },
		{ row: 1, col: -1 },
		{ row: 1, col: 0 }
	];
	const ODD_NEIGHBORS = [
		{ row: 0, col: -1 },
		{ row: 0, col: 1 },
		{ row: -1, col: 0 },
		{ row: -1, col: 1 },
		{ row: 1, col: 0 },
		{ row: 1, col: 1 }
	];

	const keys = new Set<string>();

	let phase = $state<Phase>('ready');
	let bubbles = $state<Bubble[]>(seedBoard());
	let shot = $state<Shot | null>(null);
	let bursts = $state<Burst[]>([]);
	let loadedColor = $state<BubbleColor>('sun');
	let nextColor = $state<BubbleColor>('sea');
	let aimAngle = $state(-Math.PI / 2);
	let popped = $state(0);
	let dropped = $state(0);
	let shotsTaken = $state(0);
	let rack = $state(0);
	let advances = $state(0);
	let awarded = $state(0);
	let rounds = $state(0);
	let best = $state(0);
	let raf = 0;
	let lastTime = 0;
	let burstSeq = 0;
	let pointerDown = false;
	let fieldEl: SVGSVGElement;

	const nextDrop = $derived(SHOTS_PER_DROP - rack);
	const pressure = $derived.by(() => {
		const deepest = bubbles.reduce((max, bubble) => Math.max(max, bubble.row), -1);
		return clamp((deepest + rack / SHOTS_PER_DROP) / (ROWS - 1), 0, 1);
	});
	const startLabel = $derived(phase === 'running' ? 'restart' : rounds > 0 ? 'again' : 'start');
	const rewardPreview = $derived(rewardFor(popped, dropped, phase === 'complete'));
	const outcomeLabel = $derived.by(() => {
		if (phase === 'complete') return awarded > 0 ? `+${fmt(awarded)} insight` : 'clear';
		if (phase === 'over') return 'buried';
		if (rounds > 0) return 'again?';
		return 'ready?';
	});
	const hintLabel = $derived.by(() => {
		if (phase === 'running') return 'aim, bounce, match three';
		if (phase === 'complete') return 'the canopy came down in pieces';
		if (phase === 'over') return 'the ceiling reached the sill';
		return 'clear the canopy before it presses down';
	});
	const guidePath = $derived.by(() => {
		if (shot) return '';
		const points = aimGuide();
		return points.map((point) => `${point.x},${point.y}`).join(' ');
	});

	function seedBoard(): Bubble[] {
		const seeded: Bubble[] = [];
		for (let row = 0; row < 5; row += 1) {
			for (let col = 0; col < COLS; col += 1) {
				seeded.push({
					row,
					col,
					color: COLORS[(Math.floor(col / 2) + row) % COLORS.length]
				});
			}
		}
		return seeded;
	}

	function rewardFor(popCount: number, dropCount: number, cleared: boolean): number {
		const raw = Math.floor(popCount / 5) + Math.floor(dropCount / 3) + (cleared ? 9 : 0);
		return previewArcadeReward(raw, MAX_REWARD);
	}

	function cellKey(row: number, col: number): string {
		return `${row}:${col}`;
	}

	function bubbleKey(bubble: Bubble): string {
		return cellKey(bubble.row, bubble.col);
	}

	function rowOffset(row: number): number {
		return row % 2 === 0 ? 0 : BUBBLE_R;
	}

	function bubbleCenter(row: number, col: number): Dot {
		return {
			x: GRID_LEFT + rowOffset(row) + col * BUBBLE_DIAM + BUBBLE_R,
			y: GRID_TOP + row * ROW_STEP + BUBBLE_R
		};
	}

	function bubbleMap(source: Bubble[]): Map<string, Bubble> {
		return new Map(source.map((bubble) => [bubbleKey(bubble), bubble]));
	}

	function paletteFor(source: Bubble[]): BubbleColor[] {
		const set = new Set(source.map((bubble) => bubble.color));
		const palette = COLORS.filter((color) => set.has(color));
		return palette.length > 0 ? palette : COLORS;
	}

	function randomPaletteColor(source: Bubble[]): BubbleColor {
		const palette = paletteFor(source);
		return palette[Math.floor(Math.random() * palette.length)] ?? COLORS[0];
	}

	function reset() {
		const seeded = seedBoard();
		bubbles = seeded;
		shot = null;
		bursts = [];
		loadedColor = randomPaletteColor(seeded);
		nextColor = randomPaletteColor(seeded);
		aimAngle = -Math.PI / 2;
		popped = 0;
		dropped = 0;
		shotsTaken = 0;
		rack = 0;
		advances = 0;
		awarded = 0;
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
		best = Math.max(best, popped + dropped);
		awarded = awardArcadeReward('margin-bubbles', rewardFor(popped, dropped, nextPhase === 'complete'), MAX_REWARD);
	}

	function loop(now: number) {
		const dt = Math.min(0.034, Math.max(0, (now - lastTime) / 1000));
		lastTime = now;
		step(dt);
		if (phase === 'running') raf = requestAnimationFrame(loop);
	}

	function step(dt: number) {
		updateAim(dt);
		updateBursts(dt);
		updateShot(dt);
	}

	function updateAim(dt: number) {
		let delta = 0;
		if (keys.has('arrowleft') || keys.has('a')) delta -= 1;
		if (keys.has('arrowright') || keys.has('d')) delta += 1;
		if (delta === 0) return;
		aimAngle = clamp(aimAngle + delta * AIM_SPEED * dt, MIN_ANGLE, MAX_ANGLE);
	}

	function updateBursts(dt: number) {
		bursts = bursts
			.map((burst) => ({ ...burst, y: burst.y - 22 * dt, life: burst.life - dt }))
			.filter((burst) => burst.life > 0);
	}

	function updateShot(dt: number) {
		if (!shot) return;
		let nextShot: Shot = {
			...shot,
			x: shot.x + shot.vx * dt,
			y: shot.y + shot.vy * dt
		};

		if (nextShot.x <= WALL_LEFT) {
			nextShot = { ...nextShot, x: WALL_LEFT, vx: Math.abs(nextShot.vx) };
		} else if (nextShot.x >= WALL_RIGHT) {
			nextShot = { ...nextShot, x: WALL_RIGHT, vx: -Math.abs(nextShot.vx) };
		}

		if (nextShot.y <= GRID_TOP + BUBBLE_R) {
			placeShot(nextShot, true);
			return;
		}

		const collided = bubbles.some(
			(bubble) => distance(nextShot, bubbleCenter(bubble.row, bubble.col)) <= BUBBLE_DIAM - 2
		);
		if (collided) {
			placeShot(nextShot, false);
			return;
		}

		shot = nextShot;
	}

	function fire() {
		if (phase !== 'running') {
			start();
			return;
		}
		if (shot) return;
		const color = loadedColor;
		shot = {
			x: SHOOTER.x,
			y: SHOOTER.y - 24,
			vx: Math.cos(aimAngle) * SHOT_SPEED,
			vy: Math.sin(aimAngle) * SHOT_SPEED,
			color
		};
		loadedColor = nextColor;
		nextColor = randomPaletteColor(bubbles);
	}

	function placeShot(activeShot: Shot, anchoredToTop: boolean) {
		const cell = findNearestOpenCell(activeShot.x, anchoredToTop ? GRID_TOP + BUBBLE_R : activeShot.y, bubbles);
		shot = null;
		if (!cell) {
			finish('over');
			return;
		}

		shotsTaken += 1;
		rack += 1;
		const candidate: Bubble = { ...cell, color: activeShot.color };
		resolvePlacement([...bubbles, candidate], candidate);
	}

	function findNearestOpenCell(x: number, y: number, source: Bubble[]): Pick<Bubble, 'row' | 'col'> | null {
		const occupied = new Set(source.map(bubbleKey));
		let bestCell: Pick<Bubble, 'row' | 'col'> | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;

		for (let row = 0; row < ROWS; row += 1) {
			for (let col = 0; col < COLS; col += 1) {
				if (occupied.has(cellKey(row, col))) continue;
				const center = bubbleCenter(row, col);
				const gap = Math.hypot(center.x - x, center.y - y);
				if (gap < bestDistance) {
					bestDistance = gap;
					bestCell = { row, col };
				}
			}
		}

		return bestCell;
	}

	function neighboringCells(row: number, col: number): Array<Pick<Bubble, 'row' | 'col'>> {
		const offsets = row % 2 === 0 ? EVEN_NEIGHBORS : ODD_NEIGHBORS;
		return offsets
			.map((offset) => ({ row: row + offset.row, col: col + offset.col }))
			.filter((cell) => cell.row >= 0 && cell.row < ROWS && cell.col >= 0 && cell.col < COLS);
	}

	function matchingCluster(start: Bubble, source: Bubble[]): Bubble[] {
		const map = bubbleMap(source);
		const seen = new Set<string>();
		const queue = [start];
		const cluster: Bubble[] = [];

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) continue;
			const key = bubbleKey(current);
			if (seen.has(key)) continue;
			seen.add(key);
			cluster.push(current);
			for (const neighbor of neighboringCells(current.row, current.col)) {
				const match = map.get(cellKey(neighbor.row, neighbor.col));
				if (match && match.color === start.color && !seen.has(bubbleKey(match))) queue.push(match);
			}
		}

		return cluster;
	}

	function anchoredKeys(source: Bubble[]): Set<string> {
		const map = bubbleMap(source);
		const anchored = new Set<string>();
		const queue = source.filter((bubble) => bubble.row === 0);

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) continue;
			const key = bubbleKey(current);
			if (anchored.has(key)) continue;
			anchored.add(key);
			for (const neighbor of neighboringCells(current.row, current.col)) {
				const attached = map.get(cellKey(neighbor.row, neighbor.col));
				if (attached && !anchored.has(bubbleKey(attached))) queue.push(attached);
			}
		}

		return anchored;
	}

	function addBurst(x: number, y: number, text: string, tone: Burst['tone'] = 'ink') {
		bursts = [...bursts, { id: ++burstSeq, x, y, text, tone, life: 0.68 }];
	}

	function clusterCenter(source: Bubble[]): Dot {
		const total = source.reduce(
			(sum, bubble) => {
				const center = bubbleCenter(bubble.row, bubble.col);
				return { x: sum.x + center.x, y: sum.y + center.y };
			},
			{ x: 0, y: 0 }
		);
		return {
			x: total.x / source.length,
			y: total.y / source.length
		};
	}

	function advanceCeiling(source: Bubble[]): Bubble[] {
		const shifted = source.map((bubble) => ({ ...bubble, row: bubble.row + 1 }));
		const palette = paletteFor(shifted);
		const gapA = (shotsTaken + advances + 1) % COLS;
		const gapB = (shotsTaken + advances + 5) % COLS;
		const freshRow: Bubble[] = [];
		for (let col = 0; col < COLS; col += 1) {
			if (col === gapA || col === gapB) continue;
			freshRow.push({
				row: 0,
				col,
				color: palette[(col + shotsTaken + advances) % palette.length] ?? COLORS[0]
			});
		}
		return [...shifted, ...freshRow];
	}

	function normalizeQueue(source: Bubble[]) {
		const palette = paletteFor(source);
		if (!palette.includes(loadedColor)) loadedColor = palette[0] ?? COLORS[0];
		if (!palette.includes(nextColor)) nextColor = randomPaletteColor(source);
	}

	function resolvePlacement(source: Bubble[], placed: Bubble) {
		let nextBubbles = source;
		const cluster = matchingCluster(placed, source);
		if (cluster.length >= 3) {
			const clusterKeys = new Set(cluster.map(bubbleKey));
			nextBubbles = source.filter((bubble) => !clusterKeys.has(bubbleKey(bubble)));
			popped += cluster.length;
			const center = clusterCenter(cluster);
			addBurst(center.x, center.y, `+${cluster.length}`, placed.color);

			const anchored = anchoredKeys(nextBubbles);
			const floating = nextBubbles.filter((bubble) => !anchored.has(bubbleKey(bubble)));
			if (floating.length > 0) {
				nextBubbles = nextBubbles.filter((bubble) => anchored.has(bubbleKey(bubble)));
				dropped += floating.length;
				const dropCenter = clusterCenter(floating);
				addBurst(dropCenter.x, dropCenter.y, `drop ${floating.length}`, 'ink');
			}
		} else {
			const center = bubbleCenter(placed.row, placed.col);
			addBurst(center.x, center.y, 'set', placed.color);
		}

		if (nextBubbles.length === 0) {
			bubbles = nextBubbles;
			normalizeQueue(COLORS.map((color, index) => ({ row: 0, col: index, color } as Bubble)));
			finish('complete');
			return;
		}

		if (rack >= SHOTS_PER_DROP) {
			nextBubbles = advanceCeiling(nextBubbles);
			rack = 0;
			advances += 1;
			addBurst(SHOOTER.x, GRID_TOP + 10, 'ceiling', 'ink');
		}

		bubbles = nextBubbles;
		normalizeQueue(nextBubbles);
		if (nextBubbles.some((bubble) => bubble.row >= ROWS - 1)) {
			finish('over');
		}
	}

	function aimGuide(): Dot[] {
		const points: Dot[] = [{ x: SHOOTER.x, y: SHOOTER.y - 10 }];
		let x = SHOOTER.x;
		let y = SHOOTER.y - 10;
		let vx = Math.cos(aimAngle) * 18;
		let vy = Math.sin(aimAngle) * 18;

		for (let step = 0; step < 36; step += 1) {
			x += vx;
			y += vy;
			if (x <= WALL_LEFT) {
				x = WALL_LEFT;
				vx = Math.abs(vx);
			} else if (x >= WALL_RIGHT) {
				x = WALL_RIGHT;
				vx = -Math.abs(vx);
			}
			points.push({ x, y });
			if (y <= GRID_TOP + BUBBLE_R) break;
		}

		return points;
	}

	function pointerToLocal(event: PointerEvent): Dot {
		const rect = fieldEl.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * WORLD_W,
			y: ((event.clientY - rect.top) / rect.height) * WORLD_H
		};
	}

	function setAim(point: Dot) {
		const angle = Math.atan2(point.y - SHOOTER.y, point.x - SHOOTER.x);
		aimAngle = clamp(angle, MIN_ANGLE, MAX_ANGLE);
	}

	function nudgeAim(direction: -1 | 1) {
		aimAngle = clamp(aimAngle + direction * 0.2, MIN_ANGLE, MAX_ANGLE);
	}

	function onPointerDown(event: PointerEvent) {
		pointerDown = true;
		fieldEl.setPointerCapture(event.pointerId);
		setAim(pointerToLocal(event));
	}

	function onPointerMove(event: PointerEvent) {
		if (!pointerDown) return;
		setAim(pointerToLocal(event));
	}

	function onPointerUp(event: PointerEvent) {
		pointerDown = false;
		fieldEl.releasePointerCapture(event.pointerId);
		setAim(pointerToLocal(event));
		fire();
	}

	function onKeyDown(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) {
			event.preventDefault();
			keys.add(key);
			return;
		}
		if (key === ' ' || key === 'enter') {
			event.preventDefault();
			fire();
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

<div class="bubble-shell">
	<ArcadeHud
		title="Margin Bubbles"
		hint={hintLabel}
		scores={[
			{ label: 'popped', value: popped },
			{ label: 'dropped', value: dropped, live: true, tone: 'violet' },
			{ label: 'ceiling', value: nextDrop },
			{ label: 'prize', value: fmt(phase === 'complete' || phase === 'over' ? awarded : rewardPreview) }
		]}
		{startLabel}
		onstart={start}
		onclose={onclose}
	/>

	<ArcadeProgress value={pressure} label="ceiling pressure" tone="danger" />

	<svg
		bind:this={fieldEl}
		class="field"
		class:active={phase === 'running'}
		viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
		role="img"
		aria-label="Margin Bubbles arena"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
	>
		<defs>
			<pattern id="bubble-grid" width="34" height="34" patternUnits="userSpaceOnUse">
				<path d="M 34 0 L 0 0 0 34" fill="none" stroke="rgba(88, 110, 117, 0.12)" stroke-width="1" />
			</pattern>
		</defs>
		<rect class="field-bg" width={WORLD_W} height={WORLD_H} rx="6" />
		<rect width={WORLD_W} height={WORLD_H} fill="url(#bubble-grid)" opacity="0.56" />
		<line class="danger-line" x1="0" y1={DANGER_Y} x2={WORLD_W} y2={DANGER_Y} />

		{#each bubbles as bubble (bubbleKey(bubble))}
			{@const center = bubbleCenter(bubble.row, bubble.col)}
			<circle class={`bubble-shadow bubble-shadow-${bubble.color}`} cx={center.x} cy={center.y + 5} r={BUBBLE_R - 1} />
			<circle class={`bubble bubble-${bubble.color}`} cx={center.x} cy={center.y} r={BUBBLE_R} />
			<circle class="bubble-shine" cx={center.x - 5} cy={center.y - 6} r="4.2" />
		{/each}

		{#if guidePath}
			<polyline class="aim-guide" points={guidePath} />
		{/if}

		<line
			class="aim-barrel"
			x1={SHOOTER.x}
			y1={SHOOTER.y}
			x2={SHOOTER.x + Math.cos(aimAngle) * 42}
			y2={SHOOTER.y + Math.sin(aimAngle) * 42}
		/>
		<circle class={`loaded loaded-${loadedColor}`} cx={SHOOTER.x} cy={SHOOTER.y - 8} r={BUBBLE_R - 1} />
		<circle class="shooter-base" cx={SHOOTER.x} cy={SHOOTER.y + 4} r="18" />

		{#if shot}
			<circle class={`bubble bubble-${shot.color}`} cx={shot.x} cy={shot.y} r={BUBBLE_R} />
			<circle class="bubble-shine" cx={shot.x - 5} cy={shot.y - 6} r="4.2" />
		{/if}

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
			<text class="center-title" x={WORLD_W / 2} y={WORLD_H / 2 - 12} text-anchor="middle">
				{outcomeLabel}
			</text>
			<text class="center-sub" x={WORLD_W / 2} y={WORLD_H / 2 + 22} text-anchor="middle">
				{phase === 'ready'
					? 'three of a kind, and mind the ceiling'
					: `pop ${popped} · drop ${dropped} · best ${best} · ${rounds} run${rounds === 1 ? '' : 's'}`}
			</text>
		{/if}
	</svg>

	<div class="control-row" aria-label="bubble controls">
		<button onclick={() => nudgeAim(-1)}>aim left</button>
		<button class="fire-btn" onclick={fire}>fire</button>
		<button onclick={() => nudgeAim(1)}>aim right</button>
	</div>

	<div class="queue-row" aria-label="loaded and next bubbles">
		<div class="queue-card">
			<span>loaded</span>
			<i class={`queue-bubble bubble-${loadedColor}`}></i>
		</div>
		<div class="queue-card">
			<span>next</span>
			<i class={`queue-bubble bubble-${nextColor}`}></i>
		</div>
		<p>
			Pointer, arrows, or `A` / `D` to aim. Space, Enter, click, or tap to fire.
			Every fifth shot lowers the ceiling.
		</p>
	</div>
</div>

<style>
	.bubble-shell {
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}
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
	.control-row button:hover {
		background: var(--sol-base00);
	}
	.field {
		width: min(540px, calc(100vw - 3rem));
		aspect-ratio: 26 / 18;
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
	.danger-line {
		stroke: rgba(220, 50, 47, 0.34);
		stroke-width: 2;
		stroke-dasharray: 8 6;
	}
	.aim-guide {
		fill: none;
		stroke: rgba(38, 139, 210, 0.34);
		stroke-width: 2.4;
		stroke-dasharray: 6 7;
		stroke-linecap: round;
	}
	.aim-barrel {
		stroke: var(--sol-base00);
		stroke-width: 9;
		stroke-linecap: round;
	}
	.shooter-base {
		fill: var(--sol-base01);
		stroke: rgba(253, 246, 227, 0.82);
		stroke-width: 3;
	}
	.bubble-shadow {
		opacity: 0.18;
	}
	.bubble-shadow-sun,
	.loaded-sun,
	.bubble-sun {
		fill: var(--sol-yellow);
	}
	.bubble-shadow-sea,
	.loaded-sea,
	.bubble-sea {
		fill: var(--sol-blue);
	}
	.bubble-shadow-leaf,
	.loaded-leaf,
	.bubble-leaf {
		fill: var(--sol-green);
	}
	.bubble-shadow-violet,
	.loaded-violet,
	.bubble-violet {
		fill: var(--sol-violet);
	}
	.bubble,
	.loaded {
		stroke: rgba(253, 246, 227, 0.92);
		stroke-width: 2.5;
	}
	.bubble-shine {
		fill: rgba(253, 246, 227, 0.52);
		pointer-events: none;
	}
	.burst {
		font-family: var(--font-counter);
		font-size: 17px;
		fill: var(--sol-base01);
		opacity: calc(0.2 + var(--life));
		pointer-events: none;
	}
	.burst-sun {
		fill: var(--sol-yellow);
	}
	.burst-sea {
		fill: var(--sol-blue);
	}
	.burst-leaf {
		fill: var(--sol-green);
	}
	.burst-violet {
		fill: var(--sol-violet);
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
	.control-row {
		width: min(540px, 100%);
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
	.queue-row {
		width: min(540px, 100%);
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		gap: 0.65rem;
		align-items: center;
	}
	.queue-card {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.38rem 0.55rem;
		border-radius: 4px;
		background: var(--sol-base2);
		font-family: var(--font-ui);
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--sol-base1);
	}
	.queue-bubble {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border-radius: 999px;
		border: 2px solid rgba(253, 246, 227, 0.9);
	}
	.queue-row p {
		margin: 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.8rem;
		color: var(--sol-base1);
	}
	@media (max-width: 560px) {
		.center-title {
			font-size: 34px;
		}
		.queue-row {
			grid-template-columns: 1fr 1fr;
		}
		.queue-row p {
			grid-column: 1 / -1;
		}
	}
</style>
