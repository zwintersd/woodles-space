<script lang="ts">
	interface Props {
		width: number;
		height: number;
		opacity?: number;
	}

	let { width, height, opacity = 0.28 }: Props = $props();
</script>

<g class="paper-texture-layer" aria-hidden="true">
	<image
		href="/arcade/living-paper-texture.webp"
		width={width}
		height={height}
		preserveAspectRatio="none"
		style={`opacity:${opacity}`}
	/>
	<rect class="paper-wash" {width} {height} rx="6" />
</g>

<style>
	.paper-texture-layer image {
		mix-blend-mode: multiply;
	}
	.paper-wash {
		fill: rgba(253, 246, 227, 0.36);
	}
</style>
