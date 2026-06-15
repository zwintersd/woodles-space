// Tracing a sticker outline from a PNG's alpha. The silhouette is dilated by
// blurring the alpha and thresholding it back to a hard (or soft) edge, then
// filled — flat or gradient — and slipped behind the original art. Same-size
// output (no canvas growth), so the layer's transform is untouched; the only
// caveat is a subject flush to the image border gets clipped on that side,
// which erased-background uploads almost never are.

import { type Fill, type Outline } from './composer';

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('outline: image failed to load'));
		img.src = src;
	});
}

function canvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d');
	if (!ctx) throw new Error('outline: canvas unavailable');
	return { c, ctx };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
	if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function paintFill(ctx: CanvasRenderingContext2D, fill: Fill, w: number, h: number) {
	if (fill.type === 'solid') {
		ctx.fillStyle = fill.color;
	} else if (fill.type === 'linear') {
		const rad = ((fill.angle - 90) * Math.PI) / 180;
		const len = Math.max(w, h) / 2;
		const dx = Math.cos(rad) * len;
		const dy = Math.sin(rad) * len;
		const g = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
		g.addColorStop(0, fill.from);
		g.addColorStop(1, fill.to);
		ctx.fillStyle = g;
	} else {
		const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
		g.addColorStop(0, fill.from);
		g.addColorStop(1, fill.to);
		ctx.fillStyle = g;
	}
	ctx.fillRect(0, 0, w, h);
}

// Roughly where blurred alpha crosses for the edge to sit ~width px out.
const CUT = 0.16 * 255;

// Produce a new data URL: the art with an outline behind it. Returns the
// original src unchanged when the outline would be sub-pixel.
export async function bakeOutline(
	src: string,
	naturalW: number,
	naturalH: number,
	outline: Outline
): Promise<string> {
	const w = Math.max(1, Math.round(naturalW));
	const h = Math.max(1, Math.round(naturalH));
	const radius = outline.width * Math.max(w, h);
	if (radius < 0.5) return src;

	const img = await loadImage(src);

	// 1. spread the alpha by blurring the art
	const mask = canvas(w, h);
	mask.ctx.filter = `blur(${radius}px)`;
	mask.ctx.drawImage(img, 0, 0, w, h);
	const md = mask.ctx.getImageData(0, 0, w, h);

	// 2. threshold the blurred alpha into a (crisp→soft) coverage mask
	const band = 2 + outline.softness * 130;
	const cov = mask.ctx.createImageData(w, h);
	for (let i = 0; i < md.data.length; i += 4) {
		const a = md.data[i + 3];
		const t = smoothstep(CUT - band, CUT + band, a);
		cov.data[i] = 255;
		cov.data[i + 1] = 255;
		cov.data[i + 2] = 255;
		cov.data[i + 3] = Math.round(t * 255);
	}

	// 3. tint the coverage with the outline fill
	const tint = canvas(w, h);
	tint.ctx.putImageData(cov, 0, 0);
	tint.ctx.globalCompositeOperation = 'source-in';
	paintFill(tint.ctx, outline.fill, w, h);

	// 4. outline behind, original art on top
	const out = canvas(w, h);
	out.ctx.drawImage(tint.c, 0, 0);
	out.ctx.drawImage(img, 0, 0, w, h);

	let url = out.c.toDataURL('image/webp', 0.92);
	if (!url.startsWith('data:image/webp')) url = out.c.toDataURL('image/png');
	return url;
}
