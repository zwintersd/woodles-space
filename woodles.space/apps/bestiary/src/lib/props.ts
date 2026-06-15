// The studio's built-in art kit. Everything here is inline SVG — no binary
// assets to commit, and every stamp scales cleanly to any size. Props are
// grouped into trays (nature, sky, overlays); fills are backdrop colours and
// gradients; scenes are one-click starting stacks built from the two.
//
// Each image asset is a self-contained <svg> with explicit width/height so its
// intrinsic size is deterministic when loaded into an <img> or drawn to canvas.

import {
	createFillLayer,
	createImageLayer,
	coverScale,
	type Fill,
	type Layer,
	CANVAS_W,
	CANVAS_H
} from './composer';

export type AssetTray = 'nature' | 'sky' | 'overlay';

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
	tray: AssetTray;
	src: string;
	w: number;
	h: number;
	// 'cover' stamps land sized to fill the whole canvas (overlays, skies).
	fit: 'fit' | 'cover';
	defaultOpacity?: number;
	defaultBlend?: Parameters<typeof createImageLayer>[0]['blend'];
	// only on overlays — which fx header it sits under
	group?: OverlayGroup;
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

// ── the stamps ────────────────────────────────────────────────────────
// Stylised, layered vector shapes — they read at any size and sit happily on
// top of one another. Greens and browns for the ground, warm/cool for the sky.

const pine = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="224" viewBox="0 0 160 224">
<rect x="70" y="172" width="20" height="48" rx="5" fill="#7c5638"/>
<polygon points="80,8 132,92 28,92" fill="#4f8f5e"/>
<polygon points="80,8 132,92 28,92" fill="#3f7a4e" opacity="0.0"/>
<polygon points="80,52 142,142 18,142" fill="#56995f"/>
<polygon points="80,104 152,192 8,192" fill="#5fa468"/>
<polygon points="80,8 80,92 28,92" fill="#000" opacity="0.07"/>
<polygon points="80,52 80,142 18,142" fill="#000" opacity="0.07"/>
<polygon points="80,104 80,192 8,192" fill="#000" opacity="0.07"/>
</svg>`;

const roundTree = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="216" viewBox="0 0 180 216">
<rect x="80" y="150" width="20" height="60" rx="6" fill="#86603f"/>
<circle cx="60" cy="92" r="48" fill="#5aa066"/>
<circle cx="120" cy="86" r="52" fill="#62ab6d"/>
<circle cx="92" cy="62" r="46" fill="#6cb676"/>
<circle cx="74" cy="74" r="30" fill="#7cc285" opacity="0.7"/>
</svg>`;

const bush = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="140" viewBox="0 0 220 140">
<ellipse cx="62" cy="96" rx="58" ry="42" fill="#5a9d63"/>
<ellipse cx="156" cy="96" rx="60" ry="44" fill="#5fa468"/>
<ellipse cx="110" cy="74" rx="60" ry="48" fill="#69b372"/>
<ellipse cx="96" cy="70" rx="26" ry="20" fill="#7cc285" opacity="0.6"/>
</svg>`;

const grass = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
<path d="M40 148 C30 100 20 80 8 58" stroke="#6cb676" stroke-width="9" fill="none" stroke-linecap="round"/>
<path d="M70 148 C66 96 72 70 58 40" stroke="#5fa468" stroke-width="10" fill="none" stroke-linecap="round"/>
<path d="M104 150 C100 92 100 56 100 26" stroke="#69b372" stroke-width="11" fill="none" stroke-linecap="round"/>
<path d="M140 148 C140 96 130 70 150 42" stroke="#5fa468" stroke-width="10" fill="none" stroke-linecap="round"/>
<path d="M170 148 C176 104 184 84 192 60" stroke="#6cb676" stroke-width="9" fill="none" stroke-linecap="round"/>
</svg>`;

