<script lang="ts">
	import { defaultImageEdits, imageViewport, type ImageEdits } from './imageEditing';
	let { source, name, aspectRatio, edits = defaultImageEdits() }: { source: string; name: string; aspectRatio: number; edits?: ImageEdits } = $props();
	const viewport = $derived(imageViewport(aspectRatio, edits));
</script>

<svg class="image-surface" class:rounded={edits.shape === 'rounded'} class:ellipse={edits.shape === 'ellipse'} class:diamond={edits.shape === 'diamond'}
	viewBox={viewport.viewBox} preserveAspectRatio="none" role="img" aria-label={name || 'Board image'}>
	<image href={source} x={(viewport.width - viewport.sourceWidth) / 2} y={(viewport.height - viewport.sourceHeight) / 2}
		width={viewport.sourceWidth} height={viewport.sourceHeight}
		transform={`rotate(${edits.rotation} ${viewport.width / 2} ${viewport.height / 2})`} />
</svg>

<style>
	.image-surface { display: block; width: 100%; height: 100%; overflow: hidden; pointer-events: none; }
	.image-surface:not(.ellipse):not(.diamond) { border-radius: var(--photo-corners, 0); }
	.image-surface.rounded { border-radius: var(--photo-corners, 7px); }
	.ellipse { border-radius: 50%; }
	.diamond { clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
</style>
