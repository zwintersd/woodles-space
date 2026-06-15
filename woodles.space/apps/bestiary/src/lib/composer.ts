// The sprite studio's model layer — a small, side-effect-free compositor.
//
// A creature's art is a stack of layers (image stamps and full-bleed fills),
// each carrying its own transform (position, scale, rotation), opacity, blur
// and blend mode. The studio edits this stack live as stacked DOM; render.ts
// flattens the same stack onto a canvas for the data-URL the card displays.
//
// Everything here is pure: geometry math, layer factories, and reorder/clamp
// helpers, so the math can be unit-tested without a DOM. Layers are stored
// bottom-first — index 0 is the back of the stack, the last entry the front.

import { uid } from './utils';

// The flatten canvas. A gentle landscape that reads as a little scene and
// crops kindly into the card's art window (which uses object-fit: cover).
export const CANVAS_W = 640;
export const CANVAS_H = 480;

// At scale 1 an image's longest side spans the canvas's shorter dimension.
// A freshly-stamped prop comes in a touch smaller than that.
export const FIT_SCALE = 0.6;

export const MIN_SCALE = 0.03;
export const MAX_SCALE = 4;
export const MAX_BLUR = 0.12; // as a fraction of canvas width

// ── blend modes ──────────────────────────────────────────────────────
// Names chosen to map 1:1 onto CSS mix-blend-mode (the live preview) and,
// via blendToComposite(), onto canvas globalCompositeOperation (the flatten).

export type BlendMode =
	| 'normal'
	| 'multiply'
	| 'screen'
	| 'overlay'
	| 'soft-light'
	| 'hard-light'
	| 'lighten'
	| 'darken'
	| 'color-dodge'
	| 'difference'
	| 'luminosity';

export const BLEND_MODES: { id: BlendMode; name: string }[] = [
	{ id: 'normal', name: 'normal' },
	{ id: 'multiply', name: 'multiply' },
	{ id: 'screen', name: 'screen' },
	{ id: 'overlay', name: 'overlay' },
	{ id: 'soft-light', name: 'soft light' },
	{ id: 'hard-light', name: 'hard light' },
	{ id: 'lighten', name: 'lighten' },
	{ id: 'darken', name: 'darken' },
	{ id: 'color-dodge', name: 'dodge' },
	{ id: 'difference', name: 'difference' },
	{ id: 'luminosity', name: 'luminosity' }
];

// CSS blend names line up with canvas operations save for 'normal'.
export function blendToComposite(blend: BlendMode): GlobalCompositeOperation {
	return blend === 'normal' ? 'source-over' : (blend as GlobalCompositeOperation);
}

// ── fills ─────────────────────────────────────────────────────────────

export type Fill =
	| { type: 'solid'; color: string }
	| { type: 'linear'; from: string; to: string; angle: number }
	| { type: 'radial'; from: string; to: string };

// One CSS background string for both the swatch preview and the live stage.
export function fillToCss(fill: Fill): string {
	switch (fill.type) {
		case 'solid':
			return fill.color;
		case 'linear':
			return `linear-gradient(${fill.angle}deg, ${fill.from}, ${fill.to})`;
		case 'radial':
			return `radial-gradient(120% 120% at 50% 32%, ${fill.from}, ${fill.to})`;
	}
}

// ── filters ───────────────────────────────────────────────────────────
// Per-image colour grading. Every value maps straight onto a CSS filter
// function — the same string drives the live preview and the canvas flatten,
// so what you see is what gets baked.

export type Filters = {
	brightness: number; // 1 = untouched
	contrast: number; // 1
	saturate: number; // 1
	hue: number; // degrees, 0
	sepia: number; // 0..1
	grayscale: number; // 0..1
	invert: number; // 0..1
};

export const DEFAULT_FILTERS: Filters = {
	brightness: 1,
	contrast: 1,
	saturate: 1,
	hue: 0,
	sepia: 0,
	grayscale: 0,
	invert: 0
};

export function defaultFilters(): Filters {
	return { ...DEFAULT_FILTERS };
}

