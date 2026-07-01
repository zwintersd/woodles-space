<script lang="ts">
	// A small inline instrument-reading chart — the naturalist's habit of
	// glancing at a trace instead of a bare number. Purely presentational;
	// the Book samples the history, this just draws it.
	import { sparklinePoints } from './history';

	interface Props {
		samples: number[];
		width?: number;
		height?: number;
		color?: string;
	}

	let { samples, width = 56, height = 16, color = 'var(--cyan)' }: Props = $props();

	const points = $derived(sparklinePoints(samples, width, height));
</script>

<svg
	class="sparkline"
	viewBox="0 0 {width} {height}"
	{width}
	{height}
	preserveAspectRatio="none"
	aria-hidden="true"
>
	<polyline
		{points}
		fill="none"
		stroke={color}
		stroke-width="1.4"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>

<style>
	.sparkline {
		display: block;
		overflow: visible;
		flex-shrink: 0;
	}
	polyline {
		opacity: 0.85;
	}
</style>
