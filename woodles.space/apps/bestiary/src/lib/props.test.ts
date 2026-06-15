import { describe, expect, it } from 'vitest';
import {
	imageAssets,
	fillAssets,
	overlayGroups,
	overlayAssets,
	imageAssetsByTray,
	scenePresets,
	layerFromAsset,
	imageAssetById
} from './props';
import { coverScale, FIT_SCALE, CANVAS_W, CANVAS_H } from './composer';

describe('image assets', () => {
	it('have unique ids', () => {
		const ids = imageAssets.map((a) => a.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
	it('are all inline svg data urls', () => {
		for (const a of imageAssets) expect(a.src.startsWith('data:image/svg+xml')).toBe(true);
	});
	it('look it up by id', () => {
		expect(imageAssetById('pine')?.name).toBe('pine');
		expect(imageAssetById('nope')).toBeUndefined();
	});
});

describe('overlay grouping', () => {
	it('every overlay is cover-fit and tagged with a known group', () => {
		const known = new Set(overlayGroups.map((g) => g.id));
		for (const a of imageAssetsByTray('overlay')) {
			expect(a.fit).toBe('cover');
			expect(a.group && known.has(a.group)).toBe(true);
		}
	});
	it('every group has at least one overlay, and the parts sum to the whole', () => {
		let total = 0;
		for (const g of overlayGroups) {
			const items = overlayAssets(g.id);
			expect(items.length).toBeGreaterThan(0);
			total += items.length;
		}
		expect(total).toBe(imageAssetsByTray('overlay').length);
	});
});

describe('fill assets', () => {
	it('have unique ids', () => {
		const ids = fillAssets.map((f) => f.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('layerFromAsset', () => {
	it('sizes a fit stamp at the default and a cover stamp to fill', () => {
		const pine = layerFromAsset(imageAssetById('pine')!);
		expect(pine.kind).toBe('image');
		if (pine.kind === 'image') expect(pine.scale).toBe(FIT_SCALE);

		const vig = imageAssetById('vignette')!;
		const layer = layerFromAsset(vig);
		if (layer.kind === 'image') expect(layer.scale).toBe(coverScale(vig.w, vig.h, CANVAS_W, CANVAS_H));
	});
});

describe('scene presets', () => {
	it('every preset builds a non-empty stack from known assets', () => {
		for (const s of scenePresets) {
			// build() throws on an unknown asset id, so this also validates references
			const layers = s.build();
			expect(layers.length).toBeGreaterThan(0);
		}
	});
});
