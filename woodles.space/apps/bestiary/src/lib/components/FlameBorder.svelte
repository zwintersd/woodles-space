<script lang="ts">
	// The second tier of burning: fire tongues creeping inward from the art
	// frame's edges. Same generated-once paths and stroke-dashoffset grow-in as
	// FrostBorder — stroked in fire colours (deep orange → bright amber as burn
	// climbs) with an ember glow. Opacity climbs from 0 at burning 3 to full at 6.
	// Mounted only once burning > 3, so the reveal plays when the threshold is crossed.

	let {
		burning = 0,
		paths = [],
		width,
		height
	}: { burning: number; paths: string[]; width: number; height: number } = $props();

	const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
	// 0 at burning 3 → 1 at burning 6
	let opacity = $derived(clamp01((burning - 3) / 3));
	// colour heats from deep orange toward bright amber as burning rises
	let tint = $derived(clamp01((burning - 3) / 7));
	let stroke = $derived(`color-mix(in oklch, #ff5500, #ffcc33 ${Math.round(tint * 100)}%)`);

	function measure(node: SVGPathElement, index: number) {
		const len = node.getTotalLength();
		node.style.setProperty('--len', String(len));
		node.style.setProperty('--delay', `${Math.min(index * 45, 800)}ms`);
	}

	let armed = $state(false);
	$effect(() => {
		if (paths.length) armed = true;
	});
</script>

<svg
	class="flames"
	viewBox="0 0 {width} {height}"
	preserveAspectRatio="none"
	width="100%"
	height="100%"
	style="opacity:{opacity}"
	aria-hidden="true"
>
	{#each paths as d, i (i)}
		<path {d} use:measure={i} class:burn={armed} style="stroke:{stroke}" />
	{/each}
</svg>

<style>
	.flames {
		position: absolute;
		inset: 0;
		overflow: visible;
		pointer-events: none;
		transition: opacity var(--b-transition-medium);
	}
	.flames path {
		fill: none;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
		filter: drop-shadow(0 0 2.5px rgba(255, 110, 0, 0.65));
		stroke-dasharray: var(--len, 1400);
		stroke-dashoffset: var(--len, 1400);
	}
	.flames path.burn {
		animation: flame-lick 850ms ease-out forwards;
		animation-delay: var(--delay, 0ms);
	}
	@keyframes flame-lick {
		to {
			stroke-dashoffset: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.flames path,
		.flames path.burn {
			animation: none;
			stroke-dashoffset: 0;
		}
	}
</style>
