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
			style="--holo-opacity: {0.3 + intensity * 0.45}; --holo-speed: {8 - intensity * 4}s"
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

	.holo-gradient {
		position: absolute;
		inset: -50%;
		background: linear-gradient(
			105deg,
			hsl(0, 90%, 70%),
			hsl(60, 90%, 70%),
			hsl(120, 90%, 70%),
			hsl(180, 90%, 70%),
			hsl(240, 90%, 70%),
			hsl(300, 90%, 70%),
			hsl(360, 90%, 70%)
		);
		mix-blend-mode: color-dodge;
		opacity: var(--holo-opacity);
		animation: holo-sweep var(--holo-speed) linear infinite;
	}

	@keyframes holo-sweep {
		0% {
			transform: translateX(-30%) rotate(0deg);
		}
		50% {
			transform: translateX(30%) rotate(8deg);
		}
		100% {
			transform: translateX(-30%) rotate(0deg);
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
