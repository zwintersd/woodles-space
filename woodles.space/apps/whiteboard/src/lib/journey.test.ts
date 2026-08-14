import { describe, expect, it } from 'vitest';
import {
	addStop,
	advanceStop,
	hasStop,
	moveStop,
	removeStop,
	resolveJourney,
	setJourneyStops,
	setStopHold,
	stepStop,
	suggestedOutline,
	suggestedStops
} from './journey';
import { removeItems } from './geometry';
import { createCard, createEmptyBoard, createFrame, createViewpoint, type WhiteboardDocument } from './model';

const viewport = { width: 1200, height: 800 };

function boardWithFrames(): WhiteboardDocument {
	return {
		...createEmptyBoard(),
		items: [
			{ ...createFrame(0, 0, 600, 400), id: 'brushes', title: 'Brushes' },
			{ ...createFrame(800, 20, 500, 380), id: 'products', title: 'Products' },
			{ ...createFrame(0, 700, 500, 380), id: 'foundation', title: 'Foundation' }
		]
	};
}

describe('suggesting a journey', () => {
	it('offers an overview followed by every frame in reading order', () => {
		expect(suggestedOutline(boardWithFrames())).toEqual(['Overview', 'Brushes', 'Products', 'Foundation']);
		const stops = suggestedStops(boardWithFrames());
		expect(stops.map((stop) => stop.target)).toEqual([
			{ kind: 'board' },
			{ kind: 'item', id: 'brushes' },
			{ kind: 'item', id: 'products' },
			{ kind: 'item', id: 'foundation' }
		]);
	});

	it('has nothing to suggest on a board with no frames', () => {
		expect(suggestedStops({ ...createEmptyBoard(), items: [createCard(0, 0)] })).toEqual([]);
		expect(suggestedOutline(createEmptyBoard())).toEqual([]);
	});
});

describe('resolving a journey', () => {
	it('reads a stop destination fresh, so a renamed frame is followed', () => {
		let board = addStop(boardWithFrames(), { kind: 'item', id: 'brushes' });
		expect(resolveJourney(board, viewport)[0].label).toBe('Brushes');
		board = {
			...board,
			items: board.items.map((item) => (item.id === 'brushes' ? { ...item, title: 'Brush Pickup' } : item))
		};
		expect(resolveJourney(board, viewport)[0].label).toBe('Brush Pickup');
	});

	it('gives every stop a camera to fly to', () => {
		const viewpoint = createViewpoint('From above', { x: -40, y: -60, zoom: 0.5 });
		let board = { ...boardWithFrames(), viewpoints: [viewpoint] };
		board = addStop(board, { kind: 'board' });
		board = addStop(board, { kind: 'item', id: 'foundation' });
		board = addStop(board, { kind: 'viewpoint', id: viewpoint.id });
		const resolved = resolveJourney(board, viewport);
		expect(resolved.map((entry) => entry.kind)).toEqual(['board', 'item', 'viewpoint']);
		expect(resolved.every((entry) => entry.camera !== null)).toBe(true);
		expect(resolved[2].camera).toEqual(viewpoint.camera);
	});

	it('loses the stop when the frame it pointed at is deleted', () => {
		const board = addStop(boardWithFrames(), { kind: 'item', id: 'brushes' });
		expect(board.journey.stops).toHaveLength(1);
		const pruned = removeItems(board, new Set(['brushes']));
		expect(pruned.journey.stops).toHaveLength(0);
	});
});

describe('arranging a journey', () => {
	it('adds, reorders, and removes stops', () => {
		let board = addStop(boardWithFrames(), { kind: 'item', id: 'brushes' });
		board = addStop(board, { kind: 'item', id: 'products' });
		board = addStop(board, { kind: 'item', id: 'foundation' });
		const [, second] = board.journey.stops;

		board = moveStop(board, second.id, -1);
		expect(resolveJourney(board, viewport).map((entry) => entry.label)).toEqual(['Products', 'Brushes', 'Foundation']);

		board = removeStop(board, second.id);
		expect(resolveJourney(board, viewport).map((entry) => entry.label)).toEqual(['Brushes', 'Foundation']);
	});

	it('leaves the order alone when a move would fall off either end', () => {
		let board = addStop(boardWithFrames(), { kind: 'item', id: 'brushes' });
		board = addStop(board, { kind: 'item', id: 'products' });
		const [first, last] = board.journey.stops;
		expect(moveStop(board, first.id, -1)).toBe(board);
		expect(moveStop(board, last.id, 1)).toBe(board);
		expect(moveStop(board, 'not-a-stop', 1)).toBe(board);
	});

	it('keeps a hold inside a sensible range', () => {
		const board = addStop(boardWithFrames(), { kind: 'board' });
		const [stop] = board.journey.stops;
		expect(setStopHold(board, stop.id, 0).journey.stops[0].hold).toBe(1);
		expect(setStopHold(board, stop.id, 900).journey.stops[0].hold).toBe(30);
		expect(setStopHold(board, stop.id, 6.4).journey.stops[0].hold).toBe(6);
	});

	it('knows whether somewhere is already on the journey', () => {
		const board = addStop(boardWithFrames(), { kind: 'item', id: 'brushes' });
		expect(hasStop(board, { kind: 'item', id: 'brushes' })).toBe(true);
		expect(hasStop(board, { kind: 'item', id: 'foundation' })).toBe(false);
		expect(hasStop(board, { kind: 'board' })).toBe(false);
		expect(hasStop(addStop(board, { kind: 'board' }), { kind: 'board' })).toBe(true);
	});

	it('accepts a whole sequence at once', () => {
		const board = setJourneyStops(boardWithFrames(), suggestedStops(boardWithFrames()));
		expect(resolveJourney(board, viewport).map((entry) => entry.label)).toEqual(['Overview', 'Brushes', 'Products', 'Foundation']);
	});
});

describe('playing a journey', () => {
	it('runs to the end and stops there', () => {
		expect(advanceStop(0, 3, false)).toBe(1);
		expect(advanceStop(2, 3, false)).toBeNull();
	});

	it('returns to the beginning when the journey loops', () => {
		expect(advanceStop(2, 3, true)).toBe(0);
	});

	it('has nowhere to go on an empty journey', () => {
		expect(advanceStop(0, 0, true)).toBeNull();
	});

	it('wraps in both directions when stepping by hand', () => {
		expect(stepStop(0, 3, -1)).toBe(2);
		expect(stepStop(2, 3, 1)).toBe(0);
		expect(stepStop(0, 0, 1)).toBe(0);
	});
});