const fern = `<svg xmlns="http://www.w3.org/2000/svg" width="170" height="210" viewBox="0 0 170 210">
<path d="M85 206 C85 150 85 70 85 14" stroke="#4f8f5e" stroke-width="7" fill="none" stroke-linecap="round"/>
<g stroke="#5fa468" stroke-width="6" fill="none" stroke-linecap="round">
<path d="M85 60 C60 52 40 56 22 44"/><path d="M85 60 C110 52 130 56 148 44"/>
<path d="M85 96 C62 90 44 94 28 84"/><path d="M85 96 C108 90 126 94 142 84"/>
<path d="M85 132 C66 128 50 132 36 124"/><path d="M85 132 C104 128 120 132 134 124"/>
<path d="M85 166 C70 164 58 168 48 162"/><path d="M85 166 C100 164 112 168 122 162"/>
</g>
</svg>`;

const flower = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="200" viewBox="0 0 150 200">
<path d="M75 198 C75 150 75 110 75 86" stroke="#5fa468" stroke-width="8" fill="none" stroke-linecap="round"/>
<path d="M75 150 C52 142 42 128 40 110" stroke="#5fa468" stroke-width="7" fill="none" stroke-linecap="round"/>
<g fill="#ef9bbf"><circle cx="75" cy="40" r="22"/><circle cx="47" cy="60" r="22"/><circle cx="103" cy="60" r="22"/><circle cx="58" cy="92" r="22"/><circle cx="92" cy="92" r="22"/></g>
<circle cx="75" cy="66" r="18" fill="#f5d76e"/>
</svg>`;

const mushroom = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="180" viewBox="0 0 160 180">
<path d="M58 96 C58 150 50 168 50 176 L110 176 C110 168 102 150 102 96 Z" fill="#f3e6d6"/>
<path d="M14 96 C14 50 44 18 80 18 C116 18 146 50 146 96 Z" fill="#e0584f"/>
<g fill="#fff" opacity="0.92"><circle cx="56" cy="56" r="10"/><circle cx="96" cy="48" r="8"/><circle cx="110" cy="78" r="9"/><circle cx="40" cy="82" r="7"/><circle cx="80" cy="74" r="6"/></g>
</svg>`;

const rock = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
<path d="M14 140 C6 96 40 40 92 36 C150 32 196 80 188 130 C184 146 24 148 14 140 Z" fill="#9aa3ad"/>
<path d="M92 36 C150 32 196 80 188 130 C160 120 120 108 92 36 Z" fill="#000" opacity="0.1"/>
<path d="M52 64 C70 56 92 54 108 60" stroke="#fff" stroke-width="5" fill="none" opacity="0.4" stroke-linecap="round"/>
</svg>`;

const log = `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="120" viewBox="0 0 230 120">
<rect x="28" y="28" width="184" height="64" rx="32" fill="#8a6240"/>
<rect x="28" y="28" width="184" height="22" rx="11" fill="#9c7150" opacity="0.6"/>
<ellipse cx="40" cy="60" rx="22" ry="32" fill="#a87a55"/>
<ellipse cx="40" cy="60" rx="14" ry="21" fill="#8a6240"/>
<ellipse cx="40" cy="60" rx="6" ry="9" fill="#6f4d31"/>
</svg>`;

const hill = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="180" viewBox="0 0 360 180">
<path d="M0 180 C70 70 130 40 180 40 C230 40 290 70 360 180 Z" fill="#74b873"/>
<path d="M0 180 C70 70 130 40 180 40 C150 80 90 130 0 180 Z" fill="#fff" opacity="0.12"/>
</svg>`;

