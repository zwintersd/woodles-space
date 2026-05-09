<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { game, fmt } from '$lib/state/game.svelte';
	import { classifyHit, HIT_LABEL } from '$lib/rhythm/timing';
	import { recorder } from '$lib/rhythm/recorder';
	import { CORPUS, CHARGED_TOKENS } from '$lib/content/corpus';

	// ── timing constants ─────────────────────────────────────────────────────

	// 60 px/s — slow enough to read, fast enough to feel like time passing.
	const SPEED_PX_MS = 0.06;

	// Gap between each word's peak (when it centres on the seam).
	const WORD_INTERVAL_MS = 1300;

	// How long before the first word reaches the seam after a line starts.
	const INITIAL_DELAY_MS = 2200;

	// A word this far past its peak is treated as fully exited left.
	const EXIT_THRESHOLD_MS = 3500;

	// ── state ────────────────────────────────────────────────────────────────

	type HitResult = 'luminous' | 'tight' | 'wide';

	interface Word {
		id: number;
		text: string;
		isCharged: boolean;
		peakTime: number; // performance.now() when centred on seam
		hit: HitResult | null;
	}

	let fieldEl: HTMLDivElement | undefined = $state();
	let fieldWidth = $state(700);
	let now = $state(performance.now());
	let words = $state<Word[]>([]);
	let lineIndex = 0;
	let nextId = 0;
	let rafId = 0;

	// hit label
	let lastHitQuality = $state<HitResult | null>(null);
	let lastHitAt = $state(0);

	// seam x position (centre of field)
	const seamX = $derived(fieldWidth / 2);

	// ── word positioning ─────────────────────────────────────────────────────

	// x position of a word's centre in the field at the current `now`.
	// Positive = right of seam, negative = left of seam.
	function wordCentreX(w: Word): number {
		return seamX + (w.peakTime - now) * SPEED_PX_MS;
	}

	// Charged words brighten as they approach the seam (within 1500ms).
	function chargeIntensity(w: Word): number {
		if (!w.isCharged || w.hit !== null) return 0;
		const offset = Math.abs(w.peakTime - now);
		return offset > 1500 ? 0 : 1 - offset / 1500;
	}

	// ── line management ──────────────────────────────────────────────────────

	function startLine() {
		const line = CORPUS[lineIndex % CORPUS.length];
		lineIndex++;
		const t0 = now + INITIAL_DELAY_MS;
		words = line.split(' ').map((text, i) => ({
			id: ++nextId,
			text,
			isCharged: CHARGED_TOKENS.has(text.replace(/[^a-zA-Z]/g, '').toLowerCase()),
			peakTime: t0 + i * WORD_INTERVAL_MS,
			hit: null,
		}));
	}

	// ── animation loop ───────────────────────────────────────────────────────

	function tick(ts: number) {
		now = ts;

		if (words.length === 0) {
			startLine();
		} else {
			const last = words[words.length - 1];
			if (now - last.peakTime > EXIT_THRESHOLD_MS) {
				startLine();
			}
		}

		rafId = requestAnimationFrame(tick);
	}

	// ── hit detection ────────────────────────────────────────────────────────

	function handleHit() {
		const clickTime = performance.now();

		// find nearest unhit word to the seam
		let bestWord: Word | null = null;
		let bestDist = Infinity;
		for (const w of words) {
			if (w.hit !== null) continue;
			const dist = Math.abs(w.peakTime - clickTime);
			if (dist < bestDist) {
				bestDist = dist;
				bestWord = w;
			}
		}

		if (!bestWord) return;

		const quality = classifyHit(bestDist, bestWord.isCharged);
		if (quality === 'miss') return;

		// mutate hit in the array — Svelte 5 tracks nested state changes
		const idx = words.indexOf(bestWord);
		words[idx] = { ...words[idx], hit: quality };

		lastHitQuality = quality;
		lastHitAt = clickTime;

		game.glossFromReadingPass(quality);
		recorder.record(quality, bestWord.text);
	}

	function onPointerDown(e: PointerEvent) {
		// prevent double-firing if keyboard also handled
		e.preventDefault();
		handleHit();
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			handleHit();
		}
	}

	function skip() {
		words = [];
	}

	// ── hit label display ────────────────────────────────────────────────────

	const HIT_FADE_MS = 1600;
	const hitLabelOpacity = $derived(
		lastHitAt > 0 ? Math.max(0, 1 - (now - lastHitAt) / HIT_FADE_MS) : 0
	);

	// ── tally (mirrors ClickRegion) ──────────────────────────────────────────

	const tallyCount = $derived(game.clicksThisHundred % 100);
	const fives = $derived(Math.floor(tallyCount / 5));
	const ones = $derived(tallyCount % 5);

	let sweeping = $state(false);
	let prevTally = 0;
	$effect(() => {
		const t = game.clicksThisHundred % 100;
		if (prevTally !== 0 && t === 0) {
			sweeping = true;
			const id = setTimeout(() => (sweeping = false), 700);
			return () => clearTimeout(id);
		}
		prevTally = t;
	});

	// ── lifecycle ────────────────────────────────────────────────────────────

	let resizeObserver: ResizeObserver | undefined;

	onMount(() => {
		if (fieldEl) {
			fieldWidth = fieldEl.clientWidth || 700;
			resizeObserver = new ResizeObserver((entries) => {
				fieldWidth = entries[0]?.contentRect.width ?? 700;
			});
			resizeObserver.observe(fieldEl);
		}
		rafId = requestAnimationFrame(tick);
	});

	onDestroy(() => {
		cancelAnimationFrame(rafId);
		resizeObserver?.disconnect();
	});

	// ── meta text ────────────────────────────────────────────────────────────

	const cp = $derived(game.clickPower);
	const combo = $derived(game.ductusCombo);
