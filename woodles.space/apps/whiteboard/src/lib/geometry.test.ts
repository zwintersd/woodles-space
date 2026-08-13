import { describe, expect, it } from 'vitest';
import {
	boundsForItem,
	connectorEndpoints,
	extractCardFromStack,
	fitCamera,
	insertCardIntoStack,
	repairDocument,
	removeItems,
	screenToWorld,
	zoomAroundPoint
} from './geometry';
import { createCard, createConnector, createEmptyBoard, createFrame, createStack, type WhiteboardDocument } from './model';

function fixed<T extends { id: string }>(item: T, id: string): T {
	return { ...item, id };
}

describe('whiteboard geometry', () => {
	it('keeps the world point under the cursor during zoom', () => {
		const camera = { x: 120, y: -30, zoom: 0.8 };
		const cursor = { x: 410, y: 260 };
		const before = screenToWorld(camera, cursor);
		const after = zoomAroundPoint(camera, cursor, 2.3);
		expect(screenToWorld(after, cursor)).toEqual(before);
	});

	it('fits a frame inside the viewport with breathing room', () => {
		const camera = fitCamera({ x: 100, y: 200, width: 400, height: 300 }, { width: 1200, height: 800 }, 80);
		expect(camera.zoom).toBeCloseTo(1.74, 1);
		expect(camera.x + 300 * camera.zoom).toBeCloseTo(600, 5);
		expect(camera.y + 350 * camera.zoom).toBeCloseTo(400, 5);
	});

	it('lays a card inside a stack, then restores it as free spatial material', () => {
		const card = fixed(createCard(40, 60), 'card');
		const stack = fixed(createStack(400, 100), 'stack');
		let document: WhiteboardDocument = { ...createEmptyBoard(), items: [card, stack] };
		document = insertCardIntoStack(document, card.id, stack.id);
		const stackedCard = document.items.find((item) => item.id === card.id)!;
		expect(boundsForItem(document.items, stackedCard).x).toBe(414);
		document = extractCardFromStack(document, card.id, { x: 720, y: 420 });
		const extracted = document.items.find((item) => item.id === card.id)!;
		expect(extracted.type === 'card' && extracted.stackId).toBeUndefined();
		expect(extracted.x).toBe(720);
	});

	it('keeps connector centers attached to moved scene geometry', () => {
		const first = fixed(createCard(0, 0), 'first');
		const second = fixed(createFrame(500, 300), 'second');
		const line = fixed(createConnector(first.id, second.id), 'line');
		const endpoints = connectorEndpoints([first, second, line], line)!;
		expect(endpoints.from).toEqual({ x: 125, y: 75 });
		expect(endpoints.to).toEqual({ x: 750, y: 480 });
	});

	it('removes attached lines with their deleted ideas', () => {
		const first = fixed(createCard(0, 0), 'first');
		const second = fixed(createCard(500, 0), 'second');
		const line = fixed(createConnector(first.id, second.id), 'line');
		const document = { ...createEmptyBoard(), items: [first, second, line] };
		const next = removeItems(document, new Set([first.id]));
		expect(next.items.map((item) => item.id)).toEqual([second.id]);
	});

	it('canonicalizes mismatched stack membership without duplicating cards', () => {
		const first = fixed(createStack(0, 0), 'first-stack');
		const second = fixed(createStack(500, 0), 'second-stack');
		const firstCard = { ...fixed(createCard(0, 0), 'first-card'), stackId: first.id };
		const secondCard = fixed(createCard(0, 0), 'second-card');
		const document: WhiteboardDocument = {
			...createEmptyBoard(),
			items: [
				firstCard,
				secondCard,
				{ ...first, cardIds: [] },
				{ ...second, cardIds: [firstCard.id, secondCard.id, secondCard.id] }
			]
		};

		const repaired = repairDocument(document);
		const repairedFirst = repaired.items.find((item) => item.id === first.id);
		const repairedSecond = repaired.items.find((item) => item.id === second.id);
		const repairedFirstCard = repaired.items.find((item) => item.id === firstCard.id);
		const repairedSecondCard = repaired.items.find((item) => item.id === secondCard.id);

		expect(repairedFirst?.type === 'stack' && repairedFirst.cardIds).toEqual([firstCard.id]);
		expect(repairedSecond?.type === 'stack' && repairedSecond.cardIds).toEqual([secondCard.id]);
		expect(repairedFirstCard?.type === 'card' && repairedFirstCard.stackId).toBe(first.id);
		expect(repairedSecondCard?.type === 'card' && repairedSecondCard.stackId).toBe(second.id);
	});
});
