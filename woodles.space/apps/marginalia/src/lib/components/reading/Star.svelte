<script lang="ts">
	// A five-pointed star whose points fill one at a time. Each "point" is a
	// wedge from the center through two adjacent inner vertices to one outer
	// vertex; filling those wedges individually gives the elementary-school
	// stamp feeling.

	interface Props {
		points?: number; // 0..5 — completed points (filled wedges)
		progress?: number; // 0..1 — partial fill of the next point (active star only)
		active?: boolean; // whether this star is the one currently accruing
		size?: number;
	}

	let { points = 0, progress = 0, active = false, size = 88 }: Props = $props();

	const POINTS = 5;
	const OUTER_R = 46;
	const INNER_R = 18;
	const CENTER = 50;

	function outer(i: number) {
		const angle = -Math.PI / 2 + (i * 2 * Math.PI) / POINTS;
		return [CENTER + OUTER_R * Math.cos(angle), CENTER + OUTER_R * Math.sin(angle)];
	}
	function inner(i: number) {
		const angle = -Math.PI / 2 + (i * 2 * Math.PI) / POINTS + Math.PI / POINTS;
		return [CENTER + INNER_R * Math.cos(angle), CENTER + INNER_R * Math.sin(angle)];
	}

	// Outline path: outer_0, inner_0, outer_1, inner_1, … back to outer_0
	const outlinePath = (() => {
		const pts: string[] = [];
		for (let i = 0; i < POINTS; i++) {
			pts.push(outer(i).join(','));
			pts.push(inner(i).join(','));
		}
		return pts.join(' ');
	})();

	// Wedge for point i: center → inner_(i-1) → outer_i → inner_i → center
	function wedgePath(i: number): string {
		const prev = inner((i - 1 + POINTS) % POINTS);
		const o = outer(i);
		const cur = inner(i);
		return `M ${CENTER},${CENTER} L ${prev[0]},${prev[1]} L ${o[0]},${o[1]} L ${cur[0]},${cur[1]} Z`;
	}

	const wedges = Array.from({ length: POINTS }, (_, i) => wedgePath(i));
	const clampedPoints = $derived(Math.max(0, Math.min(POINTS, points | 0)));
	const clampedProgress = $derived(Math.max(0, Math.min(1, progress)));
</script>

<svg
	class="star"
	class:active
	viewBox="0 0 100 100"
	width={size}
	height={size}
	aria-label="reading star, {clampedPoints} of {POINTS} points filled"
	role="img"
>
	<polygon class="outline" points={outlinePath} />
	{#each wedges as d, i (i)}
		{#if i < clampedPoints}
			<path class="wedge filled" {d} />
		{:else if active && i === clampedPoints && clampedProgress > 0}
			<path class="wedge filling" {d} style="opacity: {clampedProgress}" />
		{/if}
	{/each}
</svg>

<style>
	.star {
		display: block;
	}
	.outline {
		fill: none;
		stroke: var(--rule);
		stroke-width: 0.8;
		stroke-linejoin: round;
	}
	.star.active .outline {
		stroke: var(--periwinkle);
	}
	.wedge {
		stroke: var(--leafeon-pink);
		stroke-width: 0.4;
		stroke-linejoin: round;
	}
	.wedge.filled {
		fill: var(--leafeon-pink);
	}
	.wedge.filling {
		fill: var(--cyan);
		animation: pulse 2.4s ease-in-out infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			filter: drop-shadow(0 0 0 var(--cyan));
		}
		50% {
			filter: drop-shadow(0 0 3px var(--cyan));
		}
	}
</style>
