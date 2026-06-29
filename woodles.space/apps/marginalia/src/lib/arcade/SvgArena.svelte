<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		width: number;
		height: number;
		ariaLabel: string;
		active?: boolean;
		maxWidth?: string;
		gridId: string;
		gridSize?: number;
		gridOpacity?: number;
		cornerRadius?: number;
		element?: SVGSVGElement;
		children: Snippet;
		onpointerdown?: (event: PointerEvent) => void;
		onpointermove?: (event: PointerEvent) => void;
		onpointerup?: (event: PointerEvent) => void;
		onpointercancel?: (event: PointerEvent) => void;
	}

	let {
		width,
		height,
		ariaLabel,
		active = false,
		maxWidth = '540px',
		gridId,
		gridSize = 34,
		gridOpacity = 0.56,
		cornerRadius = 6,
		element = $bindable(),
		children,
		onpointerdown,
		onpointermove,
		onpointerup,
		onpointercancel
	}: Props = $props();

	const arenaClass = $derived(active ? 'svg-arena active' : 'svg-arena');
	const arenaStyle = $derived(`--arena-width:${maxWidth};--arena-aspect:${width} / ${height}`);
</script>

<svg
	bind:this={element}
	class={arenaClass}
	style={arenaStyle}
	viewBox={`0 0 ${width} ${height}`}
	role="img"
	aria-label={ariaLabel}
	onpointerdown={onpointerdown}
	onpointermove={onpointermove}
	onpointerup={onpointerup}
	onpointercancel={onpointercancel}
>
	<defs>
		<pattern id={gridId} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
			<path
				d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
				fill="none"
				stroke="rgba(88, 110, 117, 0.12)"
				stroke-width="1"
			/>
		</pattern>
	</defs>
	<rect class="arena-bg" width={width} height={height} rx={cornerRadius} />
	<rect width={width} height={height} fill={`url(#${gridId})`} opacity={gridOpacity} />
	{@render children()}
</svg>

<style>
	.svg-arena {
		width: min(var(--arena-width), calc(100vw - 3rem));
		aspect-ratio: var(--arena-aspect);
		border: 1px solid var(--sol-base2);
		border-radius: 6px;
		background: var(--sol-base2);
		box-shadow:
			inset 0 0 0 6px rgba(7, 54, 66, 0.05),
			0 8px 24px rgba(7, 54, 66, 0.08);
		touch-action: none;
		user-select: none;
	}
	.svg-arena.active {
		cursor: crosshair;
	}
	.arena-bg {
		fill: var(--sol-base3);
	}
</style>
