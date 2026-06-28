<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
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
		2:    ['#eee8d5', '#586e75'],
		4:    ['#d0c9b5', '#586e75'],
		8:    ['#b58900', '#fdf6e3'],
		16:   ['#cb4b16', '#fdf6e3'],
		32:   ['#dc322f', '#fdf6e3'],
		64:   ['#d33682', '#fdf6e3'],
		128:  ['#6c71c4', '#fdf6e3'],
		256:  ['#268bd2', '#fdf6e3'],
		512:  ['#2aa198', '#fdf6e3'],
		1024: ['#859900', '#fdf6e3'],
		2048: ['#b58900', '#fdf6e3']
	};

	function tileStyle(val: number): string {
		const [bg, fg] = TILE_COLORS[val] ?? ['#073642', '#fdf6e3'];
		const fs = val >= 1000 ? '1.1rem' : val >= 100 ? '1.35rem' : '1.7rem';
		const shadow = val !== 0 ? 'box-shadow:inset 0 -3px 0 rgba(0,0,0,0.18);' : '';
		return `background:${bg};color:${fg};font-size:${fs};${shadow}`;
	}
</script>

<div class="game-shell">
	<!-- header row -->
	<div class="game-bar">
		<div class="game-id">
			<span class="game-name">2048</span>
			<span class="game-hint">arrow keys or swipe</span>
		</div>
		<div class="score-group">
			<div class="score-box">
				<span class="score-label">score</span>
				<span class="score-val">{score}</span>
			</div>
			<div class="score-box">
				<span class="score-label">best</span>
				<span class="score-val">{best}</span>
			</div>
			<div class="score-box">
				<span class="score-label">turns</span>
				<span class="score-val">{turnDisplay}</span>
			</div>
			<div class="score-box">
				<span class="score-label">prize</span>
				<span class="score-val policy">{scoreOnlyLabel}</span>
			</div>
		</div>
		<div class="btn-group">
			<button class="ctrl-btn" onclick={reset}>new game</button>
			<button class="ctrl-btn back" onclick={onclose}>← arcade</button>
		</div>
	</div>

	<div class="mode-row" aria-label="2048 mode">
		<button class:active={mode === 'endless'} onclick={() => setMode('endless')}>endless</button>
		<button class:active={mode === 'turn-100'} onclick={() => setMode('turn-100')}>100 turn</button>
	</div>

	<section class="power-panel" aria-label="pet power-ups">
		<div class="power-head">
			<span>pet powers</span>
			<span>spark wild: {sparkReserve}</span>
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
			<p class="target-note">pet stats shape the opening, powers, and turn budget</p>
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
				<p class="overlay-title">{overReason === 'turns' ? 'turns spent' : 'game over'}</p>
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
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.1rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}

	/* ── header ─────────────────────────────────────────────────────────── */
	.game-bar {
		width: 100%;
		max-width: 360px;
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
		justify-content: flex-end;
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
	.score-label {
		font-family: var(--font-ui);
		font-size: 0.56rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--sol-base1);
	}
	.score-val {
		font-family: var(--font-counter);
		font-size: 1.3rem;
		color: var(--sol-base01);
		line-height: 1.1;
	}
	.score-val.policy {
		font-family: var(--font-ui);
		font-size: 0.64rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		line-height: 1.25;
		max-width: 4.2rem;
		text-align: center;
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

	.mode-row {
		width: min(360px, calc(100vw - 3rem));
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1px;
		overflow: hidden;
		border: 1px solid var(--sol-base2);
		border-radius: 4px;
		background: var(--sol-base2);
	}
	.mode-row button {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--sol-base0);
		background: var(--sol-base3);
		padding: 0.45rem 0.5rem;
		transition:
			background 0.1s,
			color 0.1s;
	}
	.mode-row button.active {
		color: var(--sol-base3);
		background: var(--sol-blue);
	}

	/* ── powers ─────────────────────────────────────────────────────────── */
	.power-panel {
		width: min(360px, calc(100vw - 3rem));
		border: 1px solid var(--sol-base2);
		border-radius: 5px;
		background: rgba(238, 232, 213, 0.46);
		padding: 0.65rem;
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
		color: var(--sol-base1);
	}
	.power-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.35rem;
	}
	.power-grid button {
		min-height: 3.3rem;
		border: 1px solid var(--sol-base2);
		border-radius: 4px;
		background: var(--sol-base3);
		color: var(--sol-base0);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.16rem;
		padding: 0.35rem 0.3rem;
		transition:
			background 0.1s,
			border-color 0.1s,
			color 0.1s;
	}
	.power-grid button:not(:disabled):hover,
	.power-grid button.armed {
		color: var(--sol-base3);
		background: var(--sol-cyan);
		border-color: var(--sol-cyan);
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
		color: var(--sol-base0);
		margin: -0.05rem 0 0;
	}
	/* ── board ──────────────────────────────────────────────────────────── */
	.board-wrap {
		position: relative;
		width: min(360px, calc(100vw - 3rem));
	}
	.board {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 7px;
		background: var(--sol-base01);
		border-radius: 6px;
		padding: 7px;
		aspect-ratio: 1;
		user-select: none;
		touch-action: none;
	}
	.cell {
		border-radius: 4px;
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
			transform 0.08s;
	}
	.cell.empty {
		background: rgba(255, 255, 255, 0.06);
		box-shadow: none;
	}
	.cell.targetable {
		cursor: crosshair;
		outline: 2px solid rgba(253, 246, 227, 0.68);
		outline-offset: -5px;
	}
	.cell.targetable:hover,
	.cell.targetable:focus-visible {
		transform: scale(0.96);
		outline-color: var(--sol-cyan);
	}

	/* ── overlays ───────────────────────────────────────────────────────── */
	.overlay {
		position: absolute;
		inset: 0;
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		text-align: center;
		padding: 1.5rem;
	}
	.overlay.win {
		background: rgba(181, 137, 0, 0.88);
	}
	.overlay.lose {
		background: rgba(88, 110, 117, 0.88);
	}
	.overlay-title {
		font-family: var(--font-counter);
		font-size: 3rem;
		color: #fdf6e3;
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
		border-radius: 3px;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		transition: background 0.1s;
	}
	.overlay button:hover {
		background: rgba(253, 246, 227, 0.38);
	}

	@media (max-width: 420px) {
		.game-bar {
			justify-content: center;
		}
		.game-id,
		.btn-group {
			align-items: center;
		}
		.score-group {
			justify-content: center;
		}
		.power-grid span {
			font-size: 0.52rem;
		}
	}
</style>