</script>

<div class="region">
	<!-- reading field -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="field"
		bind:this={fieldEl}
		role="button"
		tabindex="0"
		aria-label="click to annotate the passing text"
		onpointerdown={onPointerDown}
		onkeydown={onKeyDown}
	>
		<!-- wide-hit zone: faint periwinkle glow behind seam -->
		<div class="seam-zone" aria-hidden="true"></div>
		<!-- the seam itself -->
		<div class="seam" aria-hidden="true"></div>

		{#each words as w (w.id)}
			{@const cx = wordCentreX(w)}
			{@const charge = chargeIntensity(w)}
			<span
				class="word-wrap"
				style="left: {cx}px"
				aria-hidden="true"
			>
				<span
					class="word-text"
					class:charged={w.isCharged}
					class:near={Math.abs(w.peakTime - now) < 600 && w.hit === null}
					class:hit-luminous={w.hit === 'luminous'}
					class:hit-tight={w.hit === 'tight'}
					class:hit-wide={w.hit === 'wide'}
					style={w.isCharged && charge > 0 ? `--charge: ${charge.toFixed(3)}` : ''}
				>{w.text}</span>
			</span>
		{/each}

		<!-- quality label, fades after each hit -->
		{#if hitLabelOpacity > 0.01 && lastHitQuality}
			<span
				class="hit-label hit-label-{lastHitQuality}"
				style="opacity: {hitLabelOpacity.toFixed(3)}"
				aria-live="polite"
			>{HIT_LABEL[lastHitQuality]}</span>
		{/if}
	</div>

	<!-- skip button (old annotate button, graduated) -->
	<div class="controls">
		<button class="skip" type="button" onclick={skip}>→ next line</button>
	</div>

	<!-- tally marks — same as ClickRegion -->
	<div class="tally" class:sweeping aria-hidden="true">
		{#each Array(fives) as _, i (i)}
			<svg class="tally-five" viewBox="0 0 14 16" width="14" height="16" aria-hidden="true">
				<line x1="2" y1="1" x2="2" y2="15" />
				<line x1="5" y1="1" x2="5" y2="15" />
				<line x1="8" y1="1" x2="8" y2="15" />
				<line x1="11" y1="1" x2="11" y2="15" />
				<line x1="0" y1="14" x2="14" y2="2" />
			</svg>
		{/each}
		{#each Array(ones) as _, i (i)}
			<svg class="tally-one" viewBox="0 0 4 16" width="4" height="16" aria-hidden="true">
				<line x1="2" y1="1" x2="2" y2="15" />
			</svg>
		{/each}
	</div>

	<p class="meta">
		click when a word crosses the seam ·
		<span class="num">5×</span> tight ·
		<span class="num">25×</span> luminous<span class="periwinkle-dot">◆</span>
		{#if combo > 0 && game.hasUpgrade('ductus')}
			<span class="combo"> · ductus ×{combo}</span>
		{/if}
	</p>
</div>

<style>
	/* ── layout ──────────────────────────────────────────────────────────── */

	.region {
		position: relative;
		text-align: center;
		padding: 1rem 0 1.6rem;
	}

	/* ── reading field ────────────────────────────────────────────────────── */

	.field {
		position: relative;
		height: 4.8rem;
		overflow: hidden;
		cursor: crosshair;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		margin-bottom: 0.9rem;
		outline: none;
	}

	.field:focus-visible {
		box-shadow: 0 0 0 2px var(--periwinkle);
	}

	/* wide-hit zone — the ±15px (250ms × 0.06) seam region */
	.seam-zone {
		position: absolute;
		left: calc(50% - 15px);
		width: 30px;
		top: 0;
		bottom: 0;
		background: linear-gradient(
			to right,
			transparent,
			rgba(154, 150, 201, 0.06) 30%,
			rgba(154, 150, 201, 0.06) 70%,
			transparent
		);
		pointer-events: none;
	}

	/* the seam itself */
	.seam {
		position: absolute;
		left: 50%;
		top: 12%;
		bottom: 12%;
		width: 1px;
		background: var(--periwinkle);
		opacity: 0.4;
		pointer-events: none;
	}

	/* ── word positioning ─────────────────────────────────────────────────── */

	/*
	 * word-wrap centres the word on the left value:
	 * left = wordCentreX (centre of word in field)
	 * translateX(-50%) shifts left edge leftward so centre aligns
	 */
	.word-wrap {
		position: absolute;
		top: 50%;
		transform: translateY(-50%) translateX(-50%);
		pointer-events: none;
		user-select: none;
	}

	.word-text {
		display: block;
		white-space: nowrap;
		font-family: var(--font-body);
		font-size: 1.05rem;
		color: var(--muted);
		transition: none;
	}

	/* brightens as the word approaches the seam */
	.word-text.near {
		color: var(--text);
	}

	/* charged tokens: periwinkle tint, brightening via --charge 0→1 */
	.word-text.charged {
		color: color-mix(in srgb, var(--periwinkle) calc(var(--charge, 0.18) * 100%), var(--muted));
	}

	.word-text.charged.near {
		color: color-mix(in srgb, var(--periwinkle) calc(max(var(--charge, 0.18), 0.6) * 100%), var(--text));
	}

	/* ── hit animations ───────────────────────────────────────────────────── */

	.word-text.hit-luminous {
		animation: hit-luminous 1.4s ease-out forwards;
	}

	.word-text.hit-tight {
		animation: hit-tight 1s ease-out forwards;
	}

	.word-text.hit-wide {
		animation: hit-wide 0.7s ease-out forwards;
	}

	@keyframes hit-luminous {
		0% {
			color: var(--leafeon-pink);
			letter-spacing: 0.14em;
			text-shadow: 0 0 8px var(--leafeon-pink);
		}
		40% {
			color: var(--leafeon-pink);
			letter-spacing: 0.06em;
			text-shadow: 0 0 3px var(--leafeon-pink);
		}
		100% {
			color: var(--rule);
			letter-spacing: 0em;
			text-shadow: none;
		}
	}

	@keyframes hit-tight {
		0% {
			color: var(--cyan);
			letter-spacing: 0.06em;
		}
		100% {
			color: var(--rule);
			letter-spacing: 0em;
		}
	}

	@keyframes hit-wide {
		0% {
			color: var(--text);
		}
		100% {
			color: var(--rule);
		}
	}

	/* ── hit label ────────────────────────────────────────────────────────── */

	.hit-label {
		position: absolute;
		left: 50%;
		top: 0.35rem;
		transform: translateX(-50%);
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		pointer-events: none;
		white-space: nowrap;
	}

	.hit-label-luminous {
		color: var(--leafeon-pink);
	}

	.hit-label-tight {
		color: var(--cyan);
	}

	.hit-label-wide {
		color: var(--muted);
	}

	/* ── controls (skip) ─────────────────────────────────────────────────── */

	.controls {
		margin-bottom: 0.5rem;
	}

	.skip {
		font-family: var(--font-ui);
		font-size: 0.76rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
		padding: 0.2rem 0.5rem;
	}

	.skip:hover {
		color: var(--periwinkle);
	}

	/* ── tally (identical to ClickRegion) ─────────────────────────────────── */

	.tally {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: flex-end;
		gap: 4px;
		min-height: 18px;
		margin: 0.7rem auto 0;
		max-width: 28rem;
		padding: 0 1rem;
		color: var(--periwinkle);
		opacity: 0.62;
	}

	.tally :global(line) {
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
	}

	.tally-five {
		animation: tally-pop 280ms ease-out both;
	}

	.tally-one {
		animation: tally-pop 220ms ease-out both;
	}

	@keyframes tally-pop {
		0% {
			opacity: 0;
			transform: translateY(2px) scale(0.7);
		}
		60% {
			opacity: 1;
			transform: translateY(0) scale(1.08);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.tally.sweeping {
		animation: tally-sweep 700ms ease-in forwards;
		color: var(--leafeon-pink);
	}

	@keyframes tally-sweep {
		0% {
			transform: translateX(0);
			opacity: 0.9;
		}
		60% {
			transform: translateX(2.5rem);
			opacity: 0.4;
		}
		100% {
			transform: translateX(0);
			opacity: 0.62;
		}
	}

	/* ── meta ─────────────────────────────────────────────────────────────── */

	.meta {
		font-family: var(--font-ui);
		font-size: 0.82rem;
		color: var(--muted);
		margin: 0.6rem 0 0;
	}

	.num {
		font-family: var(--font-counter);
		color: var(--cream);
		font-size: 1rem;
	}

	.periwinkle-dot {
		color: var(--periwinkle);
		font-size: 0.6rem;
		vertical-align: super;
		margin-left: 0.1rem;
	}

	.combo {
		color: var(--cyan);
		font-family: var(--font-counter);
	}

	/* ── reduced motion ───────────────────────────────────────────────────── */

	@media (prefers-reduced-motion: reduce) {
		.word-text,
		.tally,
		.tally-five,
		.tally-one {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
