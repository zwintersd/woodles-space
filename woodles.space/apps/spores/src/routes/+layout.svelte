<script lang="ts">
	import '$lib/style/tokens.css';
	import { initSync } from '$lib/sync.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => { initSync(); });
</script>

<div class="spores-root">
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

	:global(body) {
		background: var(--g-bg, #0d0d1a);
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

	:global(input),
	:global(textarea) {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		outline: none;
		resize: vertical;
	}

	.spores-root {
		min-height: 100vh;
		background: var(--g-bg);
		color: var(--g-text);
		font-family: var(--g-font-body);
		font-size: 15px;
		line-height: 1.6;
	}
</style>
