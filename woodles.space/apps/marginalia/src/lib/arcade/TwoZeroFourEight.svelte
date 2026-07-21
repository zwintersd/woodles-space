<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import ArcadeHud from './ArcadeHud.svelte';
	import ArcadePetPerks from './ArcadePetPerks.svelte';
	import {
		coreStatValue,
		statTier,
		type ArcadeActivePet,
		type ArcadeCoreStat,
		type ArcadeStatEffects
	} from './arcadeStats';
	import { scoreOnlyReason } from './arcadeRewards';
	import { loadArcadeRecord, recordArcadeRun } from './arcadeRecords';

	interface Props {
		onclose: () => void;
		activePet?: ArcadeActivePet;
	}
	let { onclose, activePet = null }: Props = $props();

	type Board = number[][];
	type Dir = 'left' | 'right' | 'up' | 'down';
	type Mode = 'endless' | 'turn-100';
	type SupportStat = 'will' | 'spark';
	type PowerUpId = 'delete' | 'double' | 'undo';
	type TargetPowerUpId = Exclude<PowerUpId, 'undo'>;
	type PowerUps = Record<PowerUpId, number>;

	interface TurnSnapshot {
		board: Board;
		score: number;
		won: boolean;
		over: boolean;
		keepPlaying: boolean;
		turns: number;
		overReason: OverReason;
	}

	type OverReason = 'moves' | 'turns' | null;

	const GAME_ID = 'stack-2048';
	const BASE_TURN_LIMIT = 100;
	const scoreOnlyLabel = scoreOnlyReason(GAME_ID) ? 'score only' : '—';

	// ── board helpers ────────────────────────────────────────────────────
	function emptyBoard(): Board {
		return Array.from({ length: 4 }, () => [0, 0, 0, 0]);
	}

	function addTile(b: Board, value?: number): void {
		const empties: [number, number][] = [];
		for (let r = 0; r < 4; r++)
			for (let c = 0; c < 4; c++)
				if (b[r][c] === 0) empties.push([r, c]);
		if (!empties.length) return;
		const [r, c] = empties[Math.floor(Math.random() * empties.length)];
		b[r][c] = value ?? (Math.random() < 0.9 ? 2 : 4);
	}

	function statValue(stat: ArcadeCoreStat): number {
		return coreStatValue(activePet, stat);
	}

	function supportStatValue(stat: SupportStat): number {
		return activePet?.stats?.[stat] ?? 0;
	}

	function openingTileValue(): number | undefined {
		const tier = statTier(statValue('body'));
		return tier > 0 ? 2 ** (3 + tier) : undefined;
	}

	function freshPowerUps(): PowerUps {
		return {
			delete: statTier(statValue('grace')),
			double: statTier(statValue('heart')),
			undo: statTier(statValue('mind'))
		};
	}

	function freshBoard(): Board {
		const b = emptyBoard();
		const openingTile = openingTileValue();
		if (openingTile) addTile(b, openingTile);
		addTile(b);
		addTile(b);
		return b;
	}

	// Slide one row leftward; returns new row and points gained
	function slideRow(row: number[]): { row: number[]; score: number } {
		const tiles = row.filter((v) => v !== 0);
		let gained = 0;
		const out: number[] = [];
		let i = 0;
		while (i < tiles.length) {
			if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
				const merged = tiles[i] * 2;
				out.push(merged);
				gained += merged;
				i += 2;
			} else {
				out.push(tiles[i]);
				i++;
			}
		}
		while (out.length < 4) out.push(0);
		return { row: out, score: gained };
	}

	function applyLeft(b: Board): { board: Board; score: number; moved: boolean } {
		let gained = 0;
		let moved = false;
		const nb = b.map((row) => {
			const { row: nr, score: s } = slideRow(row);
			gained += s;
			if (nr.some((v, i) => v !== row[i])) moved = true;
			return nr;
		});
		return { board: nb, score: gained, moved };
	}

	const transpose = (b: Board): Board => b[0].map((_, c) => b.map((row) => row[c]));
	const flipH = (b: Board): Board => b.map((row) => [...row].reverse());

	function applyMove(b: Board, dir: Dir): { board: Board; score: number; moved: boolean } {
		switch (dir) {
			case 'left':
				return applyLeft(b);
			case 'right': {
				const r = applyLeft(flipH(b));
				return { ...r, board: flipH(r.board) };
			}
			case 'up': {
				const r = applyLeft(transpose(b));
				return { ...r, board: transpose(r.board) };
			}
			case 'down': {
				const r = applyLeft(flipH(transpose(b)));
				return { ...r, board: transpose(flipH(r.board)) };
			}
		}
	}

	function hasMovesLeft(b: Board): boolean {
		for (let r = 0; r < 4; r++)
			for (let c = 0; c < 4; c++) {
				if (b[r][c] === 0) return true;
				if (c + 1 < 4 && b[r][c] === b[r][c + 1]) return true;
				if (r + 1 < 4 && b[r][c] === b[r + 1][c]) return true;
			}
		return false;
	}

	function cloneBoard(b: Board): Board {
		return b.map((row) => [...row]);
	}

	// ── state ─────────────────────────────────────────────────────────────
	let board = $state<Board>(freshBoard());
	let score = $state(0);
	let best = $state(loadArcadeRecord(recordId('endless')).bestScore);
	let won = $state(false);
	let over = $state(false);
	let keepPlaying = $state(false);
	let overReason = $state<OverReason>(null);
	let mode = $state<Mode>('endless');
	let turns = $state(0);
	let powerUps = $state<PowerUps>(freshPowerUps());
	let sparkReserve = $state(statTier(supportStatValue('spark')));
	let activePower = $state<TargetPowerUpId | null>(null);
	let undoStack = $state<TurnSnapshot[]>([]);
	let recordedRun = $state(false);

	const turnLimit = $derived(
		mode === 'turn-100' ? BASE_TURN_LIMIT + statTier(supportStatValue('will')) * 10 : null
	);
	const turnDisplay = $derived(turnLimit === null ? `${turns}` : `${turns}/${turnLimit}`);
	const turnsLeft = $derived(turnLimit === null ? null : Math.max(turnLimit - turns, 0));
	const canPlay = $derived(!over && !(won && !keepPlaying));
	const supportBonusLabel = $derived.by(() => {
		const parts: string[] = [];
		const willTier = statTier(supportStatValue('will'));
		const sparkTier = statTier(supportStatValue('spark'));
		if (mode === 'turn-100' && willTier > 0) {
			const extraTurns = willTier * 10;
			parts.push(`will quietly adds ${extraTurns} turn${extraTurns === 1 ? '' : 's'}`);
		}
		if (sparkTier > 0) {
			parts.push(`spark adds ${sparkTier} wild charge${sparkTier === 1 ? '' : 's'}`);
		}
		return parts.join(' · ');
	});
	const statEffects = $derived<ArcadeStatEffects>({
		body: () => (openingTileValue() ? `opens with ${openingTileValue()}` : 'no opening tile'),
		mind: (_value, tier) => `${tier} undo`,
		grace: (_value, tier) => `${tier} delete`,
		heart: (_value, tier) => `${tier} double`
	});

	function recordId(nextMode: Mode = mode): string {
		return `${GAME_ID}:${nextMode}`;
	}

	function loadBestForMode(nextMode: Mode = mode) {
		best = loadArcadeRecord(recordId(nextMode)).bestScore;
	}

	function recordRun(reason: string) {
		if (recordedRun || (turns === 0 && score === 0)) return;
		const record = recordArcadeRun(recordId(), {
			score,
			summary: {
				mode,
				turns,
				reason,
				won,
				over
			}
		});
		best = record.bestScore;
		recordedRun = true;
	}

	function snapshotTurn(): TurnSnapshot {
		return {
			board: cloneBoard(board),
			score,
			won,
			over,
			keepPlaying,
			turns,
			overReason
		};
	}

	function move(dir: Dir) {
		if (!canPlay) return;
		const { board: nb, score: gained, moved } = applyMove(board, dir);
		if (!moved) return;
		undoStack = [...undoStack, snapshotTurn()].slice(-20);
		score += gained;
		if (score > best) best = score;
		addTile(nb);
		board = nb;
		turns += 1;
		if (!won && nb.some((row) => row.includes(2048))) won = true;
		if (turnLimit !== null && turns >= turnLimit) {
			over = true;
			overReason = 'turns';
		} else if (!hasMovesLeft(nb)) {
			over = true;
			overReason = 'moves';
		}
		if (over) recordRun(overReason ?? 'over');
	}

	function freshRun() {
		board = freshBoard();
		score = 0;
		won = false;
		over = false;
		keepPlaying = false;
		overReason = null;
		turns = 0;
		powerUps = freshPowerUps();
		sparkReserve = statTier(supportStatValue('spark'));
		activePower = null;
		undoStack = [];
		recordedRun = false;
	}

	function reset() {
		recordRun('reset');
		freshRun();
	}

	function setMode(next: Mode) {
		if (mode === next) return;
		recordRun('mode');
		mode = next;
		loadBestForMode(next);
		freshRun();
	}

	function powerCount(id: PowerUpId): number {
		return powerUps[id] + sparkReserve;
	}

	function consumePowerUp(id: PowerUpId): boolean {
		if (powerUps[id] > 0) {
			powerUps = { ...powerUps, [id]: powerUps[id] - 1 };
			return true;
		}
		if (sparkReserve > 0) {
			sparkReserve -= 1;
			return true;
		}
		return false;
	}

	function chooseTargetPower(id: TargetPowerUpId) {
		if (!canPlay || powerCount(id) <= 0) return;
		activePower = activePower === id ? null : id;
	}

	function useTargetPower(r: number, c: number) {
		if (!activePower || !canPlay || board[r][c] === 0 || !consumePowerUp(activePower)) return;

		const nb = cloneBoard(board);
		if (activePower === 'delete') {
			nb[r][c] = 0;
		} else {
			nb[r][c] *= 2;
			if (!won && nb[r][c] >= 2048) won = true;
		}
		board = nb;
		activePower = null;
		if (!hasMovesLeft(nb)) {
			over = true;
			overReason = 'moves';
			recordRun('moves');
		}
	}

	function undoTurn() {
		if (undoStack.length === 0 || !consumePowerUp('undo')) return;
		const last = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);
		board = cloneBoard(last.board);
		score = last.score;
		won = last.won;
		over = last.over;
		keepPlaying = last.keepPlaying;
		turns = last.turns;
		overReason = last.overReason;
		activePower = null;
	}

	function onCellKey(e: KeyboardEvent, r: number, c: number) {
		if ((e.key === 'Enter' || e.key === ' ') && activePower) {
			e.preventDefault();
			useTargetPower(r, c);
		}
	}

	// ── keyboard ──────────────────────────────────────────────────────────
	const keyMap: Partial<Record<string, Dir>> = {
		ArrowLeft: 'left',
		ArrowRight: 'right',
		ArrowUp: 'up',
		ArrowDown: 'down',
		a: 'left',
		d: 'right',
		w: 'up',
		s: 'down'
	};

	function onKey(e: KeyboardEvent) {
		const dir = keyMap[e.key];
		if (dir) {
			e.preventDefault();
			move(dir);
		}
	}

	// ── touch ─────────────────────────────────────────────────────────────
	let tx = 0,
		ty = 0;
	function onTouchStart(e: TouchEvent) {
		tx = e.touches[0].clientX;
		ty = e.touches[0].clientY;
	}
	function onTouchEnd(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - tx;
		const dy = e.changedTouches[0].clientY - ty;
		if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
		move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
	}

	onMount(() => {
		loadBestForMode();
		window.addEventListener('keydown', onKey);
	});
	onDestroy(() => {
		recordRun('close');
		window.removeEventListener('keydown', onKey);
	});

	// ── tile appearance ───────────────────────────────────────────────────
	const TILE_COLORS: Record<number, [string, string]> = {
		0:    ['transparent', 'transparent'],
		2:    ['linear-gradient(145deg, #fff9fc, #f6e4ef)', '#67566f'],
		4:    ['linear-gradient(145deg, #faf7ff, #e8def7)', '#635672'],
		8:    ['linear-gradient(145deg, #fff4e9, #f8d9cf)', '#76545d'],
		16:   ['linear-gradient(145deg, #ffeaf5, #f4cbe2)', '#71465f'],
		32:   ['linear-gradient(145deg, #f1efff, #d8d9f7)', '#54577b'],
		64:   ['linear-gradient(145deg, #e9f7ff, #c9e5f3)', '#426274'],
		128:  ['linear-gradient(145deg, #ecfff9, #c8eadf)', '#42695e'],
		256:  ['linear-gradient(145deg, #f3eaff, #d8c6f0)', '#604b7a'],
		512:  ['linear-gradient(145deg, #ffe4f1, #ebb7d4)', '#6f3f5a'],
		1024: ['linear-gradient(145deg, #fff5cf, #f1d996)', '#705d34'],
		2048: ['linear-gradient(145deg, #f5dcff, #cda8ed)', '#513763']
	};

	function tileStyle(val: number): string {
		const [bg, fg] = TILE_COLORS[val] ?? ['linear-gradient(145deg, #dec7f4, #a98bc8)', '#463254'];
		const fs = val >= 1000 ? '1.1rem' : val >= 100 ? '1.35rem' : '1.7rem';
		const glow = val >= 2048
			? 'box-shadow:inset 0 1px 0 rgba(255,255,255,0.88),0 0 20px rgba(220,183,242,0.78),0 6px 14px rgba(83,55,99,0.18);'
			: val !== 0
				? 'box-shadow:inset 0 1px 0 rgba(255,255,255,0.82),0 5px 12px rgba(95,72,112,0.14);'
				: '';
		return `background:${bg};color:${fg};font-size:${fs};${glow}`;
	}
