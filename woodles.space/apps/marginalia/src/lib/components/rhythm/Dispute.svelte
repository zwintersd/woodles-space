<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { game } from '$lib/state/game.svelte';
	import { readers, nextBeatTime, phraseForBeat } from '$lib/content/readers';

	// ── constants ─────────────────────────────────────────────────────────────

	// Slightly slower than reading pass; phrases are longer and need reading time.
	const SPEED_PX_MS = 0.05;
	const LOOKAHEAD_MS = 3800;
	const INITIAL_DELAY_MS = 1800;
	const EXIT_THRESHOLD_MS = 3200;

	// Timing windows for mode classification.
	// Reader interval is ~1100ms; counterpoint sits near the ~550ms midpoint.
	const AGREEMENT_MS = 110;   // ±110ms from a beat peak → agreement
	const DISAGREEMENT_MS = 380; // 110–380ms from peak → disagreement
	const COUNTERPOINT_MAX_MS = 640; // 380–640ms from peak → counterpoint (≈ half-beat)

	// ── reader ────────────────────────────────────────────────────────────────

	const reader = readers[0]; // unknown hand

	// ── state ─────────────────────────────────────────────────────────────────

	interface Beat {
		id: number;
		peakTime: number;
		phrase: string;
		isAccent: boolean;
	}

	type DisputeMode = 'agreement' | 'disagreement' | 'counterpoint';

	let fieldEl: HTMLDivElement | undefined = $state();
	let fieldWidth = $state(700);
	let now = $state(performance.now());
	let beats = $state<Beat[]>([]);
	let nextId = 0;
	let beatIndex = 0;
	let nextPeak = 0;
	let rafId = 0;

	// hit feedback
	let lastMode = $state<DisputeMode | null>(null);
	let lastHitAt = $state(0);

	// player click flash — position offset from seam (0 = on beat, ±px)
	let clickFlash = $state(0); // opacity
	let clickOffset = $state(0); // px from seam at moment of click

	const seamX = $derived(fieldWidth / 2);

	// ── beat x position ───────────────────────────────────────────────────────

	function beatX(b: Beat): number {
		return seamX + (b.peakTime - now) * SPEED_PX_MS;
	}

	// ── beat generation ───────────────────────────────────────────────────────

	function ensureBeats() {
		if (nextPeak === 0) nextPeak = now + INITIAL_DELAY_MS;
		const horizon = now + LOOKAHEAD_MS;
		while (nextPeak < horizon) {
			beats.push({
				id: ++nextId,
				peakTime: nextPeak,
				phrase: phraseForBeat(reader, beatIndex),
				isAccent: beatIndex % reader.accentEvery === 0,
			});
			beatIndex++;
			nextPeak = nextBeatTime(reader, nextPeak);
		}
		// cull exited beats
		beats = beats.filter((b) => now - b.peakTime < EXIT_THRESHOLD_MS);
	}

	// ── animation loop ────────────────────────────────────────────────────────

	function tick(ts: number) {
		now = ts;
		ensureBeats();
		// decay click flash
		if (clickFlash > 0) clickFlash = Math.max(0, clickFlash - 0.035);
		rafId = requestAnimationFrame(tick);
	}

	// ── hit detection ─────────────────────────────────────────────────────────

	function classify(clickTime: number): DisputeMode | null {
		let nearest = Infinity;
		for (const b of beats) {
			const d = Math.abs(b.peakTime - clickTime);
			if (d < nearest) nearest = d;
		}
		if (nearest <= AGREEMENT_MS) return 'agreement';
		if (nearest <= DISAGREEMENT_MS) return 'disagreement';
		if (nearest <= COUNTERPOINT_MAX_MS) return 'counterpoint';
		return null;
	}

	function handleHit() {
		const clickTime = performance.now();
		const mode = classify(clickTime);
		if (!mode) return;

		// find nearest beat to compute px offset for the click flash
		let nearestBeat: Beat | null = null;
		let nearestDist = Infinity;
		for (const b of beats) {
			const d = Math.abs(b.peakTime - clickTime);
			if (d < nearestDist) { nearestDist = d; nearestBeat = b; }
		}
		// offset in px: how far the nearest beat was from the seam at click time
		clickOffset = nearestBeat ? (nearestBeat.peakTime - clickTime) * SPEED_PX_MS : 0;

		lastMode = mode;
		lastHitAt = clickTime;
		clickFlash = 1;

		game.resourcesFromDispute(mode);
	}

	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		handleHit();
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			handleHit();
		}
	}

	// ── label fade ────────────────────────────────────────────────────────────

	const LABEL_FADE_MS = 1800;
	const labelOpacity = $derived(
		lastHitAt > 0 ? Math.max(0, 1 - (now - lastHitAt) / LABEL_FADE_MS) : 0
	);

	const MODE_LABEL: Record<DisputeMode, string> = {
		agreement: 'agreement',
		disagreement: 'disagreement',
		counterpoint: 'counterpoint',
	};

	const MODE_RESOURCE: Record<DisputeMode, string> = {
		agreement: '+ commentary',
		disagreement: '+ apparatus',
		counterpoint: '+ recension',
	};

	// ── lifecycle ─────────────────────────────────────────────────────────────

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
</script>

