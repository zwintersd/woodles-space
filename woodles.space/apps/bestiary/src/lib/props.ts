// The studio's built-in fx kit. Everything here is inline SVG — no binary
// assets to commit, and every overlay rasterises cleanly at the canvas size.
// Overlays are full-bleed light, weather, colour and grain that stack over the
// whole scene; fills are the backdrop colours and gradients dropped behind it.
//
// Each colour-bearing fx is a *recipe*: a `build(colours)` that regenerates the
// SVG from a list of editable stops, plus the default stops. Stamping one keeps
// the recipe on the layer (see layerFromAsset), so the effect's own palette
// stays fully editable in the studio — not just tinted. Colourless effects
// (grain, patterns) carry no stops and lean on the layer tint instead.

import {
	createImageLayer,
	coverScale,
	type Fill,
	type Layer,
	CANVAS_W,
	CANVAS_H
} from './composer';

// The fx tray is large, so overlays carry a sub-group for the headers shown
// in the tray. Order here is the order they appear.
export type OverlayGroup = 'light' | 'weather' | 'wash' | 'grain' | 'vignette';

export const overlayGroups: { id: OverlayGroup; label: string }[] = [
	{ id: 'light', label: 'light' },
	{ id: 'weather', label: 'weather' },
	{ id: 'wash', label: 'colour wash' },
	{ id: 'grain', label: 'grain & texture' },
	{ id: 'vignette', label: 'vignette' }
];

export type ImageAsset = {
	id: string;
	name: string;
	src: string;
	w: number;
	h: number;
	// 'cover' stamps land sized to fill the whole canvas (overlays).
	fit: 'fit' | 'cover';
	defaultOpacity?: number;
	defaultBlend?: Parameters<typeof createImageLayer>[0]['blend'];
	group: OverlayGroup;
	// editable colour stops (empty = colourless, recolour via tint instead)
	colors: string[];
	colorLabels?: string[];
	// regenerate the raw svg from a set of colours
	build: (colors: string[]) => string;
};

export type FillAsset = {
	id: string;
	name: string;
	fill: Fill;
};

// ── svg helpers ───────────────────────────────────────────────────────

function svgUrl(svg: string): string {
	return 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\s+/g, ' ').trim());
}

function fxSvg(inner: string, defs = ''): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">${defs}${inner}</svg>`;
}

// ── fx builders ───────────────────────────────────────────────────────
// Families of overlays generated from a few helpers, so a ton of variety
// stays cheap to author and every colour threads straight through. Particle
// scatters use a seeded PRNG, so the same stars/snow render in the preview and
// the flatten, stable across reloads.

function mulberry(seed: number): () => number {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function scatterSvg(
	seed: number,
	count: number,
	rMin: number,
	rMax: number,
	color: string,
	opMin: number,
	opMax: number
): string {
	const rnd = mulberry(seed);
	let s = '';
	for (let i = 0; i < count; i++) {
		const x = (rnd() * CANVAS_W).toFixed(1);
		const y = (rnd() * CANVAS_H).toFixed(1);
		const r = (rMin + rnd() * (rMax - rMin)).toFixed(1);
		const o = (opMin + rnd() * (opMax - opMin)).toFixed(2);
		s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${o}"/>`;
	}
	return fxSvg(s);
}

function bokehSvg(seed: number, count: number, rMin: number, rMax: number, color: string): string {
	const rnd = mulberry(seed);
	const defs = `<defs><radialGradient id="b"><stop offset="0%" stop-color="${color}" stop-opacity="0.85"/><stop offset="62%" stop-color="${color}" stop-opacity="0.22"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>`;
	let s = '';
	for (let i = 0; i < count; i++) {
		const x = (rnd() * CANVAS_W).toFixed(1);
		const y = (rnd() * CANVAS_H).toFixed(1);
		const r = (rMin + rnd() * (rMax - rMin)).toFixed(1);
		const o = (0.18 + rnd() * 0.5).toFixed(2);
		s += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#b)" opacity="${o}"/>`;
	}
	return fxSvg(s, defs);
}

function rainSvg(seed: number, slant: number, color: string): string {
	const rnd = mulberry(seed);
	let s = '';
	for (let i = 0; i < 110; i++) {
		const x = rnd() * (CANVAS_W + 80) - 40;
		const y = rnd() * CANVAS_H;
		const len = 10 + rnd() * 22;
		const o = (0.12 + rnd() * 0.32).toFixed(2);
		s += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - len * slant).toFixed(1)}" y2="${(y + len).toFixed(1)}" stroke="${color}" stroke-width="1.2" opacity="${o}"/>`;
	}
	return fxSvg(s);
}

