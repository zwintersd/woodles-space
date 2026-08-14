import type { Bounds, Camera, CardItem, StackItem, WhiteboardDocument, WhiteboardItem } from './model';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const STACK_HEADER_HEIGHT = 52;
export const STACK_INSET = 14;
export const STACK_GAP = 10;

export function clampZoom(value: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function screenToWorld(camera: Camera, point: { x: number; y: number }): { x: number; y: number } {
	return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom };
}

export function worldToScreen(camera: Camera, point: { x: number; y: number }): { x: number; y: number } {
	return { x: point.x * camera.zoom + camera.x, y: point.y * camera.zoom + camera.y };
}

export function zoomAroundPoint(camera: Camera, point: { x: number; y: number }, nextZoom: number): Camera {
	const zoom = clampZoom(nextZoom);
	const world = screenToWorld(camera, point);
	return { x: point.x - world.x * zoom, y: point.y - world.y * zoom, zoom };
}

export function fitCamera(bounds: Bounds, viewport: { width: number; height: number }, padding = 96): Camera {
	const safeWidth = Math.max(1, bounds.width + padding * 2);
	const safeHeight = Math.max(1, bounds.height + padding * 2);
	const zoom = clampZoom(Math.min(viewport.width / safeWidth, viewport.height / safeHeight));
	return {
		zoom,
		x: viewport.width / 2 - (bounds.x + bounds.width / 2) * zoom,
		y: viewport.height / 2 - (bounds.y + bounds.height / 2) * zoom
	};
}

export function boundsForItem(items: WhiteboardItem[], item: WhiteboardItem): Bounds {
	if (item.type === 'card' && item.stackId) {
		const stack = items.find((candidate): candidate is StackItem => candidate.id === item.stackId && candidate.type === 'stack');
		if (stack) return stackCardBounds(items, stack, item);
	}
	if (item.type === 'stack') {
		return { ...item, height: Math.max(item.height, stackContentHeight(items, item)) };
	}
	return { x: item.x, y: item.y, width: item.width, height: item.height };
}

export function stackContentHeight(items: WhiteboardItem[], stack: StackItem): number {
	const cards = stackCards(items, stack);
	if (!cards.length) return stack.height;
	const cardHeight = cards.reduce((total, card) => total + Math.max(72, card.height), 0);
	return Math.max(stack.height, STACK_HEADER_HEIGHT + STACK_INSET + cardHeight + STACK_GAP * (cards.length - 1) + STACK_INSET);
}

export function stackCardBounds(items: WhiteboardItem[], stack: StackItem, card: CardItem): Bounds {
	const cards = stackCards(items, stack);
	const index = Math.max(0, cards.findIndex((candidate) => candidate.id === card.id));
	const previousHeight = cards.slice(0, index).reduce((total, candidate) => total + Math.max(72, candidate.height) + STACK_GAP, 0);
	return {
		x: stack.x + STACK_INSET,
		y: stack.y + STACK_HEADER_HEIGHT + STACK_INSET + previousHeight,
		width: Math.max(120, stack.width - STACK_INSET * 2),
		height: Math.max(72, card.height)
	};
}

export function stackCards(items: WhiteboardItem[], stack: StackItem): CardItem[] {
	return stack.cardIds
		.map((id) => items.find((candidate): candidate is CardItem => candidate.id === id && candidate.type === 'card'))
		.filter((card): card is CardItem => Boolean(card));
}

