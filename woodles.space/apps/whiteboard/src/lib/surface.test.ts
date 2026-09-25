import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SURFACE,
	isSurface,
	normalizeSurface,
	paperCss,
	patternStep,
	surfaceBlocks,
	surfaceStyle,
	SURFACE_PAPERS,
	SURFACE_PATTERNS,
	weaveCss,
	weaveOffset,
	type Surface
} from './surface';

const at = (zoom: number, x = 0, y = 0) => ({ x, y, zoom });
const surfaceWith = (patch: Partial<Surface> = {}): Surface => ({ ...DEFAULT_SURFACE, ...patch });

describe('how dense the pattern lands', () => {
	it('leaves the cell alone at 1:1 — the board is the ruler', () => {
		expect(patternStep(22, 1)).toBe(22);
	});

	it('doubles rather than dissolving when the board is small', () => {
		// 22 world units at 20% is 4.4 screen pixels: mush. Doubling twice
		// lands on 17.6, which is still every fourth line of the board.
		expect(patternStep(22, 0.2)).toBeCloseTo(17.6, 6);
	});

	it('halves rather than becoming wallpaper when the board is close', () => {
		expect(patternStep(44, 4)).toBeCloseTo(44, 6);
	});

	it('keeps every step inside the readable band across the whole zoom range', () => {
		for (const cell of [12, 22, 44]) {
			for (const zoom of [0.1, 0.25, 0.5, 0.8, 1, 1.6, 2.5, 4]) {
				const step = patternStep(cell, zoom);
				expect(step).toBeGreaterThanOrEqual(12);
				expect(step).toBeLessThanOrEqual(72);
			}
		}
	});

	it('only ever scales the cell by a power of two, so the pattern stays registered to the board', () => {
		for (const zoom of [0.1, 0.37, 1, 2.2, 4]) {
			const ratio = patternStep(22, zoom) / (22 * zoom);
			expect(Math.log2(ratio) % 1).toBeCloseTo(0, 9);
		}
	});

	it('refuses to divide by nonsense', () => {
		expect(patternStep(22, 0)).toBe(22);
		expect(patternStep(22, Number.NaN)).toBe(22);
		expect(patternStep(Number.NaN, 1)).toBe(1);
		expect(patternStep(0, 1)).toBe(1);
	});
});

describe('where the pattern sits', () => {
	it('wraps the camera into one tile, so a long pan is still a short shift', () => {
		expect(weaveOffset({ x: 1005, y: -5 }, 20)).toEqual({ x: 5, y: 15 });
	});

	it('holds still when the camera is on a cell boundary', () => {
		expect(weaveOffset({ x: 440, y: -220 }, 22)).toEqual({ x: 0, y: 0 });
	});

	it('survives a step of zero rather than dividing by it', () => {
		expect(weaveOffset({ x: 12, y: 12 }, 0)).toEqual({ x: 0, y: 0 });
	});
});

describe('the pattern layer', () => {
	it('draws nothing at all when the board asks for plain', () => {
		expect(weaveCss(surfaceWith({ pattern: 'plain' }), at(1))).toBe('background-image: none;');
	});

	it('keeps the exact ink the dot grid was born with', () => {
		expect(weaveCss(DEFAULT_SURFACE, at(1))).toContain('rgba(103, 86, 75, 0.14)');
	});

	it('asks for less ink at faint and more at strong', () => {
		expect(weaveCss(surfaceWith({ depth: 'faint' }), at(1))).toContain('0.07');
		expect(weaveCss(surfaceWith({ depth: 'strong' }), at(1))).toContain('0.24');
	});

	it('gives every pattern a size and a shift to move by', () => {
		for (const pattern of SURFACE_PATTERNS.filter((name) => name !== 'plain')) {
			const css = weaveCss(surfaceWith({ pattern }), at(1, 140, 60));
			expect(css).toContain('background-size:');
			expect(css).toContain('translate3d(');
		}
	});

	it('rules lines across the whole layer and crosses the grid both ways', () => {
		expect(weaveCss(surfaceWith({ pattern: 'lines' }), at(1))).toContain('background-size: 100%');
		const grid = weaveCss(surfaceWith({ pattern: 'grid' }), at(1));
		expect(grid).toContain('to right');
		expect(grid).toContain('to bottom');
	});

	it('scales with the board, not with the window', () => {
		const near = weaveCss(DEFAULT_SURFACE, at(2));
		const far = weaveCss(DEFAULT_SURFACE, at(1));
		expect(near).not.toBe(far);
		expect(near).toContain('44px 44px');
	});
});

