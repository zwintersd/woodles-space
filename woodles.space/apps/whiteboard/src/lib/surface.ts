/**
 * The board's own surface: the paper under everything, and the pattern drawn
 * on it. Both used to be two hardcoded lines of CSS on `.whiteboard` — a dot
 * grid pinned to the *screen*, which meant the one thing on the page that
 * should have said "this canvas is bigger than the window" sat perfectly
 * still while the board slid underneath it.
 *
 * So the pattern is computed here instead, from the camera, and it moves and
 * scales with the board. Everything in this file is a pure function of
 * (surface, camera) so the whole thing is testable without a DOM.
 */

export const SURFACE_PATTERNS = ['dots', 'grid', 'lines', 'plain'] as const;
export type SurfacePattern = (typeof SURFACE_PATTERNS)[number];

export const SURFACE_SIZES = ['fine', 'regular', 'wide'] as const;
export type SurfaceSize = (typeof SURFACE_SIZES)[number];

/** How much the surface asserts itself — the pattern's ink and the paper's colour alike. */
export const SURFACE_DEPTHS = ['faint', 'normal', 'strong'] as const;
export type SurfaceDepth = (typeof SURFACE_DEPTHS)[number];

export const SURFACE_PAPERS = ['paper', 'rainbow'] as const;
export type SurfacePaper = (typeof SURFACE_PAPERS)[number];

export type Surface = {
	pattern: SurfacePattern;
	size: SurfaceSize;
	depth: SurfaceDepth;
	paper: SurfacePaper;
};

/** Dots, regular, normal: the exact surface every board had before it was a choice. */
export const DEFAULT_SURFACE: Surface = { pattern: 'dots', size: 'regular', depth: 'normal', paper: 'paper' };

/** In world units, so the cell means a distance on the board rather than on the screen. */
const CELL: Record<SurfaceSize, number> = { fine: 12, regular: 22, wide: 44 };

/** `normal` is 0.14 — the alpha the dot grid was born with. */
const INK_ALPHA: Record<SurfaceDepth, number> = { faint: 0.07, normal: 0.14, strong: 0.24 };

/** Ruled lines carry more ink per cell than dots do, so they are asked for less of it. */
const PATTERN_WEIGHT: Record<SurfacePattern, number> = { dots: 1, grid: 0.62, lines: 0.72, plain: 0 };

const WASH_ALPHA: Record<SurfaceDepth, number> = { faint: 0.3, normal: 0.52, strong: 0.78 };

const INK_RGB = '103, 86, 75';
const PAPER_COLOR = '#f7f3ec';
/** Seven bands, low saturation: a rainbow the board can still be read over. */
const SPECTRUM = ['246, 184, 192', '248, 211, 168', '244, 236, 174', '191, 227, 189', '182, 220, 239', '198, 196, 239', '231, 191, 228'];

/**
 * How far apart the cells land on screen. The pattern is anchored to the
 * board, so a plain `cell × zoom` would dissolve into mush at 20% and drift
 * into wallpaper at 400%. Doubling or halving keeps every visible line on a
 * multiple of the cell — the pattern stays registered to the board while its
 * density stays readable at any scale.
 */
export function patternStep(cell: number, zoom: number, min = 12, max = 72): number {
	if (!Number.isFinite(cell) || cell <= 0) return 1;
	if (!Number.isFinite(zoom) || zoom <= 0) return cell;
	let step = cell * zoom;
	for (let guard = 0; step < min && guard < 40; guard += 1) step *= 2;
	for (let guard = 0; step > max && guard < 40; guard += 1) step /= 2;
	return step;
}

/**
 * Where the tile starts. The pattern layer is one tile bigger than the
 * viewport on every side, so it is shifted by the camera modulo the step
 * rather than by the camera itself — a translation of a few pixels per frame
 * instead of a background that has to be redrawn across the whole screen.
 */
