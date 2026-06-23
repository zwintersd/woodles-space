import { describe, expect, it } from 'vitest';
import {
	imageAssets,
	fillAssets,
	overlayGroups,
	overlayAssets,
	layerFromAsset,
	imageAssetById,
	recolorFxSrc
} from './props';
import { coverScale, CANVAS_W, CANVAS_H } from './composer';

describe('image assets', () => {
	it('have unique ids', () => {
		const ids = imageAssets.map((a) => a.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
	it('are all inline svg data urls', () => {
		for (const a of imageAssets) expect(a.src.startsWith('data:image/svg+xml')).toBe(true);
	});
	it('look it up by id', () => {
		expect(imageAssetById('glow')?.name).toBe('glow');
		expect(imageAssetById('nope')).toBeUndefined();
	});
});

describe('overlay grouping', () => {
	it('every built-in asset is a cover-fit fx tagged with a known group', () => {
		const known = new Set(overlayGroups.map((g) => g.id));
		for (const a of imageAssets) {
			expect(a.fit).toBe('cover');
			expect(known.has(a.group)).toBe(true);
		}
	});
	it('every group has at least one overlay, and the parts sum to the whole', () => {
		let total = 0;
		for (const g of overlayGroups) {
			const items = overlayAssets(g.id);
			expect(items.length).toBeGreaterThan(0);
			total += items.length;
		}
		expect(total).toBe(imageAssets.length);
	});
});

describe('fill assets', () => {
	it('have unique ids', () => {
		const ids = fillAssets.map((f) => f.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('layerFromAsset', () => {
	it('sizes a cover overlay to fill the canvas', () => {
		const vig = imageAssetById('vignette')!;
		const layer = layerFromAsset(vig);
		expect(layer.kind).toBe('image');
		if (layer.kind === 'image') {
			expect(layer.scale).toBe(coverScale(vig.w, vig.h, CANVAS_W, CANVAS_H));
		}
	});
	it('carries the asset blend / opacity hints onto the layer', () => {
		const glow = imageAssetById('glow')!;
		const layer = layerFromAsset(glow);
		if (layer.kind === 'image') expect(layer.blend).toBe('screen');
	});
	it('attaches a recipe to a colour-bearing fx and none to a colourless one', () => {
		const wash = layerFromAsset(imageAssetById('golden')!);
		if (wash.kind === 'image') {
			expect(wash.recipe?.id).toBe('golden');
			expect(wash.recipe?.colors).toEqual(['#ffe0a0', '#ff9e6b']);
		}
		const grain = layerFromAsset(imageAssetById('grain')!);
		if (grain.kind === 'image') expect(grain.recipe).toBeNull();
	});
});

describe('fx recipes', () => {
	it('a colour-bearing fx is rebuildable, a colourless one is not', () => {
		const wash = imageAssetById('golden')!;
		expect(wash.colors.length).toBe(2);
		expect(wash.colorLabels?.length).toBe(2);
		const grain = imageAssetById('grain')!;
		expect(grain.colors.length).toBe(0);
	});
	it('recolorFxSrc changes the src and is stable for the same colours', () => {
		const original = imageAssetById('golden')!.src;
		const recolored = recolorFxSrc('golden', ['#000000', '#ffffff']);
		expect(recolored).not.toBeNull();
		expect(recolored).not.toBe(original);
		expect(recolorFxSrc('golden', ['#000000', '#ffffff'])).toBe(recolored);
		// the default colours reproduce the asset's own src exactly
		expect(recolorFxSrc('golden', imageAssetById('golden')!.colors)).toBe(original);
	});
	it('returns null for an unknown fx id', () => {
		expect(recolorFxSrc('nope', ['#fff'])).toBeNull();
	});
});
