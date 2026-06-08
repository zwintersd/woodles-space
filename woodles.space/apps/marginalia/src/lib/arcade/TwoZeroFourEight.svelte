<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		onclose: () => void;
	}
	let { onclose }: Props = $props();

	type Board = number[][];
	type Dir = 'left' | 'right' | 'up' | 'down';

	// ── board helpers ────────────────────────────────────────────────────
	function emptyBoard(): Board {
		return Array.from({ length: 4 }, () => [0, 0, 0, 0]);
	}

	function addTile(b: Board): void {
		const empties: [number, number][] = [];
		for (let r = 0; r < 4; r++)
			for (let c = 0; c < 4; c++)
				if (b[r][c] === 0) empties.push([r, c]);
		if (!empties.length) return;
		const [r, c] = empties[Math.floor(Math.random() * empties.length)];
		b[r][c] = Math.random() < 0.9 ? 2 : 4;
	}

	function freshBoard(): Board {
		const b = emptyBoard();
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

	// ── state ─────────────────────────────────────────────────────────────
	let board = $state<Board>(freshBoard());
	let score = $state(0);
	let best = $state(0);
	let won = $state(false);
	let over = $state(false);
	let keepPlaying = $state(false);

	function move(dir: Dir) {
		if (over || (won && !keepPlaying)) return;
		const { board: nb, score: gained, moved } = applyMove(board, dir);
		if (!moved) return;
		score += gained;
		if (score > best) best = score;
		addTile(nb);
		board = nb;
		if (!won && nb.some((row) => row.includes(2048))) won = true;
		if (!hasMovesLeft(nb)) over = true;
	}

	function reset() {
		board = freshBoard();
		score = 0;
		won = false;
		over = false;
		keepPlaying = false;
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

	onMount(() => window.addEventListener('keydown', onKey));
	onDestroy(() => window.removeEventListener('keydown', onKey));

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
		</div>
		<div class="btn-group">
			<button class="ctrl-btn" onclick={reset}>new game</button>
			<button class="ctrl-btn back" onclick={onclose}>← arcade</button>
		</div>
	</div>

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
					<div class="cell" class:empty={val === 0} style={tileStyle(val)}>
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
				<p class="overlay-title">game over</p>
				<p class="overlay-sub">no moves left. final score: {score}</p>
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
		font-family: var(--font-counter);
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.02em;
		transition:
			background 0.08s,
			color 0.08s;
	}
	.cell.empty {
		background: rgba(255, 255, 255, 0.06);
		box-shadow: none;
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
</style>
