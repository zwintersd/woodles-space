import { describe, expect, it } from 'vitest';
import { defaultImageEdits, imageViewport, validImageEdits } from './imageEditing';
import { createImage, createEmptyBoard, isWhiteboardDocument, snapshotDocument } from './model';

describe('image editing', () => {
	it('keeps the source ratio, swaps it on quarter turns, and crops the rotated bounds', () => {
		const edits = defaultImageEdits();
		expect(imageViewport(2, edits).aspectRatio).toBeCloseTo(2);
		edits.rotation = 90;
		expect(imageViewport(2, edits).aspectRatio).toBeCloseTo(.5);
		edits.crop.top = 25;
		edits.crop.bottom = 25;
		expect(imageViewport(2, edits).aspectRatio).toBeCloseTo(1);
	});
	it('rejects empty crops and invalid rotation or shape', () => {
		const edits = defaultImageEdits();
		expect(validImageEdits(edits)).toBe(true);
		expect(validImageEdits({ ...edits, rotation: NaN })).toBe(false);
		expect(validImageEdits({ ...edits, shape: 'unknown' })).toBe(false);
		expect(validImageEdits({ ...edits, crop: { ...edits.crop, left: 60, right: 40 } })).toBe(false);
	});
	it('saves edits with the same asset and isolates history snapshots', () => {
		const image = { ...createImage(0, 0, 'original', 'Photo', 2), edits: defaultImageEdits() };
		const document = { ...createEmptyBoard(), items: [image] };
		const snapshot = snapshotDocument(document);
		image.edits.crop.left = 20;
		expect(snapshot.items[0]).toMatchObject({ assetId: 'original', edits: { crop: { left: 0 } } });
		expect(isWhiteboardDocument(JSON.parse(JSON.stringify(document)))).toBe(true);
	});
});