export function filtersAreDefault(f: Filters): boolean {
	return (
		f.brightness === 1 &&
		f.contrast === 1 &&
		f.saturate === 1 &&
		f.hue === 0 &&
		f.sepia === 0 &&
		f.grayscale === 0 &&
		f.invert === 0
	);
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

// Build the combined CSS/canvas filter string. blurPx is resolved per context
// (preview measures the stage; flatten uses the canvas width) and prepended.
export function cssFilter(filters: Filters | undefined, blurPx = 0): string {
	const f = filters ?? DEFAULT_FILTERS;
	const parts: string[] = [];
	if (blurPx > 0) parts.push(`blur(${round2(blurPx)}px)`);
	if (f.brightness !== 1) parts.push(`brightness(${round2(f.brightness)})`);
	if (f.contrast !== 1) parts.push(`contrast(${round2(f.contrast)})`);
	if (f.saturate !== 1) parts.push(`saturate(${round2(f.saturate)})`);
	if (f.hue !== 0) parts.push(`hue-rotate(${Math.round(f.hue)}deg)`);
	if (f.sepia > 0) parts.push(`sepia(${round2(f.sepia)})`);
	if (f.grayscale > 0) parts.push(`grayscale(${round2(f.grayscale)})`);
	if (f.invert > 0) parts.push(`invert(${round2(f.invert)})`);
	return parts.length ? parts.join(' ') : 'none';
}

// ── outline ───────────────────────────────────────────────────────────
// A silhouette stroke traced from a PNG's alpha — the sticker edge. width is a
// fraction of the image's longest side (so it scales with the art, not the
// upload's resolution); the fill reuses the backdrop Fill type, so an outline
// can be a flat colour or a gradient. See outline.ts for the bake.

export const MAX_OUTLINE = 0.08;

export type Outline = {
	width: number; // 0..MAX_OUTLINE, fraction of longest side
	softness: number; // 0 = crisp edge, 1 = a soft halo
	fill: Fill;
};

export function defaultOutline(): Outline {
	return { width: 0.025, softness: 0.12, fill: { type: 'solid', color: '#fff8fc' } };
}

export function clampOutlineWidth(n: number): number {
	if (Number.isNaN(n)) return 0;
	return Math.max(0, Math.min(MAX_OUTLINE, n));
}

// ── layers ────────────────────────────────────────────────────────────

type LayerCommon = {
	id: string;
	name: string;
	hidden: boolean;
	opacity: number; // 0..1
	blur: number; // 0..MAX_BLUR, as a fraction of canvas width
	blend: BlendMode;
};

// Image stamps carry a full transform. x/y are the centre's offset from the
// canvas centre, as a fraction of width/height (0,0 = dead centre).
export type ImageLayer = LayerCommon & {
	kind: 'image';
	src: string; // data URL
	naturalW: number;
	naturalH: number;
	x: number;
	y: number;
	scale: number;
	rotation: number; // degrees
	flipX: boolean;
	flipY: boolean;
	smooth: boolean; // false renders nearest-neighbour, for pixel art
	filters: Filters;
	outline: Outline | null;
};

// Fills are full-bleed backdrops — no transform, just paint, blur, blend.
export type FillLayer = LayerCommon & {
	kind: 'fill';
	fill: Fill;
};

export type Layer = ImageLayer | FillLayer;

export type Composition = {
	v: 1;
	width: number;
	height: number;
	layers: Layer[]; // bottom-first
};

// ── factories ─────────────────────────────────────────────────────────

export function emptyComposition(): Composition {
	return { v: 1, width: CANVAS_W, height: CANVAS_H, layers: [] };
}

type ImageLayerInit = {
	src: string;
	naturalW: number;
	naturalH: number;
	name?: string;
	x?: number;
	y?: number;
	scale?: number;
	rotation?: number;
	opacity?: number;
	blur?: number;
	blend?: BlendMode;
	flipX?: boolean;
	flipY?: boolean;
	smooth?: boolean;
	filters?: Filters;
	outline?: Outline | null;
};

export function createImageLayer(init: ImageLayerInit): ImageLayer {
	return {
		kind: 'image',
		id: uid(),
		name: init.name?.trim() || 'image',
		hidden: false,
		src: init.src,
		naturalW: Math.max(1, init.naturalW || 1),
		naturalH: Math.max(1, init.naturalH || 1),
		x: init.x ?? 0,
		y: init.y ?? 0,
		scale: clampScale(init.scale ?? FIT_SCALE),
		rotation: init.rotation ?? 0,
		opacity: clamp01(init.opacity ?? 1),
		blur: clampBlur(init.blur ?? 0),
		blend: init.blend ?? 'normal',
		flipX: init.flipX ?? false,
		flipY: init.flipY ?? false,
		smooth: init.smooth ?? true,
		filters: init.filters ?? defaultFilters(),
		outline: init.outline ?? null
	};
}

export function createFillLayer(fill: Fill, name = 'backdrop'): FillLayer {
	return {
		kind: 'fill',
		id: uid(),
		name,
		hidden: false,
		opacity: 1,
		blur: 0,
		blend: 'normal',
		fill
	};
}

// ── clamps ────────────────────────────────────────────────────────────

export function clamp01(n: number): number {
	if (Number.isNaN(n)) return 0;
	return Math.max(0, Math.min(1, n));
}

export function clampScale(n: number): number {
	if (Number.isNaN(n)) return FIT_SCALE;
	return Math.max(MIN_SCALE, Math.min(MAX_SCALE, n));
}

export function clampBlur(n: number): number {
	if (Number.isNaN(n)) return 0;
	return Math.max(0, Math.min(MAX_BLUR, n));
}

// Keep rotation readable in (−180, 180].
export function normalizeRotation(deg: number): number {
	if (!Number.isFinite(deg)) return 0;
	let r = deg % 360;
	if (r > 180) r -= 360;
	if (r <= -180) r += 360;
	return r;
}

// ── geometry ──────────────────────────────────────────────────────────

export type LayerBox = { cx: number; cy: number; w: number; h: number };

// Where an image layer lands on the canvas, in pixels: its centre and its
// drawn (unrotated) size. The single source of truth shared by the live
// CSS preview, the bounding-box handles, and the canvas flatten.
export function imageLayerBox(layer: ImageLayer, W = CANVAS_W, H = CANVAS_H): LayerBox {
	const refDim = Math.min(W, H);
	const maxNat = Math.max(layer.naturalW, layer.naturalH) || 1;
	const ratio = (clampScale(layer.scale) * refDim) / maxNat;
	return {
		w: layer.naturalW * ratio,
		h: layer.naturalH * ratio,
		cx: W / 2 + layer.x * W,
		cy: H / 2 + layer.y * H
	};
}

// The scale value that makes an image just cover the whole canvas — used when
// stamping full-bleed assets (overlays, vignettes) and backdrop photos.
export function coverScale(naturalW: number, naturalH: number, W = CANVAS_W, H = CANVAS_H): number {
	const maxNat = Math.max(naturalW, naturalH) || 1;
	const refDim = Math.min(W, H);
	const ratioCover = Math.max(W / (naturalW || 1), H / (naturalH || 1));
	return clampScale((ratioCover * maxNat) / refDim);
}

// ── stack operations (all pure, never mutate the input) ───────────────

export function indexOfLayer(layers: Layer[], id: string): number {
	return layers.findIndex((l) => l.id === id);
}

export function updateLayer(layers: Layer[], id: string, changes: Partial<Layer>): Layer[] {
	return layers.map((l) => (l.id === id ? ({ ...l, ...changes } as Layer) : l));
}

export function removeLayer(layers: Layer[], id: string): Layer[] {
	return layers.filter((l) => l.id !== id);
}

// Shift a layer one step through the stack. 'up' moves it toward the front
// (later in the array), 'down' toward the back.
export function moveLayer(layers: Layer[], id: string, dir: 'up' | 'down'): Layer[] {
	const i = indexOfLayer(layers, id);
	if (i === -1) return layers;
	const j = dir === 'up' ? i + 1 : i - 1;
	if (j < 0 || j >= layers.length) return layers;
	const next = layers.slice();
	[next[i], next[j]] = [next[j], next[i]];
	return next;
}

export function moveLayerToEnd(layers: Layer[], id: string, end: 'front' | 'back'): Layer[] {
	const i = indexOfLayer(layers, id);
	if (i === -1) return layers;
	const next = layers.slice();
	const [layer] = next.splice(i, 1);
	if (end === 'front') next.push(layer);
	else next.unshift(layer);
	return next;
}

// Add a layer just above the currently selected one (or on top if none),
// returning the new stack — the natural place a freshly-stamped prop lands.
export function addLayerAbove(layers: Layer[], layer: Layer, selectedId: string | null): Layer[] {
	const i = selectedId ? indexOfLayer(layers, selectedId) : -1;
	if (i === -1) return [...layers, layer];
	const next = layers.slice();
	next.splice(i + 1, 0, layer);
	return next;
}

// Copy a layer, nudged down-right so the duplicate is visible, with a fresh id.
export function duplicateLayer(layer: Layer): Layer {
	if (layer.kind === 'image') {
		return {
			...layer,
			id: uid(),
			x: clampOffset(layer.x + 0.04),
			y: clampOffset(layer.y + 0.04)
		};
	}
	return { ...layer, id: uid() };
}

// Positions can roam a little past the edge so a layer can sit half-off-frame.
export function clampOffset(n: number): number {
	if (Number.isNaN(n)) return 0;
	return Math.max(-1.5, Math.min(1.5, n));
}

// ── (de)serialization ─────────────────────────────────────────────────

export function cloneComposition(comp: Composition): Composition {
	return {
		v: 1,
		width: comp.width,
		height: comp.height,
		layers: comp.layers.map((l) => ({ ...l }))
	};
}

// Coerce a stored/synced composition into a known-good shape. Tolerates
// missing fields from older or hand-edited blobs without throwing.
export function migrateComposition(raw: unknown): Composition | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Partial<Composition>;
	if (!Array.isArray(r.layers)) return null;
	const layers: Layer[] = [];
	for (const l of r.layers) {
		const safe = normalizeLayer(l);
		if (safe) layers.push(safe);
	}
	return {
		v: 1,
		width: typeof r.width === 'number' && r.width > 0 ? r.width : CANVAS_W,
		height: typeof r.height === 'number' && r.height > 0 ? r.height : CANVAS_H,
		layers
	};
}