function raysSvg(color: string): string {
	const cx = CANVAS_W * 0.22;
	const cy = -CANVAS_H * 0.15;
	let s = '';
	for (const b of [0.16, 0.3, 0.45, 0.62, 0.82]) {
		const x = CANVAS_W * b;
		s += `<polygon points="${cx},${cy} ${x - 26},${CANVAS_H} ${x + 26},${CANVAS_H}" fill="${color}" opacity="0.07"/>`;
	}
	return fxSvg(s);
}

function sunburstSvg(n: number, color: string): string {
	const cx = CANVAS_W / 2;
	const cy = CANVAS_H * 0.36;
	const R = Math.max(CANVAS_W, CANVAS_H);
	let s = '';
	for (let k = 0; k < n; k++) {
		const a0 = (k / n) * Math.PI * 2;
		const a1 = ((k + 0.46) / n) * Math.PI * 2;
		s += `<polygon points="${cx},${cy} ${(cx + Math.cos(a0) * R).toFixed(1)},${(cy + Math.sin(a0) * R).toFixed(1)} ${(cx + Math.cos(a1) * R).toFixed(1)},${(cy + Math.sin(a1) * R).toFixed(1)}" fill="${color}" opacity="0.06"/>`;
	}
	return fxSvg(s);
}

function gradAttrs(angle: number): string {
	const rad = ((angle - 90) * Math.PI) / 180;
	const dx = Math.cos(rad) / 2;
	const dy = Math.sin(rad) / 2;
	return `x1="${(0.5 - dx).toFixed(3)}" y1="${(0.5 - dy).toFixed(3)}" x2="${(0.5 + dx).toFixed(3)}" y2="${(0.5 + dy).toFixed(3)}"`;
}

function washSvg(angle: number, from: string, fop: number, to: string, top: number): string {
	const defs = `<defs><linearGradient id="w" ${gradAttrs(angle)}><stop offset="0%" stop-color="${from}" stop-opacity="${fop}"/><stop offset="100%" stop-color="${to}" stop-opacity="${top}"/></linearGradient></defs>`;
	return fxSvg(`<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#w)"/>`, defs);
}

function radialSvg(cx: string, cy: string, r: string, stops: string): string {
	const defs = `<defs><radialGradient id="r" cx="${cx}" cy="${cy}" r="${r}">${stops}</radialGradient></defs>`;
	return fxSvg(`<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#r)"/>`, defs);
}

function vignetteSvg(cx: string, cy: string, r: string, innerOff: number, color: string, outerOp: number): string {
	return radialSvg(
		cx,
		cy,
		r,
		`<stop offset="${innerOff}%" stop-color="${color}" stop-opacity="0"/><stop offset="100%" stop-color="${color}" stop-opacity="${outerOp}"/>`
	);
}

// ── colourless textures (feTurbulence + patterns) ─────────────────────
// These rasterise when the SVG is drawn, so the same noise bakes into the
// flatten. Their colour is luminance, not hue — they recolour through the layer
// tint, so they carry no editable stops.

function turbSvg(
	baseFreq: string,
	octaves: number,
	opts: { sat?: number; flatten?: boolean; gamma?: number } = {}
): string {
	const sat = opts.sat ?? 0;
	const gamma = opts.gamma
		? `<feComponentTransfer><feFuncR type="gamma" exponent="${opts.gamma}"/><feFuncG type="gamma" exponent="${opts.gamma}"/><feFuncB type="gamma" exponent="${opts.gamma}"/></feComponentTransfer>`
		: '';
	const flat =
		opts.flatten !== false
			? `<feComponentTransfer><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>`
			: '';
	const filter = `<filter id="t"><feTurbulence type="fractalNoise" baseFrequency="${baseFreq}" numOctaves="${octaves}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="${sat}"/>${gamma}${flat}</filter>`;
	return fxSvg(`<rect width="${CANVAS_W}" height="${CANVAS_H}" filter="url(#t)"/>`, `<defs>${filter}</defs>`);
}

