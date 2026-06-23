import { describe, expect, it } from 'vitest';
import {
	createImageLayer,
	createFillLayer,
	clamp01,
	clampScale,
	clampBlur,
	clampOffset,
	normalizeRotation,
	imageLayerBox,
	coverScale,
	moveLayer,
	moveLayerToEnd,
	removeLayer,
	updateLayer,
	addLayerAbove,
	duplicateLayer,
	indexOfLayer,
	cloneComposition,
	migrateComposition,
	blendToComposite,
	fillToCss,
	emptyComposition,
	cssFilter,
	defaultFilters,
	filtersAreDefault,
	defaultOutline,
	clampOutlineWidth,
	defaultTint,
	FIT_SCALE,
	MAX_SCALE,
	MAX_BLUR,
	MAX_OUTLINE,
	CANVAS_W,
	CANVAS_H,
	type Layer
} from './composer';

const img = (over: Parameters<typeof createImageLayer>[0] = { src: 's', naturalW: 200, naturalH: 100 }) =>
	createImageLayer(over);

describe('clamps', () => {
	it('clamp01 holds [0,1] and coerces NaN to 0', () => {
		expect(clamp01(0.5)).toBe(0.5);
		expect(clamp01(-1)).toBe(0);
		expect(clamp01(2)).toBe(1);
		expect(clamp01(NaN)).toBe(0);
	});
	it('clampScale respects bounds and falls back to FIT_SCALE on NaN', () => {
		expect(clampScale(1)).toBe(1);
		expect(clampScale(99)).toBe(MAX_SCALE);
		expect(clampScale(0)).toBeCloseTo(0.03);
		expect(clampScale(NaN)).toBe(FIT_SCALE);
	});
	it('clampBlur caps at MAX_BLUR', () => {
		expect(clampBlur(1)).toBe(MAX_BLUR);
		expect(clampBlur(-1)).toBe(0);
	});
	it('clampOffset lets a layer hang a little off-frame', () => {
		expect(clampOffset(0.3)).toBe(0.3);
		expect(clampOffset(9)).toBe(1.5);
		expect(clampOffset(-9)).toBe(-1.5);
	});
});

describe('normalizeRotation', () => {
	it('wraps into (−180, 180]', () => {
		expect(normalizeRotation(0)).toBe(0);
		expect(normalizeRotation(190)).toBe(-170);
		expect(normalizeRotation(-190)).toBe(170);
		expect(normalizeRotation(540)).toBe(180);
	});
});

describe('createImageLayer', () => {
	it('fills sensible defaults', () => {
		const l = img();
		expect(l.kind).toBe('image');
		expect(l.scale).toBe(FIT_SCALE);
		expect(l.opacity).toBe(1);
		expect(l.blur).toBe(0);
		expect(l.blend).toBe('normal');
		expect(l.smooth).toBe(true);
		expect(l.x).toBe(0);
		expect(l.y).toBe(0);
	});
	it('clamps out-of-range scale / opacity / blur on the way in', () => {
		const l = createImageLayer({ src: 's', naturalW: 10, naturalH: 10, scale: 99, opacity: 5, blur: 9 });
		expect(l.scale).toBe(MAX_SCALE);
		expect(l.opacity).toBe(1);
		expect(l.blur).toBe(MAX_BLUR);
	});
	it('guards against zero natural size', () => {
		const l = createImageLayer({ src: 's', naturalW: 0, naturalH: 0 });
		expect(l.naturalW).toBe(1);
		expect(l.naturalH).toBe(1);
	});
	it('mints unique ids', () => {
		expect(img().id).not.toBe(img().id);
	});
});

describe('createFillLayer', () => {
	it('is full-bleed with no transform', () => {
		const l = createFillLayer({ type: 'solid', color: '#fff' });
		expect(l.kind).toBe('fill');
		expect(l.opacity).toBe(1);
		expect(l.blend).toBe('normal');
	});
});

describe('imageLayerBox', () => {
	it('centres a layer and scales its longest side to the short canvas dim at scale 1', () => {
		const box = imageLayerBox(img({ src: 's', naturalW: 200, naturalH: 100, scale: 1 }), CANVAS_W, CANVAS_H);
		// refDim 480, longest side 200 → ratio 2.4
		expect(box.w).toBeCloseTo(480);
		expect(box.h).toBeCloseTo(240);
		expect(box.cx).toBeCloseTo(320);
		expect(box.cy).toBeCloseTo(240);
	});
	it('offsets the centre by x/y as a fraction of width/height', () => {
		const box = imageLayerBox(
			img({ src: 's', naturalW: 100, naturalH: 100, x: 0.25, y: -0.5 }),
			CANVAS_W,
			CANVAS_H
		);
		expect(box.cx).toBeCloseTo(320 + 0.25 * 640);
		expect(box.cy).toBeCloseTo(240 - 0.5 * 480);
	});
});

