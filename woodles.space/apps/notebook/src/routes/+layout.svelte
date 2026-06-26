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
		font-size: 112.5%;
	}

	:global(body) {
		background: var(--nb-bg);
		color: var(--nb-ink);
		overflow-x: hidden;
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
			repeating-linear-gradient(
				135deg,
				rgba(255, 255, 255, 0.26) 0 8px,
				rgba(255, 130, 218, 0.16) 8px 16px,
				rgba(97, 232, 255, 0.14) 16px 24px,
				rgba(255, 248, 184, 0.18) 24px 32px
			),
			linear-gradient(90deg, rgba(255, 255, 255, 0.38) 1px, transparent 1px),
			linear-gradient(180deg, rgba(149, 87, 230, 0.16) 1px, transparent 1px),
			var(--nb-bg);
		background-size: auto, 30px 30px, 30px 30px;
		font-family: var(--nb-font-mono);
		font-weight: 400;
		line-height: 1.5;
		position: relative;
		overflow: hidden;
	}

	.notebook-root::before,
	.notebook-root::after {
		position: fixed;
		z-index: 0;
		pointer-events: none;
		font-family: var(--nb-font-mono);
		color: rgba(255, 255, 255, 0.72);
		text-shadow: 0 2px 0 rgba(255, 97, 199, 0.32);
	}

	.notebook-root::before {
		content: "star star moon bow cloud star heart";
		top: 0.75rem;
		left: 1rem;
		right: 1rem;
		font-size: 0.58rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
	}

	.notebook-root::after {
		content: "cute file cabinet";
		right: -2rem;
		bottom: 3rem;
		transform: rotate(-8deg);
		font-family: var(--nb-font-display);
		font-size: clamp(2.6rem, 10vw, 7rem);
		font-style: italic;
		opacity: 0.3;
	}
</style>