function normalizeLayer(raw: unknown): Layer | null {
	if (!raw || typeof raw !== 'object') return null;
	const l = raw as Record<string, unknown>;
	const common = {
		id: typeof l.id === 'string' ? l.id : uid(),
		name: typeof l.name === 'string' ? l.name : 'layer',
		hidden: l.hidden === true,
		opacity: clamp01(typeof l.opacity === 'number' ? l.opacity : 1),
		blur: clampBlur(typeof l.blur === 'number' ? l.blur : 0),
		blend: (typeof l.blend === 'string' ? l.blend : 'normal') as BlendMode
	};
	if (l.kind === 'fill') {
		const fill = l.fill as Fill | undefined;
		if (!fill || typeof fill !== 'object') return null;
		return { ...common, kind: 'fill', fill };
	}
	if (l.kind === 'image') {
		if (typeof l.src !== 'string') return null;
		return {
			...common,
			kind: 'image',
			src: l.src,
			naturalW: typeof l.naturalW === 'number' ? l.naturalW : 1,
			naturalH: typeof l.naturalH === 'number' ? l.naturalH : 1,
			x: clampOffset(typeof l.x === 'number' ? l.x : 0),
			y: clampOffset(typeof l.y === 'number' ? l.y : 0),
			scale: clampScale(typeof l.scale === 'number' ? l.scale : FIT_SCALE),
			rotation: normalizeRotation(typeof l.rotation === 'number' ? l.rotation : 0),
			flipX: l.flipX === true,
			flipY: l.flipY === true,
			smooth: l.smooth !== false,
			filters: normalizeFilters(l.filters),
			outline: normalizeOutline(l.outline)
		};
	}
	return null;
}

function num(v: unknown, fallback: number): number {
	return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function normalizeFilters(raw: unknown): Filters {
	if (!raw || typeof raw !== 'object') return defaultFilters();
	const f = raw as Record<string, unknown>;
	return {
		brightness: Math.max(0, Math.min(2, num(f.brightness, 1))),
		contrast: Math.max(0, Math.min(2, num(f.contrast, 1))),
		saturate: Math.max(0, Math.min(3, num(f.saturate, 1))),
		hue: normalizeRotation(num(f.hue, 0)),
		sepia: clamp01(num(f.sepia, 0)),
		grayscale: clamp01(num(f.grayscale, 0)),
		invert: clamp01(num(f.invert, 0))
	};
}

function normalizeOutline(raw: unknown): Outline | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const fill = o.fill as Fill | undefined;
	if (!fill || typeof fill !== 'object') return null;
	return {
		width: clampOutlineWidth(num(o.width, 0.025)),
		softness: clamp01(num(o.softness, 0.12)),
		fill
	};
}
