import { describe, expect, it } from 'vitest';
import {
	cameraForBounds,
	camerasMatch,
	canGoBack,
	canGoForward,
	createCameraHistory,
	planCameraFlight,
	pushCameraMark,
	scaleName,
	stepHistory,
	visibleBounds
} from './camera';
import type { Camera } from './model';

const viewport = { width: 1200, height: 800 };

function centreOf(camera: Camera) {
	const view = visibleBounds(camera, viewport);
	return { x: view.x + view.width / 2, y: view.y + view.height / 2 };
}

describe('camera flight', () => {
	it('starts where you are and ends where you asked for', () => {
		const from: Camera = { x: 0, y: 0, zoom: 1 };
		const to: Camera = { x: -4200, y: -1800, zoom: 2.4 };
		const flight = planCameraFlight(from, to, viewport);
		const start = flight.at(0);
		expect(start.x).toBeCloseTo(from.x, 3);
		expect(start.y).toBeCloseTo(from.y, 3);
		expect(start.zoom).toBeCloseTo(from.zoom, 3);
		expect(flight.at(1)).toEqual(to);
	});

	it('arcs out to show the board while it travels, instead of sliding across it', () => {
		const from: Camera = { x: 0, y: 0, zoom: 1 };
		const to: Camera = { x: -9000, y: 0, zoom: 1 };
		const flight = planCameraFlight(from, to, viewport);
		const middle = flight.at(0.5);
		// A linear tween would hold zoom at 1 the whole way across.
		expect(middle.zoom).toBeLessThan(0.5);
		expect(visibleBounds(middle, viewport).width).toBeGreaterThan(visibleBounds(from, viewport).width * 2);
	});

	it('moves the centre steadily along the straight line between the two views', () => {
		const from: Camera = { x: 0, y: 0, zoom: 1 };
		const to: Camera = { x: -3000, y: -1500, zoom: 1 };
		const flight = planCameraFlight(from, to, viewport);
		const startCentre = centreOf(from);
		const endCentre = centreOf(to);
		for (const progress of [0.25, 0.5, 0.75]) {
			const centre = centreOf(flight.at(progress));
			const along = (centre.x - startCentre.x) / (endCentre.x - startCentre.x);
			expect(along).toBeGreaterThan(0);
			expect(along).toBeLessThan(1);
			// On the line: the same fraction of the way along both axes.
			expect(centre.y).toBeCloseTo(startCentre.y + (endCentre.y - startCentre.y) * along, 4);
		}
	});

	it('advances the journey monotonically rather than doubling back', () => {
		const flight = planCameraFlight({ x: 0, y: 0, zoom: 0.6 }, { x: -2400, y: 900, zoom: 2 }, viewport);
		let previous = -Infinity;
		for (let step = 0; step <= 20; step += 1) {
			const centre = centreOf(flight.at(step / 20));
			expect(centre.x).toBeGreaterThanOrEqual(previous);
			previous = centre.x;
		}
	});

	it('zooms evenly in place when there is nowhere to travel', () => {
		const from: Camera = { x: -600, y: -400, zoom: 0.5 };
		const centre = centreOf(from);
		const to: Camera = { x: viewport.width / 2 - centre.x * 2, y: viewport.height / 2 - centre.y * 2, zoom: 2 };
		const flight = planCameraFlight(from, to, viewport);
		for (const progress of [0.25, 0.5, 0.75]) {
			const held = centreOf(flight.at(progress));
			expect(held.x).toBeCloseTo(centre.x, 6);
			expect(held.y).toBeCloseTo(centre.y, 6);
		}
		expect(flight.at(0.5).zoom).toBeGreaterThan(from.zoom);
		expect(flight.at(0.5).zoom).toBeLessThan(to.zoom);
	});

	it('gives a longer journey more time, within a bounded range', () => {
		const near = planCameraFlight({ x: 0, y: 0, zoom: 1 }, { x: -120, y: -80, zoom: 1.1 }, viewport);
		const far = planCameraFlight({ x: 0, y: 0, zoom: 1 }, { x: -14000, y: 9000, zoom: 3 }, viewport);
		expect(far.duration).toBeGreaterThan(near.duration);
		expect(near.duration).toBeGreaterThanOrEqual(280);
		expect(far.duration).toBeLessThanOrEqual(1500);
	});

	it('treats a move to the same place as a move that is already over', () => {
		const camera: Camera = { x: 42, y: -17, zoom: 1.25 };
		const flight = planCameraFlight(camera, { ...camera }, viewport);
		expect(flight.at(0.4)).toEqual(camera);
		expect(flight.at(1)).toEqual(camera);
	});
});

