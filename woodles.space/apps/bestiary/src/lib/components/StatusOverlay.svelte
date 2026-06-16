<script lang="ts">
	// The single door CreatureCard opens onto the cold system. It owns the three
	// procedural tiers — drifting snow, creeping frost, fractured ice — and decides
	// which are present from one number: `cold` (0–10).
	//
	//   cold > 0  snow in the art window
	//   cold > 3  frost crystals on the art frame
	//   cold > 6  ice cracks across the whole card
	//
	// The frost/crack path data is generated *once* from the creature's seed (so a
	// creature's ice is its own stable fingerprint, not reshuffled on every edit)
	// and held in plain state — never a $derived, which would regenerate it.
	//
	// `artEl` is CreatureCard's `.art` div. We measure it against our own box (we
	// fill `.card-inner`) to place the art-bound layers over the frame and to give
	// the cracks an origin to radiate from. That geometry is recomputed on resize
	// so the responsive card never drifts out of register.

	import { seededRng } from '$lib/prng';
	import { generateFrostPaths } from '$lib/frostgen';
	import SnowCanvas from './SnowCanvas.svelte';
	import FrostBorder from './FrostBorder.svelte';
	import CrackOverlay from './CrackOverlay.svelte';

	let {
		cold = 0,
		seed = '',
		artEl
	}: { cold: number; seed?: string; artEl: HTMLElement | null } = $props();

	let rootEl: HTMLDivElement;

	// generated-once path data + the art's pixel box (the SVG viewBox)
	let borderPaths = $state<string[]>([]);
	let crackPaths = $state<string[]>([]);
	let artW = $state(0);
	let artH = $state(0);
	let generated = false;

	// the art frame's place within our box, as percentages, so the overlay layers
	// stay pinned to the art as the card scales
	let frame = $state({ left: '0%', top: '0%', width: '100%', height: '100%' });

	function measure() {
		if (!artEl || !rootEl) return;
		const a = artEl.getBoundingClientRect();
		const r = rootEl.getBoundingClientRect();
		if (!a.width || !a.height || !r.width || !r.height) return;

		frame = {
			left: `${((a.left - r.left) / r.width) * 100}%`,
			top: `${((a.top - r.top) / r.height) * 100}%`,
			width: `${(a.width / r.width) * 100}%`,
			height: `${(a.height / r.height) * 100}%`
		};

		// generate the ice fingerprint the first time the art has a real size
		if (!generated) {
			const { borderPaths: bp, crackPaths: cp } = generateFrostPaths(seededRng(seed), a);
			borderPaths = bp;
			crackPaths = cp;
			artW = a.width;
			artH = a.height;
			generated = true;
		}
	}

	// Re-run when the art ref arrives; keep measuring across resizes. The observer
	// also fires once on observe(), which covers the first real layout.
	$effect(() => {
		if (!artEl || !rootEl) return;
		measure();
		const ro = new ResizeObserver(() => measure());
		ro.observe(rootEl);
		ro.observe(artEl);
		return () => ro.disconnect();
	});

	let frameStyle = $derived(
		`left:${frame.left};top:${frame.top};width:${frame.width};height:${frame.height}`
	);
	let ready = $derived(artW > 0 && artH > 0);
</script>

<div class="status-overlay" bind:this={rootEl} aria-hidden="true">
	{#if cold > 0}
		<!-- art-bound tiers: clipped to the art frame so snow & frost end at the edge -->
		<div class="art-frame" style={frameStyle}>
			<SnowCanvas {cold} />
			{#if cold > 3 && ready}
				<FrostBorder {cold} paths={borderPaths} width={artW} height={artH} />
			{/if}
		</div>

		<!-- card-bound tier: radiates out of the art box, across the whole card -->
		{#if cold > 6 && ready}
			<div class="crack-frame" style={frameStyle}>
				<CrackOverlay {cold} paths={crackPaths} width={artW} height={artH} />
			</div>
		{/if}
	{/if}
</div>

<style>
	.status-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		/* sit above the card's content, under its texture/finish sheen */
		z-index: 5;
	}
	.art-frame {
		position: absolute;
		overflow: hidden;
		/* match the art window's rounded corner so flakes clip cleanly */
		border-radius: 0.45em;
	}
	.crack-frame {
		position: absolute;
		overflow: visible;
	}
</style>
