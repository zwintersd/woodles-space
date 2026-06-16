<script lang="ts">
	// The second tier of cold: frost crystals creeping in from the art frame's
	// edges. The path data is generated once (see frostgen) and handed in; this
	// component only draws it. Each crystal "grows in" via a stroke-dashoffset
	// reveal, staggered so the frost spreads rather than pops. Overall opacity
	// tracks cold from 0 at 3 up to full at 6.
	//
	// The viewBox is the art window's own pixel box, so the crystals scale with
	// the card and read crisply at any size. The component is only mounted once
	// cold passes 3 — so the grow-in plays exactly when the threshold is crossed,
	// and replays if cold dips below and climbs back.

	let {
		cold = 0,
		paths = [],
		width,
		height
	}: { cold: number; paths: string[]; width: number; height: number } = $props();

	const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
	// 0 at cold 3 → 1 at cold 6
	let opacity = $derived(clamp01((cold - 3) / 3));
	// colder frost reads whiter — drift from icy blue toward near-white
	let tint = $derived(clamp01((cold - 3) / 7));
	let stroke = $derived(`color-mix(in oklch, #c8e8f8, #e8f4ff ${Math.round(tint * 100)}%)`);

	// Each path measures its own length (in user units = viewBox units, matching
	// the dash array) and sets a staggered start, so the frost spreads in order.
	function measure(node: SVGPathElement, index: number) {
		const len = node.getTotalLength();
		node.style.setProperty('--len', String(len));
		node.style.setProperty('--delay', `${Math.min(index * 55, 900)}ms`);
	}

	// Arm the grow-in once the paths exist (and the actions above have set each
	// --len). Toggling a real class — rather than adding one in JS — keeps Svelte
	// from pruning the animation as an "unused" selector. Only mounted past cold
	// 3, so this plays exactly when the threshold is crossed.
	let armed = $state(false);
	$effect(() => {
		if (paths.length) armed = true;
	});
</script>

<svg
	class="frost"
	viewBox="0 0 {width} {height}"
	preserveAspectRatio="none"
	width="100%"
	height="100%"
	style="opacity:{opacity}"
	aria-hidden="true"
>
	{#each paths as d, i (i)}
		<path {d} use:measure={i} class:grow={armed} style="stroke:{stroke}" />
	{/each}
</svg>

<style>
	.frost {
		position: absolute;
		inset: 0;
		overflow: visible;
		pointer-events: none;
		transition: opacity var(--b-transition-medium);
	}
	.frost path {
		fill: none;
		stroke-width: 1.2;
		stroke-linecap: round;
		stroke-linejoin: round;
		/* fallback length (overwritten per-path) keeps crystals hidden pre-reveal */
		stroke-dasharray: var(--len, 1400);
		stroke-dashoffset: var(--len, 1400);
	}
	.frost path.grow {
		animation: frost-grow 1100ms ease forwards;
		animation-delay: var(--delay, 0ms);
	}
	@keyframes frost-grow {
		to {
			stroke-dashoffset: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.frost path,
		.frost path.grow {
			animation: none;
			stroke-dashoffset: 0;
		}
	}
</style>
