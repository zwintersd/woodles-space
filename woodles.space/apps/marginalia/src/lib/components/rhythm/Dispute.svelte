<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { game } from '$lib/state/game.svelte';
	import { TIMING } from '$lib/rhythm/timing';
	import { unknownReader, type Reader } from '$lib/content/readers';

	// ── constants ─────────────────────────────────────────────────────────────

	const SPEED_PX_MS = 0.06;        // px/ms — matches reading pass
	const INITIAL_DELAY_MS = 2400;   // first reader beat arrives after this
	const LOOKAHEAD_COUNT = 8;       // keep this many future beats pre-generated
	const EXIT_PAST_MS = 3500;       // trim beats this long past their peak
	const MARK_FADE_MS = 2000;       // player marks fade over this duration
	const LABEL_FADE_MS = 1800;      // mode label fades over this duration

	// ── types ─────────────────────────────────────────────────────────────────

	type DisputeMode = 'agreement' | 'disagreement' | 'counterpoint';

	interface ReaderBeat {
		id: number;
		text: string;
		peakTime: number;
		responded: boolean;   // true once the player has hit near this beat
	}

	interface PlayerMark {
		id: number;
		mode: DisputeMode;
		at: number;            // performance.now() at click time
	}

	// ── state ─────────────────────────────────────────────────────────────────

	// The active reader — fixed to the unknown hand for v1.5.
	// v3.0 will allow switching via a separate unlock.
	const reader: Reader = unknownReader;

	let fieldEl: HTMLDivElement | undefined = $state();
	let fieldWidth = $state(700);
	let now = $state(performance.now());
	let readerBeats = $state<ReaderBeat[]>([]);
	let playerMarks = $state<PlayerMark[]>([]);
	let nextId = 0;
	let phraseIdx = 0;
	let intervalIdx = 0;
	let rafId = 0;

	// hit feedback
	let lastMode = $state<DisputeMode | null>(null);
	let lastHitAt = $state(0);

	// seam flare for visual hit response
	let seamFlareMode = $state<DisputeMode | null>(null);
	let seamFlareAt = $state(0);
	const SEAM_FLARE_MS = 400;

	// ── derived ───────────────────────────────────────────────────────────────

	const seamX = $derived(fieldWidth / 2);

	function beatX(b: ReaderBeat): number {
		return seamX + (b.peakTime - now) * SPEED_PX_MS;
	}

	function markX(m: PlayerMark): number {
		// Marks start at the seam when clicked and drift left with time.
		return seamX + (m.at - now) * SPEED_PX_MS;
	}

	function markOpacity(m: PlayerMark): number {
		return Math.max(0, 1 - (now - m.at) / MARK_FADE_MS);
	}

	const labelOpacity = $derived(
		lastHitAt > 0 ? Math.max(0, 1 - (now - lastHitAt) / LABEL_FADE_MS) : 0
	);

	const seamFlareOpacity = $derived(
		seamFlareAt > 0 ? Math.max(0, 1 - (now - seamFlareAt) / SEAM_FLARE_MS) : 0
	);

	// Whether a reader beat is near enough the seam to be "active" (glow on).
	function isNearSeam(b: ReaderBeat): boolean {
		return Math.abs(b.peakTime - now) < 600 && !b.responded;
	}

	// ── beat generation ───────────────────────────────────────────────────────

	function nextPhrase(): string {
		return reader.phrases[phraseIdx++ % reader.phrases.length];
	}

	function nextInterval(): number {
		return reader.intervalSeq[intervalIdx++ % reader.intervalSeq.length];
	}

	function ensureBeats() {
		const futureCount = readerBeats.filter((b) => b.peakTime > now).length;
		let remaining = LOOKAHEAD_COUNT - futureCount;
		while (remaining-- > 0) {
			const last = readerBeats[readerBeats.length - 1];
			const peakTime = last ? last.peakTime + nextInterval() : now + INITIAL_DELAY_MS;
			readerBeats.push({ id: ++nextId, text: nextPhrase(), peakTime, responded: false });
		}
	}

	// ── hit classification ────────────────────────────────────────────────────

	function classifyClick(clickTime: number): DisputeMode | null {
		// Find nearest reader beat to the click.
		let nearest: ReaderBeat | null = null;
		let nearestDist = Infinity;
		for (const b of readerBeats) {
			const d = Math.abs(b.peakTime - clickTime);
			if (d < nearestDist) { nearestDist = d; nearest = b; }
		}
		if (!nearest) return null;

		// Agreement: within tight window of beat peak.
		if (nearestDist <= TIMING.tight) return 'agreement';

		// Counterpoint: within tight window of the midpoint between two beats.
		// Check midpoints on both sides of the nearest beat.
		const idx = readerBeats.indexOf(nearest);
		const prev = readerBeats[idx - 1];
		const next = readerBeats[idx + 1];
		if (prev) {
			const mid = (prev.peakTime + nearest.peakTime) / 2;
			if (Math.abs(clickTime - mid) <= TIMING.tight) return 'counterpoint';
		}
		if (next) {
			const mid = (nearest.peakTime + next.peakTime) / 2;
			if (Math.abs(clickTime - mid) <= TIMING.tight) return 'counterpoint';
		}

		// Disagreement: within wide window but outside agreement and counterpoint.
		if (nearestDist <= TIMING.wide) return 'disagreement';

		return null;
	}

	// ── animation loop ────────────────────────────────────────────────────────

	function tick(ts: number) {
		now = ts;
		ensureBeats();
		readerBeats = readerBeats.filter((b) => now - b.peakTime < EXIT_PAST_MS);
		playerMarks = playerMarks.filter((m) => now - m.at < MARK_FADE_MS);
		rafId = requestAnimationFrame(tick);
	}

	// ── input handling ────────────────────────────────────────────────────────

	function handleHit() {
		const clickTime = performance.now();
		const mode = classifyClick(clickTime);
		if (!mode) return;

		// Mark the nearest beat as responded-to.
		let nearest: ReaderBeat | null = null;
		let nearestDist = Infinity;
		for (const b of readerBeats) {
			const d = Math.abs(b.peakTime - clickTime);
			if (d < nearestDist) { nearestDist = d; nearest = b; }
		}
		if (nearest) {
			const idx = readerBeats.indexOf(nearest);
			readerBeats[idx] = { ...readerBeats[idx], responded: true };
		}

		// Record player mark (drifts left from seam as time passes).
		playerMarks.push({ id: ++nextId, mode, at: clickTime });

		// Feedback state.
		lastMode = mode;
		lastHitAt = clickTime;
		seamFlareMode = mode;
		seamFlareAt = clickTime;

		game.disputeHit(mode);
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

	// ── mode labels ───────────────────────────────────────────────────────────

	const MODE_LABEL: Record<DisputeMode, string> = {
		agreement: 'agreement',
		disagreement: 'in dispute',
		counterpoint: 'counterpoint',
	};
</script>

<div class="dispute">
	<!-- attribution -->
	<p class="attribution">
		<span class="attr-name">{reader.name}</span>
		<span class="attr-hand">{reader.hand}</span>
	</p>

	<!-- two-track field -->
	<div class="field" bind:this={fieldEl}>

		<!-- seam: runs through both tracks -->
		<div
			class="seam"
			class:flare-agreement={seamFlareMode === 'agreement'}
			class:flare-disagreement={seamFlareMode === 'disagreement'}
			class:flare-counterpoint={seamFlareMode === 'counterpoint'}
			style={seamFlareOpacity > 0.01 ? `--flare: ${seamFlareOpacity.toFixed(3)}` : ''}
			aria-hidden="true"
		></div>
		<div class="seam-zone" aria-hidden="true"></div>

		<!-- upper track: reader's marks scroll past -->
		<div class="track reader-track" aria-hidden="true">
			<span class="track-label">▸ {reader.name.replace('the ', '')}</span>

			{#each readerBeats as b (b.id)}
				{@const x = beatX(b)}
				{#if x > -120 && x < fieldWidth + 120}
					<span
						class="reader-mark"
						class:near={isNearSeam(b)}
						class:responded={b.responded}
						style="left: {x}px"
						aria-hidden="true"
					>{b.text}</span>
				{/if}
			{/each}
		</div>

		<!-- track divider -->
		<div class="track-rule" aria-hidden="true"></div>

		<!-- lower track: player clicks here -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="track player-track"
			role="button"
			tabindex="0"
			aria-label="click to respond to the previous reader"
			onpointerdown={onPointerDown}
			onkeydown={onKeyDown}
		>
			<span class="track-label">▸ your reading</span>

			<!-- player hit marks: drift left from seam -->
			{#each playerMarks as m (m.id)}
				{@const x = markX(m)}
				{#if x > -80 && x < fieldWidth + 20}
					<span
						class="player-mark mark-{m.mode}"
						style="left: {x}px; opacity: {markOpacity(m).toFixed(3)}"
						aria-hidden="true"
					>◆</span>
				{/if}
			{/each}

			<!-- mode label at seam, fades after hit -->
			{#if labelOpacity > 0.01 && lastMode}
				<span
					class="mode-label label-{lastMode}"
					style="opacity: {labelOpacity.toFixed(3)}"
					aria-live="polite"
				>{MODE_LABEL[lastMode]}</span>
			{/if}
		</div>
	</div>

	<!-- legend -->
	<p class="legend">
		<span class="leg leg-agreement">agreement</span> <span class="leg-sep">→ commentary</span>
		<span class="leg-dot">·</span>
		<span class="leg leg-disagreement">in dispute</span> <span class="leg-sep">→ apparatus</span>
		<span class="leg-dot">·</span>
		<span class="leg leg-counterpoint">counterpoint</span> <span class="leg-sep">→ recension</span>
	</p>
</div>

<style>
	/* ── outer container ─────────────────────────────────────────────────── */

	.dispute {
		padding: 0.6rem 0 1.2rem;
		max-width: 44rem;
		margin: 0 auto;
	}

	/* ── attribution ─────────────────────────────────────────────────────── */

	.attribution {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
		padding: 0 0.4rem 0.45rem;
		margin: 0;
	}

	.attr-name {
		font-family: var(--font-ui);
		font-size: 0.74rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}

	.attr-hand {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.82rem;
		color: var(--muted);
	}

	/* ── field ───────────────────────────────────────────────────────────── */

	.field {
		position: relative;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		overflow: hidden;
	}

	/* ── shared seam (spans both tracks via absolute positioning) ─────────── */

	.seam {
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--periwinkle);
		opacity: 0.3;
		pointer-events: none;
		z-index: 2;
		transition: none;
	}

	/* Seam flares on hit — colour and widen briefly via box-shadow. */
	.seam.flare-agreement {
		box-shadow: 0 0 0 calc(var(--flare, 0) * 3px) var(--cyan);
		opacity: calc(0.3 + var(--flare, 0) * 0.7);
	}
	.seam.flare-disagreement {
		box-shadow: 0 0 0 calc(var(--flare, 0) * 3px) var(--leafeon-pink);
		opacity: calc(0.3 + var(--flare, 0) * 0.7);
	}
	.seam.flare-counterpoint {
		box-shadow: 0 0 0 calc(var(--flare, 0) * 3px) var(--print-pink);
		opacity: calc(0.3 + var(--flare, 0) * 0.7);
	}

	/* Wide-hit zone highlight — the ±15px window */
	.seam-zone {
		position: absolute;
		left: calc(50% - 15px);
		width: 30px;
		top: 0;
		bottom: 0;
		background: linear-gradient(
			to right,
			transparent,
			rgba(154, 150, 201, 0.05) 30%,
			rgba(154, 150, 201, 0.05) 70%,
			transparent
		);
		pointer-events: none;
		z-index: 1;
	}

	/* ── tracks ──────────────────────────────────────────────────────────── */

	.track {
		position: relative;
		height: 4rem;
		overflow: hidden;
	}

	.track-label {
		position: absolute;
		left: 0.6rem;
		top: 50%;
		transform: translateY(-50%);
		font-family: var(--font-ui);
		font-size: 0.68rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
		opacity: 0.5;
		pointer-events: none;
		z-index: 3;
		white-space: nowrap;
	}

	.player-track {
		cursor: crosshair;
		outline: none;
		background: transparent;
	}

	.player-track:focus-visible {
		box-shadow: inset 0 0 0 2px var(--periwinkle);
	}

	.reader-track {
		background: rgba(45, 45, 95, 0.3);
	}

	.track-rule {
		height: 1px;
		background: var(--rule);
		position: relative;
		z-index: 2;
	}

	/* ── reader marks ────────────────────────────────────────────────────── */

	.reader-mark {
		position: absolute;
		top: 50%;
		transform: translateX(-50%) translateY(-50%);
		font-family: var(--font-hand);
		font-size: 1.05rem;
		white-space: nowrap;
		color: var(--muted);
		pointer-events: none;
		user-select: none;
		z-index: 2;
		transition: none;
	}

	/* Brightens as the mark approaches the seam. */
	.reader-mark.near {
		color: var(--periwinkle);
	}

	/* Once responded-to, dims quickly — the beat is consumed. */
	.reader-mark.responded {
		opacity: 0.25;
		color: var(--muted);
		transition: opacity 600ms ease, color 600ms ease;
	}

	/* ── player marks ────────────────────────────────────────────────────── */

	.player-mark {
		position: absolute;
		top: 50%;
		transform: translateX(-50%) translateY(-50%);
		font-size: 0.72rem;
		pointer-events: none;
		user-select: none;
		z-index: 2;
	}

	.mark-agreement   { color: var(--cyan); }
	.mark-disagreement { color: var(--leafeon-pink); }
	.mark-counterpoint { color: var(--print-pink); }

	/* ── mode label ──────────────────────────────────────────────────────── */

	.mode-label {
		position: absolute;
		left: 50%;
		top: 0.4rem;
		transform: translateX(-50%);
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		white-space: nowrap;
		pointer-events: none;
		z-index: 4;
	}

	.label-agreement   { color: var(--cyan); }
	.label-disagreement { color: var(--leafeon-pink); }
	.label-counterpoint { color: var(--print-pink); }

	/* ── legend ──────────────────────────────────────────────────────────── */

	.legend {
		font-family: var(--font-ui);
		font-size: 0.76rem;
		color: var(--muted);
		text-align: center;
		margin: 0.65rem 0 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.2rem 0.5rem;
	}

	.leg-sep {
		color: var(--muted);
		opacity: 0.6;
	}

	.leg-dot {
		color: var(--muted);
		opacity: 0.4;
	}

	.leg-agreement   { color: var(--cyan); }
	.leg-disagreement { color: var(--leafeon-pink); }
	.leg-counterpoint { color: var(--print-pink); }

	/* ── reduced motion ──────────────────────────────────────────────────── */

	@media (prefers-reduced-motion: reduce) {
		.reader-mark,
		.player-mark,
		.seam {
			transition: none !important;
			animation: none !important;
		}
	}
</style>
