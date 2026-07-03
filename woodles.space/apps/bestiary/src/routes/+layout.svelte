<script lang="ts">
	import '$lib/style/tokens.css';
	import { initSync } from '$lib/sync.svelte';
	import { hasPassphrase } from '@woodles/sync';
	import { bestiary } from '$lib/bestiary.svelte';
	import { gallery } from '$lib/gallery.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();
	let w = $derived(bestiary.workshop);

	onMount(async () => {
		await bestiary.readyPromise;
		await initSync();
		// First-run routing (ROADMAP.md week 3): a browser that has never
		// opened the bestiary before lands in the public gallery instead of
		// the seed deck, if Z has published one. hasPassphrase is only true
		// once initSync has connected a stored passphrase — that's Z's own
		// device, which should always land on her real collection instead.
		if (bestiary.isFirstRun && !hasPassphrase()) {
			await gallery.load();
			if (gallery.status === 'ready') bestiary.openGallery();
		}
	});
</script>

<div class="bestiary-root" class:calm={w.calm} class:reduce-motion={w.reduceMotion}>
	{@render children()}
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
		background: var(--b-bg, #fdeef7);
		overflow-x: hidden;
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

	.bestiary-root {
		min-height: 100vh;
		background:
			radial-gradient(75% 55% at 0% 0%, rgba(244, 154, 196, 0.35), transparent 60%),
			radial-gradient(75% 55% at 100% 0%, rgba(160, 206, 239, 0.32), transparent 60%),
			var(--b-bg);
		color: var(--b-text);
		font-family: var(--b-font-body);
		font-size: 1rem;
		line-height: 1.6;
	}

	/* ── calm the lights: flatten the lit-fair backdrop to a single quiet wash,
	   so fewer things compete for the eye ───────────────────────────────── */
	.bestiary-root.calm { background: var(--b-bg); }

	/* ── still the air: hold motion when the player asks for it, and always
	   honour the operating system's own reduced-motion preference ────────── */
	.bestiary-root.reduce-motion :global(*),
	.bestiary-root.reduce-motion :global(*::before),
	.bestiary-root.reduce-motion :global(*::after) {
		animation-duration: 0.001ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: 0.001ms !important;
		scroll-behavior: auto !important;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.bestiary-root *),
		:global(.bestiary-root *::before),
		:global(.bestiary-root *::after) {
			animation-duration: 0.001ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.001ms !important;
			scroll-behavior: auto !important;
		}
	}
</style>
