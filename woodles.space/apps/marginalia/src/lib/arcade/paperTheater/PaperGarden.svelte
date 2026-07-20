<script lang="ts">
	export type PaperGardenKind = 'sprig' | 'fern' | 'flower' | 'mushroom' | 'lantern';

	export interface PaperGardenItem {
		id: string;
		kind: PaperGardenKind;
		x: number;
		y: number;
		scale?: number;
		flip?: boolean;
	}

	interface Props {
		items: PaperGardenItem[];
	}

	let { items }: Props = $props();

	function transformFor(item: PaperGardenItem): string {
		const scaleX = (item.flip ? -1 : 1) * (item.scale ?? 1);
		const scaleY = item.scale ?? 1;
		return `translate(${item.x} ${item.y}) scale(${scaleX} ${scaleY})`;
	}
</script>

<g class="paper-garden" aria-hidden="true">
	{#each items as item (item.id)}
		<g class={`garden-item ${item.kind}`} transform={transformFor(item)}>
			{#if item.kind === 'sprig'}
				<path class="stem" d="M 0 0 q 3 -16 0 -28" />
				<path class="leaf" d="M 0 -11 q -11 -5 -12 -13 q 10 1 12 13 M 0 -18 q 10 -4 12 -12 q -10 0 -12 12" />
			{:else if item.kind === 'fern'}
				<path class="stem" d="M 0 0 q -1 -22 4 -38" />
				<path class="leaf" d="M 1 -10 l -13 -7 M 2 -16 l 14 -8 M 3 -22 l -13 -8 M 4 -28 l 12 -8 M 4 -34 l -8 -6" />
			{:else if item.kind === 'flower'}
				<path class="stem" d="M 0 0 v -22" />
				<path class="petal" d="M 0 -22 q -10 -9 0 -13 q 10 4 0 13 M 0 -22 q -9 10 -13 0 q 4 -10 13 0 M 0 -22 q 9 10 13 0 q -4 -10 -13 0" />
				<circle class="flower-core" cx="0" cy="-22" r="3" />
			{:else if item.kind === 'mushroom'}
				<path class="mushroom-stem" d="M -4 0 q 4 -13 8 0 Z" />
				<path class="mushroom-cap" d="M -12 -10 q 12 -14 24 0 Z" />
			{:else}
				<path class="lantern-post" d="M 0 0 v -30 M -7 -30 h 14" />
				<path class="lantern" d="M -7 -27 h 14 v 14 h -14 Z M -4 -30 h 8 M -4 -13 h 8" />
			{/if}
		</g>
	{/each}
</g>

<style>
	.paper-garden :global(path),
	.paper-garden :global(circle) {
		vector-effect: non-scaling-stroke;
	}
	.garden-item {
		pointer-events: none;
	}
	.stem,
	.leaf,
	.lantern-post {
		fill: none;
		stroke: rgba(42, 161, 152, 0.43);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.7;
	}
	.flower .stem,
	.flower .petal {
		stroke: rgba(211, 54, 130, 0.46);
	}
	.petal {
		fill: rgba(211, 54, 130, 0.12);
		stroke: rgba(211, 54, 130, 0.46);
		stroke-linejoin: round;
		stroke-width: 1.5;
	}
	.flower-core {
		fill: rgba(181, 137, 0, 0.68);
	}
	.mushroom-stem {
		fill: rgba(253, 246, 227, 0.76);
		stroke: rgba(88, 110, 117, 0.37);
		stroke-width: 1.4;
	}
	.mushroom-cap {
		fill: rgba(108, 113, 196, 0.22);
		stroke: rgba(108, 113, 196, 0.48);
		stroke-linejoin: round;
		stroke-width: 1.5;
	}
	.lantern {
		fill: rgba(181, 137, 0, 0.16);
		stroke: rgba(181, 137, 0, 0.55);
		stroke-linejoin: round;
		stroke-width: 1.4;
	}
</style>
