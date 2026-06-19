<script lang="ts">
	import '$lib/style/tokens.css';
	let { children } = $props();
</script>

<div class="marginalia-root">
	{@render children()}
</div>

<style>
	:global(body) {
		margin: 0;
		background: #1a1a3e;
	}
	/* base type scale — % keeps it relative to the reader's browser font size,
	   so every rem in the app scales from here (and large-text prefs are honored) */
	:global(html) {
		font-size: 112.5%;
	}
	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
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
	.marginalia-root {
		min-height: 100vh;
		background: var(--bg);
		color: var(--text);
		font-family: var(--font-body);
		font-weight: 400;
		font-size: 1rem;
		line-height: 1.55;
	}
</style>
