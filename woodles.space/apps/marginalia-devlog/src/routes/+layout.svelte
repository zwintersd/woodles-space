<script lang="ts">
	import '$lib/style/tokens.css';
	import '@shared/fonts.css';
	import { initSync } from '$lib/sync.svelte';
	import { devlog } from '$lib/devlog.svelte';
	import { fontStore } from '$lib/fontStore.svelte';
	import FontPanel from '$lib/FontPanel.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	let fontPanelOpen = $state(false);

	const sparkles = [
		// original eight
		{ char: '✦', left: '6%',  top: '14%', delay: '0s',   size: '0.9rem' },
		{ char: '✧', left: '88%', top: '10%', delay: '1.4s', size: '1.1rem' },
		{ char: '⋆', left: '20%', top: '74%', delay: '2.2s', size: '1rem'   },
		{ char: '✦', left: '70%', top: '30%', delay: '3.1s', size: '0.8rem' },
		{ char: '✧', left: '42%', top: '8%',  delay: '4s',   size: '0.7rem' },
		{ char: '⋆', left: '92%', top: '60%', delay: '1.9s', size: '1.2rem' },
		{ char: '✦', left: '12%', top: '44%', delay: '2.8s', size: '0.7rem' },
		{ char: '✧', left: '60%', top: '82%', delay: '0.6s', size: '0.9rem' },
		// hearts & flowers
		{ char: '♡', left: '32%', top: '22%', delay: '1.1s', size: '0.85rem' },
		{ char: '♡', left: '78%', top: '68%', delay: '3.5s', size: '0.75rem' },
		{ char: '♡', left: '66%', top: '16%', delay: '4.9s', size: '0.7rem'  },
		{ char: '✿', left: '52%', top: '88%', delay: '2.7s', size: '0.9rem'  },
		{ char: '✿', left: '28%', top: '50%', delay: '2.4s', size: '0.75rem' },
		// geometric extras
		{ char: '⊹', left: '16%', top: '58%', delay: '4.4s', size: '1rem'   },
		{ char: '˚',  left: '84%', top: '46%', delay: '0.3s', size: '1.4rem' },
		{ char: '✦', left: '48%', top: '36%', delay: '5.1s', size: '0.65rem'},
		{ char: '⋆', left: '4%',  top: '84%', delay: '3.8s', size: '0.8rem' },
		{ char: '✧', left: '96%', top: '26%', delay: '1.7s', size: '0.75rem'},
	];

	onMount(async () => {
		await devlog.readyPromise;
		initSync();
	});
</script>

