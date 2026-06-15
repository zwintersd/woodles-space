// The flatten. The studio edits the composition as live, stacked DOM; when the
// art is committed to the card, the same composition is painted onto a canvas
// here and exported as a single data URL — the only thing the card itself reads.
//
// This file is the one place that touches the DOM/canvas, so it lives apart from
// the pure math in composer.ts (which it leans on for every layer's geometry).

import {
	blendToComposite,
	imageLayerBox,
	cssFilter,
	type Composition,
	type Fill,
	type ImageLayer
} from './composer';
import { bakeOutline } from './outline';

export class RenderError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RenderError';
	}
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new RenderError('a layer image would not load'));
		img.src = src;
	});
}

function paintFill(ctx: CanvasRenderingContext2D, fill: Fill, w: number, h: number, pad: number) {
	const x = -pad;
	const y = -pad;
	const fw = w + pad * 2;
	const fh = h + pad * 2;
	if (fill.type === 'solid') {
		ctx.fillStyle = fill.color;
	} else if (fill.type === 'linear') {
		// angle: 180deg = top→bottom, matching CSS linear-gradient.
		const rad = ((fill.angle - 90) * Math.PI) / 180;
		const cx = w / 2;
		const cy = h / 2;
		const len = Math.max(w, h) / 2;
		const dx = Math.cos(rad) * len;
		const dy = Math.sin(rad) * len;
		const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
		g.addColorStop(0, fill.from);
		g.addColorStop(1, fill.to);
		ctx.fillStyle = g;
	} else {
		const g = ctx.createRadialGradient(w / 2, h * 0.32, 0, w / 2, h * 0.32, Math.max(w, h) * 0.9);
		g.addColorStop(0, fill.from);
		g.addColorStop(1, fill.to);
		ctx.fillStyle = g;
	}
	ctx.fillRect(x, y, fw, fh);
}

function drawImageLayer(
	ctx: CanvasRenderingContext2D,
	layer: ImageLayer,
	img: HTMLImageElement,
	w: number,
	h: number
) {
	const box = imageLayerBox(layer, w, h);
	ctx.imageSmoothingEnabled = layer.smooth;
	ctx.translate(box.cx, box.cy);
	ctx.rotate((layer.rotation * Math.PI) / 180);
	ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
	ctx.drawImage(img, -box.w / 2, -box.h / 2, box.w, box.h);
}

// Flatten a composition to a data URL. Images are preloaded first so draw order
// (and thus blending) is exact and deterministic.
export async function renderComposition(comp: Composition): Promise<string> {
	const canvas = document.createElement('canvas');
	canvas.width = comp.width;
	canvas.height = comp.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new RenderError('canvas is unavailable');

	// Each image layer is baked (outline applied) and loaded ahead of the draw
	// pass, keyed by layer id, so blend order stays exact and deterministic.
	const bitmaps = new Map<string, HTMLImageElement>();
	await Promise.all(
		comp.layers
			.filter((l): l is ImageLayer => l.kind === 'image' && !l.hidden)
			.map(async (l) => {
				const src = l.outline
					? await bakeOutline(l.src, l.naturalW, l.naturalH, l.outline)
					: l.src;
				bitmaps.set(l.id, await loadImage(src));
			})
	);

	for (const layer of comp.layers) {
		if (layer.hidden || layer.opacity <= 0) continue;
		ctx.save();
		ctx.globalAlpha = layer.opacity;
		ctx.globalCompositeOperation = blendToComposite(layer.blend);
		const blurPx = layer.blur * comp.width;
		if (layer.kind === 'fill') {
			ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
			// Overscan blurred fills so the soft edge doesn't reveal the canvas.
			paintFill(ctx, layer.fill, comp.width, comp.height, blurPx * 3);
		} else {
			ctx.filter = cssFilter(layer.filters, blurPx);
			const img = bitmaps.get(layer.id);
			if (img) drawImageLayer(ctx, layer, img, comp.width, comp.height);
		}
		ctx.restore();
	}

	let out = canvas.toDataURL('image/webp', 0.9);
	if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/png');
	return out;
}

// ── upload → layer source ─────────────────────────────────────────────
// A dropped/chosen image becomes a layer source: downscaled so the stored
// composition stays light, with its (downscaled) natural size and a pixel-art
// guess returned for the layer's transform and smoothing.

const LAYER_MAX = 700;

export type LayerSource = {
	src: string;
	naturalW: number;
	naturalH: number;
	pixelated: boolean;
};

function readAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new RenderError('could not read that file'));
		reader.readAsDataURL(file);
	});
}

export async function layerSourceFromFile(file: File): Promise<LayerSource> {
	if (!file.type.startsWith('image/')) throw new RenderError('that file is not an image');
	const sourceUrl = await readAsDataUrl(file);

	// SVGs scale cleanly — keep the source, but probe a real intrinsic size.
	const img = await loadImage(sourceUrl);
	const width = img.naturalWidth || img.width || 200;
	const height = img.naturalHeight || img.height || 200;
	const pixelated = Math.max(width, height) <= 128;

	if (file.type === 'image/svg+xml') {
		return { src: sourceUrl, naturalW: width, naturalH: height, pixelated: false };
	}

	const scale = Math.min(1, LAYER_MAX / Math.max(width, height));
	if (scale === 1 && pixelated) {
		return { src: sourceUrl, naturalW: width, naturalH: height, pixelated };
	}

	const w = Math.max(1, Math.round(width * scale));
	const h = Math.max(1, Math.round(height * scale));
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new RenderError('canvas is unavailable');
	ctx.imageSmoothingEnabled = !pixelated;
	ctx.drawImage(img, 0, 0, w, h);
	let out = canvas.toDataURL('image/webp', 0.9);
	if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/png');
	return { src: out, naturalW: w, naturalH: h, pixelated };
}

// Probe an already-encoded data URL for its intrinsic size — used to bring an
// existing flat sprite into the studio as a single image layer.
export async function measureImage(src: string): Promise<{ naturalW: number; naturalH: number }> {
	const img = await loadImage(src);
	return {
		naturalW: img.naturalWidth || img.width || 200,
		naturalH: img.naturalHeight || img.height || 200
	};
}
