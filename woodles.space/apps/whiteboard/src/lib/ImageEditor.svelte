<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import ImageSurface from './ImageSurface.svelte';
	import { defaultImageEdits, imageViewport, type ImageEdits } from './imageEditing';
	import type { ImageItem } from './model';
	let { item, source, apply, cancel }: { item: ImageItem; source: string; apply: (edits: ImageEdits) => void; cancel: () => void } = $props();
	function copyEdits(value: ImageEdits): ImageEdits { return { ...value, crop: { ...value.crop } }; }
	let edits = $state<ImageEdits>(untrack(() => copyEdits(item.edits ?? defaultImageEdits())));
	let dialog: HTMLDialogElement;
	const viewport = $derived(imageViewport(item.aspectRatio, edits));
	onMount(() => { dialog.showModal(); });
	function turn(amount: number) { edits.rotation = ((edits.rotation + amount + 540) % 360) - 180; }
</script>

<dialog bind:this={dialog} oncancel={(event) => { event.preventDefault(); cancel(); }} aria-labelledby="image-editor-title" data-whiteboard-ui>
	<form onsubmit={(event) => { event.preventDefault(); apply(copyEdits(edits)); }}>
		<header><h2 id="image-editor-title">Edit image</h2><button type="button" aria-label="Close image editor" onclick={cancel}>×</button></header>
		<div class="editor-body">
			<div class="preview-well"><div class="preview" style={`aspect-ratio: ${viewport.aspectRatio}; --preview-ratio: ${viewport.aspectRatio};`}><ImageSurface {source} name={item.name} aspectRatio={item.aspectRatio} {edits} /></div></div>
			<fieldset><legend>Crop</legend><p>Trim the edges of the rotated image.</p>
				{#each ['left', 'top', 'right', 'bottom'] as edge}
					{@const side = edge as keyof ImageEdits['crop']}
					{@const opposite = side === 'left' ? 'right' : side === 'right' ? 'left' : side === 'top' ? 'bottom' : 'top'}
					<label><span>{edge} <output>{edits.crop[side]}%</output></span><input aria-label={`Crop ${edge}`} type="range" min="0" max={90 - edits.crop[opposite]} step="1" bind:value={edits.crop[side]} /></label>
				{/each}
			</fieldset>
			<fieldset><legend>Shape</legend><div class="choices">
				{#each ['rectangle', 'rounded', 'ellipse', 'diamond'] as shape}<button type="button" class:active={edits.shape === shape} aria-pressed={edits.shape === shape} onclick={() => edits.shape = shape as ImageEdits['shape']}>{shape}</button>{/each}
			</div></fieldset>
			<fieldset><legend>Rotation</legend><div class="choices"><button type="button" onclick={() => turn(-90)}>↶ 90°</button><button type="button" onclick={() => turn(90)}>↷ 90°</button><label class="degrees"><input aria-label="Rotation degrees" type="number" min="-180" max="180" bind:value={edits.rotation} required />°</label></div>
				<input aria-label="Rotate image" type="range" min="-180" max="180" step="1" bind:value={edits.rotation} />
			</fieldset>
		</div>
		<footer><button type="button" onclick={() => edits = defaultImageEdits()}>Reset</button><span></span><button type="button" onclick={cancel}>Cancel</button><button class="apply" type="submit">Apply</button></footer>
	</form>
</dialog>

<style>
	dialog { width: min(540px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); padding: 0; border: 1px solid #d8cbc0; border-radius: 20px; color: #574b43; background: #fffdf7; box-shadow: 0 20px 80px #342b3440; }
	dialog::backdrop { background: #39303d60; backdrop-filter: blur(4px); }
	form { display: flex; flex-direction: column; max-height: calc(100dvh - 26px); }
	header, footer { display: flex; align-items: center; gap: 8px; padding: 14px 18px; }
	header { border-bottom: 1px solid #e9e0d6; } h2 { flex: 1; font: 22px Georgia, serif; margin: 0; }
	.editor-body { overflow-y: auto; overscroll-behavior: contain; padding: 16px 18px; }
	.preview-well { --preview-height: 310px; display: flex; align-items: center; justify-content: center; height: var(--preview-height); background: repeating-conic-gradient(#eee8df 0% 25%, #faf6ef 0% 50%) 0 / 20px 20px; border-radius: 12px; overflow: hidden; }
	.preview { width: min(100%, calc(var(--preview-height) * var(--preview-ratio))); height: auto; }
	fieldset { border: 0; padding: 0; margin: 18px 0 0; min-width: 0; } legend { font-weight: 600; } p { margin: 5px 0 10px; font-size: 12px; color: #897b70; }
	label { display: block; font-size: 12px; text-transform: capitalize; } label span { display: flex; justify-content: space-between; } output { color: #8d7b70; }
	input[type=range] { width: 100%; accent-color: #a66670; margin: 6px 0; } button { border: 1px solid #dfd2c5; border-radius: 9px; padding: 7px 11px; background: #faf5e9; color: inherit; cursor: pointer; font: inherit; font-size: 13px; }
	button:hover, .active { background: #eadbd7; } button:focus-visible, input:focus-visible { outline: 2px solid #a66670; outline-offset: 2px; }
	.choices { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; } .degrees { display: flex; align-items: center; gap: 4px; } input[type=number] { width: 65px; padding: 7px; border: 1px solid #dfd2c5; border-radius: 8px; background: white; color: inherit; }
	footer { border-top: 1px solid #e9e0d6; } footer span { flex: 1; } .apply { background: #a66670; color: white; border-color: #a66670; }
	@media(max-height: 750px) { .preview-well { --preview-height: 190px; } }
</style>