export function centerOf(bounds: Bounds): { x: number; y: number } {
	return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function intersects(a: Bounds, b: Bounds): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function normalizeBounds(x: number, y: number, width: number, height: number): Bounds {
	return {
		x: width < 0 ? x + width : x,
		y: height < 0 ? y + height : y,
		width: Math.abs(width),
		height: Math.abs(height)
	};
}

export function connectorEndpoints(items: WhiteboardItem[], connector: Extract<WhiteboardItem, { type: 'connector' }>) {
	const from = items.find((item) => item.id === connector.fromId);
	const to = items.find((item) => item.id === connector.toId);
	if (!from || !to) return null;
	return { from: centerOf(boundsForItem(items, from)), to: centerOf(boundsForItem(items, to)) };
}

export function documentBounds(document: WhiteboardDocument): Bounds | null {
	const bounds = document.items
		.filter((item) => item.type !== 'connector' && !(item.type === 'card' && item.stackId))
		.map((item) => boundsForItem(document.items, item));
	if (!bounds.length) return null;
	const left = Math.min(...bounds.map((bound) => bound.x));
	const top = Math.min(...bounds.map((bound) => bound.y));
	const right = Math.max(...bounds.map((bound) => bound.x + bound.width));
	const bottom = Math.max(...bounds.map((bound) => bound.y + bound.height));
	return { x: left, y: top, width: right - left, height: bottom - top };
}

export function repairDocument(document: WhiteboardDocument): WhiteboardDocument {
	const availableObjects = new Set(document.items.filter((item) => item.type !== 'connector').map((item) => item.id));
	const baseItems = document.items.filter(
		(item) => item.type !== 'connector' || (availableObjects.has(item.fromId) && availableObjects.has(item.toId) && item.fromId !== item.toId)
	) as WhiteboardItem[];
	const stacks = baseItems.filter((item): item is StackItem => item.type === 'stack');
	const cards = baseItems.filter((item): item is CardItem => item.type === 'card');
	const stackIds = new Set(stacks.map((stack) => stack.id));
	const cardsById = new Map(cards.map((card) => [card.id, card]));
	const listedOwners = new Map<string, string[]>();

	for (const stack of stacks) {
		for (const cardId of [...new Set(stack.cardIds)]) {
			if (!cardsById.has(cardId)) continue;
			const owners = listedOwners.get(cardId) ?? [];
			owners.push(stack.id);
			listedOwners.set(cardId, owners);
		}
	}

	// A card's explicit stack wins. If it is missing, retain a single listed
	// membership so legacy or partially-written saves stay useful.
	const ownerByCard = new Map<string, string>();
	for (const card of cards) {
		if (card.stackId && stackIds.has(card.stackId)) {
			ownerByCard.set(card.id, card.stackId);
			continue;
		}
		const listed = listedOwners.get(card.id);
		if (listed?.length) ownerByCard.set(card.id, listed[0]);
	}

	const cardIdsByStack = new Map<string, string[]>();
	for (const stack of stacks) {
		const ordered = [...new Set(stack.cardIds)].filter((cardId) => ownerByCard.get(cardId) === stack.id);
		cardIdsByStack.set(stack.id, ordered);
	}
	for (const card of cards) {
		const owner = ownerByCard.get(card.id);
		if (!owner) continue;
		const ordered = cardIdsByStack.get(owner)!;
		if (!ordered.includes(card.id)) ordered.push(card.id);
	}

	const items = baseItems.map((item) => {
		if (item.type === 'stack') return { ...item, cardIds: cardIdsByStack.get(item.id) ?? [] };
		if (item.type !== 'card') return item;
		const owner = ownerByCard.get(item.id);
		if (owner) {
			return { ...item, stackId: owner, freePosition: item.freePosition ?? { x: item.x, y: item.y } };
		}
		if (item.stackId) {
			const free = item.freePosition ?? { x: item.x, y: item.y };
			return { ...item, stackId: undefined, freePosition: undefined, x: free.x, y: free.y };
		}
		return item;
	}) as WhiteboardItem[];
	return { ...document, items, journey: repairJourney(document, items) };
}

/**
 * A stop whose destination is gone is not a stop. Deleting a frame therefore
 * shortens the journey rather than leaving a step that lands nowhere.
 */
function repairJourney(document: WhiteboardDocument, items: WhiteboardItem[]): WhiteboardDocument['journey'] {
	const itemIds = new Set(items.filter((item) => item.type !== 'connector').map((item) => item.id));
	const viewpointIds = new Set(document.viewpoints.map((viewpoint) => viewpoint.id));
	const seen = new Set<string>();
	const stops = document.journey.stops.filter((stop) => {
		if (seen.has(stop.id)) return false;
		seen.add(stop.id);
		if (stop.target.kind === 'item') return itemIds.has(stop.target.id);
		if (stop.target.kind === 'viewpoint') return viewpointIds.has(stop.target.id);
		return true;
	});
	return stops.length === document.journey.stops.length ? document.journey : { ...document.journey, stops };
}

export function removeItems(document: WhiteboardDocument, ids: Set<string>): WhiteboardDocument {
	const removedStacks = document.items.filter((item): item is StackItem => ids.has(item.id) && item.type === 'stack');
	const items = document.items
		.filter((item) => !ids.has(item.id))
		.filter((item) => item.type !== 'connector' || (!ids.has(item.fromId) && !ids.has(item.toId)))
		.map((item) => {
			if (item.type !== 'card') return item;
			if (item.stackId && removedStacks.some((stack) => stack.id === item.stackId)) {
				const free = item.freePosition ?? { x: item.x, y: item.y };
				return { ...item, stackId: undefined, freePosition: undefined, x: free.x, y: free.y };
			}
			return item;
		}) as WhiteboardItem[];
	return repairDocument({ ...document, items });
}

export function insertCardIntoStack(document: WhiteboardDocument, cardId: string, stackId: string, index?: number): WhiteboardDocument {
	const card = document.items.find((item): item is CardItem => item.id === cardId && item.type === 'card');
	const stack = document.items.find((item): item is StackItem => item.id === stackId && item.type === 'stack');
	if (!card || !stack) return document;

	const freePosition = card.stackId ? card.freePosition : { x: card.x, y: card.y };
	const nextItems = document.items.map((item) => {
		if (item.type === 'stack') {
			const without = item.cardIds.filter((id) => id !== cardId);
			if (item.id !== stackId) return { ...item, cardIds: without };
			const insertion = Math.max(0, Math.min(index ?? without.length, without.length));
			return { ...item, cardIds: [...without.slice(0, insertion), cardId, ...without.slice(insertion)] };
		}
		if (item.id === cardId && item.type === 'card') return { ...item, stackId, freePosition };
		return item;
	}) as WhiteboardItem[];
	return { ...document, items: nextItems };
}

export function extractCardFromStack(document: WhiteboardDocument, cardId: string, point?: { x: number; y: number }): WhiteboardDocument {
	const card = document.items.find((item): item is CardItem => item.id === cardId && item.type === 'card');
	if (!card || !card.stackId) return document;
	const position = point ?? card.freePosition ?? { x: card.x, y: card.y };
	const items = document.items.map((item) => {
		if (item.type === 'stack') return { ...item, cardIds: item.cardIds.filter((id) => id !== cardId) };
		if (item.id === cardId && item.type === 'card') {
			return { ...item, stackId: undefined, freePosition: undefined, x: position.x, y: position.y };
		}
		return item;
	}) as WhiteboardItem[];
	return { ...document, items };
}

export function reorderStackCard(document: WhiteboardDocument, stackId: string, cardId: string, pointY: number): WhiteboardDocument {
	const stack = document.items.find((item): item is StackItem => item.id === stackId && item.type === 'stack');
	if (!stack || !stack.cardIds.includes(cardId)) return document;
	const cards = stackCards(document.items, stack).filter((card) => card.id !== cardId);
	let index = cards.length;
	for (let i = 0; i < cards.length; i += 1) {
		const bounds = stackCardBounds(document.items, { ...stack, cardIds: cards.map((card) => card.id) }, cards[i]);
		if (pointY < bounds.y + bounds.height / 2) {
			index = i;
			break;
		}
	}
	return insertCardIntoStack(document, cardId, stackId, index);
}
