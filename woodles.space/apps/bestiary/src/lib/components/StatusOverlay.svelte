<script lang="ts">
	// The single door CreatureCard opens onto all status conditions. It owns the
	// procedural tiers for cold and burning, and decides which are present from
	// two numbers: `cold` and `burning` (each 0–10).
	//
	//   cold > 0      snow in the art window
	//   cold > 3      frost crystals on the art frame
	//   cold > 6      ice cracks across the whole card
	//
	//   burning > 0   embers rising in the art window
	//   burning > 3   flame tongues on the art frame
	//   burning > 6   scorch marks across the whole card
	//
	// Path data is generated *once* from the creature's seed (its ice and fire are
	// stable fingerprints, never reshuffled on edit). Frost uses the raw seed;
	// fire uses seed + ':fire' so the two fingerprints are independent.
	//
	// `artEl` is CreatureCard's `.art` div. We measure it against our own box to
	// place art-bound layers over the frame and give spreading effects an origin.

	import { seededRng } from '../prng';
	import { generateFrostPaths } from '../frostgen';
	import { generateFirePaths } from '../firegen';
	import SnowCanvas from './SnowCanvas.svelte';
	import FrostBorder from './FrostBorder.svelte';
	import CrackOverlay from './CrackOverlay.svelte';
	import EmberCanvas from './EmberCanvas.svelte';
	import FlameBorder from './FlameBorder.svelte';
	import CharOverlay from './CharOverlay.svelte';

	let {
		cold = 0,
		burning = 0,
		seed = '',
		artEl
	}: { cold: number; burning: number; seed?: string; artEl: HTMLElement | null } = $props();

	let rootEl: HTMLDivElement;

	let borderPaths = $state<string[]>([]);
	let crackPaths = $state<string[]>([]);
	let flamePaths = $state<string[]>([]);
	let scorchPaths = $state<string[]>([]);
	let artW = $state(0);
	let artH = $state(0);
	let generated = false;

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

		if (!generated) {
			// frost: raw seed preserves existing creature fingerprints
			const { borderPaths: bp, crackPaths: cp } = generateFrostPaths(seededRng(seed), a);
			// fire: ':fire' suffix keeps it independent of the frost fingerprint
			const { flamePaths: fp, scorchPaths: sp } = generateFirePaths(
				seededRng(seed + ':fire'),
				a
			);
			borderPaths = bp;
			crackPaths = cp;
			flamePaths = fp;
			scorchPaths = sp;
			artW = a.width;
			artH = a.height;
			generated = true;
		}
	}

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
			<div class="spread-frame" style={frameStyle}>
				<CrackOverlay {cold} paths={crackPaths} width={artW} height={artH} />
			</div>
		{/if}
	{/if}

	{#if burning > 0}
		<!-- art-bound tiers: clipped so embers & flames end at the art edge -->
		<div class="art-frame" style={frameStyle}>
			<EmberCanvas {burning} />
			{#if burning > 3 && ready}
				<FlameBorder {burning} paths={flamePaths} width={artW} height={artH} />
			{/if}
		</div>

		<!-- card-bound tier: char spreads out of the art box, across the whole card -->
		{#if burning > 6 && ready}
			<div class="spread-frame" style={frameStyle}>
				<CharOverlay {burning} paths={scorchPaths} width={artW} height={artH} />
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
		/* match the art window's rounded corner so effects clip cleanly */
		border-radius: 0.45em;
	}
	.spread-frame {
		position: absolute;
		overflow: visible;
	}
</style>
