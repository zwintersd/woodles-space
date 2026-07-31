<script lang="ts">
	import '$lib/style/tokens.css';

	let { children } = $props();
</script>

<div class="notebook-root">
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
		min-height: 100%;
	}

	:global(html) {
		font-size: 100%;
	}

	:global(body) {
		background: var(--nb-bg);
		color: var(--nb-ink);
		overflow-x: hidden;
		font-family: var(--nb-font-sans);
	}

	:global(button),
	:global(input),
	:global(textarea),
	:global(select) {
		font: inherit;
		color: inherit;
	}

	:global(button) {
		background: none;
		border: 0;
		cursor: pointer;
	}

	:global(button:disabled) {
		cursor: not-allowed;
		opacity: 0.45;
	}

	:global(input),
	:global(textarea),
	:global(select) {
		background: transparent;
		border: 0;
		outline: none;
	}

	.notebook-root {
		min-height: 100vh;
		background:
			radial-gradient(circle at 12% 5%, rgba(255, 247, 252, 0.72), transparent 23rem),
			radial-gradient(circle at 92% 86%, rgba(178, 146, 209, 0.24), transparent 24rem),
			radial-gradient(circle, rgba(232, 70, 143, 0.1) 0 1px, transparent 1.5px) 0 0 / 16px
				16px,
			radial-gradient(circle, rgba(66, 190, 203, 0.09) 0 1px, transparent 1.5px) 8px 8px /
				16px 16px,
			linear-gradient(115deg, rgba(255, 255, 255, 0.2), transparent 48%),
			var(--nb-bg);
		position: relative;
		line-height: 1.5;
	}

	:global(::selection) {
		background: var(--nb-cyan-soft);
		color: var(--nb-ink);
	}

	:global(:focus-visible) {
		outline: 2px solid var(--nb-violet);
		outline-offset: 2px;
	}
</style>
