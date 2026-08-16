<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

{@render children()}

<style>
	:global(html) {
		color-scheme: light;
	}

	:global(body) {
		margin: 0;
		background: var(--bg);
		color: var(--text);
		font-family: var(--font-body, system-ui, sans-serif);
	}
</style>