describe('coverScale', () => {
	it('returns a scale large enough to cover the canvas', () => {
		const s = coverScale(200, 100, CANVAS_W, CANVAS_H);
		expect(s).toBeCloseTo(2);
		const box = imageLayerBox(img({ src: 's', naturalW: 200, naturalH: 100, scale: s }));
		expect(box.w).toBeGreaterThanOrEqual(CANVAS_W);
		expect(box.h).toBeGreaterThanOrEqual(CANVAS_H);
	});
});

describe('stack operations', () => {
	const a = createFillLayer({ type: 'solid', color: '#000' }, 'a');
	const b = img({ src: 'b', naturalW: 10, naturalH: 10, name: 'b' });
	const c = img({ src: 'c', naturalW: 10, naturalH: 10, name: 'c' });
	const stack: Layer[] = [a, b, c]; // bottom-first

	it('finds a layer index', () => {
		expect(indexOfLayer(stack, b.id)).toBe(1);
		expect(indexOfLayer(stack, 'nope')).toBe(-1);
	});

	it('moves a layer up toward the front without mutating', () => {
		const next = moveLayer(stack, b.id, 'up');
		expect(next.map((l) => l.id)).toEqual([a.id, c.id, b.id]);
		expect(stack.map((l) => l.id)).toEqual([a.id, b.id, c.id]);
	});
	it('moves a layer down toward the back', () => {
		expect(moveLayer(stack, c.id, 'down').map((l) => l.id)).toEqual([a.id, c.id, b.id]);
	});
	it('is a no-op at the ends', () => {
		expect(moveLayer(stack, a.id, 'down')).toBe(stack);
		expect(moveLayer(stack, c.id, 'up')).toBe(stack);
	});

	it('sends a layer to front or back', () => {
		expect(moveLayerToEnd(stack, a.id, 'front').map((l) => l.id)).toEqual([b.id, c.id, a.id]);
		expect(moveLayerToEnd(stack, c.id, 'back').map((l) => l.id)).toEqual([c.id, a.id, b.id]);
	});

	it('removes a layer', () => {
		expect(removeLayer(stack, b.id).map((l) => l.id)).toEqual([a.id, c.id]);
	});

	it('updates a single layer immutably', () => {
		const next = updateLayer(stack, b.id, { name: 'renamed' });
		expect(next[1].name).toBe('renamed');
		expect(stack[1].name).toBe('b');
	});

	it('adds above the selected layer, or on top when none is selected', () => {
		const fresh = img({ src: 'd', naturalW: 10, naturalH: 10, name: 'd' });
		expect(addLayerAbove(stack, fresh, a.id).map((l) => l.id)).toEqual([a.id, fresh.id, b.id, c.id]);
		expect(addLayerAbove(stack, fresh, null).map((l) => l.id)).toEqual([a.id, b.id, c.id, fresh.id]);
	});

	it('duplicates an image layer with a new id, nudged over', () => {
		const dup = duplicateLayer(b);
		expect(dup.id).not.toBe(b.id);
		if (dup.kind === 'image' && b.kind === 'image') {
			expect(dup.x).toBeCloseTo(b.x + 0.04);
		}
	});
});

describe('blend & fill helpers', () => {
	it('maps normal to source-over and passes the rest through', () => {
		expect(blendToComposite('normal')).toBe('source-over');
		expect(blendToComposite('multiply')).toBe('multiply');
	});
	it('builds css for each fill type', () => {
		expect(fillToCss({ type: 'solid', color: '#abc' })).toBe('#abc');
		expect(fillToCss({ type: 'linear', from: '#000', to: '#fff', angle: 90 })).toContain(
			'linear-gradient(90deg'
		);
		expect(fillToCss({ type: 'radial', from: '#000', to: '#fff' })).toContain('radial-gradient');
	});
});

describe('filters', () => {
	it('a fresh image layer is unfiltered with no outline', () => {
		const l = img();
		expect(filtersAreDefault(l.filters)).toBe(true);
		expect(l.outline).toBeNull();
	});
	it('cssFilter is "none" at defaults', () => {
		expect(cssFilter(defaultFilters())).toBe('none');
		expect(cssFilter(undefined)).toBe('none');
	});
	it('prepends blur, then only the non-default functions', () => {
		const f = { ...defaultFilters(), brightness: 1.2, hue: 45, grayscale: 0.5 };
		const s = cssFilter(f, 8);
		expect(s.startsWith('blur(8px)')).toBe(true);
		expect(s).toContain('brightness(1.2)');
		expect(s).toContain('hue-rotate(45deg)');
		expect(s).toContain('grayscale(0.5)');
		expect(s).not.toContain('contrast');
		expect(s).not.toContain('sepia');
	});
});

