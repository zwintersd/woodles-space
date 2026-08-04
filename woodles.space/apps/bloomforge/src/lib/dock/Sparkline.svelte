<script lang="ts">
	import { compact } from '../format.js';

	/**
	 * The currency-over-time chart. Hand-rolled SVG again — an area under a
	 * monotone line is a `path`, and the run is already sampled to a fixed point
	 * budget by the playtest store.
	 */
	interface Props {
		points: { t: number; value: number }[];
		colour?: string;
		height?: number;
		label?: string;
	}

	let { points, colour = 'var(--bf-accent)', height = 108, label = 'Value over time' }: Props = $props();

	/**
	 * The viewBox tracks the measured width rather than being a fixed ratio the
	 * browser scales to fit. Stretching an SVG to fill a container stretches its
	 * text with it, and a squashed axis label is the tell that a chart was
	 * scaled rather than drawn.
	 */
	let measured = $state(420);
	const width = $derived(Math.max(240, measured));
	const pad = { top: 8, right: 8, bottom: 16, left: 44 };

	const max = $derived(points.length ? Math.max(...points.map((point) => point.value), 1) : 1);
	const span = $derived(points.length ? Math.max(points[points.length - 1].t, 1) : 1);

	const toX = $derived((t: number) => pad.left + (t / span) * (width - pad.left - pad.right));
	// Log-ish, because an incremental's late values dwarf its early ones and a
	// linear axis shows a flat line then a cliff.
	const toY = $derived(
		(value: number) =>
			pad.top + (1 - Math.log10(1 + value) / Math.log10(1 + max)) * (height - pad.top - pad.bottom)
	);

	const line = $derived(
		points.map((point, index) => `${index === 0 ? 'M' : 'L'}${toX(point.t)},${toY(point.value)}`).join(' ')
	);
	const area = $derived(
		points.length
			? `${line} L${toX(points[points.length - 1].t)},${height - pad.bottom} L${toX(points[0].t)},${height - pad.bottom} Z`
			: ''
	);

	/** Evenly spaced on the drawn axis, so the labels match where the line sits. */
	const ticks = $derived(
		[0, 0.5, 1].map((fraction) => ({ fraction, value: Math.pow(10, fraction * Math.log10(1 + max)) - 1 }))
	);

	function clock(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		return minutes > 0 ? `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : `${Math.floor(seconds)}s`;
	}
</script>

<div class="wrap" bind:clientWidth={measured}>
	<svg viewBox="0 0 {width} {height}" role="img" aria-label={label}>
		{#each ticks as tick (tick.fraction)}
			{@const y = pad.top + (1 - tick.fraction) * (height - pad.top - pad.bottom)}
			<line x1={pad.left} y1={y} x2={width - pad.right} y2={y} class="grid" />
			<text x={pad.left - 5} y={y + 3} class="tick" text-anchor="end">{compact(tick.value)}</text>
		{/each}

		{#if points.length > 1}
			<path d={area} fill={colour} opacity="0.14" />
			<path d={line} fill="none" stroke={colour} stroke-width="1.75" stroke-linejoin="round" />
		{:else}
			<text x={width / 2} y={height / 2} class="idle" text-anchor="middle">press play to see the curve</text>
		{/if}

		<text x={pad.left} y={height - 3} class="tick">0:00</text>
		<text x={width - pad.right} y={height - 3} class="tick" text-anchor="end">{clock(span)}</text>
	</svg>
</div>

<style>
	.wrap {
		width: 100%;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.grid {
		stroke: var(--bf-rule);
		stroke-width: 1;
	}

	.tick {
		font-size: 9px;
		fill: var(--bf-faint);
		font-family: var(--bf-font-mono);
	}

	.idle {
		font-size: 11px;
		fill: var(--bf-faint);
		font-family: var(--bf-font-sans);
	}
</style>
