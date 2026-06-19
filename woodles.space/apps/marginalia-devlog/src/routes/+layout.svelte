<script lang="ts">
	import '$lib/style/tokens.css';
	import { initSync } from '$lib/sync.svelte';
	import { devlog } from '$lib/devlog.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	// a scatter of drifting sparkles — fixed positions so they don't reflow
	const sparkles = [
		{ char: '✦', left: '6%',  top: '14%', delay: '0s',   size: '0.9rem' },
		{ char: '✧', left: '88%', top: '10%', delay: '1.4s', size: '1.1rem' },
		{ char: '⋆', left: '20%', top: '74%', delay: '2.2s', size: '1rem' },
		{ char: '✦', left: '70%', top: '30%', delay: '3.1s', size: '0.8rem' },
		{ char: '✧', left: '42%', top: '8%',  delay: '4s',   size: '0.7rem' },
		{ char: '⋆', left: '92%', top: '60%', delay: '1.9s', size: '1.2rem' },
		{ char: '✦', left: '12%', top: '44%', delay: '2.8s', size: '0.7rem' },
		{ char: '✧', left: '60%', top: '82%', delay: '0.6s', size: '0.9rem' }
	];

	onMount(async () => {
		await devlog.readyPromise;
		initSync();
	});
</script>

<div class="devlog-root">
	<!-- dreamy backdrop -->
	<div class="dream-wash" aria-hidden="true"></div>
	<div class="dream-clouds" aria-hidden="true">
		<span class="cloud cloud-1"></span>
		<span class="cloud cloud-2"></span>
		<span class="cloud cloud-3"></span>
	</div>
	<div class="dream-sparkles" aria-hidden="true">
		{#each sparkles as s}
			<span class="sparkle" style="left:{s.left}; top:{s.top}; animation-delay:{s.delay}; font-size:{s.size};">{s.char}</span>
		{/each}
	</div>

	<div class="dream-content">
		{@render children()}
	</div>
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

	:global(body) {
		background: var(--d-bg, #f3ecfb);
		overflow-x: hidden;
	}

	/* a soft lavender scrollbar to match the haze */
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
		font-size: 15px;
		line-height: 1.6;
		overflow: hidden;
	}

	/* ── the wash: drifting pastel blobs, blurred soft ─────────────── */
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
			radial-gradient(48% 52% at 50% 48%, #f3e6c9 0%, transparent 78%);
		opacity: 0.7;
		filter: blur(48px);
		animation: wash-drift 38s ease-in-out infinite alternate;
	}
	@keyframes wash-drift {
		0%   { transform: translate(0, 0) scale(1) rotate(0deg); }
		50%  { transform: translate(2%, -3%) scale(1.06) rotate(3deg); }
		100% { transform: translate(-3%, 2%) scale(1.04) rotate(-3deg); }
	}

	/* ── soft clouds along the lower edge ──────────────────────────── */
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
		background: radial-gradient(closest-side, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0));
		filter: blur(6px);
	}
	.cloud-1 { width: 320px; height: 130px; left: -60px;  bottom: 4%;  animation: cloud-float 46s ease-in-out infinite alternate; }
	.cloud-2 { width: 420px; height: 160px; right: -80px; bottom: 12%; opacity: 0.8; animation: cloud-float 58s ease-in-out infinite alternate-reverse; }
	.cloud-3 { width: 260px; height: 110px; left: 40%;    bottom: -2%; opacity: 0.6; animation: cloud-float 52s ease-in-out infinite alternate; }
	@keyframes cloud-float {
		0%   { transform: translateX(0); }
		100% { transform: translateX(40px); }
	}

	/* ── drifting sparkles ─────────────────────────────────────────── */
	.dream-sparkles { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
	.sparkle {
		position: absolute;
		color: #d9a8f0;
		opacity: 0;
		text-shadow: 0 0 8px rgba(217, 168, 240, 0.6);
		animation: twinkle 7s ease-in-out infinite;
	}
	@keyframes twinkle {
		0%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); }
		45%, 55% { opacity: 0.85; transform: scale(1) rotate(40deg); }
	}

	/* content floats above the dream */
	.dream-content { position: relative; z-index: 1; }

	@media (prefers-reduced-motion: reduce) {
		.dream-wash,
		.cloud,
		.sparkle {
			animation-duration: 0.001ms !important;
			animation-iteration-count: 1 !important;
		}
		.sparkle { opacity: 0.5; }
	}
</style>