<div class="devlog-root" style="--d-font-body: {fontStore.cssValue};">
	<!-- dreamy backdrop -->
	<div class="dream-wash" aria-hidden="true"></div>
	<div class="dream-shimmer" aria-hidden="true"></div>

	<div class="dream-clouds" aria-hidden="true">
		<span class="cloud cloud-1"></span>
		<span class="cloud cloud-2"></span>
		<span class="cloud cloud-3"></span>
	</div>

	<!-- crescent moon -->
	<div class="dream-moon" aria-hidden="true">☽</div>

	<!-- scattered sparkles, hearts, flowers -->
	<div class="dream-sparkles" aria-hidden="true">
		{#each sparkles as s}
			<span
				class="sparkle"
				style="left:{s.left}; top:{s.top}; animation-delay:{s.delay}; font-size:{s.size};"
			>{s.char}</span>
		{/each}
	</div>

	<div class="dream-content">
		{@render children()}
	</div>

	<!-- font selector toggle — always accessible -->
	<button
		class="font-toggle"
		class:active={fontPanelOpen}
		onclick={() => (fontPanelOpen = !fontPanelOpen)}
		title="choose writing font"
		aria-label="font settings"
		aria-expanded={fontPanelOpen}
	>
		Aa
	</button>

	{#if fontPanelOpen}
		<div
			class="font-backdrop"
			role="presentation"
			onclick={() => (fontPanelOpen = false)}
			onkeydown={() => (fontPanelOpen = false)}
		></div>
		<FontPanel onclose={() => (fontPanelOpen = false)} />
	{/if}
</div>

<style>
	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(html),
	:global(body) { height: 100%; }

	/* base type scale — % keeps it relative to the reader's browser font size,
	   so every rem in the app scales from here (and large-text prefs are honored) */
	:global(html) { font-size: 112.5%; }

	:global(body) {
		background: var(--d-bg, #f3ecfb);
		overflow-x: hidden;
	}

	:global(*::-webkit-scrollbar) { width: 12px; height: 12px; }
	:global(*::-webkit-scrollbar-track) { background: transparent; }
	:global(*::-webkit-scrollbar-thumb) {
		background: rgba(183, 140, 240, 0.35);
		border-radius: 100px;
		border: 3px solid transparent;
		background-clip: content-box;
	}
	:global(*::-webkit-scrollbar-thumb:hover) {
		background: rgba(183, 140, 240, 0.55);
		background-clip: content-box;
	}

	:global(button) {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}
	:global(button:disabled) { cursor: not-allowed; opacity: 0.4; }

	:global(input),
	:global(textarea),
	:global(select) {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		outline: none;
	}

	.devlog-root {
		position: relative;
		min-height: 100vh;
		background: var(--d-bg);
		color: var(--d-text);
		font-family: var(--d-font-body);
		font-size: 1rem;
		line-height: 1.6;
		overflow: hidden;
	}

	/* ── the wash: drifting pastel blobs ───────────────────────────── */
	.dream-wash {
		position: fixed;
		inset: -25%;
		z-index: 0;
		pointer-events: none;
		background:
			radial-gradient(38% 42% at 16% 20%, #e7c9f5 0%, transparent 66%),
			radial-gradient(34% 40% at 84% 24%, #c9e3f9 0%, transparent 66%),
			radial-gradient(40% 44% at 74% 80%, #fbd4e6 0%, transparent 70%),
			radial-gradient(36% 40% at 22% 82%, #d6f3ea 0%, transparent 66%),
			radial-gradient(48% 52% at 50% 48%, #f3e6c9 0%, transparent 78%),
			radial-gradient(30% 35% at 58% 14%, #fce8f5 0%, transparent 60%),
			radial-gradient(26% 30% at 8% 52%,  #dde8fc 0%, transparent 60%);
		opacity: 0.75;
		filter: blur(48px);
		animation: wash-drift 38s ease-in-out infinite alternate;
	}
	@keyframes wash-drift {
		0%   { transform: translate(0, 0) scale(1) rotate(0deg); }
		50%  { transform: translate(2%, -3%) scale(1.06) rotate(3deg); }
		100% { transform: translate(-3%, 2%) scale(1.04) rotate(-3deg); }
	}

	/* ── iridescent shimmer ribbon ─────────────────────────────────── */
	.dream-shimmer {
		position: fixed;
		top: 0;
		left: -20%;
		width: 140%;
		height: 3px;
		z-index: 0;
		pointer-events: none;
		background: linear-gradient(90deg,
			transparent 0%,
			rgba(245, 184, 216, 0.7) 15%,
			rgba(210, 184, 245, 0.8) 30%,
			rgba(184, 216, 245, 0.7) 45%,
			rgba(184, 245, 227, 0.6) 58%,
			rgba(245, 237, 184, 0.7) 72%,
			rgba(245, 184, 216, 0.6) 86%,
			transparent 100%
		);
		animation: shimmer-slide 14s ease-in-out infinite alternate;
		filter: blur(0.5px);
	}
	@keyframes shimmer-slide {
		0%   { transform: translateX(-10%) scaleX(1); opacity: 0.6; }
		50%  { opacity: 1; }
		100% { transform: translateX(10%) scaleX(1.05); opacity: 0.7; }
	}

	/* ── soft clouds ────────────────────────────────────────────────── */
	.dream-clouds {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		overflow: hidden;
	}
	.cloud {
		position: absolute;
		border-radius: 100px;
		background: radial-gradient(closest-side, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0));
		filter: blur(6px);
	}
	.cloud-1 { width: 360px; height: 140px; left: -60px;  bottom: 4%;  animation: cloud-float 46s ease-in-out infinite alternate; }
	.cloud-2 { width: 460px; height: 170px; right: -80px; bottom: 12%; opacity: 0.8; animation: cloud-float 58s ease-in-out infinite alternate-reverse; }
	.cloud-3 { width: 280px; height: 120px; left: 38%;    bottom: -2%; opacity: 0.6; animation: cloud-float 52s ease-in-out infinite alternate; }
	@keyframes cloud-float {
		0%   { transform: translateX(0) translateY(0); }
		100% { transform: translateX(40px) translateY(-8px); }
	}

	/* ── crescent moon ──────────────────────────────────────────────── */
	.dream-moon {
		position: fixed;
		top: 5%;
		right: 6%;
		z-index: 0;
		pointer-events: none;
		font-size: 2.2rem;
		color: #f0c97a;
		opacity: 0.55;
		text-shadow:
			0 0 16px rgba(240, 183, 94, 0.55),
			0 0 36px rgba(240, 183, 94, 0.25);
		animation: moon-sway 22s ease-in-out infinite alternate;
		filter: drop-shadow(0 0 10px rgba(240, 183, 94, 0.35));
	}
	@keyframes moon-sway {
		0%   { transform: rotate(-8deg) translateY(0); }
		100% { transform: rotate(8deg) translateY(10px); }
	}

	/* ── sparkles, hearts, flowers ─────────────────────────────────── */
	.dream-sparkles { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
	.sparkle {
		position: absolute;
		color: #d9a8f0;
		opacity: 0;
		text-shadow: 0 0 8px rgba(217, 168, 240, 0.5);
		animation: twinkle 7s ease-in-out infinite;
	}
	/* hearts glow rose, flowers glow mint */
	.sparkle:nth-child(9),
	.sparkle:nth-child(10),
	.sparkle:nth-child(11) {
		color: #f284b0;
		text-shadow: 0 0 10px rgba(242, 132, 176, 0.5);
	}
	.sparkle:nth-child(12),
	.sparkle:nth-child(13) {
		color: #5ec9c0;
		text-shadow: 0 0 10px rgba(94, 201, 192, 0.5);
	}
	@keyframes twinkle {
		0%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); }
		45%, 55% { opacity: 0.9; transform: scale(1) rotate(40deg); }
	}

	/* content floats above the dream */
	.dream-content { position: relative; z-index: 1; }

	/* ── font selector toggle ───────────────────────────────────────── */
	.font-toggle {
		position: fixed;
		bottom: 20px;
		right: 20px;
		z-index: 55;
		width: 44px;
		height: 44px;
		border-radius: var(--d-radius-pill);
		border: 1.5px solid var(--d-border-mid);
		background: rgba(255, 255, 255, 0.80);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		font-family: var(--d-font-mono);
		font-size: 13px;
		color: var(--d-text-dim);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--d-shadow-card);
		transition: all var(--d-transition-fast);
	}
	.font-toggle:hover {
		border-color: var(--d-accent);
		color: var(--d-accent);
		box-shadow: var(--d-shadow-hover), 0 0 0 3px var(--d-accent-glow);
	}
	.font-toggle.active {
		border-color: var(--d-accent);
		color: var(--d-accent);
		background: rgba(183, 140, 240, 0.12);
	}

	.font-backdrop {
		position: fixed;
		inset: 0;
		z-index: 54;
	}

	@media (prefers-reduced-motion: reduce) {
		.dream-wash,
		.dream-shimmer,
		.dream-moon,
		.cloud,
		.sparkle {
			animation-duration: 0.001ms !important;
			animation-iteration-count: 1 !important;
		}
		.sparkle { opacity: 0.45; }
		.dream-moon { opacity: 0.4; }
	}
</style>