function patternSvg(tile: number, content: string): string {
	const defs = `<defs><pattern id="p" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse">${content}</pattern></defs>`;
	return fxSvg(`<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#p)"/>`, defs);
}

// ── per-fx builders (colours threaded through) ────────────────────────

const glow = (c: string[]) =>
	radialSvg('50%', '20%', '62%', `<stop offset="0%" stop-color="${c[0]}" stop-opacity="0.85"/><stop offset="55%" stop-color="${c[1]}" stop-opacity="0.28"/><stop offset="100%" stop-color="${c[1]}" stop-opacity="0"/>`);

const spotlight = (c: string[]) =>
	radialSvg('50%', '42%', '62%', `<stop offset="0%" stop-color="${c[0]}" stop-opacity="0.85"/><stop offset="55%" stop-color="${c[0]}" stop-opacity="0.14"/><stop offset="100%" stop-color="${c[0]}" stop-opacity="0"/>`);

const groundglow = (c: string[]) =>
	radialSvg('50%', '102%', '72%', `<stop offset="0%" stop-color="${c[0]}" stop-opacity="0.85"/><stop offset="55%" stop-color="${c[1]}" stop-opacity="0.22"/><stop offset="100%" stop-color="${c[1]}" stop-opacity="0"/>`);

const leakWarm = (c: string[]) =>
	radialSvg('82%', '14%', '78%', `<stop offset="0%" stop-color="${c[0]}" stop-opacity="0.95"/><stop offset="42%" stop-color="${c[1]}" stop-opacity="0.4"/><stop offset="100%" stop-color="${c[2]}" stop-opacity="0"/>`);

const leakCool = (c: string[]) =>
	radialSvg('16%', '88%', '80%', `<stop offset="0%" stop-color="${c[0]}" stop-opacity="0.9"/><stop offset="44%" stop-color="${c[1]}" stop-opacity="0.34"/><stop offset="100%" stop-color="${c[2]}" stop-opacity="0"/>`);

const prism = (c: string[]) =>
	fxSvg(
		`<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#pr)"/>`,
		`<defs><linearGradient id="pr" ${gradAttrs(120)}><stop offset="0%" stop-color="${c[0]}" stop-opacity="0.5"/><stop offset="35%" stop-color="${c[1]}" stop-opacity="0.4"/><stop offset="65%" stop-color="${c[2]}" stop-opacity="0.4"/><stop offset="100%" stop-color="${c[3]}" stop-opacity="0.5"/></linearGradient></defs>`
	);

const fog = (c: string[]) =>
	fxSvg(
		`<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#f)"/><ellipse cx="180" cy="300" rx="240" ry="60" fill="${c[0]}" opacity="0.4"/><ellipse cx="470" cy="360" rx="240" ry="56" fill="${c[0]}" opacity="0.4"/>`,
		`<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${c[0]}" stop-opacity="0"/><stop offset="60%" stop-color="${c[0]}" stop-opacity="0.5"/><stop offset="100%" stop-color="${c[0]}" stop-opacity="0.9"/></linearGradient></defs>`
	);

const mist = (c: string[]) =>
	radialSvg('50%', '78%', '90%', `<stop offset="0%" stop-color="${c[0]}" stop-opacity="0"/><stop offset="62%" stop-color="${c[0]}" stop-opacity="0.45"/><stop offset="100%" stop-color="${c[0]}" stop-opacity="0.85"/>`);

const haze = (c: string[]) => washSvg(180, c[0], 0.4, c[0], 0);

const sparkles = (c: string[]) =>
	fxSvg(
		`<g fill="${c[0]}"><circle cx="70" cy="60" r="3"/><circle cx="150" cy="120" r="2"/><circle cx="240" cy="44" r="2.5"/><circle cx="320" cy="96" r="2"/><circle cx="410" cy="56" r="3"/><circle cx="500" cy="130" r="2"/><circle cx="560" cy="70" r="2.5"/><circle cx="600" cy="180" r="2"/><circle cx="110" cy="220" r="2"/><circle cx="360" cy="200" r="2.5"/><circle cx="470" cy="240" r="2"/><circle cx="200" cy="300" r="2"/></g>` +
			`<g fill="${c[0]}"><path d="M280 150 l4 12 12 4 -12 4 -4 12 -4 -12 -12 -4 12 -4 z"/><path d="M520 300 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 z"/><path d="M90 340 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 z"/></g>`
	);

