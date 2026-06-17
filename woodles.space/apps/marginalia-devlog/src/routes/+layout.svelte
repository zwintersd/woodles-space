<script lang="ts">
	import '$lib/style/tokens.css';
	import { initSync } from '$lib/sync.svelte';
	import { devlog } from '$lib/devlog.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(async () => {
		await devlog.readyPromise;
		initSync();
	});
</script>

<div class="devlog-root">
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
		background: var(--d-bg, #0b0919);
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

	.devlog-root {
		min-height: 100vh;
		background:
			radial-gradient(70% 50% at 0% 0%, rgba(100, 60, 180, 0.18), transparent 55%),
			radial-gradient(60% 45% at 100% 100%, rgba(60, 30, 120, 0.14), transparent 55%),
			var(--d-bg);
		color: var(--d-text);
		font-family: var(--d-font-body);
		font-size: 15px;
		line-height: 1.6;
	}
</style>