<div class="dispute">
	<p class="reader-id" aria-hidden="true">— {reader.name} —</p>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="field"
		bind:this={fieldEl}
		role="button"
		tabindex="0"
		aria-label="click to annotate in agreement, disagreement, or counterpoint with the previous reader"
		onpointerdown={onPointerDown}
		onkeydown={onKeyDown}
	>
		<!-- vertical seam, spans both tracks -->
		<div class="seam" aria-hidden="true"></div>

		<!-- ── upper track: previous reader ───────────────────────────── -->
		<div class="track track-upper" aria-hidden="true">
			<span class="track-label">their hand</span>
			{#each beats as b (b.id)}
				{@const x = beatX(b)}
				{#if x > -200 && x < fieldWidth + 200}
					<span
						class="beat"
						class:accent={b.isAccent}
						style="left: {x}px"
					>{b.phrase}</span>
				{/if}
			{/each}
		</div>

		<!-- track divider -->
		<div class="track-divider" aria-hidden="true"></div>

		<!-- ── lower track: player ────────────────────────────────────── -->
		<div class="track track-lower" aria-hidden="true">
			<span class="track-label">your hand</span>

			<!-- click flash: a mark landing at the seam (±offset from where the beat was) -->
			{#if clickFlash > 0.01 && lastMode}
				<span
					class="click-mark click-mark-{lastMode}"
					style="left: {seamX + clickOffset}px; opacity: {clickFlash.toFixed(3)}"
				>|</span>
			{/if}

			<!-- mode + resource label, fades after hit -->
			{#if labelOpacity > 0.01 && lastMode}
				<span
					class="hit-label hit-label-{lastMode}"
					style="opacity: {labelOpacity.toFixed(3)}"
					aria-live="polite"
				>
					<span class="mode-word">{MODE_LABEL[lastMode]}</span>
					<span class="resource-word">{MODE_RESOURCE[lastMode]}</span>
				</span>
			{/if}
		</div>
	</div>

	<p class="meta">
		<span class="hint-agree">agree</span>
		·
		<span class="hint-disagree">disagree</span>
		·
		<span class="hint-counter">counterpoint</span>
		<span class="meta-sep"> — </span>collate, refute, or diverge from the previous reader's hand
	</p>
</div>

<style>
	/* ── layout ──────────────────────────────────────────────────────────── */

	.dispute {
		padding: 0.6rem 0 1.2rem;
		text-align: center;
	}

	.reader-id {
		font-family: var(--font-ui);
		font-size: 0.74rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--muted);
		margin: 0 0 0.6rem;
	}

	/* ── field ───────────────────────────────────────────────────────────── */

	.field {
		position: relative;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		margin-bottom: 0.8rem;
		cursor: crosshair;
		outline: none;
		overflow: hidden;
	}

	.field:focus-visible {
		box-shadow: 0 0 0 2px var(--periwinkle);
	}

	/* seam spans the full height of both tracks */
	.seam {
		position: absolute;
		left: 50%;
		top: 8%;
		bottom: 8%;
		width: 1px;
		background: var(--periwinkle);
		opacity: 0.35;
		pointer-events: none;
		z-index: 2;
	}

	/* ── tracks ──────────────────────────────────────────────────────────── */

	.track {
		position: relative;
		height: 3.4rem;
		overflow: hidden;
	}

	.track-label {
		position: absolute;
		left: 0.8rem;
		top: 50%;
		transform: translateY(-50%);
		font-family: var(--font-ui);
		font-size: 0.68rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--rule);
		pointer-events: none;
		user-select: none;
		white-space: nowrap;
		z-index: 1;
	}

	.track-divider {
		height: 1px;
		background: var(--rule);
	}

	/* ── previous reader beats (upper track) ─────────────────────────────── */

	.beat {
		position: absolute;
		top: 50%;
		transform: translateY(-50%) translateX(-50%);
		white-space: nowrap;
		font-family: var(--font-body);
		font-size: 0.9rem;
		color: var(--muted);
		pointer-events: none;
		user-select: none;
		font-style: italic;
	}

	.beat.accent {
		font-family: var(--font-hand);
		font-size: 1rem;
		color: var(--periwinkle);
		font-style: normal;
	}

	/* ── player click mark (lower track) ─────────────────────────────────── */

	.click-mark {
		position: absolute;
		top: 50%;
		transform: translateY(-50%) translateX(-50%);
		font-family: var(--font-counter);
		font-size: 1.6rem;
		line-height: 1;
		pointer-events: none;
		user-select: none;
	}

	.click-mark-agreement {
		color: var(--cyan);
	}

	.click-mark-disagreement {
		color: var(--leafeon-pink);
	}

	.click-mark-counterpoint {
		color: var(--periwinkle);
	}

	/* ── hit label (lower track, centred) ────────────────────────────────── */

	.hit-label {
		position: absolute;
		left: 50%;
		top: 0.3rem;
		transform: translateX(-50%);
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		white-space: nowrap;
		pointer-events: none;
	}

	.mode-word {
		font-family: var(--font-ui);
		font-size: 0.68rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}

	.resource-word {
		font-family: var(--font-counter);
		font-size: 1rem;
	}

	.hit-label-agreement .mode-word,
	.hit-label-agreement .resource-word {
		color: var(--cyan);
	}

	.hit-label-disagreement .mode-word,
	.hit-label-disagreement .resource-word {
		color: var(--leafeon-pink);
	}

	.hit-label-counterpoint .mode-word,
	.hit-label-counterpoint .resource-word {
		color: var(--periwinkle);
	}

	/* ── meta ─────────────────────────────────────────────────────────────── */

	.meta {
		font-family: var(--font-ui);
		font-size: 0.8rem;
		color: var(--muted);
		margin: 0;
	}

	.hint-agree {
		color: var(--cyan);
		letter-spacing: 0.06em;
	}

	.hint-disagree {
		color: var(--leafeon-pink);
		letter-spacing: 0.06em;
	}

	.hint-counter {
		color: var(--periwinkle);
		letter-spacing: 0.06em;
	}

	.meta-sep {
		color: var(--rule);
	}

	/* ── reduced motion ───────────────────────────────────────────────────── */

	@media (prefers-reduced-motion: reduce) {
		.beat,
		.click-mark {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
