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

	// Window widths in pixels (each side of the seam) — for visualising the zones.
	const AGREEMENT_PX = AGREEMENT_MS * SPEED_PX_MS;
	const DISAGREEMENT_PX = DISAGREEMENT_MS * SPEED_PX_MS;
	const COUNTERPOINT_PX = COUNTERPOINT_MAX_MS * SPEED_PX_MS;

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

	// Per-mode resource gain (must mirror game.resourcesFromDispute).
	const MODE_GAIN: Record<DisputeMode, number> = {
		agreement: 1,
		disagreement: 0.1,
		counterpoint: 0.01,
	};

	const MODE_RESOURCE_NAME: Record<DisputeMode, string> = {
		agreement: 'commentary',
		disagreement: 'apparatus',
		counterpoint: 'recension',
	};

	function fmtGain(mode: DisputeMode): string {
		const g = MODE_GAIN[mode];
		const num = g >= 1 ? g.toFixed(0) : g.toFixed(2);
		const name = MODE_RESOURCE_NAME[mode];
		return `+ ${num} ${name}`;
	}

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

	// miss flash — distinct from hit flash, faintly muted
	let missFlash = $state(0);
	let missOffset = $state(0);

	// running tallies per mode this session, shown subtly
	let hits = $state({ agreement: 0, disagreement: 0, counterpoint: 0 });

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
		// decay flashes
		if (clickFlash > 0) clickFlash = Math.max(0, clickFlash - 0.035);
		if (missFlash > 0) missFlash = Math.max(0, missFlash - 0.05);
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

		// find nearest beat (used for both hit and miss feedback)
		let nearestBeat: Beat | null = null;
		let nearestDist = Infinity;
		for (const b of beats) {
			const d = Math.abs(b.peakTime - clickTime);
			if (d < nearestDist) { nearestDist = d; nearestBeat = b; }
		}
		const offsetPx = nearestBeat ? (nearestBeat.peakTime - clickTime) * SPEED_PX_MS : 0;

		const mode = classify(clickTime);
		if (!mode) {
			// miss — register feedback so the click is felt, but no resource
			missOffset = offsetPx;
			missFlash = 1;
			return;
		}

		clickOffset = offsetPx;
		lastMode = mode;
		lastHitAt = clickTime;
		clickFlash = 1;
		hits[mode] += 1;

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
		<!-- timing-window zones around the seam, on the upper track -->
		<div class="zones" aria-hidden="true">
			<div
				class="zone zone-counter"
				style="left: calc(50% - {COUNTERPOINT_PX}px); width: {COUNTERPOINT_PX * 2}px"
			></div>
			<div
				class="zone zone-disagree"
				style="left: calc(50% - {DISAGREEMENT_PX}px); width: {DISAGREEMENT_PX * 2}px"
			></div>
			<div
				class="zone zone-agree"
				style="left: calc(50% - {AGREEMENT_PX}px); width: {AGREEMENT_PX * 2}px"
			></div>
		</div>

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

			<!-- miss flash: faintly muted, no resource -->
			{#if missFlash > 0.01}
				<span
					class="click-mark click-mark-miss"
					style="left: {seamX + missOffset}px; opacity: {(missFlash * 0.6).toFixed(3)}"
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
					<span class="resource-word">{fmtGain(lastMode)}</span>
				</span>
			{/if}
		</div>
	</div>

	<p class="meta">
		<span class="hint-agree">on-beat → agreement</span>
		<span class="meta-sep"> · </span>
		<span class="hint-disagree">off-beat → disagreement</span>
		<span class="meta-sep"> · </span>
		<span class="hint-counter">half-beat → counterpoint</span>
	</p>

	<p class="tallies" aria-live="off">
		<span class="tally-agree" title="commentaries from agreement">
			<span class="tally-dot tally-dot-agree"></span>{hits.agreement}
		</span>
		<span class="tally-sep">·</span>
		<span class="tally-disagree" title="apparatus from disagreement">
			<span class="tally-dot tally-dot-disagree"></span>{hits.disagreement}
		</span>
		<span class="tally-sep">·</span>
		<span class="tally-counter" title="recensions from counterpoint">
			<span class="tally-dot tally-dot-counter"></span>{hits.counterpoint}
		</span>
		<span class="tally-sep">·</span>
		<span class="tally-hint">space / click</span>
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
		z-index: 3;
	}

	/* ── timing-window zones (upper track only) ───────────────────────── */

	.zones {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 3.4rem; /* matches .track height */
		pointer-events: none;
		z-index: 0;
	}

	.zone {
		position: absolute;
		top: 0;
		bottom: 0;
		opacity: 0.12;
	}

	.zone-counter {
		background: linear-gradient(
			to right,
			transparent,
			var(--periwinkle) 20%,
			var(--periwinkle) 80%,
			transparent
		);
	}

	.zone-disagree {
		background: var(--leafeon-pink);
		opacity: 0.10;
	}

	.zone-agree {
		background: var(--cyan);
		opacity: 0.18;
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
		z-index: 4;
		background: linear-gradient(
			to right,
			var(--bg) 0%,
			var(--bg) 80%,
			transparent
		);
		padding-right: 0.6rem;
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

	.click-mark-miss {
		color: var(--rule);
		font-size: 1.3rem;
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

	/* ── tallies ──────────────────────────────────────────────────────────── */

	.tallies {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.55rem;
		font-family: var(--font-counter);
		font-size: 0.82rem;
		color: var(--muted);
		margin: 0.45rem 0 0;
	}

	.tally-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		margin-right: 0.3rem;
		vertical-align: middle;
	}

	.tally-dot-agree { background: var(--cyan); }
	.tally-dot-disagree { background: var(--leafeon-pink); }
	.tally-dot-counter { background: var(--periwinkle); }

	.tally-sep {
		color: var(--rule);
	}

	.tally-hint {
		font-family: var(--font-ui);
		font-size: 0.68rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
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
