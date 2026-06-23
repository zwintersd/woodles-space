<script lang="ts">
	import SparkleCanvas from './SparkleCanvas.svelte';

	let {
		finish,
		intensity = 0.5,
		creatureId
	}: {
		finish: 'sparkle' | 'holo';
		intensity: number;
		creatureId: string;
	} = $props();
</script>

<div class="finish-overlay">
	{#if finish === 'sparkle'}
		<SparkleCanvas {intensity} {creatureId} />
	{:else if finish === 'holo'}
		<div
			class="holo"
			style="--holo-opacity: {0.1 + intensity * 0.12}; --holo-speed: {16 - intensity * 7}s"
		>
			<div class="holo-gradient"></div>
			<div class="holo-noise"></div>
		</div>
	{/if}
</div>

<style>
	.finish-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		border-radius: inherit;
		z-index: 3;
	}

	/* ── holo ── */
	.holo {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		overflow: hidden;
		pointer-events: none;
	}

	/* fine spectral banding (a diffraction sheen, not a colour wash) that slides
	   with the pointer — vars are set by the card's holo action, centred by
	   default — and brightens as the pointer comes live. A slow hue drift keeps
	   it alive at rest without a sweep that would fight the pointer. */
	.holo-gradient {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background-image: repeating-linear-gradient(
			110deg,
			hsl(0 90% 72%) 0%,
			hsl(50 90% 72%) 6%,
			hsl(140 85% 70%) 12%,
			hsl(200 90% 72%) 18%,
			hsl(280 85% 74%) 24%,
			hsl(330 90% 74%) 30%,
			hsl(0 90% 72%) 36%
		);
		background-size: 220% 220%;
		background-position: calc(var(--holo-px, 0.5) * 120%) calc(var(--holo-py, 0.5) * 120%);
		mix-blend-mode: soft-light;
		opacity: calc(var(--holo-opacity) * (0.5 + var(--holo-active, 0) * 0.5));
	}

	@media (prefers-reduced-motion: no-preference) {
		.holo-gradient {
			animation: holo-drift var(--holo-speed) linear infinite;
		}
	}

	@keyframes holo-drift {
		from {
			filter: hue-rotate(0deg);
		}
		to {
			filter: hue-rotate(360deg);
		}
	}

	/* noise mask breaks up the uniform gradient into irregular optical patches */
	.holo-noise {
		position: absolute;
		inset: 0;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
		background-size: 180px 180px;
		mix-blend-mode: overlay;
		opacity: 0.35;
		pointer-events: none;
	}
</style>