const mountain = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="230" viewBox="0 0 360 230">
<polygon points="120,40 250,228 0,228" fill="#8d93b8"/>
<polygon points="240,8 360,228 130,228" fill="#9ea4c6"/>
<polygon points="240,8 286,84 196,84" fill="#fff" opacity="0.9"/>
<polygon points="120,40 158,104 82,104" fill="#fff" opacity="0.85"/>
<polygon points="240,8 360,228 240,228" fill="#000" opacity="0.08"/>
</svg>`;

const sun = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
<g stroke="#f6c95a" stroke-width="9" stroke-linecap="round">
<line x1="110" y1="10" x2="110" y2="40"/><line x1="110" y1="180" x2="110" y2="210"/>
<line x1="10" y1="110" x2="40" y2="110"/><line x1="180" y1="110" x2="210" y2="110"/>
<line x1="39" y1="39" x2="60" y2="60"/><line x1="160" y1="160" x2="181" y2="181"/>
<line x1="181" y1="39" x2="160" y2="60"/><line x1="60" y1="160" x2="39" y2="181"/>
</g>
<circle cx="110" cy="110" r="58" fill="#fcd86a"/>
<circle cx="110" cy="110" r="58" fill="#fff" opacity="0.18"/>
</svg>`;

const crescent = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
<defs><mask id="c"><rect width="180" height="180" fill="#fff"/><circle cx="118" cy="74" r="62" fill="#000"/></mask></defs>
<circle cx="86" cy="90" r="74" fill="#f3ecbf" mask="url(#c)"/>
</svg>`;

const fullMoon = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
<circle cx="90" cy="90" r="76" fill="#eef0d8"/>
<g fill="#000" opacity="0.07"><circle cx="66" cy="70" r="16"/><circle cx="112" cy="98" r="22"/><circle cx="78" cy="118" r="11"/><circle cx="120" cy="56" r="9"/></g>
</svg>`;

const star = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 100 100">
<polygon points="50,4 61,38 97,38 68,60 79,96 50,73 21,96 32,60 3,38 39,38" fill="#f7e08a"/>
</svg>`;

const cloud = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="150" viewBox="0 0 260 150">
<g fill="#ffffff">
<ellipse cx="78" cy="98" rx="58" ry="40"/><ellipse cx="150" cy="104" rx="68" ry="44"/>
<ellipse cx="120" cy="70" rx="56" ry="44"/><ellipse cx="186" cy="78" rx="44" ry="36"/>
<rect x="40" y="96" width="180" height="36" rx="18"/>
</g>
<ellipse cx="120" cy="70" rx="40" ry="28" fill="#fff"/>
</svg>`;

// ── overlays (full-bleed, canvas aspect) ───────────────────────────────

const vignette = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
<defs><radialGradient id="v" cx="50%" cy="46%" r="72%"><stop offset="52%" stop-color="#1a0f1d" stop-opacity="0"/><stop offset="100%" stop-color="#160a18" stop-opacity="0.82"/></radialGradient></defs>
<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#v)"/>
</svg>`;

const glow = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
<defs><radialGradient id="g" cx="50%" cy="20%" r="62%"><stop offset="0%" stop-color="#fff6dd" stop-opacity="0.85"/><stop offset="55%" stop-color="#ffe7b0" stop-opacity="0.28"/><stop offset="100%" stop-color="#ffe7b0" stop-opacity="0"/></radialGradient></defs>
<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#g)"/>
</svg>`;

const fog = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity="0"/><stop offset="60%" stop-color="#f3eef6" stop-opacity="0.5"/><stop offset="100%" stop-color="#f3eef6" stop-opacity="0.9"/></linearGradient></defs>
<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#f)"/>
<ellipse cx="180" cy="300" rx="240" ry="60" fill="#fff" opacity="0.4"/>
<ellipse cx="470" cy="360" rx="240" ry="56" fill="#fff" opacity="0.4"/>
</svg>`;

const sparkles = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
<g fill="#fff7d8">
<circle cx="70" cy="60" r="3"/><circle cx="150" cy="120" r="2"/><circle cx="240" cy="44" r="2.5"/>
<circle cx="320" cy="96" r="2"/><circle cx="410" cy="56" r="3"/><circle cx="500" cy="130" r="2"/>
<circle cx="560" cy="70" r="2.5"/><circle cx="600" cy="180" r="2"/><circle cx="110" cy="220" r="2"/>
<circle cx="360" cy="200" r="2.5"/><circle cx="470" cy="240" r="2"/><circle cx="200" cy="300" r="2"/>
</g>
<g fill="#ffffff"><path d="M280 150 l4 12 12 4 -12 4 -4 12 -4 -12 -12 -4 12 -4 z"/><path d="M520 300 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 z"/><path d="M90 340 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 z"/></g>
</svg>`;

