import { describe, expect, it } from 'vitest';
import {
	currentFrame,
	fitBoardCamera,
	focusCamera,
	frameAncestry,
	frameContains,
	frameSequence,
	itemLabel,
	locateCamera,
	stepFrame
} from './navigation';
import { visibleBounds } from './camera';
import { createCard, createEmptyBoard, createFrame, type FrameItem, type WhiteboardItem } from './model';

const viewport = { width: 1200, height: 800 };

function frame(id: string, title: string, x: number, y: number, width = 400, height = 300): FrameItem {
	return { ...createFrame(x, y, width, height), id, title };
}

function cameraOver(bounds: { x: number; y: number; width: number; height: number }, zoom: number) {
	return {
		zoom,
		x: viewport.width / 2 - (bounds.x + bounds.width / 2) * zoom,
		y: viewport.height / 2 - (bounds.y + bounds.height / 2) * zoom
	};
}

describe('frame sequence', () => {
	it('reads the board in rows: top to bottom, left to right inside a row', () => {
		const items = [
			frame('c', 'Products', 900, 40),
			frame('a', 'Overview', 0, 0),
			frame('d', 'Foundation', 100, 700),
			frame('b', 'Brushes', 460, 60)
		];
		expect(frameSequence(items).map((item) => item.title)).toEqual(['Overview', 'Brushes', 'Products', 'Foundation']);
	});

	it('visits a frame before the frames nested inside it', () => {
		const items = [frame('inner', 'Brush Pickup', 120, 120, 160, 120), frame('outer', 'Brushes', 60, 60, 600, 400)];
		expect(frameSequence(items).map((item) => item.title)).toEqual(['Brushes', 'Brush Pickup']);
	});

	it('keeps its order when frames are handed over in a different one', () => {
		const items = [frame('a', 'A', 0, 0), frame('b', 'B', 500, 20), frame('c', 'C', 0, 600)];
		const forwards = frameSequence(items).map((item) => item.id);
		const backwards = frameSequence([...items].reverse()).map((item) => item.id);
		expect(backwards).toEqual(forwards);
	});

	it('steps through the sequence and wraps around at both ends', () => {
		const sequence = frameSequence([frame('a', 'A', 0, 0), frame('b', 'B', 500, 20), frame('c', 'C', 0, 600)]);
		expect(stepFrame(sequence, 'a', 1)?.id).toBe('b');
		expect(stepFrame(sequence, 'c', 1)?.id).toBe('a');
		expect(stepFrame(sequence, 'a', -1)?.id).toBe('c');
		expect(stepFrame(sequence, null, 1)?.id).toBe('a');
		expect(stepFrame([], null, 1)).toBeNull();
	});
});

describe('location awareness', () => {
	const outer = frame('outer', 'Brushes', 0, 0, 2000, 1400);
	const inner = frame('inner', 'Brush Pickup', 400, 300, 500, 360);
	const items: WhiteboardItem[] = [outer, inner];

	it('reports the chain of frames the camera is inside, outermost first', () => {
		const path = locateCamera(items, cameraOver(inner, 1.4), viewport);
		expect(path.map((item) => item.title)).toEqual(['Brushes', 'Brush Pickup']);
		expect(currentFrame(items, cameraOver(inner, 1.4), viewport)?.id).toBe('inner');
	});

	it('drops the inner frame once the camera has climbed above it', () => {
		const wide = cameraOver(outer, 0.4);
		expect(locateCamera(items, wide, viewport).map((item) => item.title)).toEqual(['Brushes']);
	});

	it('reports nowhere in particular when the whole board is small in view', () => {
		const distant = cameraOver(outer, 0.1);
		expect(visibleBounds(distant, viewport).width).toBeGreaterThan(outer.width * 2);
		expect(locateCamera(items, distant, viewport)).toEqual([]);
		expect(currentFrame(items, distant, viewport)).toBeNull();
	});

	it('reports nowhere when the camera is off past the edge of every frame', () => {
		expect(locateCamera(items, cameraOver({ x: 9000, y: 9000, width: 10, height: 10 }, 1), viewport)).toEqual([]);
	});

	it('lists ancestry from the widest enclosing frame inward', () => {
		const middle = frame('middle', 'Middle', 200, 200, 1200, 900);
		expect(frameAncestry([outer, middle, inner], inner).map((item) => item.id)).toEqual(['outer', 'middle', 'inner']);
	});

	it('nests a frame drawn flush against its container', () => {
		expect(frameContains({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
		expect(frameContains({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 140, height: 100 })).toBe(false);
	});
});

describe('framing a destination', () => {
	it('centres the camera on the thing being focused', () => {
		const card = { ...createCard(500, 400), id: 'card' };
		const camera = focusCamera([card], 'card', viewport)!;
		const view = visibleBounds(camera, viewport);
		expect(view.x + view.width / 2).toBeCloseTo(card.x + card.width / 2, 4);
		expect(view.y + view.height / 2).toBeCloseTo(card.y + card.height / 2, 4);
	});

	it('has nothing to focus for a missing or unframeable target', () => {
		expect(focusCamera([], 'gone', viewport)).toBeNull();
	});

	it('falls back to a plain centred view when the board is empty', () => {
		const camera = fitBoardCamera(createEmptyBoard(), viewport);
		expect(camera).toEqual({ x: 600, y: 400, zoom: 1 });
	});

	it('fits everything on a board that has material', () => {
		const board = { ...createEmptyBoard(), items: [frame('a', 'A', 0, 0, 3000, 2000)] };
		const view = visibleBounds(fitBoardCamera(board, viewport), viewport);
		expect(view.width).toBeGreaterThanOrEqual(3000);
		expect(view.height).toBeGreaterThanOrEqual(2000);
	});
});

describe('labels', () => {
	it('names each kind of thing, falling back to its own words', () => {
		expect(itemLabel(frame('a', '  ', 0, 0))).toBe('Untitled frame');
		expect(itemLabel({ ...createCard(0, 0), title: '', body: 'brush pickup\nsecond line' })).toBe('brush pickup');
		expect(itemLabel({ ...createCard(0, 0), title: 'Foundation' })).toBe('Foundation');
	});
});
