<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { game } from '$lib/state/game.svelte';
	import { recorder, type RecitationFragment, type RecitationBeat } from '$lib/rhythm/recorder';

	// ── parameters ──────────────────────────────────────────────────────────

	const SPEED_PX_MS = 0.06;          // matches the original reading-pass cadence
	const LEAD_IN_MS = 1800;           // pause before the first beat reaches the seam
	const HIT_WINDOW_MS = 220;         // generous on purpose — the past is forgiving
	const TAIL_MS = 2200;              // how long after the last beat we wait before scoring

	// ── ghost fragment ──────────────────────────────────────────────────────

	const fragment: RecitationFragment | null = recorder.pickFragment();

	interface Ghost extends RecitationBeat {
		id: number;
		peakTime: number;        // performance.now() when this beat centres on the seam
		hit: boolean;
		consumed: boolean;       // missed / past-the-window
	}

	let ghosts = $state<Ghost[]>([]);
	let stripEl: HTMLDivElement | undefined = $state();
	let stripWidth = $state(640);
	let now = $state(performance.now());
	let startTime = 0;
	let endTime = 0;
	let rafId = 0;

	let phase = $state<'running' | 'finished' | 'aborted'>('running');
	let hits = $state(0);
	let total = $state(0);
	let lastFlash = $state<{ at: number; quality: 'hit' | 'miss' } | null>(null);

	// ── lifecycle ───────────────────────────────────────────────────────────

	function setup() {
		if (!fragment) {
			phase = 'finished';
			endTime = performance.now();
			return;
		}
		startTime = performance.now() + LEAD_IN_MS;
		endTime = startTime + fragment.durationMs + TAIL_MS;
		ghosts = fragment.beats.map((b, i) => ({
			...b,
			id: i,
			peakTime: startTime + b.offset,
			hit: false,
			consumed: false
		}));
		total = ghosts.length;
	}

	function tick(ts: number) {
		now = ts;
		if (phase === 'running') {
			// Mark beats whose hit window has fully passed as consumed (missed).
			for (const g of ghosts) {
				if (g.hit || g.consumed) continue;
				if (ts - g.peakTime > HIT_WINDOW_MS) g.consumed = true;
			}
			if (ts >= endTime) {
				phase = 'finished';
			}
		}
		rafId = requestAnimationFrame(tick);
	}

	function ghostX(g: Ghost): number {
		const seam = stripWidth / 2;
		return seam + (g.peakTime - now) * SPEED_PX_MS;
	}

	function handleHit() {
		if (phase !== 'running') return;
		const t = performance.now();
		// nearest unhit, unconsumed beat
		let best: Ghost | null = null;
		let bestDist = Infinity;
		for (const g of ghosts) {
			if (g.hit || g.consumed) continue;
			const d = Math.abs(g.peakTime - t);
			if (d < bestDist) { bestDist = d; best = g; }
		}
		if (!best) {
			lastFlash = { at: t, quality: 'miss' };
			return;
		}
		if (bestDist <= HIT_WINDOW_MS) {
			best.hit = true;
			hits += 1;
			lastFlash = { at: t, quality: 'hit' };
		} else {
			lastFlash = { at: t, quality: 'miss' };
		}
	}

	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		handleHit();
	}

	function onKeyDown(e: KeyboardEvent) {
		if (phase !== 'running') {
			if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				close();
			}
			return;
		}
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			handleHit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			phase = 'aborted';
		}
	}

	function buildRememberedLine(): string | undefined {
		if (!fragment) return;
		// Pull two distinctive words from the fragment, prefer longer/charged ones.
		const words = fragment.beats
			.map((b) => b.w)
			.filter((w) => w.length >= 4)
			.sort((a, b) => b.length - a.length);
		const w1 = words[0] ?? fragment.beats[0]?.w;
		const w2 = words[1] ?? fragment.beats[fragment.beats.length - 1]?.w;
		if (!w1) return;
		const templates = [
			`a margin returns the words "${w1}" and "${w2}" — they are remembered.`,
			`somewhere in this reading, the cadence "${w1}…${w2}" survived the forgetting.`,
			`a hand has come back across the gap, carrying "${w1}".`,
			`what was once written, lightly: "${w1}, ${w2}". it is remembered.`
		];
		return templates[(Math.random() * templates.length) | 0];
	}

	function close() {
		game.completeRecitation({
			hits,
			total,
			rememberedLine: buildRememberedLine()
		});
	}

	let resizeObserver: ResizeObserver | undefined;

	onMount(() => {
		if (stripEl) {
			stripWidth = stripEl.clientWidth || stripWidth;
			resizeObserver = new ResizeObserver((entries) => {
				stripWidth = entries[0]?.contentRect.width ?? stripWidth;
			});
			resizeObserver.observe(stripEl);
		}
		setup();
		rafId = requestAnimationFrame(tick);
		document.addEventListener('keydown', onKeyDown);
	});

	onDestroy(() => {
		cancelAnimationFrame(rafId);
		resizeObserver?.disconnect();
		document.removeEventListener('keydown', onKeyDown);
	});

	const ratio = $derived(total > 0 ? hits / total : 0);
	const verdict = $derived.by(() => {
		if (ratio >= 0.8) return 'remembered';
		if (ratio >= 0.5) return 'partial';
		return 'forgotten';
	});

	const flashOpacity = $derived(
		lastFlash ? Math.max(0, 1 - (now - lastFlash.at) / 600) : 0
	);