// ── grain, texture & light (feTurbulence + patterns) ──────────────────
// These rasterise when the SVG is drawn, so the same noise bakes into the
// flatten. Paired with a low opacity and a soft blend they read as film grain,
// paper, scanlines, or a light leak.

const grain = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer></filter>
<rect width="${CANVAS_W}" height="${CANVAS_H}" filter="url(#g)"/>
</svg>`;

const paper = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
<filter id="p"><feTurbulence type="fractalNoise" baseFrequency="0.013 0.017" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer></filter>
<rect width="${CANVAS_W}" height="${CANVAS_H}" filter="url(#p)"/>
</svg>`;

const scanlines = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
<defs><pattern id="s" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000"/></pattern></defs>
<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#s)"/>
</svg>`;

const halftone = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
<defs><pattern id="h" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="5.5" cy="5.5" r="2.4" fill="#000"/></pattern></defs>
<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#h)"/>
</svg>`;

const leakWarm = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
<defs><radialGradient id="lw" cx="82%" cy="14%" r="78%"><stop offset="0%" stop-color="#ffe1ad" stop-opacity="0.95"/><stop offset="42%" stop-color="#ff8f6b" stop-opacity="0.4"/><stop offset="100%" stop-color="#ff7a8f" stop-opacity="0"/></radialGradient></defs>
<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#lw)"/>
</svg>`;

const leakCool = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
<defs><radialGradient id="lc" cx="16%" cy="88%" r="80%"><stop offset="0%" stop-color="#bdeaff" stop-opacity="0.9"/><stop offset="44%" stop-color="#7aa6ff" stop-opacity="0.34"/><stop offset="100%" stop-color="#9b7aff" stop-opacity="0"/></radialGradient></defs>
<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#lc)"/>
</svg>`;

// ── fx builders ───────────────────────────────────────────────────────
// Families of overlays generated from a few helpers, so a ton of variety
// stays cheap to author. Particle scatters use a seeded PRNG, so the same
// stars/snow render in the preview and the flatten, stable across reloads.

function mulberry(seed: number): () => number {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function fxSvg(inner: string, defs = ''): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">${defs}${inner}</svg>`;
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

function bokehSvg(seed: number, count: number, rMin: number, rMax: number): string {
	const rnd = mulberry(seed);
	const defs = `<defs><radialGradient id="b"><stop offset="0%" stop-color="#fff" stop-opacity="0.85"/><stop offset="62%" stop-color="#fff" stop-opacity="0.22"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`;
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

function rainSvg(seed: number, slant: number): string {
	const rnd = mulberry(seed);
	let s = '';
	for (let i = 0; i < 110; i++) {
		const x = rnd() * (CANVAS_W + 80) - 40;
		const y = rnd() * CANVAS_H;
		const len = 10 + rnd() * 22;
		const o = (0.12 + rnd() * 0.32).toFixed(2);
		s += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - len * slant).toFixed(1)}" y2="${(y + len).toFixed(1)}" stroke="#dcefff" stroke-width="1.2" opacity="${o}"/>`;
	}
	return fxSvg(s);
}

function raysSvg(): string {
	const cx = CANVAS_W * 0.22;
	const cy = -CANVAS_H * 0.15;
	let s = '';
	for (const b of [0.16, 0.3, 0.45, 0.62, 0.82]) {
		const x = CANVAS_W * b;
		s += `<polygon points="${cx},${cy} ${x - 26},${CANVAS_H} ${x + 26},${CANVAS_H}" fill="#fff" opacity="0.07"/>`;
	}
	return fxSvg(s);
}