export function weaveOffset(camera: { x: number; y: number }, step: number): { x: number; y: number } {
	if (!Number.isFinite(step) || step <= 0) return { x: 0, y: 0 };
	const wrap = (value: number) => (Number.isFinite(value) ? ((value % step) + step) % step : 0);
	return { x: wrap(camera.x), y: wrap(camera.y) };
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}

function ink(surface: Surface): string {
	const alpha = INK_ALPHA[surface.depth] * PATTERN_WEIGHT[surface.pattern];
	return `rgba(${INK_RGB}, ${round(alpha * 1000) / 1000})`;
}

/** The pattern layer: what it draws, how big, and where it sits under the camera. */
export function weaveCss(surface: Surface, camera: { x: number; y: number; zoom: number }): string {
	if (surface.pattern === 'plain') return 'background-image: none;';
	const step = round(patternStep(CELL[surface.size], camera.zoom));
	const offset = weaveOffset(camera, step);
	const color = ink(surface);
	const shift = `transform: translate3d(${round(offset.x)}px, ${round(offset.y)}px, 0);`;

	if (surface.pattern === 'dots') {
		// The dot grows a little with the cell, so a wide grid reads as a grid
		// rather than as dust.
		const dot = round(Math.max(1, Math.min(2.2, step / 20)));
		return `background-image: radial-gradient(circle at ${dot}px ${dot}px, ${color} ${dot}px, transparent ${round(dot + 0.4)}px); background-size: ${step}px ${step}px; ${shift}`;
	}
	if (surface.pattern === 'grid') {
		return `background-image: linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px); background-size: ${step}px ${step}px; ${shift}`;
	}
	return `background-image: linear-gradient(to bottom, ${color} 1px, transparent 1px); background-size: 100% ${step}px; ${shift}`;
}

/** The paper under the pattern: warm and plain, or the whole spectrum. */
export function paperCss(surface: Surface): string {
	const glow = surface.paper === 'rainbow'
		? 'radial-gradient(ellipse at 50% -20%, rgba(255, 255, 255, 0.6), transparent 54%)'
		: 'radial-gradient(ellipse at 50% -20%, rgba(255, 255, 255, 0.82), transparent 59%)';
	if (surface.paper !== 'rainbow') {
		return `background-color: ${PAPER_COLOR}; background-image: ${glow};`;
	}
	const wash = WASH_ALPHA[surface.depth];
	const bands = SPECTRUM
		.map((rgb, index) => `rgba(${rgb}, ${round(wash * 1000) / 1000}) ${round((index / (SPECTRUM.length - 1)) * 100)}%`)
		.join(', ');
	return `background-color: ${PAPER_COLOR}; background-image: ${glow}, linear-gradient(105deg, ${bands});`;
}

export function isSurface(value: unknown): value is Surface {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	return (SURFACE_PATTERNS as readonly unknown[]).includes(record.pattern) &&
		(SURFACE_SIZES as readonly unknown[]).includes(record.size) &&
		(SURFACE_DEPTHS as readonly unknown[]).includes(record.depth) &&
		(SURFACE_PAPERS as readonly unknown[]).includes(record.paper);
}

/**
 * Keeps whatever was readable and fills in the rest. A surface is decoration:
 * a board whose saved pattern is a word this version has never heard of loses
 * the pattern, never the board.
 */
export function normalizeSurface(value: unknown): Surface {
	if (isSurface(value)) return { ...value };
	const record = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
	const pick = <T extends string>(options: readonly T[], candidate: unknown, fallback: T): T =>
		(options as readonly unknown[]).includes(candidate) ? (candidate as T) : fallback;
	return {
		pattern: pick(SURFACE_PATTERNS, record.pattern, DEFAULT_SURFACE.pattern),
		size: pick(SURFACE_SIZES, record.size, DEFAULT_SURFACE.size),
		depth: pick(SURFACE_DEPTHS, record.depth, DEFAULT_SURFACE.depth),
		paper: pick(SURFACE_PAPERS, record.paper, DEFAULT_SURFACE.paper)
	};
}
