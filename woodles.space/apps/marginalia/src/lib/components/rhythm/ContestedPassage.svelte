<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { game } from '$lib/state/game.svelte';
	import { passageFor, type Passage } from '$lib/content/passages';
	import { pickGlyph, corruptionChar, type GlyphValence } from '$lib/content/glyphs';

	// ── encounter parameters ─────────────────────────────────────────────────

	const DURATION_MS = 30_000;
	const SPAWN_INTERVAL_MS = 700;       // baseline spawn cadence
	const SPAWN_JITTER_MS = 350;
	const GLYPH_SPEED_MIN = 0.06;        // px/ms
	const GLYPH_SPEED_MAX = 0.12;
	const CARET_RADIUS_PX = 22;          // collision radius
	const CARET_KEY_STEP_PX = 18;
	const MAX_CORRUPTIONS = 3;

	// ── encounter state ──────────────────────────────────────────────────────

	interface Glyph {
		id: number;
		char: string;
		valence: GlyphValence;
		x: number;
		y: number;
		vx: number;
		vy: number;
		age: number;
	}

	interface MarginalNote {
		id: number;
		char: string;
		x: number;     // px relative to overlay
		y: number;
		age: number;
	}

	// each character in the passage tracked individually so we can corrupt them
	interface PChar {
		ch: string;
		corrupted: boolean;
	}

	// Pick a passage based on how many the player has already read.
	// First-time reads progress the corpus; after all read, repeats are fine.
	const passage: Passage = passageFor(game.passagesRead.length);

	let chars = $state<PChar[][]>(
		passage.lines.map((l) => l.split('').map((ch) => ({ ch, corrupted: false })))
	);

	let overlayEl: HTMLDivElement | undefined = $state();
	let passageEl: HTMLDivElement | undefined = $state();

	let glyphs = $state<Glyph[]>([]);
	let nextGlyphId = 0;
	let notes = $state<MarginalNote[]>([]);
	let nextNoteId = 0;

	let caretX = $state(0);
	let caretY = $state(0);

	let startTime = 0;
	let elapsed = $state(0);
	let nextSpawnAt = 0;
	let rafId = 0;

	let caught = $state(0);
	let corruptions = $state(0);

	// 'running' | 'won' | 'lost'
	let phase = $state<'running' | 'won' | 'lost'>('running');

	// ── derived ──────────────────────────────────────────────────────────────

	const remainingMs = $derived(Math.max(0, DURATION_MS - elapsed));
	const corruptionsLeft = $derived(MAX_CORRUPTIONS - corruptions);

	// ── helpers ──────────────────────────────────────────────────────────────

	function passageRect(): { x: number; y: number; w: number; h: number } {
		if (!passageEl || !overlayEl) return { x: 0, y: 0, w: 0, h: 0 };
		const p = passageEl.getBoundingClientRect();
		const o = overlayEl.getBoundingClientRect();
		return { x: p.left - o.left, y: p.top - o.top, w: p.width, h: p.height };
	}

	function spawnGlyph() {
		if (!overlayEl) return;
		const o = overlayEl.getBoundingClientRect();
		const W = o.width;
		const H = o.height;

		const kind = pickGlyph();

		// Pick an edge, then a target inside the passage rect (or just inside arena).
		const edge = (Math.random() * 4) | 0;
		let x = 0;
		let y = 0;
		switch (edge) {
			case 0: x = Math.random() * W; y = -30; break;
			case 1: x = W + 30; y = Math.random() * H; break;
			case 2: x = Math.random() * W; y = H + 30; break;
			case 3: x = -30; y = Math.random() * H; break;
		}

		const pr = passageRect();
		const tx = pr.x + Math.random() * pr.w;
		const ty = pr.y + Math.random() * pr.h;
		const dx = tx - x;
		const dy = ty - y;
		const dist = Math.max(1, Math.hypot(dx, dy));
		const speed = GLYPH_SPEED_MIN + Math.random() * (GLYPH_SPEED_MAX - GLYPH_SPEED_MIN);

		glyphs.push({
			id: ++nextGlyphId,
			char: kind.char,
			valence: kind.valence,
			x,
			y,
			vx: (dx / dist) * speed,
			vy: (dy / dist) * speed,
			age: 0,
		});
	}

	function corruptOneChar() {
		// Pick a random non-whitespace, non-corrupted character in the passage.
		const candidates: Array<{ li: number; ci: number }> = [];
		for (let li = 0; li < chars.length; li++) {
			for (let ci = 0; ci < chars[li].length; ci++) {
				const c = chars[li][ci];
				if (!c.corrupted && c.ch.trim().length > 0) {
					candidates.push({ li, ci });
				}
			}
		}
		if (candidates.length === 0) return;
		const pick = candidates[(Math.random() * candidates.length) | 0];
		chars[pick.li][pick.ci] = { ch: corruptionChar(), corrupted: true };
	}

	function placeMarginalNote(char: string) {
		const pr = passageRect();
		// Drop the note just outside a random edge of the passage box.
		const edge = (Math.random() * 4) | 0;
		let x = pr.x + Math.random() * pr.w;
		let y = pr.y + Math.random() * pr.h;
		const off = 28;
		switch (edge) {
			case 0: y = pr.y - off; break;
			case 1: x = pr.x + pr.w + off; break;
			case 2: y = pr.y + pr.h + off; break;
			case 3: x = pr.x - off; break;
		}
		notes.push({ id: ++nextNoteId, char, x, y, age: 0 });
	}

	function consume(g: Glyph) {
		if (g.valence === 'helpful') {
			caught++;
			placeMarginalNote(g.char);
		} else {
			corruptions++;
			corruptOneChar();
			if (corruptions >= MAX_CORRUPTIONS) {
				phase = 'lost';
			}
		}
	}

	function step(ts: number, dt: number) {
		// spawn
		if (ts >= nextSpawnAt) {
			spawnGlyph();
			nextSpawnAt = ts + SPAWN_INTERVAL_MS + (Math.random() * 2 - 1) * SPAWN_JITTER_MS;
		}

		// update glyphs
		const survivors: Glyph[] = [];
		for (const g of glyphs) {
			g.x += g.vx * dt;
			g.y += g.vy * dt;
			g.age += dt;

			// caret collision
			const dx = g.x - caretX;
			const dy = g.y - caretY;
			if (dx * dx + dy * dy <= CARET_RADIUS_PX * CARET_RADIUS_PX) {
				consume(g);
				continue;
			}

			// off-screen culling
			if (!overlayEl) {
				survivors.push(g);
				continue;
			}
			const o = overlayEl.getBoundingClientRect();
			if (g.x < -50 || g.x > o.width + 50 || g.y < -50 || g.y > o.height + 50) {
				continue;
			}
			survivors.push(g);
		}
		glyphs = survivors;

		// fade old marginal notes (drop after ~3s)
		const noteSurv: MarginalNote[] = [];
		for (const n of notes) {
			n.age += dt;
			if (n.age < 3000) noteSurv.push(n);
		}
		notes = noteSurv;
	}

	let lastTs = 0;

	function tick(ts: number) {
		if (phase !== 'running') return;
		if (lastTs === 0) lastTs = ts;
		const dt = Math.min(64, ts - lastTs); // clamp so a tab-out doesn't avalanche
		lastTs = ts;
		elapsed = ts - startTime;

		step(ts, dt);

		// Surviving the duration without three corruptions counts as an intact read.
		if (elapsed >= DURATION_MS) phase = 'won';

		rafId = requestAnimationFrame(tick);
	}

	// ── input ────────────────────────────────────────────────────────────────

	function onPointerMove(e: PointerEvent) {
		if (!overlayEl) return;
		const o = overlayEl.getBoundingClientRect();
		caretX = e.clientX - o.left;
		caretY = e.clientY - o.top;
	}

	function onKeyDown(e: KeyboardEvent) {
		if (phase !== 'running') {
			if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				close();
			}
			return;
		}
		switch (e.key) {
			case 'ArrowUp':
				caretY -= CARET_KEY_STEP_PX;
				e.preventDefault();
				break;
			case 'ArrowDown':
				caretY += CARET_KEY_STEP_PX;
				e.preventDefault();
				break;
			case 'ArrowLeft':
				caretX -= CARET_KEY_STEP_PX;
				e.preventDefault();
				break;
			case 'ArrowRight':
				caretX += CARET_KEY_STEP_PX;
				e.preventDefault();
				break;
			case 'Escape':
				e.preventDefault();
				phase = 'lost';
				break;
		}
		if (overlayEl) {
			const o = overlayEl.getBoundingClientRect();
			caretX = Math.max(0, Math.min(o.width, caretX));
			caretY = Math.max(0, Math.min(o.height, caretY));
		}
	}

	// ── lifecycle ────────────────────────────────────────────────────────────

	function close() {
		if (phase === 'running') return; // can only close after the encounter ends
		game.completeContestedPassage({
			passage,
			intact: phase === 'won',
			caught,
			corrupted: corruptions,
		});
		// game.contestedActive becomes false inside completeContestedPassage,
		// which unmounts this component via the surrounding {#if} on the page.
	}

	onMount(() => {
		startTime = performance.now();
		nextSpawnAt = startTime + 600; // small intro pause before glyphs arrive
		// initial caret position: centered
		if (overlayEl) {
			const o = overlayEl.getBoundingClientRect();
			caretX = o.width / 2;
			caretY = o.height - 80;
		}
		rafId = requestAnimationFrame(tick);
		document.addEventListener('keydown', onKeyDown);
	});

	onDestroy(() => {
		cancelAnimationFrame(rafId);
		document.removeEventListener('keydown', onKeyDown);
	});

	// ── derived display values ──────────────────────────────────────────────

	const apparatusEstimate = $derived.by(() => {
		const v = 5 + caught * 0.5 - corruptions * 1;
		return Math.max(1, v);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="overlay"
	bind:this={overlayEl}
	onpointermove={onPointerMove}
	role="application"
	aria-label="contested passage encounter"
>
	<div class="backdrop" aria-hidden="true"></div>

	<header class="hud">
		<div class="hud-cell">
			<span class="hud-label">remaining</span>
			<span class="hud-value">{(remainingMs / 1000).toFixed(1)}s</span>
		</div>
		<div class="hud-cell">
			<span class="hud-label">caught</span>
			<span class="hud-value caught">{caught}</span>
		</div>
		<div class="hud-cell">
			<span class="hud-label">corruptions left</span>
			<span class="hud-value corruptions" class:low={corruptionsLeft <= 1}>{corruptionsLeft}</span>
		</div>
	</header>

	<div class="passage-wrap">
		<div class="passage" bind:this={passageEl} class:collapsed={phase === 'lost'}>
			<p class="source" aria-hidden="true">— {passage.source} —</p>
			{#each chars as line, li (li)}
				<p class="line">
					{#each line as c, ci (ci)}
						<span class="char" class:corrupted={c.corrupted}>{c.ch}</span>
					{/each}
				</p>
			{/each}
		</div>
	</div>

	<!-- marginal notes that float to the edges of the passage -->
	{#each notes as n (n.id)}
		<span
			class="note"
			style="left: {n.x}px; top: {n.y}px; opacity: {Math.max(0, 1 - n.age / 3000).toFixed(3)}"
			aria-hidden="true"
		>{n.char}</span>
	{/each}

	<!-- glyph rain -->
	{#each glyphs as g (g.id)}
		<span
			class="glyph glyph-{g.valence}"
			style="left: {g.x}px; top: {g.y}px"
			aria-hidden="true"
		>{g.char}</span>
	{/each}

	<!-- caret -->
	{#if phase === 'running'}
		<span
			class="caret"
			style="left: {caretX}px; top: {caretY}px"
			aria-hidden="true"
		>|</span>
	{/if}

	<!-- end-of-encounter card -->
	{#if phase !== 'running'}
		<div
			class="result"
			role="dialog"
			aria-live="assertive"
		>
			{#if phase === 'won'}
				<h2 class="result-title intact">— the passage holds —</h2>
				<p class="result-line">
					read intact. apparatus <span class="num">+{apparatusEstimate.toFixed(1)}</span>.
				</p>
				{#if !game.passagesRead.includes(passage.id)}
					<p class="result-line muted">
						the passage joins your canonical citations.
					</p>
				{:else}
					<p class="result-line muted">
						you have read this passage before.
					</p>
				{/if}
			{:else}
				<h2 class="result-title collapsed">— the passage collapses —</h2>
				<p class="result-line">
					three corruptions, and the reading falls apart. nothing is gained from a reading
					that was not finished.
				</p>
			{/if}
			<button class="dismiss" type="button" onclick={close}>
				— return to the margin —
			</button>
		</div>
	{/if}

	<footer class="hint" aria-hidden="true">
		<span class="hint-key">mouse</span> or <span class="hint-key">arrow keys</span> · catch
		<span class="glyph-helpful">☞ ¶ ✦</span> · dodge
		<span class="glyph-corrupting">† ‡ ⸿</span> · <span class="hint-key">esc</span> to abandon
	</footer>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		font-family: var(--font-body);
		color: var(--text);
		cursor: none; /* the caret is the cursor */
	}

	.backdrop {
		position: absolute;
		inset: 0;
		background: var(--bg);
		opacity: 0.94;
	}

	/* ── HUD ─────────────────────────────────────────────────────────────── */

	.hud {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		gap: 2.4rem;
		padding: 1rem 1.2rem;
		border-bottom: 1px solid var(--rule);
		background: var(--bg);
	}

	.hud-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
	}

	.hud-label {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.hud-value {
		font-family: var(--font-counter);
		font-size: 1.2rem;
		color: var(--cream);
	}

	.hud-value.caught {
		color: var(--cyan);
	}

	.hud-value.corruptions {
		color: var(--periwinkle);
	}

	.hud-value.corruptions.low {
		color: var(--leafeon-pink);
	}

	/* ── passage ─────────────────────────────────────────────────────────── */

	.passage-wrap {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6rem 1.5rem 8rem;
		pointer-events: none;
	}

	.passage {
		max-width: 42rem;
		text-align: left;
		font-size: 1.05rem;
		line-height: 1.7;
		padding: 1.4rem 1.6rem;
		background: var(--panel);
		border: 1px solid var(--rule);
		border-radius: 4px;
		box-shadow: 0 0 0 6px rgba(154, 150, 201, 0.05);
		transition: transform 600ms ease;
	}

	.passage.collapsed {
		transform: scale(0.96) rotate(-0.4deg);
		filter: blur(0.6px) saturate(0.6);
	}

	.source {
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--muted);
		margin: 0 0 0.6rem;
	}

	.line {
		margin: 0 0 0.25rem;
		color: var(--text);
	}

	.char.corrupted {
		color: var(--leafeon-pink);
		font-family: var(--font-counter);
	}

	/* ── glyphs ──────────────────────────────────────────────────────────── */

	.glyph {
		position: absolute;
		font-size: 1.5rem;
		line-height: 1;
		pointer-events: none;
		user-select: none;
		transform: translate(-50%, -50%);
		text-shadow: 0 0 4px var(--bg);
	}

	.glyph-helpful {
		color: var(--cyan);
	}

	.glyph-corrupting {
		color: var(--leafeon-pink);
	}

	/* ── marginal notes (caught helpful glyphs settle here) ──────────────── */

	.note {
		position: absolute;
		font-family: var(--font-hand);
		font-size: 1rem;
		color: var(--periwinkle);
		pointer-events: none;
		transform: translate(-50%, -50%);
	}

	/* ── caret ───────────────────────────────────────────────────────────── */

	.caret {
		position: absolute;
		font-family: var(--font-counter);
		font-size: 2rem;
		line-height: 1;
		color: var(--cream);
		pointer-events: none;
		transform: translate(-50%, -50%);
		animation: blink 900ms infinite;
		text-shadow: 0 0 6px var(--periwinkle);
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50%      { opacity: 0.55; }
	}

	/* ── result card ─────────────────────────────────────────────────────── */

	.result {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--panel);
		border: 1px solid var(--rule);
		border-radius: 4px;
		padding: 1.6rem 1.8rem;
		text-align: center;
		max-width: 36rem;
		box-shadow: 0 0 0 8px rgba(0, 0, 0, 0.25);
	}

	.result-title {
		font-family: var(--font-display);
		font-weight: 400;
		letter-spacing: 0.04em;
		font-size: 1.4rem;
		margin: 0 0 0.6rem;
	}

	.result-title.intact {
		color: var(--cyan);
	}

	.result-title.collapsed {
		color: var(--leafeon-pink);
	}

	.result-line {
		font-family: var(--font-body);
		margin: 0 0 0.4rem;
	}

	.result-line.muted {
		color: var(--muted);
		font-style: italic;
	}

	.num {
		font-family: var(--font-counter);
		color: var(--cream);
	}

	.dismiss {
		margin-top: 0.9rem;
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--cream);
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--rule);
		border-radius: 3px;
		background: var(--panel-accent);
		cursor: pointer;
	}

	.dismiss:hover {
		border-color: var(--periwinkle);
		color: var(--periwinkle);
	}

	/* ── hint ────────────────────────────────────────────────────────────── */

	.hint {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		text-align: center;
		padding: 0.8rem 1rem;
		border-top: 1px solid var(--rule);
		background: var(--bg);
		font-family: var(--font-ui);
		font-size: 0.78rem;
		color: var(--muted);
	}

	.hint-key {
		font-family: var(--font-counter);
		color: var(--cream);
		padding: 0.05rem 0.3rem;
		border: 1px solid var(--rule);
		border-radius: 3px;
		font-size: 0.78rem;
	}

	.glyph-helpful {
		color: var(--cyan);
	}

	.glyph-corrupting {
		color: var(--leafeon-pink);
	}

	/* ── reduced motion ─────────────────────────────────────────────────── */

	@media (prefers-reduced-motion: reduce) {
		.caret {
			animation: none;
		}
		.passage {
			transition: none;
		}
	}
</style>
