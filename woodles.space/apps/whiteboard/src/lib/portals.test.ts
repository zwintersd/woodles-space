import { describe, expect, it } from 'vitest';
import {
	arrivalCamera,
	breadcrumbs,
	enterCamera,
	isPortal,
	popTrailTo,
	portalTitle,
	portals,
	portalsTo,
	pushTrail,
	returnCamera,
	trailHasBoard,
	type TrailStep
} from './portals';
import { visibleBounds } from './camera';
import { removeItems } from './geometry';
import {
	createCard,
	createEmptyBoard,
	createFrame,
	createPortal,
	isWhiteboardDocument,
	type Camera,
	type WhiteboardDocument
} from './model';
import { MAX_ZOOM, MIN_ZOOM } from './geometry';

const viewport = { width: 1200, height: 800 };

function step(boardId: string, title: string, camera: Camera = { x: 0, y: 0, zoom: 1 }, portalId: string | null = null): TrailStep {
	return { boardId, title, camera, portalId };
}

function board(title: string): WhiteboardDocument {
	return { ...createEmptyBoard(), board: { id: `board-${title}`, title } };
}

describe('a doorway to another board', () => {
	it('holds the board id and nothing else about it', () => {
		const portal = createPortal(100, 100, 'board-brushes', 'Brushes');
		expect(portal.type).toBe('portal');
		expect(portal.boardId).toBe('board-brushes');
		expect(isPortal(portal)).toBe(true);
		expect(isPortal(createCard(0, 0))).toBe(false);
	});

	it('falls back to the name of the board it opens onto', () => {
		expect(portalTitle(createPortal(0, 0, 'b', 'Brushes'), 'Brush behaviour')).toBe('Brushes');
		expect(portalTitle(createPortal(0, 0, 'b', '  '), 'Brush behaviour')).toBe('Brush behaviour');
		expect(portalTitle(createPortal(0, 0, 'b', ''), null)).toBe('Untitled board');
	});

	it('gathers the doorways on a board, and the ones leading somewhere in particular', () => {
		const items = [
			createPortal(0, 0, 'board-brushes', 'Brushes'),
			createPortal(300, 0, 'board-skin', 'Skin'),
			createPortal(600, 0, 'board-brushes', 'Brushes again'),
			createCard(0, 400)
		];
		expect(portals(items)).toHaveLength(3);
		expect(portalsTo(items, 'board-brushes').map((portal) => portal.title)).toEqual(['Brushes', 'Brushes again']);
	});

	it('is deleted like any other object on the board', () => {
		const portal = { ...createPortal(0, 0, 'board-brushes'), id: 'door' };
		const document = { ...createEmptyBoard(), items: [portal, createCard(400, 0)] };
		expect(removeItems(document, new Set(['door'])).items).toHaveLength(1);
	});
});

describe('the trail', () => {
	it('remembers the camera of each board on the way down', () => {
		let trail: TrailStep[] = [];
		trail = pushTrail(trail, step('board-game', 'Makeup Game', { x: -40, y: -90, zoom: 0.6 }, 'door-1'));
		trail = pushTrail(trail, step('board-brushes', 'Brushes', { x: 12, y: 8, zoom: 1.4 }, 'door-2'));
		expect(trail.map((entry) => entry.title)).toEqual(['Makeup Game', 'Brushes']);
		expect(trail[0].camera).toEqual({ x: -40, y: -90, zoom: 0.6 });
	});

	it('climbs back to a board and drops everything below it', () => {
		const trail = [step('a', 'Makeup Game'), step('b', 'Brushes'), step('c', 'Pickup')];
		const climbed = popTrailTo(trail, 0)!;
		expect(climbed.step.boardId).toBe('a');
		expect(climbed.trail).toEqual([]);

		const partway = popTrailTo(trail, 1)!;
		expect(partway.step.boardId).toBe('b');
		expect(partway.trail.map((entry) => entry.boardId)).toEqual(['a']);
	});

	it('has nowhere to climb to outside the trail', () => {
		const trail = [step('a', 'Makeup Game')];
		expect(popTrailTo(trail, 1)).toBeNull();
		expect(popTrailTo(trail, -1)).toBeNull();
		expect(popTrailTo([], 0)).toBeNull();
	});

	it('knows whether a board is already somewhere above, so a loop can be seen', () => {
		const trail = [step('a', 'Makeup Game'), step('b', 'Brushes')];
		expect(trailHasBoard(trail, 'a')).toBe(true);
		expect(trailHasBoard(trail, 'c')).toBe(false);
	});
});

