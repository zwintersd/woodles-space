<script lang="ts">
	import '$lib/style/tokens.css';
	import { store } from '$lib/store.svelte';
	import { getPaletteForTime, getNamedPalette } from '$lib/dayCycle';
	import type { PaletteModeName } from '$lib/dayCycle';
	import { initSync } from '$lib/sync.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();
	let root: HTMLElement | undefined = $state();

	onMount(() => { initSync(); });

	$effect(() => {
		if (!root) return;
		const palette = store.settings.fixedPaletteMode
			? getNamedPalette(store.settings.fixedPaletteMode as PaletteModeName)
			: getPaletteForTime(store.now);
		for (const [k, v] of Object.entries(palette)) {
			root.style.setProperty(k, v);
		}
	});
</script>

<div class="planner-root" bind:this={root}>
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
	:global(body) {
		height: 100%;
	}

	/* base type scale — % keeps it relative to the reader's browser font size,
	   so every rem in the app scales from here (and large-text prefs are honored) */
	:global(html) {
		font-size: 112.5%;
	}

	:global(body) {
		background: var(--p-bg, #f6efd2);
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

	:global(button:disabled) {
		cursor: not-allowed;
		opacity: 0.4;
	}

	:global(input) {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		outline: none;
	}

	.planner-root {
		min-height: 100vh;
		background: var(--p-bg);
		color: var(--p-text);
		font-family: var(--pl-font-mono);
		font-weight: 400;
		font-size: 1rem;
		line-height: 1.55;
		transition: var(--pl-transition-palette);
		position: relative;
	}
</style>
