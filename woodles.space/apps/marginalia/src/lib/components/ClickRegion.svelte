<script lang="ts">
	import { game, fmt } from '$lib/state/game.svelte';

	type Mark = {
		id: number;
		x: number;
		y: number;
		kind: number;
		drift: number; // -1..1 horizontal drift
		rot: number; // degrees
		weight: number; // 1..3 stroke width
		hue: 'periwinkle' | 'leafeon' | 'cyan' | 'print';
		gain: number;
		showGain: boolean;
	};

	const cp = $derived(game.clickPower);
	const combo = $derived(game.ductusCombo);
	const charged = $derived(game.chargedClickReady);

	let buttonEl: HTMLButtonElement | undefined = $state();
	let marks = $state<Mark[]>([]);
	let stamping = $state(false);
	let nextMarkId = 0;
	let lastGainShownAt = 0;

	function onclick(e: MouseEvent) {
		if (!buttonEl) return;
		const rect = buttonEl.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const before = game.glosses;
		game.click();
		const gain = game.glosses - before;

		// the brackets clamp inward briefly
		stamping = true;
		setTimeout(() => (stamping = false), 180);

		const c = game.ductusCombo;
		const weight = 1 + Math.min(c / 8, 2);
		let hue: Mark['hue'] = 'periwinkle';
		if (c >= 18) hue = 'print';
		else if (c >= 8) hue = 'leafeon';
		else if (c >= 3) hue = 'cyan';

		// Show gain numerals only when the click is genuinely heavier than 1,
		// and not on every single click — keeps the air light.
		const now = performance.now();
		const showGain = gain >= 2 && now - lastGainShownAt > 90;
		if (showGain) lastGainShownAt = now;

		const id = ++nextMarkId;
		const kind = Math.floor(Math.random() * 7);
		const drift = (Math.random() - 0.5) * 1.4;
		const rot = (Math.random() - 0.5) * 30;
		marks = [
			...marks,
			{ id, x, y, kind, drift, rot, weight, hue, gain, showGain }
		];
		setTimeout(() => {
			marks = marks.filter((m) => m.id !== id);
		}, 1300);
	}

	// ── tally: groups of five, like wall hatches ──────────────────────────
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
</script>