describe('breadcrumbs', () => {
	it('reads boards then frames, as one line', () => {
		const document: WhiteboardDocument = {
			...board('Brushes'),
			items: [{ ...createFrame(0, 0, 900, 600), id: 'pickup', title: 'Pickup Physics' }]
		};
		const camera = {
			zoom: 1.2,
			x: viewport.width / 2 - 450 * 1.2,
			y: viewport.height / 2 - 300 * 1.2
		};
		const crumbs = breadcrumbs([step('board-game', 'Makeup Game')], document, camera, viewport);
		expect(crumbs.map((crumb) => crumb.label)).toEqual(['Makeup Game', 'Brushes', 'Pickup Physics']);
		expect(crumbs.map((crumb) => crumb.kind)).toEqual(['board', 'here', 'frame']);
	});

	it('is just this board when nothing is above and nothing is around', () => {
		const crumbs = breadcrumbs([], board('Makeup Game'), { x: 0, y: 0, zoom: 1 }, viewport);
		expect(crumbs).toEqual([{ kind: 'here', label: 'Makeup Game' }]);
	});

	it('names an untitled board rather than showing a gap', () => {
		const crumbs = breadcrumbs([step('a', '   ')], board('  '), { x: 0, y: 0, zoom: 1 }, viewport);
		expect(crumbs.map((crumb) => crumb.label)).toEqual(['Untitled board', 'Untitled board']);
	});

	it('carries the depth to climb back to for each board above', () => {
		const trail = [step('a', 'Makeup Game'), step('b', 'Brushes')];
		const crumbs = breadcrumbs(trail, board('Pickup'), { x: 0, y: 0, zoom: 1 }, viewport);
		expect(crumbs.filter((crumb) => crumb.kind === 'board')).toEqual([
			{ kind: 'board', label: 'Makeup Game', depth: 0 },
			{ kind: 'board', label: 'Brushes', depth: 1 }
		]);
	});
});

describe('going through', () => {
	it('comes down onto the doorway, centred on it', () => {
		const portal = { x: 200, y: 100, width: 230, height: 168 };
		const camera = enterCamera(portal, viewport);
		const view = visibleBounds(camera, viewport);
		expect(view.x + view.width / 2).toBeCloseTo(portal.x + portal.width / 2, 4);
		expect(view.y + view.height / 2).toBeCloseTo(portal.y + portal.height / 2, 4);
		// Much closer than a resting view: the doorway dominates what is on screen.
		expect(portal.width / view.width).toBeGreaterThan(0.5);
	});

	it('stays a camera the board will accept, however small the doorway', () => {
		// Filling the screen with a small doorway would want a zoom past the
		// board's maximum, and a camera out of range fails validation on save.
		for (const width of [40, 120, 230, 900]) {
			const camera = enterCamera({ x: 0, y: 0, width, height: width * 0.7 }, viewport);
			expect(camera.zoom).toBeLessThanOrEqual(MAX_ZOOM);
			expect(camera.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
			expect(isWhiteboardDocument({ ...createEmptyBoard(), camera })).toBe(true);
		}
	});

	it('never leaves the board with a camera it cannot save on the way back either', () => {
		const camera = returnCamera({ x: 0, y: 0, width: 12, height: 9 }, { x: 0, y: 0, zoom: 1 }, viewport);
		expect(isWhiteboardDocument({ ...createEmptyBoard(), camera })).toBe(true);
	});

	it('arrives at the child framing that the doorway was showing', () => {
		const child: WhiteboardDocument = {
			...board('Brushes'),
			items: [createFrame(0, 0, 1800, 1200)]
		};
		const arrival = arrivalCamera(child, viewport);
		const view = visibleBounds(arrival, viewport);
		expect(view.width).toBeGreaterThanOrEqual(1800);
	});

	it('honours a child board that has chosen its own front door', () => {
		const child: WhiteboardDocument = { ...board('Brushes'), home: { x: -300, y: -200, zoom: 1.5 } };
		expect(arrivalCamera(child, viewport)).toEqual({ x: -300, y: -200, zoom: 1.5 });
	});

	it('comes back out framed on the doorway it left through', () => {
		const portal = { x: 200, y: 100, width: 230, height: 168 };
		const resting = { x: 5, y: 5, zoom: 1 };
		const back = returnCamera(portal, resting, viewport);
		const view = visibleBounds(back, viewport);
		expect(view.x + view.width / 2).toBeCloseTo(portal.x + portal.width / 2, 4);
		expect(back).not.toEqual(resting);
	});

	it('comes back to where it was standing when there is no doorway to aim at', () => {
		const resting = { x: 5, y: 5, zoom: 1 };
		expect(returnCamera(null, resting, viewport)).toEqual(resting);
	});
});