const aurora = (c: string[]) =>
	fxSvg(
		`<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#au)"/><ellipse cx="220" cy="200" rx="260" ry="120" fill="${c[0]}" opacity="0.18"/><ellipse cx="430" cy="250" rx="240" ry="110" fill="${c[1]}" opacity="0.16"/>`,
		`<defs><radialGradient id="au" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="${c[0]}" stop-opacity="0.3"/><stop offset="60%" stop-color="${c[1]}" stop-opacity="0.18"/><stop offset="100%" stop-color="#3a356b" stop-opacity="0"/></radialGradient></defs>`
	);

const vignette = (c: string[]) =>
	radialSvg('50%', '46%', '72%', `<stop offset="52%" stop-color="${c[0]}" stop-opacity="0"/><stop offset="100%" stop-color="${c[0]}" stop-opacity="0.82"/>`);

// ── registries ──────────────────────────────────────────────────────

type FxBuild = (colors: string[]) => string;

// A recolourable overlay. Overlays are always full-bleed; this trims the
// repetition and derives the default src from the recipe's default stops.
function fx(
	id: string,
	name: string,
	group: OverlayGroup,
	colors: string[],
	labels: string[] | undefined,
	build: FxBuild,
	blend?: ImageAsset['defaultBlend'],
	opacity?: number
): ImageAsset {
	return {
		id,
		name,
		src: svgUrl(build(colors)),
		w: CANVAS_W,
		h: CANVAS_H,
		fit: 'cover',
		group,
		defaultBlend: blend,
		defaultOpacity: opacity,
		colors,
		colorLabels: labels,
		build
	};
}

