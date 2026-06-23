// Baking the per-layer pixel effects that can't be expressed as a live CSS
// filter: the sticker outline traced from a PNG's alpha, and the colour tint
// multiplied into the art. Both produce a new data URL the size of the original
// (no canvas growth, so the layer's transform is untouched), and both run in
// the same place for the live preview and the flatten — what you see is baked.

import { type Fill, type Outline, type Tint } from './composer';

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('bake: image failed to load'));
		img.src = src;
	});
}

function canvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d');
	if (!ctx) throw new Error('bake: canvas unavailable');
	return { c, ctx };
}

function toUrl(c: HTMLCanvasElement): string {
	let url = c.toDataURL('image/webp', 0.92);
	if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/png');
	return url;
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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
	let h = hex.trim();
	if (h.startsWith('#')) h = h.slice(1);
	if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
	if (h.length !== 6) return null;
	const n = Number.parseInt(h, 16);
	if (Number.isNaN(n)) return null;
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// ── tint ────────────────────────────────────────────────────────────────
// Multiply the colour into the art, lerped by strength: out.rgb = src.rgb ×
// lerp(1, colour, strength). Done per-pixel on un-premultiplied data so alpha
// (the fx's shape) is preserved exactly and transparent regions stay clear.
function tintCanvas(img: HTMLImageElement, w: number, h: number, tint: Tint): HTMLCanvasElement {
	const { c, ctx } = canvas(w, h);
	ctx.drawImage(img, 0, 0, w, h);
	const rgb = hexToRgb(tint.color);
	const s = Math.max(0, Math.min(1, tint.strength));
	if (!rgb || s <= 0) return c;
	const fr = 1 - s + (s * rgb.r) / 255;
	const fg = 1 - s + (s * rgb.g) / 255;
	const fb = 1 - s + (s * rgb.b) / 255;
	const id = ctx.getImageData(0, 0, w, h);
	const d = id.data;
	for (let i = 0; i < d.length; i += 4) {
		d[i] = d[i] * fr;
		d[i + 1] = d[i + 1] * fg;
		d[i + 2] = d[i + 2] * fb;
	}
	ctx.putImageData(id, 0, 0);
	return c;
}

// ── outline ───────────────────────────────────────────────────────────
// The silhouette is dilated by blurring the alpha and thresholding it back to
// a hard (or soft) edge, then filled — flat or gradient. Returns a same-size
// canvas holding just the outline fill, to slip behind the art.
const CUT = 0.16 * 255; // where blurred alpha crosses for the edge to sit ~width px out

function outlineCanvas(
	img: HTMLImageElement,
	w: number,
	h: number,
	outline: Outline,
	radius: number
): HTMLCanvasElement {
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
	return tint.c;
}

// Produce a new data URL for an image layer with its tint and/or outline baked
// in. Returns the original src untouched when neither applies (or the outline
// would be sub-pixel and there's no tint) — the caller can stay on the source.
export async function bakeLayer(
	src: string,
	naturalW: number,
	naturalH: number,
	opts: { outline?: Outline | null; tint?: Tint | null }
): Promise<string> {
	const outline = opts.outline ?? null;
	const tint = opts.tint && opts.tint.strength > 0 ? opts.tint : null;
	if (!outline && !tint) return src;

	const w = Math.max(1, Math.round(naturalW));
	const h = Math.max(1, Math.round(naturalH));
	const radius = outline ? outline.width * Math.max(w, h) : 0;
	const hasOutline = radius >= 0.5;
	if (!tint && !hasOutline) return src; // outline was sub-pixel, nothing to bake

	const img = await loadImage(src);

	// the (optionally) recoloured art — a canvas when tinted, else the raw image
	const art: CanvasImageSource = tint ? tintCanvas(img, w, h, tint) : img;
	if (!hasOutline) return toUrl(art as HTMLCanvasElement);

	// outline behind, art on top — alpha is traced from the untinted image since
	// the tint never changes the silhouette
	const ol = outlineCanvas(img, w, h, outline!, radius);
	const out = canvas(w, h);
	out.ctx.drawImage(ol, 0, 0);
	out.ctx.drawImage(art, 0, 0, w, h);
	return toUrl(out.c);
}
