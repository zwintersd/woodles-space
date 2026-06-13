<script lang="ts">
	import '$lib/style/tokens.css';
	import { initSync } from '$lib/sync.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => { initSync(); });
</script>

<div class="bestiary-root">
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
		font-size: 15px;
		line-height: 1.6;
	}
</style>