export const imageAssets: ImageAsset[] = [
	// ── fx · light ──
	fx('glow', 'glow', 'light', ['#fff6dd', '#ffe7b0'], ['core', 'halo'], glow, 'screen'),
	fx('godrays', 'god rays', 'light', ['#ffffff'], ['rays'], (c) => raysSvg(c[0]), 'screen', 0.6),
	fx('sunburst', 'sunburst', 'light', ['#ffffff'], ['rays'], (c) => sunburstSvg(48, c[0]), 'screen', 0.5),
	fx('bokeh', 'bokeh', 'light', ['#ffffff'], ['light'], (c) => bokehSvg(5, 26, 14, 48, c[0]), 'screen', 0.85),
	fx('spotlight', 'spotlight', 'light', ['#ffffff'], ['light'], spotlight, 'screen', 0.7),
	fx('groundglow', 'ground glow', 'light', ['#ffe7c2', '#ffd0a0'], ['core', 'edge'], groundglow, 'screen', 0.75),
	fx('prism', 'prism', 'light', ['#ff6b9d', '#ffd36b', '#6bffb0', '#6bb8ff'], ['1', '2', '3', '4'], prism, 'screen', 0.4),
	fx('leak-warm', 'warm leak', 'light', ['#ffe1ad', '#ff8f6b', '#ff7a8f'], ['core', 'mid', 'edge'], leakWarm, 'screen', 0.8),
	fx('leak-cool', 'cool leak', 'light', ['#bdeaff', '#7aa6ff', '#9b7aff'], ['core', 'mid', 'edge'], leakCool, 'screen', 0.8),
	// ── fx · weather ──
	fx('fog', 'fog', 'weather', ['#f3eef6'], ['fog'], fog, undefined, 0.85),
	fx('mist', 'mist', 'weather', ['#f3eef6'], ['mist'], mist, 'screen', 0.8),
	fx('haze', 'haze', 'weather', ['#ffffff'], ['haze'], haze, 'screen', 0.55),
	fx('snow', 'snow', 'weather', ['#ffffff'], ['snow'], (c) => scatterSvg(7, 90, 1, 3.6, c[0], 0.45, 1), 'screen', 0.9),
	fx('rain', 'rain', 'weather', ['#dcefff'], ['rain'], (c) => rainSvg(11, 0.34, c[0]), 'screen', 0.5),
	fx('embers', 'embers', 'weather', ['#ffb066'], ['ember'], (c) => scatterSvg(21, 60, 0.8, 2.8, c[0], 0.3, 0.95), 'screen', 0.9),
	fx('dust', 'dust motes', 'weather', ['#fff3d8'], ['dust'], (c) => scatterSvg(33, 75, 0.6, 2, c[0], 0.15, 0.6), 'screen', 0.8),
	fx('sparkles', 'sparkles', 'weather', ['#fff7d8'], ['sparkle'], sparkles, 'screen'),
	fx('starfield', 'starfield', 'weather', ['#ffffff'], ['star'], (c) => scatterSvg(13, 130, 0.4, 1.8, c[0], 0.3, 1), 'screen'),
	fx('aurora', 'aurora', 'weather', ['#7fe6c4', '#9bb6ff'], ['green', 'blue'], aurora, 'screen', 0.75),
	// ── fx · colour wash ──
	fx('golden', 'golden hour', 'wash', ['#ffe0a0', '#ff9e6b'], ['from', 'to'], (c) => washSvg(180, c[0], 0.5, c[1], 0.34), 'soft-light', 0.8),
	fx('sunsetwash', 'sunset', 'wash', ['#ffb07c', '#ff6f91'], ['from', 'to'], (c) => washSvg(180, c[0], 0.5, c[1], 0.4), 'soft-light', 0.75),
	fx('tealorange', 'teal & orange', 'wash', ['#15a89e', '#ff9a52'], ['from', 'to'], (c) => washSvg(90, c[0], 0.45, c[1], 0.4), 'soft-light', 0.7),
	fx('pinkblue', 'pink & blue', 'wash', ['#ff9ecb', '#86b8ff'], ['from', 'to'], (c) => washSvg(160, c[0], 0.46, c[1], 0.4), 'soft-light', 0.7),
	fx('purplehaze', 'purple haze', 'wash', ['#caa0ff', '#5b3fae'], ['from', 'to'], (c) => washSvg(180, c[0], 0.5, c[1], 0.3), 'overlay', 0.6),
	fx('cyber', 'cyber', 'wash', ['#ff4fd8', '#3ad0ff'], ['from', 'to'], (c) => washSvg(120, c[0], 0.4, c[1], 0.42), 'soft-light', 0.65),
	fx('mintwash', 'mint', 'wash', ['#bff5d8', '#5fc8b0'], ['from', 'to'], (c) => washSvg(180, c[0], 0.5, c[1], 0.3), 'soft-light', 0.6),
	fx('coolshade', 'cool shade', 'wash', ['#a6c0ff', '#5a6fae'], ['from', 'to'], (c) => washSvg(180, c[0], 0.45, c[1], 0.3), 'soft-light', 0.6),
	// ── fx · grain & texture (colourless — recolour via tint) ──
	fx('grain', 'grain', 'grain', [], undefined, () => turbSvg('0.82', 2), 'soft-light', 0.55),
	fx('finegrain', 'fine grain', 'grain', [], undefined, () => turbSvg('1.3', 2), 'soft-light', 0.45),
	fx('heavygrain', 'heavy grain', 'grain', [], undefined, () => turbSvg('0.55', 3, { gamma: 0.6 }), 'soft-light', 0.6),
	fx('colornoise', 'colour noise', 'grain', [], undefined, () => turbSvg('0.7', 2, { sat: 1, flatten: false }), 'overlay', 0.35),
	fx('paper', 'paper', 'grain', [], undefined, () => turbSvg('0.013 0.017', 3), 'multiply', 0.4),
	fx('mottle', 'mottle', 'grain', [], undefined, () => turbSvg('0.02 0.03', 3), 'multiply', 0.35),
	fx('fibers', 'fibers', 'grain', [], undefined, () => turbSvg('0.012 0.2', 2), 'soft-light', 0.4),
	fx('scanlines', 'scanlines', 'grain', [], undefined, () => patternSvg(4, `<rect width="4" height="2" fill="#000"/>`), 'soft-light', 0.35),
	fx('halftone', 'halftone', 'grain', [], undefined, () => patternSvg(11, `<circle cx="5.5" cy="5.5" r="2.4" fill="#000"/>`), 'soft-light', 0.3),
	fx('crosshatch', 'crosshatch', 'grain', [], undefined, () => patternSvg(8, `<path d="M0 0 L8 8 M8 0 L0 8" stroke="#000" stroke-width="0.7"/>`), 'soft-light', 0.35),
	fx('grid', 'grid', 'grain', [], undefined, () => patternSvg(18, `<path d="M18 0 H0 V18" stroke="#000" stroke-width="0.6" fill="none"/>`), 'soft-light', 0.3),
	fx('grunge', 'grunge', 'grain', [], undefined, () => turbSvg('0.045', 4, { gamma: 2.4 }), 'multiply', 0.4),
	// ── fx · vignette ──
	fx('vignette', 'vignette', 'vignette', ['#160a18'], ['shade'], vignette, 'multiply'),
	fx('soft-vignette', 'soft vignette', 'vignette', ['#160a18'], ['shade'], (c) => vignetteSvg('50%', '46%', '76%', 55, c[0], 0.55), 'multiply', 0.8),
	fx('heavy-vignette', 'heavy vignette', 'vignette', ['#0e0712'], ['shade'], (c) => vignetteSvg('50%', '46%', '72%', 34, c[0], 0.92), 'multiply', 0.9),
	fx('topshade', 'top shade', 'vignette', ['#0e0712'], ['shade'], (c) => washSvg(180, c[0], 0.55, c[0], 0), 'multiply', 0.6),
	fx('bottomshade', 'bottom shade', 'vignette', ['#0e0712'], ['shade'], (c) => washSvg(0, c[0], 0.55, c[0], 0), 'multiply', 0.6)
];