describe('outline', () => {
	it('defaults to a soft, thin, solid stroke', () => {
		const o = defaultOutline();
		expect(o.fill.type).toBe('solid');
		expect(o.width).toBeGreaterThan(0);
		expect(o.width).toBeLessThanOrEqual(MAX_OUTLINE);
	});
	it('clamps thickness to the allowed band', () => {
		expect(clampOutlineWidth(99)).toBe(MAX_OUTLINE);
		expect(clampOutlineWidth(-1)).toBe(0);
		expect(clampOutlineWidth(NaN)).toBe(0);
	});
	it('round-trips through migration, dropping a fill-less outline', () => {
		const ok = migrateComposition({
			layers: [
				{
					kind: 'image',
					id: 'a',
					src: 'x',
					naturalW: 10,
					naturalH: 10,
					outline: { width: 0.04, softness: 0.5, fill: { type: 'solid', color: '#000' } },
					filters: { brightness: 9 }
				},
				{ kind: 'image', id: 'b', src: 'y', naturalW: 10, naturalH: 10, outline: { width: 0.04 } }
			]
		});
		const a = ok!.layers[0];
		const b = ok!.layers[1];
		expect(a.kind).toBe('image');
		if (a.kind === 'image') {
			expect(a.outline?.width).toBe(0.04);
			expect(a.filters.brightness).toBe(2); // clamped from 9
		}
		if (b.kind === 'image') expect(b.outline).toBeNull(); // no fill → dropped
	});
});

describe('tint', () => {
	it('a fresh image layer has no tint', () => {
		expect(img().tint).toBeNull();
	});
	it('defaults to a strong house-pink recolour', () => {
		const t = defaultTint();
		expect(t.color).toMatch(/^#/);
		expect(t.strength).toBeGreaterThan(0);
		expect(t.strength).toBeLessThanOrEqual(1);
	});
	it('round-trips through migration, clamping strength and dropping colourless tints', () => {
		const comp = migrateComposition({
			layers: [
				{ kind: 'image', id: 'a', src: 'x', naturalW: 10, naturalH: 10, tint: { color: '#7fb8ec', strength: 9 } },
				{ kind: 'image', id: 'b', src: 'y', naturalW: 10, naturalH: 10, tint: { strength: 0.5 } }
			]
		});
		const a = comp!.layers[0];
		const b = comp!.layers[1];
		if (a.kind === 'image') {
			expect(a.tint?.color).toBe('#7fb8ec');
			expect(a.tint?.strength).toBe(1); // clamped from 9
		}
		if (b.kind === 'image') expect(b.tint).toBeNull(); // no colour → dropped
	});
});

describe('composition (de)serialization', () => {
	it('clones without sharing layer references', () => {
		const comp = emptyComposition();
		comp.layers = [img()];
		const copy = cloneComposition(comp);
		copy.layers[0].name = 'changed';
		expect(comp.layers[0].name).not.toBe('changed');
	});

	it('migrates a plausible blob, dropping unreadable layers', () => {
		const raw = {
			width: 640,
			height: 480,
			layers: [
				{ kind: 'fill', id: 'f', fill: { type: 'solid', color: '#fff' } },
				{ kind: 'image', id: 'i', src: 'x', naturalW: 50, naturalH: 50, scale: 9 },
				{ kind: 'image', id: 'bad' }, // no src — dropped
				{ kind: 'mystery' } // unknown — dropped
			]
		};
		const comp = migrateComposition(raw);
		expect(comp).not.toBeNull();
		expect(comp!.layers).toHaveLength(2);
		const image = comp!.layers[1];
		expect(image.kind).toBe('image');
		if (image.kind === 'image') expect(image.scale).toBe(MAX_SCALE); // clamped
	});

	it('rejects junk', () => {
		expect(migrateComposition(null)).toBeNull();
		expect(migrateComposition({ layers: 'nope' })).toBeNull();
		expect(migrateComposition(42)).toBeNull();
	});

	it('defaults canvas size when missing', () => {
		const comp = migrateComposition({ layers: [] });
		expect(comp!.width).toBe(CANVAS_W);
		expect(comp!.height).toBe(CANVAS_H);
	});
});