</script>

<div class="game-shell">
	<ArcadeHud
		title="2048"
		hint="arrow keys or swipe"
		maxWidth="360px"
		scores={[
			{ label: 'score', value: score },
			{ label: 'best', value: best },
			{ label: 'turns', value: turnDisplay },
			{ label: 'prize', value: scoreOnlyLabel }
		]}
		startLabel="new game"
		onstart={reset}
		{onclose}
	/>

	<div class="mode-row" aria-label="2048 mode">
		<button class:active={mode === 'endless'} onclick={() => setMode('endless')}>endless</button>
		<button class:active={mode === 'turn-100'} onclick={() => setMode('turn-100')}>100 turn</button>
	</div>

	<section class="power-panel" aria-label="pet power-ups">
		<div class="power-head">
			<span>core pet powers</span>
			<span>wild charges: {sparkReserve}</span>
		</div>
		<div class="power-grid">
			<button
				class:armed={activePower === 'delete'}
				disabled={!canPlay || powerCount('delete') <= 0}
				onclick={() => chooseTargetPower('delete')}
			>
				<span>delete tile</span>
				<strong>{powerUps.delete}</strong>
			</button>
			<button
				class:armed={activePower === 'double'}
				disabled={!canPlay || powerCount('double') <= 0}
				onclick={() => chooseTargetPower('double')}
			>
				<span>double tile</span>
				<strong>{powerUps.double}</strong>
			</button>
			<button
				disabled={undoStack.length === 0 || powerCount('undo') <= 0}
				onclick={undoTurn}
			>
				<span>undo turn</span>
				<strong>{powerUps.undo}</strong>
			</button>
		</div>
		{#if activePower}
			<p class="target-note">choose a numbered tile to {activePower}</p>
		{:else if mode === 'turn-100' && turnsLeft !== null}
			<p class="target-note">{turnsLeft} turns remaining</p>
		{:else}
			<p class="target-note">Body, Mind, Grace, and Heart shape this board</p>
		{/if}
		{#if supportBonusLabel}
			<p class="support-note">{supportBonusLabel}</p>
		{/if}
		<ArcadePetPerks creature={activePet} effects={statEffects} />
	</section>

	<!-- board -->
	<div
		class="board-wrap"
		ontouchstart={onTouchStart}
		ontouchend={onTouchEnd}
		role="application"
		aria-label="2048 game board"
	>
		<div class="board">
			{#each board as row, r (r)}
				{#each row as val, c (c)}
					<div
						class="cell"
						class:empty={val === 0}
						class:targetable={activePower !== null && val !== 0}
						style={tileStyle(val)}
						role="button"
						aria-disabled={activePower === null || val === 0}
						tabindex={activePower && val !== 0 ? 0 : undefined}
						onclick={() => useTargetPower(r, c)}
						onkeydown={(event) => onCellKey(event, r, c)}
					>
						{#if val !== 0}{val}{/if}
					</div>
				{/each}
			{/each}
		</div>

		<!-- overlays -->
		{#if won && !keepPlaying}
			<div class="overlay win">
				<p class="overlay-title">2048!</p>
				<p class="overlay-sub">you reached the tile.</p>
				<div class="overlay-btns">
					<button onclick={() => (keepPlaying = true)}>keep going</button>
					<button onclick={reset}>new game</button>
				</div>
			</div>
		{/if}
		{#if over}
			<div class="overlay lose">
				<p class="overlay-title">{overReason === 'turns' ? 'turns spent' : 'boxed in'}</p>
				<p class="overlay-sub">
					{overReason === 'turns'
						? `turn limit reached. final score: ${score}`
						: `no moves left. final score: ${score}`}
				</p>
				<button onclick={reset}>try again</button>
			</div>
		{/if}
	</div>
</div>

<style>
	/* inherits --sol-* tokens from .arcade-root ancestor */
	.game-shell {
		--magic-ink: #67566f;
		--magic-deep: #71587d;
		--magic-rose: #d88fb8;
		--magic-lilac: #b99bdd;
		position: relative;
		isolation: isolate;
		overflow: hidden;
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.1rem;
		background:
			radial-gradient(circle at 12% 12%, rgba(255, 255, 255, 0.95) 0 2px, transparent 2.8px),
			radial-gradient(circle at 88% 23%, rgba(216, 143, 184, 0.45) 0 1.5px, transparent 2.4px),
			radial-gradient(circle at 22% 70%, rgba(185, 155, 221, 0.44) 0 1.5px, transparent 2.4px),
			linear-gradient(150deg, #fffafc 0%, #f8eff8 46%, #eef2ff 100%);
		background-size: 92px 92px, 118px 118px, 137px 137px, auto;
		border-top: 2px solid #ead7e8;
	}
	.game-shell::before,
	.game-shell::after {
		content: '';
		position: absolute;
		z-index: -1;
		border-radius: 999px;
		filter: blur(2px);
		pointer-events: none;
	}
	.game-shell::before {
		width: 13rem;
		height: 13rem;
		top: 8rem;
		left: -8rem;
		background: rgba(243, 193, 219, 0.2);
		box-shadow: 0 22rem 0 rgba(196, 226, 222, 0.18);
	}
	.game-shell::after {
		width: 11rem;
		height: 11rem;
		top: 24rem;
		right: -7rem;
		background: rgba(194, 176, 229, 0.22);
	}

	.mode-row {
		width: min(360px, calc(100vw - 3rem));
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 3px;
		overflow: hidden;
		border: 1px solid rgba(185, 155, 221, 0.42);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.5);
		padding: 3px;
		box-shadow: 0 7px 20px rgba(105, 78, 120, 0.08);
	}
	.mode-row button {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--magic-ink);
		background: transparent;
		padding: 0.45rem 0.5rem;
		border-radius: 999px;
		transition:
			background 0.18s,
			color 0.18s,
			box-shadow 0.18s;
	}
	.mode-row button.active {
		color: #fffaff;
		background: linear-gradient(135deg, var(--magic-rose), var(--magic-lilac));
		box-shadow: 0 4px 12px rgba(185, 155, 221, 0.28);
	}

	/* ── powers ─────────────────────────────────────────────────────────── */
	.power-panel {
		width: min(360px, calc(100vw - 3rem));
		border: 1px solid rgba(255, 255, 255, 0.88);
		border-radius: 16px;
		background: rgba(255, 250, 253, 0.68);
		box-shadow:
			0 12px 30px rgba(100, 73, 116, 0.1),
			inset 0 0 0 1px rgba(216, 143, 184, 0.14);
		backdrop-filter: blur(8px);
		padding: 0.78rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.power-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		font-family: var(--font-ui);
		font-size: 0.58rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--magic-deep);
	}
	.power-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.35rem;
	}
	.power-grid button {
		min-height: 3.3rem;
		border: 1px solid rgba(185, 155, 221, 0.34);
		border-radius: 10px;
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(246, 236, 249, 0.88));
		color: var(--magic-ink);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.16rem;
		padding: 0.35rem 0.3rem;
		transition:
			background 0.18s,
			border-color 0.18s,
			color 0.18s,
			transform 0.18s,
			box-shadow 0.18s;
	}
	.power-grid button:not(:disabled):hover,
	.power-grid button.armed {
		color: #fffaff;
		background: linear-gradient(135deg, var(--magic-rose), var(--magic-lilac));
		border-color: rgba(255, 255, 255, 0.78);
		box-shadow: 0 6px 15px rgba(185, 155, 221, 0.28);
		transform: translateY(-1px);
	}
	.power-grid button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.power-grid span {
		font-family: var(--font-ui);
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-align: center;
		line-height: 1.2;
	}
	.power-grid strong {
		font-family: var(--font-counter);
		font-size: 1.1rem;
		line-height: 1;
	}
	.target-note {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.74rem;
		text-align: center;
		color: var(--magic-ink);
		margin: -0.05rem 0 0;
	}
	.support-note {
		font-family: var(--font-ui);
		font-size: 0.56rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-align: center;
		color: #8a7592;
		margin: -0.2rem 0 0;
	}
	/* ── board ──────────────────────────────────────────────────────────── */
	.board-wrap {
		position: relative;
		width: min(360px, calc(100vw - 3rem));
		filter: drop-shadow(0 18px 24px rgba(91, 64, 105, 0.16));
	}
	.board {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
		background:
			linear-gradient(145deg, rgba(132, 103, 149, 0.94), rgba(173, 145, 188, 0.92));
		border: 1px solid rgba(255, 255, 255, 0.72);
		border-radius: 18px;
		padding: 9px;
		aspect-ratio: 1;
		user-select: none;
		touch-action: none;
	}
	.cell {
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 0;
		font-family: var(--font-counter);
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.02em;
		transition:
			background 0.08s,
			color 0.08s,
			outline-color 0.08s,
			transform 0.08s,
			box-shadow 0.12s;
	}
	.cell.empty {
		background: rgba(255, 249, 253, 0.14) !important;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
	}
	.cell.targetable {
		cursor: crosshair;
		outline: 2px solid rgba(255, 255, 255, 0.82);
		outline-offset: -5px;
	}
	.cell.targetable:hover,
	.cell.targetable:focus-visible {
		transform: scale(0.96);
		outline-color: #f4b9db;
		box-shadow: 0 0 0 4px rgba(244, 185, 219, 0.25) !important;
	}

	/* ── overlays ───────────────────────────────────────────────────────── */
	.overlay {
		position: absolute;
		inset: 0;
		border-radius: 18px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		text-align: center;
		padding: 1.5rem;
	}
	.overlay.win {
		background: linear-gradient(145deg, rgba(225, 169, 208, 0.92), rgba(174, 145, 217, 0.94));
		backdrop-filter: blur(4px);
	}
	.overlay.lose {
		background: linear-gradient(145deg, rgba(113, 88, 125, 0.9), rgba(111, 116, 153, 0.92));
		backdrop-filter: blur(4px);
	}
	.overlay-title {
		font-family: var(--font-counter);
		font-size: 3rem;
		color: #fdf6e3;
		text-shadow: 0 3px 16px rgba(83, 55, 99, 0.3);
		margin: 0;
		line-height: 1;
	}
	.overlay-sub {
		font-family: var(--font-body);
		font-size: 0.88rem;
		color: rgba(253, 246, 227, 0.85);
		margin: 0;
		font-style: italic;
	}
	.overlay-btns {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.3rem;
	}
	.overlay button {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		background: rgba(253, 246, 227, 0.22);
		color: #fdf6e3;
		border: 1px solid rgba(253, 246, 227, 0.5);
		border-radius: 999px;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		transition: background 0.1s;
	}
	.overlay button:hover {
		background: rgba(253, 246, 227, 0.38);
	}

	@media (max-width: 420px) {
		.power-grid span {
			font-size: 0.52rem;
		}
	}
</style>
