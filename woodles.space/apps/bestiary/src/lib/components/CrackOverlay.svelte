<script lang="ts">
	// The third tier of cold: the art frame fractures like a pane of ice, cracks
	// running outward across the whole card. Same generated-once paths, same
	// stroke-dashoffset grow-in as the frost — but these radiate *out* of the art
	// box, so the SVG keeps overflow visible and the host frame is unclipped.
	// Opacity climbs from 0 at cold 6 to full at 10.
	//
	// Mounted only past cold 6, so the fracture animation plays as the threshold
	// is crossed.

	let {
		cold = 0,
		paths = [],
		width,
		height
	}: { cold: number; paths: string[]; width: number; height: number } = $props();

	const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
	// 0 at cold 6 → 1 at cold 10
	let opacity = $derived(clamp01((cold - 6) / 4));

	function measure(node: SVGPathElement, index: number) {
		const len = node.getTotalLength();
		node.style.setProperty('--len', String(len));
		node.style.setProperty('--delay', `${Math.min(index * 70, 700)}ms`);
	}

	// A real toggled class (not a JS-added one) so Svelte keeps the fracture
	// animation instead of pruning it as unused. Mounted only past cold 6, so the
	// split plays when the card crosses into the ice tier.
	let armed = $state(false);
	$effect(() => {
		if (paths.length) armed = true;
	});
</script>

<svg
	class="cracks"
	viewBox="0 0 {width} {height}"
	preserveAspectRatio="none"
	width="100%"
	height="100%"
	style="opacity:{opacity}"
	aria-hidden="true"
>
	{#each paths as d, i (i)}
		<path {d} use:measure={i} class:split={armed} />
	{/each}
</svg>

<style>
	.cracks {
		position: absolute;
		inset: 0;
		overflow: visible;
		pointer-events: none;
		transition: opacity var(--b-transition-medium);
	}
	.cracks path {
		fill: none;
		/* a cold, pale fracture with a faint frozen glow */
		stroke: #eaf6ff;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
		filter: drop-shadow(0 0 1.5px rgba(160, 210, 240, 0.7));
		stroke-dasharray: var(--len, 1600);
		stroke-dashoffset: var(--len, 1600);
	}
	.cracks path.split {
		animation: crack-split 900ms cubic-bezier(0.3, 0.7, 0.4, 1) forwards;
		animation-delay: var(--delay, 0ms);
	}
	@keyframes crack-split {
		to {
			stroke-dashoffset: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cracks path,
		.cracks path.split {
			animation: none;
			stroke-dashoffset: 0;
		}
	}
</style>