describe('camera history', () => {
	const mark = (x: number, label: string) => ({ camera: { x, y: 0, zoom: 1 }, label });

	it('walks back and forward through the places that were visited', () => {
		let history = createCameraHistory(mark(0, 'Board'));
		history = pushCameraMark(history, { x: 0, y: 0, zoom: 1 }, mark(-500, 'Brushes'));
		history = pushCameraMark(history, { x: -500, y: 0, zoom: 1 }, mark(-900, 'Products'));
		expect(canGoBack(history)).toBe(true);
		expect(canGoForward(history)).toBe(false);

		const back = stepHistory(history, { x: -900, y: 0, zoom: 1 }, -1)!;
		expect(back.mark.label).toBe('Brushes');
		expect(canGoForward(back.history)).toBe(true);

		const forward = stepHistory(back.history, back.mark.camera, 1)!;
		expect(forward.mark.label).toBe('Products');
	});

	it('returns you to where you actually were, not to where the jump landed', () => {
		let history = createCameraHistory(mark(0, 'Board'));
		history = pushCameraMark(history, { x: 0, y: 0, zoom: 1 }, mark(-500, 'Brushes'));
		// Panned by hand after arriving at Brushes, then jumped somewhere else.
		history = pushCameraMark(history, { x: -640, y: -120, zoom: 1.4 }, mark(-2000, 'Foundation'));
		const back = stepHistory(history, { x: -2000, y: 0, zoom: 1 }, -1)!;
		expect(back.mark.camera).toEqual({ x: -640, y: -120, zoom: 1.4 });
	});

	it('drops the forward trail once you navigate somewhere new', () => {
		let history = createCameraHistory(mark(0, 'Board'));
		history = pushCameraMark(history, { x: 0, y: 0, zoom: 1 }, mark(-500, 'Brushes'));
		history = pushCameraMark(history, { x: -500, y: 0, zoom: 1 }, mark(-900, 'Products'));
		const back = stepHistory(history, { x: -900, y: 0, zoom: 1 }, -1)!;
		const branched = pushCameraMark(back.history, back.mark.camera, mark(-1500, 'Foundation'));
		expect(canGoForward(branched)).toBe(false);
		expect(branched.entries.map((entry) => entry.label)).toEqual(['Board', 'Brushes', 'Foundation']);
	});

	it('does not stack a second entry for the place it is already at', () => {
		let history = createCameraHistory(mark(0, 'Board'));
		history = pushCameraMark(history, { x: 0, y: 0, zoom: 1 }, mark(0, 'Board'));
		expect(history.entries).toHaveLength(1);
		expect(canGoBack(history)).toBe(false);
	});

	it('refuses to step past either end', () => {
		const history = createCameraHistory(mark(0, 'Board'));
		expect(stepHistory(history, { x: 0, y: 0, zoom: 1 }, -1)).toBeNull();
		expect(stepHistory(history, { x: 0, y: 0, zoom: 1 }, 1)).toBeNull();
	});
});

describe('camera helpers', () => {
	it('frames bounds in the middle of the viewport without over-magnifying', () => {
		const camera = cameraForBounds({ x: -50, y: -50, width: 100, height: 100 }, viewport, 40, 1.8);
		expect(camera.zoom).toBe(1.8);
		expect(centreOf(camera).x).toBeCloseTo(0, 6);
		expect(centreOf(camera).y).toBeCloseTo(0, 6);
	});

	it('reports the world rectangle the camera can see', () => {
		expect(visibleBounds({ x: -200, y: -100, zoom: 2 }, viewport)).toEqual({ x: 100, y: 50, width: 600, height: 400 });
	});

	it('names the scale the board is being read at', () => {
		expect(scaleName(0.15)).toBe('whole board');
		expect(scaleName(0.5)).toBe('wide');
		expect(scaleName(1)).toBe('reading');
		expect(scaleName(3)).toBe('close');
	});

	it('treats a nudge of less than half a pixel as the same camera', () => {
		expect(camerasMatch({ x: 0, y: 0, zoom: 1 }, { x: 0.3, y: -0.2, zoom: 1 })).toBe(true);
		expect(camerasMatch({ x: 0, y: 0, zoom: 1 }, { x: 4, y: 0, zoom: 1 })).toBe(false);
		expect(camerasMatch({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0, zoom: 1.4 })).toBe(false);
	});
});
