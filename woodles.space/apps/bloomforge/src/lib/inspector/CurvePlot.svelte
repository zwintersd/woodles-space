<script lang="ts">
	import { curveAt, type Curve } from '@woodles/incremental-core';
	import { compact } from '../format.js';

	/**
	 * Hand-rolled SVG rather than a charting library: two monotone lines over a
	 * hundred integer levels is a `path` string, and the dependency would weigh
	 * more than the feature.
	 *
	 * This is the thing the mockup didn't have and the tool most needs — a curve
	 * you can't see is a curve you're guessing at.
	 */
	interface Series {
		label: string;
		colour: string;
		base: number;
		curve: Curve;
	}

	interface Props {
		series: Series[];
		levels?: number;
		height?: number;
	}

	let { series, levels = 100, height = 128 }: Props = $props();

	let logScale = $state(true);
	const width = 260;
	const padding = { top: 8, right: 6, bottom: 16, left: 34 };

	const plotted = $derived(
		series.map((entry) => ({
			...entry,
			points: Array.from({ length: levels }, (_, index) => {
				const level = index + 1;
				const value = curveAt(entry.curve, entry.base, level);
				return { level, value: Number.isFinite(value) ? value : 0 };
			})
		}))
	);

	const bounds = $derived.by(() => {
		const values = plotted.flatMap((entry) => entry.points.map((point) => point.value));
		const positive = values.filter((value) => value > 0);
		const max = values.length ? Math.max(...values) : 1;
		// A log axis can't show zero, so it floors at the smallest positive
		// value instead of pretending the curve starts somewhere it doesn't.
		const min = logScale ? (positive.length ? Math.min(...positive) : 1) : 0;
		return { min, max: max > min ? max : min + 1 };
	});

	function toX(level: number): number {
		return padding.left + ((level - 1) / Math.max(1, levels - 1)) * (width - padding.left - padding.right);
	}

	function toY(value: number): number {
		const usable = height - padding.top - padding.bottom;
		const { min, max } = bounds;
		if (logScale) {
			const safe = Math.max(value, min);
			const ratio = (Math.log10(safe) - Math.log10(min)) / Math.max(1e-9, Math.log10(max) - Math.log10(min));
			return padding.top + (1 - ratio) * usable;
		}
		return padding.top + (1 - (value - min) / (max - min)) * usable;
	}

	function path(points: { level: number; value: number }[]): string {
		return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${toX(point.level)},${toY(point.value)}`).join(' ');
	}
</script>

<div class="plot">
	<div class="head">
		<div class="legend">
			{#each plotted as entry (entry.label)}
				<span class="key"><i style:background={entry.colour}></i>{entry.label}</span>
			{/each}
		</div>
		<button
			class="scale"
			type="button"
			aria-pressed={logScale}
			onclick={() => (logScale = !logScale)}
			title="Toggle logarithmic vertical axis"
		>
			{logScale ? 'log' : 'linear'}
		</button>
	</div>

	<svg viewBox="0 0 {width} {height}" role="img" aria-label="Cost and output against level">
		<line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} class="axis" />
		<line
			x1={padding.left}
			y1={height - padding.bottom}
			x2={width - padding.right}
			y2={height - padding.bottom}
			class="axis"
		/>

		<text x={padding.left - 4} y={padding.top + 4} class="tick" text-anchor="end">{compact(bounds.max)}</text>
		<text x={padding.left - 4} y={height - padding.bottom} class="tick" text-anchor="end">{compact(bounds.min)}</text>
		<text x={padding.left} y={height - 3} class="tick">1</text>
		<text x={width - padding.right} y={height - 3} class="tick" text-anchor="end">{levels}</text>

		{#each plotted as entry (entry.label)}
			<path d={path(entry.points)} fill="none" stroke={entry.colour} stroke-width="1.75" stroke-linejoin="round" />
		{/each}
	</svg>
</div>

<style>
	.plot {
		margin-top: 4px;
		padding: 8px;
		border: 1px solid var(--bf-rule);
		border-radius: var(--bf-radius-sm);
		background: var(--bf-surface-sunk);
	}

	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 9px;
		flex: 1;
	}

	.key {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		color: var(--bf-muted);
	}

	.key i {
		width: 9px;
		height: 2.5px;
		border-radius: 2px;
	}

	.scale {
		padding: 1px 7px;
		border: 1px solid var(--bf-rule-strong);
		border-radius: var(--bf-radius-pill);
		background: var(--bf-surface);
		color: var(--bf-muted);
		font-size: 10px;
		cursor: pointer;
	}

	.scale[aria-pressed='true'] {
		border-color: var(--bf-upgrade-line);
		background: var(--bf-accent-soft);
		color: var(--bf-accent-strong);
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.axis {
		stroke: var(--bf-rule-strong);
		stroke-width: 1;
	}

	.tick {
		font-size: 8px;
		fill: var(--bf-faint);
		font-family: var(--bf-font-mono);
	}
</style>