</script>

<div
	class="overlay"
	role="dialog"
	aria-label="recitation séance"
>
	<div class="backdrop" aria-hidden="true"></div>

	<header class="hud">
		<span class="hud-title">— a séance: recite the past —</span>
		<span class="hud-meta">
			<span class="num">{hits}</span> / <span class="num">{total}</span> in time
		</span>
	</header>

	{#if !fragment}
		<div class="empty-card">
			<h2>nothing to recite.</h2>
			<p>your reading has not yet left a rhythm. play the reading pass for a while; the past will collect.</p>
			<button class="dismiss" type="button" onclick={() => game.completeRecitation({ hits: 0, total: 0 })}>
				— return —
			</button>
		</div>
	{:else}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="strip"
			bind:this={stripEl}
			onpointerdown={onPointerDown}
		>
			<div class="strip-zone" aria-hidden="true"></div>
			<div class="seam" aria-hidden="true"></div>

			{#each ghosts as g (g.id)}
				{@const x = ghostX(g)}
				{#if x > -200 && x < stripWidth + 50}
					<span
						class="ghost"
						class:hit={g.hit}
						class:consumed={g.consumed && !g.hit}
						style="left: {x}px"
					>{g.w}</span>
				{/if}
			{/each}

			{#if flashOpacity > 0.02 && lastFlash}
				<span
					class="flash flash-{lastFlash.quality}"
					style="opacity: {flashOpacity.toFixed(3)}"
					aria-live="polite"
				>{lastFlash.quality === 'hit' ? '· in time' : '· out of time'}</span>
			{/if}
		</div>

		<p class="hint" aria-hidden="true">
			click or press <span class="hint-key">space</span> as each ghost crosses the seam ·
			<span class="hint-key">esc</span> to break the séance
		</p>

		{#if phase !== 'running'}
			<div class="result" role="dialog" aria-live="assertive">
				{#if phase === 'aborted'}
					<h2 class="title broken">— the séance breaks —</h2>
					<p class="line">you let it go. nothing returns.</p>
				{:else if verdict === 'remembered'}
					<h2 class="title remembered">— they are remembered —</h2>
					<p class="line">
						<span class="num">{hits}</span> of <span class="num">{total}</span> in time.
						apparatus <span class="num">+5</span>, and a line returns to the canonical.
					</p>
				{:else if verdict === 'partial'}
					<h2 class="title partial">— a partial recitation —</h2>
					<p class="line">
						<span class="num">{hits}</span> of <span class="num">{total}</span>. the rhythm
						half-survives. apparatus <span class="num">+2</span>.
					</p>
				{:else}
					<h2 class="title forgotten">— the margin forgets itself —</h2>
					<p class="line">
						only <span class="num">{hits}</span> of <span class="num">{total}</span>. nothing returns.
					</p>
				{/if}
				<button class="dismiss" type="button" onclick={close}>— return —</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		font-family: var(--font-body);
		color: var(--text);
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}

	.backdrop {
		position: absolute;
		inset: 0;
		background: var(--bg);
		opacity: 0.96;
	}

	/* ── HUD ─────────────────────────────────────────────────────────────── */

	.hud {
		position: relative;
		z-index: 1;
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 0.9rem 1.2rem;
		border-bottom: 1px solid var(--rule);
	}

	.hud-title {
		font-family: var(--font-display);
		font-size: 1.05rem;
		color: var(--print-pink);
		letter-spacing: 0.04em;
	}

	.hud-meta {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.num {
		font-family: var(--font-counter);
		color: var(--cream);
	}

	/* ── strip ───────────────────────────────────────────────────────────── */

	.strip {
		position: relative;
		z-index: 1;
		height: 6.5rem;
		margin: 4rem auto 0;
		max-width: 46rem;
		width: 100%;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		overflow: hidden;
		cursor: crosshair;
	}

	.strip-zone {
		position: absolute;
		left: calc(50% - 14px);
		width: 28px;
		top: 0;
		bottom: 0;
		background: linear-gradient(
			to right,
			transparent,
			rgba(154, 150, 201, 0.08) 30%,
			rgba(154, 150, 201, 0.08) 70%,
			transparent
		);
		pointer-events: none;
	}

	.seam {
		position: absolute;
		left: 50%;
		top: 12%;
		bottom: 12%;
		width: 1px;
		background: var(--print-pink);
		opacity: 0.4;
		pointer-events: none;
	}

	.ghost {
		position: absolute;
		top: 50%;
		transform: translateY(-50%) translateX(-50%);
		font-family: var(--font-hand);
		font-size: 1.25rem;
		line-height: 1;
		color: var(--periwinkle);
		opacity: 0.62;
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
		text-shadow: 0 0 10px rgba(154, 150, 201, 0.25);
		transition: color 200ms ease, opacity 200ms ease;
	}

	.ghost.hit {
		color: var(--print-pink);
		opacity: 1;
		text-shadow: 0 0 12px rgba(199, 119, 162, 0.45);
	}

	.ghost.consumed {
		color: var(--rule);
		opacity: 0.32;
		text-decoration: line-through;
		text-decoration-color: var(--rule);
	}

	.flash {
		position: absolute;
		left: 50%;
		top: 0.4rem;
		transform: translateX(-50%);
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		pointer-events: none;
	}

	.flash-hit {
		color: var(--print-pink);
	}

	.flash-miss {
		color: var(--muted);
	}

	/* ── hint + result ───────────────────────────────────────────────────── */

	.hint {
		position: relative;
		z-index: 1;
		text-align: center;
		font-family: var(--font-ui);
		font-size: 0.78rem;
		color: var(--muted);
		margin: 1.2rem auto 0;
	}

	.hint-key {
		font-family: var(--font-counter);
		color: var(--cream);
		padding: 0.05rem 0.3rem;
		border: 1px solid var(--rule);
		border-radius: 3px;
		font-size: 0.78rem;
	}

	.result, .empty-card {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--panel);
		border: 1px solid var(--rule);
		border-radius: 4px;
		padding: 1.4rem 1.6rem;
		text-align: center;
		max-width: 34rem;
		z-index: 2;
		box-shadow: 0 0 0 8px rgba(0, 0, 0, 0.25);
	}

	.title {
		font-family: var(--font-display);
		font-weight: 400;
		letter-spacing: 0.04em;
		font-size: 1.4rem;
		margin: 0 0 0.6rem;
	}

	.title.remembered { color: var(--print-pink); }
	.title.partial    { color: var(--cyan); }
	.title.forgotten  { color: var(--muted); }
	.title.broken     { color: var(--leafeon-pink); }

	.line {
		margin: 0 0 0.4rem;
	}

	.empty-card h2 {
		font-family: var(--font-display);
		color: var(--muted);
		font-weight: 400;
		font-size: 1.2rem;
		margin: 0 0 0.4rem;
	}

	.empty-card p {
		color: var(--muted);
		font-style: italic;
		margin: 0 0 1rem;
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
		border-color: var(--print-pink);
		color: var(--print-pink);
	}

	@media (prefers-reduced-motion: reduce) {
		.ghost { transition: none; }
	}
</style>
