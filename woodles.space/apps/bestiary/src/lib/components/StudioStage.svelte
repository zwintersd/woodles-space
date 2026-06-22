<script lang="ts">
	import {
		imageLayerBox,
		fillToCss,
		cssFilter,
		normalizeRotation,
		clampOffset,
		clampScale,
		type ImageLayer
	} from '$lib/composer';
	import type { StudioState } from '$lib/studio.svelte';

	let { studio }: { studio: StudioState } = $props();

	// Derive canvas dimensions from the live composition so the stage works for
	// any aspect ratio — the landscape sprite canvas and the portrait card back.
	let cw = $derived(studio.comp.width);
	let ch = $derived(studio.comp.height);

	// measured stage width in px → lets blur (an absolute length) track the
	// canvas's blur-as-fraction-of-width, so preview and flatten agree.
	let stageW = $state(0);
	let stageEl: HTMLDivElement;

	type Gesture =
		| { mode: 'move'; startX: number; startY: number; ox: number; oy: number }
		| { mode: 'scale'; cx: number; cy: number; startDist: number; startScale: number }
		| { mode: 'rotate'; cx: number; cy: number; startAngle: number; startRot: number };

	let gesture: Gesture | null = null;

	// pointer position in canvas space
	function toCanvas(e: PointerEvent): { x: number; y: number } {
		const rect = stageEl.getBoundingClientRect();
		return {
			x: ((e.clientX - rect.left) / rect.width) * cw,
			y: ((e.clientY - rect.top) / rect.height) * ch
		};
	}

	function startMove(e: PointerEvent, layer: ImageLayer) {
		studio.select(layer.id);
		studio.begin();
		const p = toCanvas(e);
		gesture = { mode: 'move', startX: p.x, startY: p.y, ox: layer.x, oy: layer.y };
		arm(e);
	}

	function startScale(e: PointerEvent, layer: ImageLayer) {
		studio.select(layer.id);
		studio.begin();
		const box = imageLayerBox(layer, cw, ch);
		const p = toCanvas(e);
		gesture = {
			mode: 'scale',
			cx: box.cx,
			cy: box.cy,
			startDist: Math.hypot(p.x - box.cx, p.y - box.cy) || 1,
			startScale: layer.scale
		};
		arm(e);
	}

	function startRotate(e: PointerEvent, layer: ImageLayer) {
		studio.select(layer.id);
		studio.begin();
		const box = imageLayerBox(layer, cw, ch);
		const p = toCanvas(e);
		gesture = {
			mode: 'rotate',
			cx: box.cx,
			cy: box.cy,
			startAngle: Math.atan2(p.y - box.cy, p.x - box.cx),
			startRot: layer.rotation
		};
		arm(e);
	}

	function arm(e: PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	function onMove(e: PointerEvent) {
		if (!gesture) return;
		const p = toCanvas(e);
		if (gesture.mode === 'move') {
			studio.updateSelected({
				x: clampOffset(gesture.ox + (p.x - gesture.startX) / cw),
				y: clampOffset(gesture.oy + (p.y - gesture.startY) / ch)
			} as Partial<ImageLayer>);
		} else if (gesture.mode === 'scale') {
			const dist = Math.hypot(p.x - gesture.cx, p.y - gesture.cy);
			studio.updateSelected({
				scale: clampScale(gesture.startScale * (dist / gesture.startDist))
			} as Partial<ImageLayer>);
		} else {
			const ang = Math.atan2(p.y - gesture.cy, p.x - gesture.cx);
			const deltaDeg = ((ang - gesture.startAngle) * 180) / Math.PI;
			studio.updateSelected({
				rotation: normalizeRotation(gesture.startRot + deltaDeg)
			} as Partial<ImageLayer>);
		}
	}

	function onUp() {
		gesture = null;
		studio.end();
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
	}

	function onStagePointerdown(e: PointerEvent) {
		// a bare click on the canvas backdrop clears the selection
		if (e.target === stageEl) studio.select(null);
	}

	function onWheel(e: WheelEvent) {
		const sel = studio.selected;
		if (!sel || sel.kind !== 'image') return;
		e.preventDefault();
		studio.scaleSelected(e.deltaY < 0 ? 1.06 : 1 / 1.06);
	}

	// ── per-layer style ───────────────────────────────────────────────

	function blurPx(blur: number): number {
		return blur * stageW;
	}

	function imageStyle(layer: ImageLayer): string {
		const box = imageLayerBox(layer, cw, ch);
		const left = (box.cx / cw) * 100;
		const top = (box.cy / ch) * 100;
		const width = (box.w / cw) * 100;
		const fx = layer.flipX ? -1 : 1;
		const fy = layer.flipY ? -1 : 1;
		return [
			`left:${left}%`,
			`top:${top}%`,
			`width:${width}%`,
			`opacity:${layer.opacity}`,
			`transform:translate(-50%,-50%) rotate(${layer.rotation}deg) scale(${fx},${fy})`,
			`filter:${cssFilter(layer.filters, blurPx(layer.blur))}`,
			`mix-blend-mode:${layer.blend}`,
			`image-rendering:${layer.smooth ? 'auto' : 'pixelated'}`
		].join(';');
	}

	function fillStyle(layer: Extract<StudioState['layers'][number], { kind: 'fill' }>): string {
		return [
			`background:${fillToCss(layer.fill)}`,
			`opacity:${layer.opacity}`,
			`filter:${layer.blur > 0 ? `blur(${blurPx(layer.blur)}px)` : 'none'}`,
			`mix-blend-mode:${layer.blend}`
		].join(';');
	}

	// selection box geometry (matches the image's drawn rect, before rotation)
	let selBox = $derived.by(() => {
		const sel = studio.selected;
		if (!sel || sel.kind !== 'image') return null;
		const box = imageLayerBox(sel, cw, ch);
		return {
			layer: sel,
			left: (box.cx / cw) * 100,
			top: (box.cy / ch) * 100,
			width: (box.w / cw) * 100,
			height: (box.h / ch) * 100,
			rotation: sel.rotation,
			fx: sel.flipX ? -1 : 1,
			fy: sel.flipY ? -1 : 1
		};
	});
</script>

<div
	class="stage"
	bind:this={stageEl}
	bind:clientWidth={stageW}
	style="aspect-ratio:{cw}/{ch}"
	onpointerdown={onStagePointerdown}
	onwheel={onWheel}
	role="application"
	aria-label="composition stage — drag layers to arrange"
>
	{#if studio.isEmpty}
		<div class="stage-empty">
			<span class="ee-glyph">⬓</span>
			<span class="ee-text">an empty canvas — add a backdrop, a creature, some trees</span>
		</div>
	{/if}

	{#each studio.layers as layer (layer.id)}
		{#if !layer.hidden}
			{#if layer.kind === 'fill'}
				<button
					type="button"
					class="layer fill"
					class:selected={layer.id === studio.selectedId}
					style={fillStyle(layer)}
					onpointerdown={(e) => {
						e.stopPropagation();
						studio.select(layer.id);
					}}
					aria-label="{layer.name} backdrop"
				></button>
			{:else}
				<img
					class="layer img"
					src={studio.renderSrc(layer)}
					alt={layer.name}
					draggable="false"
					style={imageStyle(layer)}
					onpointerdown={(e) => startMove(e, layer)}
				/>
			{/if}
		{/if}
	{/each}

	<!-- selection frame + handles, above every layer, non-blending -->
	{#if selBox}
		<div
			class="sel-box"
			style="left:{selBox.left}%;top:{selBox.top}%;width:{selBox.width}%;height:{selBox.height}%;transform:translate(-50%,-50%) rotate({selBox.rotation}deg)"
		>
			<span class="rot-stem"></span>
			<button
				type="button"
				class="handle rotate"
				title="drag to rotate"
				aria-label="rotate layer"
				style="transform:scale({selBox.fx},{selBox.fy})"
				onpointerdown={(e) => startRotate(e, selBox!.layer)}
			></button>
			<button
				type="button"
				class="handle scale"
				title="drag to resize"
				aria-label="resize layer"
				onpointerdown={(e) => startScale(e, selBox!.layer)}
			></button>
		</div>
	{/if}
</div>

<style>
	.stage {
		position: relative;
		width: 100%;
		border-radius: var(--b-radius-md);
		overflow: hidden;
		isolation: isolate;
		background:
			repeating-conic-gradient(rgba(154, 125, 150, 0.12) 0% 25%, transparent 0% 50%) 50% / 22px 22px,
			var(--b-vellum);
		border: 1px solid var(--b-border-strong);
		touch-action: none;
		user-select: none;
		cursor: default;
	}

	.stage-empty {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--b-space-sm);
		text-align: center;
		padding: var(--b-space-lg);
		pointer-events: none;
	}
	.ee-glyph { font-size: 2.2rem; color: var(--b-gold); opacity: 0.6; }
	.ee-text {
		font-family: var(--b-font-mono);
		font-size: 0.78rem;
		color: var(--b-muted);
		max-width: 22ch;
	}

	.layer { position: absolute; }
	.layer.img {
		transform-origin: center;
		cursor: grab;
		display: block;
		height: auto;
	}
	.layer.img:active { cursor: grabbing; }
	.layer.fill {
		inset: 0;
		width: 100%;
		height: 100%;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.sel-box {
		position: absolute;
		transform-origin: center;
		border: 1.5px dashed var(--b-gold);
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
		pointer-events: none;
		z-index: 5;
	}
	.rot-stem {
		position: absolute;
		left: 50%;
		top: -26px;
		width: 1.5px;
		height: 26px;
		background: var(--b-gold);
		transform: translateX(-50%);
	}
	.handle {
		position: absolute;
		width: 15px;
		height: 15px;
		padding: 0;
		border-radius: 50%;
		background: var(--b-surface);
		border: 1.5px solid var(--b-gold);
		box-shadow: 0 1px 4px rgba(206, 130, 175, 0.5);
		pointer-events: auto;
	}
	.handle.rotate {
		left: 50%;
		top: -26px;
		transform: translate(-50%, -50%);
		cursor: grab;
	}
	.handle.scale {
		right: 0;
		bottom: 0;
		transform: translate(50%, 50%);
		cursor: nwse-resize;
		border-radius: 3px;
	}
</style>