describe('the paper', () => {
	it('is the warm sheet and its top light by default', () => {
		const css = paperCss(DEFAULT_SURFACE);
		expect(css).toContain('#f7f3ec');
		expect(css).not.toContain('105deg');
	});

	it('lays seven bands across the board when asked for a rainbow', () => {
		const css = paperCss(surfaceWith({ paper: 'rainbow' }));
		expect(css).toContain('105deg');
		expect(css.match(/rgba\(\d+, \d+, \d+, [\d.]+\) [\d.]+%/g)).toHaveLength(7);
		expect(css).toContain('0%');
		expect(css).toContain('100%');
	});

	it('takes its strength from the same dial the pattern does', () => {
		const faint = paperCss(surfaceWith({ paper: 'rainbow', depth: 'faint' }));
		const strong = paperCss(surfaceWith({ paper: 'rainbow', depth: 'strong' }));
		expect(faint).toContain('0.3)');
		expect(strong).toContain('0.78)');
	});

	it('names a background colour whichever paper it is, so nothing shows through', () => {
		for (const paper of SURFACE_PAPERS) {
			expect(paperCss(surfaceWith({ paper }))).toContain('background-color: #f7f3ec;');
		}
	});
});

describe('the blocks the chrome wears', () => {
	it('hands out nothing at all on ordinary paper, so ordinary boards stay ordinary', () => {
		expect(surfaceBlocks(DEFAULT_SURFACE)).toBe('');
		expect(surfaceStyle(DEFAULT_SURFACE)).toBe(paperCss(DEFAULT_SURFACE));
	});

	it('names all seven bands, pale for the panel and deep for what is chosen in it', () => {
		const blocks = surfaceBlocks(surfaceWith({ paper: 'rainbow' }));
		for (const band of ['rose', 'apricot', 'butter', 'leaf', 'sky', 'iris', 'lilac']) {
			expect(blocks).toContain(`--block-${band}:`);
			expect(blocks).toContain(`--deep-${band}:`);
		}
	});

	it('hands over triples rather than colours, so every panel keeps its own alpha', () => {
		const blocks = surfaceBlocks(surfaceWith({ paper: 'rainbow' }));
		expect(blocks).toMatch(/--block-rose: \d+, \d+, \d+;/);
		expect(blocks).not.toContain('rgba(');
	});

	it('draws a state harder than the panel it is in', () => {
		const blocks = surfaceBlocks(surfaceWith({ paper: 'rainbow' }));
		const read = (name: string) =>
			blocks.match(new RegExp(`--${name}-leaf: (\\d+), (\\d+), (\\d+);`))!.slice(1).map(Number);
		const [, blockGreen] = read('block');
		const [deepRed, deepGreen] = read('deep');
		// The leaf band is greener and darker than the cream: deeper means
		// further from the cream on both counts.
		expect(deepGreen).toBeGreaterThan(0);
		expect(deepRed).toBeLessThan(255);
		expect(255 - deepRed).toBeGreaterThan(255 - read('block')[0]);
		expect(blockGreen).toBeGreaterThan(deepGreen);
	});

	it('takes the same dial the paper and the pattern take', () => {
		const faint = surfaceBlocks(surfaceWith({ paper: 'rainbow', depth: 'faint' }));
		const strong = surfaceBlocks(surfaceWith({ paper: 'rainbow', depth: 'strong' }));
		const red = (blocks: string) => Number(blocks.match(/--block-sky: (\d+),/)![1]);
		// The sky band is far below the cream's red, so a stronger mix is a
		// lower number — a panel further from cream and closer to its band.
		expect(red(strong)).toBeLessThan(red(faint));
	});

	it('never leaves a channel outside what a colour can hold', () => {
		for (const depth of ['faint', 'normal', 'strong'] as const) {
			for (const channel of surfaceBlocks(surfaceWith({ paper: 'rainbow', depth })).match(/\d+/g) ?? []) {
				expect(Number(channel)).toBeLessThanOrEqual(255);
			}
		}
	});

	it('is carried by the canvas alongside its paper', () => {
		const rainbow = surfaceWith({ paper: 'rainbow' });
		const style = surfaceStyle(rainbow);
		expect(style.startsWith(paperCss(rainbow))).toBe(true);
		expect(style).toContain('--block-iris:');
	});
});

describe('reading a surface back off a saved board', () => {
	it('accepts a whole one and refuses a partial one', () => {
		expect(isSurface(DEFAULT_SURFACE)).toBe(true);
		expect(isSurface({ pattern: 'dots' })).toBe(false);
		expect(isSurface({ ...DEFAULT_SURFACE, pattern: 'plaid' })).toBe(false);
		expect(isSurface(null)).toBe(false);
		expect(isSurface(['dots'])).toBe(false);
	});

	it('keeps whatever was readable and fills in the rest', () => {
		expect(normalizeSurface({ pattern: 'grid', size: 'enormous', paper: 'rainbow' })).toEqual({
			pattern: 'grid',
			size: 'regular',
			depth: 'normal',
			paper: 'rainbow'
		});
	});

	it('hands back the default for something that is not a surface at all', () => {
		expect(normalizeSurface(undefined)).toEqual(DEFAULT_SURFACE);
		expect(normalizeSurface('dots')).toEqual(DEFAULT_SURFACE);
	});

	it('copies rather than sharing, so two boards cannot edit one surface', () => {
		const copy = normalizeSurface(DEFAULT_SURFACE);
		copy.pattern = 'lines';
		expect(DEFAULT_SURFACE.pattern).toBe('dots');
	});
});
