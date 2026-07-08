<script lang="ts">
	import '$lib/style/tokens.css';
	import { initSync } from '$lib/sync.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		void initSync();
	});
</script>

<div class="thinking-about-root">
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

	:global(button) {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		cursor: pointer;
	}

	:global(button:disabled) {
		cursor: not-allowed;
		opacity: 0.5;
	}

	:global(input),
	:global(textarea),
	:global(select) {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		outline: none;
	}

	.thinking-about-root {
		min-height: 100vh;
		background: var(--ta-page-wash);
		color: var(--ta-text);
		font-family: var(--ta-font-sans);
		line-height: 1.5;
	}
</style>