<div class="region">
	<div class="ink-stage" aria-hidden="true">
		{#each marks as m (m.id)}
			<span
				class="mark hue-{m.hue}"
				style="left: {m.x}px; top: {m.y}px; --drift: {m.drift}; --rot: {m.rot}deg; --w: {m.weight};"
			>
				<svg viewBox="-14 -14 28 28" width="32" height="32" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="calc(var(--w) * 1px)">
					{#if m.kind === 0}
						<circle cx="0" cy="0" r="2.2" fill="currentColor" stroke="none" />
					{:else if m.kind === 1}
						<path d="M -10 0 L 10 0" />
					{:else if m.kind === 2}
						<path d="M -8 -1 L -2 6 L 10 -7" />
					{:else if m.kind === 3}
						<path d="M -8 5 L 0 -6 L 8 5" />
					{:else if m.kind === 4}
						<path d="M -10 0 Q -5 -6 0 0 T 10 0" />
					{:else if m.kind === 5}
						<path d="M -7 -7 L 7 7 M -7 7 L 7 -7" />
					{:else}
						<path d="M -9 2 Q -6 -7 0 -3 T 8 4" />
					{/if}
				</svg>
				{#if m.showGain}
					<span class="gain hue-{m.hue}">+{fmt(m.gain)}</span>
				{/if}
			</span>
		{/each}
	</div>

	<button
		bind:this={buttonEl}
		type="button"
		{onclick}
		aria-label={charged ? 'annotate (charged: 5×)' : 'annotate'}
		class:stamping
		class:charged
		style="--combo: {Math.min(combo, 30)}"
	>
		<span class="bracket left">[</span>
		<span class="word">annotate</span>
		<span class="bracket right">]</span>
	</button>

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
		each click writes <span class="num">{fmt(cp)}</span> gloss{cp === 1 ? '' : 'es'}{#if combo > 0 && game.hasUpgrade('ductus')}<span class="combo"> · ductus ×{combo}</span>{/if}{#if charged}<span class="charged-hint"> · charged ×5</span>{/if}.
	</p>
</div>

<style>
	.region {
		position: relative;
		text-align: center;
		padding: 1rem 0 1.6rem;
	}
	.ink-stage {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: visible;
		z-index: 2;
	}
	button {
		position: relative;
		font-family: var(--font-display);
		font-size: clamp(1.4rem, 3.2vw, 1.9rem);
		letter-spacing: 0.02em;
		color: var(--cream);
		padding: 0.4rem 0.6rem;
		transition: color 120ms ease, transform 60ms ease, text-shadow 220ms ease;
		text-shadow:
			0 0 0 transparent,
			calc(var(--combo, 0) * 0.18px) 0 0 rgba(108, 229, 232, calc(var(--combo, 0) * 0.012)),
			calc(var(--combo, 0) * -0.18px) 0 0 rgba(240, 143, 184, calc(var(--combo, 0) * 0.012));
		z-index: 1;
	}
	button:hover {
		color: var(--leafeon-pink);
	}
	button:active {
		transform: translateY(1px) scale(0.985);
	}
	button.stamping {
		transform: translateY(1px) scale(0.985);
	}
	.bracket {
		display: inline-block;
		color: var(--periwinkle);
		margin: 0 0.35rem;
		transition: transform 120ms cubic-bezier(0.2, 1.4, 0.4, 1);
	}
	button.stamping .bracket.left {
		transform: translateX(0.35rem);
		color: var(--cyan);
	}
	button.stamping .bracket.right {
		transform: translateX(-0.35rem);
		color: var(--cyan);
	}
	.word {
		text-decoration: underline;
		text-decoration-color: var(--rule);
		text-underline-offset: 0.32em;
		text-decoration-thickness: calc(1px + var(--combo, 0) * 0.04px);
	}
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
	.combo {
		color: var(--cyan);
		font-family: var(--font-counter);
	}
	.charged-hint {
		color: var(--leafeon-pink);
		font-family: var(--font-counter);
	}

	/* ── charged state ───────────────────────────────────────────── */
	button.charged .bracket {
		color: var(--leafeon-pink);
		animation: charged-tremor 700ms ease-in-out infinite;
	}
	button.charged .word {
		color: var(--leafeon-pink);
		text-shadow: 0 0 10px rgba(240, 143, 184, 0.45);
	}
	@keyframes charged-tremor {
		0%, 100% { transform: translateX(0); }
		25%      { transform: translateX(-1px); }
		75%      { transform: translateX(1px); }
	}

	/* ── ink marks ───────────────────────────────────────────── */
	.mark {
		position: absolute;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transform: translate(-50%, -50%);
		animation: ink-fade 1.3s cubic-bezier(0.2, 0.6, 0.3, 1) forwards;
		filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.25));
	}
	.mark svg {
		display: block;
		transform: rotate(var(--rot, 0deg));
	}
	.hue-periwinkle {
		color: var(--periwinkle);
	}
	.hue-cyan {
		color: var(--cyan);
	}
	.hue-leafeon {
		color: var(--leafeon-pink);
	}
	.hue-print {
		color: var(--print-pink);
	}
	.gain {
		position: absolute;
		left: 100%;
		top: 0;
		margin-left: 0.15rem;
		font-family: var(--font-hand);
		font-size: 1.1rem;
		line-height: 1;
		white-space: nowrap;
		transform: translateY(-30%);
		opacity: 0.9;
	}
	@keyframes ink-fade {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.35);
		}
		15% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1.05);
		}
		35% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(calc(-50% + var(--drift, 0) * 18px), calc(-50% - 28px)) scale(1);
		}
	}

	/* ── tally marks ─────────────────────────────────────────── */
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
		transition: opacity 280ms ease, transform 280ms ease;
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

	@media (prefers-reduced-motion: reduce) {
		.mark,
		.tally,
		.tally-five,
		.tally-one,
		button,
		.bracket {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
