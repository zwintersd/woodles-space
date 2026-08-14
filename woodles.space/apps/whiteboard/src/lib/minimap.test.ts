import { describe, expect, it } from 'vitest';
import { cameraCentredOn, minimapExtent, minimapMarks, minimapProjection } from './minimap';
import { insertCardIntoStack } from './geometry';
import { createCard, createEmptyBoard, createFrame, createStack, type WhiteboardDocument } from './model';

const viewport = { width: 1200, height: 800 };
const mapSize = { width: 180, height: 120 };

function boardWith(items: WhiteboardDocument['items']): WhiteboardDocument {
	return { ...createEmptyBoard(), items };
}

describe('the overview extent', () => {
	it('covers the material and wherever the camera is, so the view marker stays on the map', () => {
		const board = boardWith([createFrame(0, 0, 400, 300)]);
		const far = { x: -6000, y: -4000, zoom: 1 };
		const extent = minimapExtent(board, far, viewport);
		expect(extent.x).toBeLessThanOrEqual(0);
		expect(extent.x + extent.width).toBeGreaterThanOrEqual(6000 + viewport.width);
		expect(extent.y + extent.height).toBeGreaterThanOrEqual(4000 + viewport.height);
	});

	it('is just the view when the board holds nothing yet', () => {
		const extent = minimapExtent(createEmptyBoard(), { x: 0, y: 0, zoom: 1 }, viewport);
		expect(extent.x).toBeCloseTo(0, 6);
		expect(extent.y).toBeCloseTo(0, 6);
		expect(extent.width).toBe(1200);
		expect(extent.height).toBe(800);
	});
});

describe('projecting onto the overview', () => {
	it('fits the extent inside the map and centres the slack', () => {
		const extent = { x: 0, y: 0, width: 2000, height: 1000 };
		const projection = minimapProjection(extent, mapSize, 10);
		const projected = projection.project(extent);
		expect(projected.width).toBeLessThanOrEqual(mapSize.width - 20 + 0.001);
		expect(projected.height).toBeLessThanOrEqual(mapSize.height - 20 + 0.001);
		expect(projected.x + projected.width / 2).toBeCloseTo(mapSize.width / 2, 6);
		expect(projected.y + projected.height / 2).toBeCloseTo(mapSize.height / 2, 6);
	});

	it('reads a click on the map back as the world point under it', () => {
		const projection = minimapProjection({ x: -500, y: 200, width: 2000, height: 1000 }, mapSize, 10);
		const world = { x: 420, y: 640 };
		const onMap = projection.project({ ...world, width: 0, height: 0 });
		const back = projection.toWorld({ x: onMap.x, y: onMap.y });
		expect(back.x).toBeCloseTo(world.x, 6);
		expect(back.y).toBeCloseTo(world.y, 6);
	});

	it('keeps the smallest thing on the board visible as at least a pixel', () => {
		const projection = minimapProjection({ x: 0, y: 0, width: 40_000, height: 40_000 }, mapSize, 8);
		expect(projection.project({ x: 0, y: 0, width: 2, height: 2 }).width).toBeGreaterThanOrEqual(1);
	});
});

describe('what the overview draws', () => {
	it('shows the board as shapes, leaving out lines and cards held in a stack', () => {
		const card = { ...createCard(0, 0), id: 'card' };
		const stack = { ...createStack(400, 0), id: 'stack' };
		const board = insertCardIntoStack(boardWith([card, stack, createFrame(0, 0, 900, 600)]), 'card', 'stack');
		const marks = minimapMarks(board.items);
		expect(marks.map((mark) => mark.kind).sort()).toEqual(['frame', 'stack']);
	});
});

describe('travelling by the overview', () => {
	it('moves to the point without changing how close you are', () => {
		const camera = { x: -100, y: -200, zoom: 1.75 };
		const moved = cameraCentredOn({ x: 900, y: 450 }, camera, viewport);
		expect(moved.zoom).toBe(camera.zoom);
		expect((viewport.width / 2 - moved.x) / moved.zoom).toBeCloseTo(900, 6);
		expect((viewport.height / 2 - moved.y) / moved.zoom).toBeCloseTo(450, 6);
	});
});