const imageAssetMap = new Map(imageAssets.map((a) => [a.id, a]));

export function imageAssetById(id: string): ImageAsset | undefined {
	return imageAssetMap.get(id);
}

export function overlayAssets(group: OverlayGroup): ImageAsset[] {
	return imageAssets.filter((a) => a.group === group);
}

// Regenerate an fx's src from a new set of colours — the studio calls this when
// a stop is edited. Returns null if the id is unknown (e.g. a stale saved blob).
export function recolorFxSrc(id: string, colors: string[]): string | null {
	const a = imageAssetById(id);
	if (!a) return null;
	return svgUrl(a.build(colors));
}

// Turn a library overlay into a fresh layer, honouring its fit / blend hints and
// carrying a recipe so its colours stay editable (when it has any).
export function layerFromAsset(asset: ImageAsset): Layer {
	const scale = asset.fit === 'cover' ? coverScale(asset.w, asset.h) : undefined;
	return createImageLayer({
		src: asset.src,
		naturalW: asset.w,
		naturalH: asset.h,
		name: asset.name,
		scale,
		opacity: asset.defaultOpacity,
		blend: asset.defaultBlend,
		recipe: asset.colors.length ? { id: asset.id, colors: asset.colors.slice() } : null
	});
}

// ── backdrop fills ──────────────────────────────────────────────────

export const fillAssets: FillAsset[] = [
	{ id: 'day', name: 'day sky', fill: { type: 'linear', from: '#bfe4ff', to: '#eaf6ff', angle: 180 } },
	{ id: 'dusk', name: 'dusk', fill: { type: 'linear', from: '#ffd2a6', to: '#9a7bc4', angle: 180 } },
	{ id: 'sunset', name: 'sunset', fill: { type: 'linear', from: '#ffb07c', to: '#ff6f91', angle: 180 } },
	{ id: 'night', name: 'night', fill: { type: 'linear', from: '#1d2350', to: '#4b3d77', angle: 180 } },
	{ id: 'meadow', name: 'meadow', fill: { type: 'linear', from: '#cdeccb', to: '#86c98a', angle: 180 } },
	{ id: 'water', name: 'water', fill: { type: 'linear', from: '#73c4d6', to: '#2f6f9e', angle: 180 } },
	{ id: 'aurora', name: 'aurora', fill: { type: 'radial', from: '#8fe0c0', to: '#33356b' } },
	{ id: 'rose', name: 'rose', fill: { type: 'solid', color: '#f6c6db' } },
	{ id: 'vellum', name: 'vellum', fill: { type: 'solid', color: '#fff8fc' } },
	{ id: 'sand', name: 'sand', fill: { type: 'solid', color: '#ecdcb6' } },
	{ id: 'lilac', name: 'lilac', fill: { type: 'solid', color: '#d7c6ee' } },
	{ id: 'charcoal', name: 'charcoal', fill: { type: 'solid', color: '#2b2433' } }
];
