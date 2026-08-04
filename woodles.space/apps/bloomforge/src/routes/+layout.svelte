<script lang="ts">
	import '$lib/style/tokens.css';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

{@render children()}