function sunburstSvg(n: number): string {
	const cx = CANVAS_W / 2;
	const cy = CANVAS_H * 0.36;
	const R = Math.max(CANVAS_W, CANVAS_H);
	let s = '';
	for (let k = 0; k < n; k++) {
		const a0 = (k / n) * Math.PI * 2;
		const a1 = ((k + 0.46) / n) * Math.PI * 2;
		s += `<polygon points="${cx},${cy} ${(cx + Math.cos(a0) * R).toFixed(1)},${(cy + Math.sin(a0) * R).toFixed(1)} ${(cx + Math.cos(a1) * R).toFixed(1)},${(cy + Math.sin(a1) * R).toFixed(1)}" fill="#fff" opacity="0.06"/>`;
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

function patternSvg(tile: number, content: string, transform = ''): string {
	const t = transform ? ` patternTransform="${transform}"` : '';
	const defs = `<defs><pattern id="p" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse"${t}>${content}</pattern></defs>`;
	return fxSvg(`<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#p)"/>`, defs);
}

// god-rays / spotlights / weather / washes / textures built from the above
const godrays = raysSvg();
const sunburst = sunburstSvg(48);
const bokeh = bokehSvg(5, 26, 14, 48);
const spotlight = radialSvg('50%', '42%', '62%', `<stop offset="0%" stop-color="#fff" stop-opacity="0.85"/><stop offset="55%" stop-color="#fff" stop-opacity="0.14"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/>`);
const groundglow = radialSvg('50%', '102%', '72%', `<stop offset="0%" stop-color="#ffe7c2" stop-opacity="0.85"/><stop offset="55%" stop-color="#ffd0a0" stop-opacity="0.22"/><stop offset="100%" stop-color="#ffd0a0" stop-opacity="0"/>`);
const prism = fxSvg(
	`<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#pr)"/>`,
	`<defs><linearGradient id="pr" ${gradAttrs(120)}><stop offset="0%" stop-color="#ff6b9d" stop-opacity="0.5"/><stop offset="35%" stop-color="#ffd36b" stop-opacity="0.4"/><stop offset="65%" stop-color="#6bffb0" stop-opacity="0.4"/><stop offset="100%" stop-color="#6bb8ff" stop-opacity="0.5"/></linearGradient></defs>`
);

const mist = radialSvg('50%', '78%', '90%', `<stop offset="0%" stop-color="#fff" stop-opacity="0.0"/><stop offset="62%" stop-color="#f3eef6" stop-opacity="0.45"/><stop offset="100%" stop-color="#f3eef6" stop-opacity="0.85"/>`);
const haze = washSvg(180, '#ffffff', 0.4, '#ffffff', 0);
const snow = scatterSvg(7, 90, 1, 3.6, '#ffffff', 0.45, 1);
const rain = rainSvg(11, 0.34);
const embers = scatterSvg(21, 60, 0.8, 2.8, '#ffb066', 0.3, 0.95);
const dust = scatterSvg(33, 75, 0.6, 2, '#fff3d8', 0.15, 0.6);
const starfield = scatterSvg(13, 130, 0.4, 1.8, '#ffffff', 0.3, 1);
const aurora = fxSvg(
	`<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#au)"/><ellipse cx="220" cy="200" rx="260" ry="120" fill="#8fe6c0" opacity="0.18"/><ellipse cx="430" cy="250" rx="240" ry="110" fill="#9bb6ff" opacity="0.16"/>`,
	`<defs><radialGradient id="au" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="#7fe6c4" stop-opacity="0.3"/><stop offset="60%" stop-color="#6f7bd6" stop-opacity="0.18"/><stop offset="100%" stop-color="#3a356b" stop-opacity="0"/></radialGradient></defs>`
);

const golden = washSvg(180, '#ffe0a0', 0.5, '#ff9e6b', 0.34);
const tealorange = washSvg(90, '#15a89e', 0.45, '#ff9a52', 0.4);
const pinkblue = washSvg(160, '#ff9ecb', 0.46, '#86b8ff', 0.4);
const purplehaze = washSvg(180, '#caa0ff', 0.5, '#5b3fae', 0.3);
const cyber = washSvg(120, '#ff4fd8', 0.4, '#3ad0ff', 0.42);
const mintwash = washSvg(180, '#bff5d8', 0.5, '#5fc8b0', 0.3);
const sunsetwash = washSvg(180, '#ffb07c', 0.5, '#ff6f91', 0.4);
const coolshade = washSvg(180, '#a6c0ff', 0.45, '#5a6fae', 0.3);

const finegrain = turbSvg('1.3', 2);
const heavygrain = turbSvg('0.55', 3, { gamma: 0.6 });
const colornoise = turbSvg('0.7', 2, { sat: 1, flatten: false });
const mottle = turbSvg('0.02 0.03', 3);
const fibers = turbSvg('0.012 0.2', 2);
const grunge = turbSvg('0.045', 4, { gamma: 2.4 });
const crosshatch = patternSvg(8, `<path d="M0 0 L8 8 M8 0 L0 8" stroke="#000" stroke-width="0.7"/>`);
const grid = patternSvg(18, `<path d="M18 0 H0 V18" stroke="#000" stroke-width="0.6" fill="none"/>`);

const softVignette = vignetteSvg('50%', '46%', '76%', 55, '#160a18', 0.55);
const heavyVignette = vignetteSvg('50%', '46%', '72%', 34, '#0e0712', 0.92);
const topshade = washSvg(180, '#0e0712', 0.55, '#0e0712', 0);
const bottomshade = washSvg(0, '#0e0712', 0.55, '#0e0712', 0);

// ── registries ──────────────────────────────────────────────────────

function img(
	id: string,
	name: string,
	tray: AssetTray,
	svg: string,
	w: number,
	h: number,
	extra: Partial<ImageAsset> = {}
): ImageAsset {
	return { id, name, tray, src: svgUrl(svg), w, h, fit: 'fit', ...extra };
}

// Overlays are always full-bleed; this just trims the repetition.
function ov(
	id: string,
	name: string,
	svg: string,
	group: OverlayGroup,
	blend?: ImageAsset['defaultBlend'],
	opacity?: number
): ImageAsset {
	return {
		id,
		name,
		tray: 'overlay',
		src: svgUrl(svg),
		w: CANVAS_W,
		h: CANVAS_H,
		fit: 'cover',
		group,
		defaultBlend: blend,
		defaultOpacity: opacity
	};
}

export const imageAssets: ImageAsset[] = [
	img('pine', 'pine', 'nature', pine, 160, 224),
	img('tree', 'round tree', 'nature', roundTree, 180, 216),
	img('bush', 'bush', 'nature', bush, 220, 140),
	img('grass', 'grass', 'nature', grass, 200, 150),
	img('fern', 'fern', 'nature', fern, 170, 210),
	img('flower', 'flower', 'nature', flower, 150, 200),
	img('mushroom', 'mushroom', 'nature', mushroom, 160, 180),
	img('rock', 'rock', 'nature', rock, 200, 150),
	img('log', 'log', 'nature', log, 230, 120),
	img('hill', 'hill', 'nature', hill, 360, 180),
	img('mountain', 'mountain', 'nature', mountain, 360, 230),
	img('sun', 'sun', 'sky', sun, 220, 220),
	img('crescent', 'crescent', 'sky', crescent, 180, 180),
	img('moon', 'full moon', 'sky', fullMoon, 180, 180),
	img('star', 'star', 'sky', star, 140, 140),
	img('cloud', 'cloud', 'sky', cloud, 260, 150),
	// ── fx · light ──
	ov('glow', 'glow', glow, 'light', 'screen'),
	ov('godrays', 'god rays', godrays, 'light', 'screen', 0.6),
	ov('sunburst', 'sunburst', sunburst, 'light', 'screen', 0.5),
	ov('bokeh', 'bokeh', bokeh, 'light', 'screen', 0.85),
	ov('spotlight', 'spotlight', spotlight, 'light', 'screen', 0.7),
	ov('groundglow', 'ground glow', groundglow, 'light', 'screen', 0.75),
	ov('prism', 'prism', prism, 'light', 'screen', 0.4),
	ov('leak-warm', 'warm leak', leakWarm, 'light', 'screen', 0.8),
	ov('leak-cool', 'cool leak', leakCool, 'light', 'screen', 0.8),
	// ── fx · weather ──
	ov('fog', 'fog', fog, 'weather', undefined, 0.85),
	ov('mist', 'mist', mist, 'weather', 'screen', 0.8),
	ov('haze', 'haze', haze, 'weather', 'screen', 0.55),
	ov('snow', 'snow', snow, 'weather', 'screen', 0.9),
	ov('rain', 'rain', rain, 'weather', 'screen', 0.5),
	ov('embers', 'embers', embers, 'weather', 'screen', 0.9),
	ov('dust', 'dust motes', dust, 'weather', 'screen', 0.8),
	ov('sparkles', 'sparkles', sparkles, 'weather', 'screen'),
	ov('starfield', 'starfield', starfield, 'weather', 'screen'),
	ov('aurora', 'aurora', aurora, 'weather', 'screen', 0.75),
	// ── fx · colour wash ──
	ov('golden', 'golden hour', golden, 'wash', 'soft-light', 0.8),
	ov('sunsetwash', 'sunset', sunsetwash, 'wash', 'soft-light', 0.75),
	ov('tealorange', 'teal & orange', tealorange, 'wash', 'soft-light', 0.7),
	ov('pinkblue', 'pink & blue', pinkblue, 'wash', 'soft-light', 0.7),
	ov('purplehaze', 'purple haze', purplehaze, 'wash', 'overlay', 0.6),
	ov('cyber', 'cyber', cyber, 'wash', 'soft-light', 0.65),
	ov('mintwash', 'mint', mintwash, 'wash', 'soft-light', 0.6),
	ov('coolshade', 'cool shade', coolshade, 'wash', 'soft-light', 0.6),
	// ── fx · grain & texture ──
	ov('grain', 'grain', grain, 'grain', 'soft-light', 0.55),
	ov('finegrain', 'fine grain', finegrain, 'grain', 'soft-light', 0.45),
	ov('heavygrain', 'heavy grain', heavygrain, 'grain', 'soft-light', 0.6),
	ov('colornoise', 'colour noise', colornoise, 'grain', 'overlay', 0.35),
	ov('paper', 'paper', paper, 'grain', 'multiply', 0.4),
	ov('mottle', 'mottle', mottle, 'grain', 'multiply', 0.35),
	ov('fibers', 'fibers', fibers, 'grain', 'soft-light', 0.4),
	ov('scanlines', 'scanlines', scanlines, 'grain', 'soft-light', 0.35),
	ov('halftone', 'halftone', halftone, 'grain', 'soft-light', 0.3),
	ov('crosshatch', 'crosshatch', crosshatch, 'grain', 'soft-light', 0.35),
	ov('grid', 'grid', grid, 'grain', 'soft-light', 0.3),
	ov('grunge', 'grunge', grunge, 'grain', 'multiply', 0.4),
	// ── fx · vignette ──
	ov('vignette', 'vignette', vignette, 'vignette', 'multiply'),
	ov('soft-vignette', 'soft vignette', softVignette, 'vignette', 'multiply', 0.8),
	ov('heavy-vignette', 'heavy vignette', heavyVignette, 'vignette', 'multiply', 0.9),
	ov('topshade', 'top shade', topshade, 'vignette', 'multiply', 0.6),
	ov('bottomshade', 'bottom shade', bottomshade, 'vignette', 'multiply', 0.6)
];

const imageAssetMap = new Map(imageAssets.map((a) => [a.id, a]));

export function imageAssetById(id: string): ImageAsset | undefined {
	return imageAssetMap.get(id);
}

export function imageAssetsByTray(tray: AssetTray): ImageAsset[] {
	return imageAssets.filter((a) => a.tray === tray);
}

export function overlayAssets(group: OverlayGroup): ImageAsset[] {
	return imageAssets.filter((a) => a.tray === 'overlay' && a.group === group);
}

// Turn a library stamp into a fresh layer, honouring its fit / blend hints.
export function layerFromAsset(asset: ImageAsset): Layer {
	const scale = asset.fit === 'cover' ? coverScale(asset.w, asset.h) : undefined;
	return createImageLayer({
		src: asset.src,
		naturalW: asset.w,
		naturalH: asset.h,
		name: asset.name,
		scale,
		opacity: asset.defaultOpacity,
		blend: asset.defaultBlend
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

// ── scene presets (one-click starting stacks, bottom-first) ───────────

export type ScenePreset = {
	id: string;
	name: string;
	note: string;
	build: () => Layer[];
};

function stamp(id: string, t: Partial<Parameters<typeof createImageLayer>[0]>): Layer {
	const a = imageAssetById(id);
	if (!a) throw new Error(`unknown asset ${id}`);
	return createImageLayer({ src: a.src, naturalW: a.w, naturalH: a.h, name: a.name, ...t });
}

export const scenePresets: ScenePreset[] = [
	{
		id: 'meadow',
		name: 'meadow',
		note: 'a soft hill under an open sky',
		build: () => [
			createFillLayer(fillAssets[0].fill, 'day sky'),
			stamp('sun', { x: 0.32, y: -0.3, scale: 0.5, opacity: 0.95 }),
			stamp('cloud', { x: -0.28, y: -0.28, scale: 0.55, opacity: 0.9 }),
			stamp('hill', { x: 0, y: 0.42, scale: 1.7 }),
			stamp('tree', { x: -0.32, y: 0.16, scale: 0.7 }),
			stamp('grass', { x: 0.3, y: 0.4, scale: 0.5 })
		]
	},
	{
		id: 'dusk',
		name: 'dusk ridge',
		note: 'mountains going violet at evening',
		build: () => [
			createFillLayer(fillAssets[1].fill, 'dusk'),
			stamp('mountain', { x: -0.06, y: 0.26, scale: 1.7, opacity: 0.96 }),
			stamp('mountain', { x: 0.34, y: 0.34, scale: 1.3, opacity: 0.7, blur: 0.012 }),
			stamp('glow', { scale: coverScale(CANVAS_W, CANVAS_H), blend: 'screen', opacity: 0.8 }),
			stamp('pine', { x: 0.3, y: 0.28, scale: 0.7 }),
			stamp('pine', { x: 0.42, y: 0.34, scale: 0.5, opacity: 0.85 })
		]
	},
	{
		id: 'night',
		name: 'night',
		note: 'a full moon, stars, a quiet rise',
		build: () => [
			createFillLayer(fillAssets[3].fill, 'night'),
			stamp('sparkles', { scale: coverScale(CANVAS_W, CANVAS_H), blend: 'screen' }),
			stamp('moon', { x: 0.28, y: -0.26, scale: 0.5 }),
			stamp('star', { x: -0.3, y: -0.3, scale: 0.16 }),
			stamp('star', { x: -0.12, y: -0.36, scale: 0.1 }),
			stamp('hill', { x: 0, y: 0.46, scale: 1.7, opacity: 0.9 }),
			stamp('pine', { x: -0.3, y: 0.2, scale: 0.7, opacity: 0.85 })
		]
	},
	{
		id: 'pond',
		name: 'misty water',
		note: 'a low fog over still water',
		build: () => [
			createFillLayer(fillAssets[5].fill, 'water'),
			stamp('hill', { x: -0.2, y: 0.12, scale: 1.2, opacity: 0.55, blur: 0.01 }),
			stamp('rock', { x: 0.26, y: 0.34, scale: 0.5 }),
			stamp('fog', { scale: coverScale(CANVAS_W, CANVAS_H), opacity: 0.85 })
		]
	}
];
