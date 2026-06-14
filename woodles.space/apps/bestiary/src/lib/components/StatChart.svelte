<script lang="ts">
	// The stat portrait: a hexagon of the six cores. Each spoke is one core,
	// reaching out as far as its value (0 at the centre, 10 at the rim). The
	// shape morphs live as the editor's steppers change — a face, not a tally.
	import type { Stats } from '$lib/types';
	import { coreStats } from '$lib/content/stats';
	import {
		coreValues,
		coreDetailValues,
		hasDepth,
		radarPoint,
		radarPolygon,
		spokeAngle
	} from '$lib/chart';

	let { stats }: { stats: Stats } = $props();

	const SIZE = 168;
	const C = SIZE / 2;
	const R = 56; // the rim, at value 10
	const LABEL_R = R + 17;
	const RINGS = [1 / 3, 2 / 3, 1];

	let values = $derived(coreValues(stats));
	let dataPoly = $derived(radarPolygon(values, R, C, C));

	// The ghost: where the substat detail actually reaches. Only drawn when it
	// pulls away from the headline shape, so a creature with no overrides shows
	// a single clean hexagon.
	let depth = $derived(hasDepth(stats));
	let detailPoly = $derived(radarPolygon(coreDetailValues(stats), R, C, C));

	let spokes = $derived(
		coreStats.map((core, i) => {
			const a = spokeAngle(i, coreStats.length);
			return {
				core,
				value: values[i],
				rim: { x: C + R * Math.cos(a), y: C + R * Math.sin(a) },
				vtx: radarPoint(values[i], i, coreStats.length, R, C, C),
				label: { x: C + LABEL_R * Math.cos(a), y: C + LABEL_R * Math.sin(a) }
			};
		})
	);

	function ringPoly(frac: number): string {
		return coreStats
			.map((_, i) => {
				const a = spokeAngle(i, coreStats.length);
				const r = R * frac;
				return `${(C + r * Math.cos(a)).toFixed(2)},${(C + r * Math.sin(a)).toFixed(2)}`;
			})
			.join(' ');
	}

	let summary = $derived(coreStats.map((c, i) => `${c.name} ${values[i]}`).join(', '));
</script>

<svg
	class="chart"
	viewBox="0 0 {SIZE} {SIZE}"
	role="img"
	aria-label="Stat portrait — {summary}"
>
	<!-- grid: concentric hexagons + spokes -->
	{#each RINGS as frac (frac)}
		<polygon class="ring" points={ringPoly(frac)} />
	{/each}
	{#each spokes as s (s.core.id)}
		<line class="spoke" x1={C} y1={C} x2={s.rim.x} y2={s.rim.y} />
	{/each}

	<!-- the ghost: the reach of its substat detail, when it diverges -->
	{#if depth}
		<polygon class="detail" points={detailPoly}>
			<title>the reach of its substats</title>
		</polygon>
	{/if}

	<!-- the creature's shape -->
	<polygon class="data" points={dataPoly} />

	<!-- vertices + glyph labels, each in its stat's colour -->
	{#each spokes as s (s.core.id)}
		<circle class="vtx" cx={s.vtx.x} cy={s.vtx.y} r="2.4" style="--c: var({s.core.colorVar})" />
		<text
			class="glyph"
			x={s.label.x}
			y={s.label.y}
			style="--c: var({s.core.colorVar})"
			text-anchor="middle"
			dominant-baseline="central">{s.core.glyph}</text
		>
	{/each}
</svg>

<style>
	.chart {
		width: 100%;
		max-width: 190px;
		height: auto;
		display: block;
	}
	.ring {
		fill: none;
		stroke: var(--b-rule);
		stroke-width: 1;
	}
	.spoke {
		stroke: var(--b-rule);
		stroke-width: 1;
	}
	.data {
		fill: var(--b-gold-soft);
		stroke: var(--b-gold);
		stroke-width: 1.5;
		stroke-linejoin: round;
		transition: fill var(--b-transition-fast);
	}
	.detail {
		fill: none;
		stroke: var(--b-muted);
		stroke-width: 1;
		stroke-dasharray: 3 2.5;
		stroke-linejoin: round;
		opacity: 0.8;
	}
	.vtx {
		fill: var(--c);
		stroke: var(--b-surface);
		stroke-width: 1;
	}
	.glyph {
		fill: var(--c);
		font-size: 11px;
	}
</style>
