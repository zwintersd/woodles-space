<script lang="ts">
	// The third tier of burning: charred tendrils radiating outward from the art
	// frame's corners, spreading across the card like a surface burned through.
	// Same stroke-dashoffset grow-in as CrackOverlay. Opacity climbs from 0 at
	// burning 6 to full at 10. Overflow visible so char spreads past the art box.
	// Mounted only past burning 6, so the spread plays when the threshold is crossed.

	let {
		burning = 0,
		paths = [],
		width,
		height
	}: { burning: number; paths: string[]; width: number; height: number } = $props();

	const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
	// 0 at burning 6 → 1 at burning 10
	let opacity = $derived(clamp01((burning - 6) / 4));

	function measure(node: SVGPathElement, index: number) {
		const len = node.getTotalLength();
		node.style.setProperty('--len', String(len));
		node.style.setProperty('--delay', `${Math.min(index * 60, 700)}ms`);
	}

	let armed = $state(false);
	$effect(() => {
		if (paths.length) armed = true;
	});
</script>

<svg
	class="char"
	viewBox="0 0 {width} {height}"
	preserveAspectRatio="none"
	width="100%"
	height="100%"
	style="opacity:{opacity}"
	aria-hidden="true"
>
	{#each paths as d, i (i)}
		<path {d} use:measure={i} class:spread={armed} />
	{/each}
</svg>

<style>
	.char {
		position: absolute;
		inset: 0;
		overflow: visible;
		pointer-events: none;
		transition: opacity var(--b-transition-medium);
	}
	.char path {
		fill: none;
		/* deep char with a faint ember glow at the edges */
		stroke: #1c0800;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		filter: drop-shadow(0 0 2px rgba(255, 55, 0, 0.45));
		stroke-dasharray: var(--len, 1600);
		stroke-dashoffset: var(--len, 1600);
	}
	.char path.spread {
		animation: char-spread 1100ms cubic-bezier(0.25, 0.8, 0.35, 1) forwards;
		animation-delay: var(--delay, 0ms);
	}
	@keyframes char-spread {
		to {
			stroke-dashoffset: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.char path,
		.char path.spread {
			animation: none;
			stroke-dashoffset: 0;
		}
	}
</style>
