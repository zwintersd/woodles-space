import { clampZoom } from './geometry';
import type { Bounds, Camera } from './model';

export type Viewport = { width: number; height: number };

/**
 * A planned camera move. `at(0)` is where you are, `at(1)` is where you land,
 * and everything between is the arc that connects them.
 */
export type CameraFlight = {
	duration: number;
	at(progress: number): Camera;
};

/**
 * Curvature of the arc, from van Wijk & Nuij's "Smooth and Efficient Zooming
 * and Panning" (2003). 1.42 is their empirical optimum, and it is the number
 * that makes a long jump *read*: the camera lifts, travels while the board is
 * small enough to see whole, then settles. A straight linear interpolation of
 * x/y/zoom instead smears the board sideways at reading scale, which is the
 * motion people describe as making them lose their place.
 */
const RHO = 1.42;
const RHO2 = RHO * RHO;
const RHO4 = RHO2 * RHO2;
/** Units of the arc parameter per second — how fast the camera covers the path. */
const VELOCITY = 1.7;
const MIN_DURATION = 280;
const MAX_DURATION = 1500;

type View = { cx: number; cy: number; w: number };

/** The camera, restated as "where am I looking, and how wide is what I see". */
function toView(camera: Camera, viewport: Viewport): View {
	return {
		cx: (viewport.width / 2 - camera.x) / camera.zoom,
		cy: (viewport.height / 2 - camera.y) / camera.zoom,
		w: Math.max(1, viewport.width / camera.zoom)
	};
}

function toCamera(view: View, viewport: Viewport): Camera {
	// The arc deliberately pulls wider than either endpoint, so it can ask for a
	// zoom past MIN_ZOOM. Clamping flattens the top of the arc into a pan at the
	// widest legal scale, which still reads correctly — the centre is unaffected.
	const zoom = clampZoom(viewport.width / Math.max(1, view.w));
	return { x: viewport.width / 2 - view.cx * zoom, y: viewport.height / 2 - view.cy * zoom, zoom };
}

function smoothstep(value: number): number {
	const t = Math.min(1, Math.max(0, value));
	return t * t * (3 - 2 * t);
}

export function planCameraFlight(from: Camera, to: Camera, viewport: Viewport): CameraFlight {
	const start = toView(from, viewport);
	const end = toView(to, viewport);
	const dx = end.cx - start.cx;
	const dy = end.cy - start.cy;
	const u1 = Math.hypot(dx, dy);
	const w0 = start.w;
	const w1 = end.w;

	// Same place, same scale: nothing to fly.
	if (u1 < 1e-6 && Math.abs(w1 - w0) < 1e-6) {
		return { duration: MIN_DURATION, at: () => ({ ...to }) };
	}

	// Straight up or straight down — no travel, so the arc degenerates to a
	// plain exponential zoom, which is what "scale changes evenly" means.
	if (u1 < 1e-6) {
		const total = Math.abs(Math.log(w1 / w0)) / RHO;
		const direction = w1 > w0 ? 1 : -1;
		return {
			duration: durationFor(total),
			at: (progress) => {
				const s = smoothstep(progress) * total;
				return toCamera({ cx: end.cx, cy: end.cy, w: w0 * Math.exp(direction * RHO * s) }, viewport);
			}
		};
	}

	const b0 = (w1 * w1 - w0 * w0 + RHO4 * u1 * u1) / (2 * w0 * RHO2 * u1);
	const b1 = (w1 * w1 - w0 * w0 - RHO4 * u1 * u1) / (2 * w1 * RHO2 * u1);
	const r0 = Math.log(-b0 + Math.sqrt(b0 * b0 + 1));
	const r1 = Math.log(-b1 + Math.sqrt(b1 * b1 + 1));
	const total = (r1 - r0) / RHO;

	// Degenerate geometry (near-identical views reached through rounding) has no
	// arc to follow. Interpolating the endpoints keeps the move defined.
	if (!Number.isFinite(total) || Math.abs(total) < 1e-6) {
		return {
			duration: MIN_DURATION,
			at: (progress) => {
				const t = smoothstep(progress);
				return toCamera({ cx: start.cx + dx * t, cy: start.cy + dy * t, w: w0 + (w1 - w0) * t }, viewport);
			}
		};
	}

	return {
		duration: durationFor(total),
		at: (progress) => {
			if (progress >= 1) return { ...to };
			const s = smoothstep(progress) * total;
			const coshR0 = Math.cosh(r0);
			const w = (w0 * coshR0) / Math.cosh(RHO * s + r0);
			const u = (w0 / RHO2) * coshR0 * Math.tanh(RHO * s + r0) - (w0 / RHO2) * Math.sinh(r0);
			const along = u / u1;
			return toCamera({ cx: start.cx + dx * along, cy: start.cy + dy * along, w }, viewport);
		}
	};
}

function durationFor(total: number): number {
	return Math.min(MAX_DURATION, Math.max(MIN_DURATION, (Math.abs(total) / VELOCITY) * 1000));
}

export function camerasMatch(a: Camera, b: Camera, tolerance = 0.5): boolean {
	return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance &&
		Math.abs(a.zoom - b.zoom) <= tolerance / 1000 + 0.001;
}

/**
 * How much board a zoom level is showing. Scale is meant to mean something
 * here, so it gets said out loud rather than left as a percentage.
 */
export function scaleName(zoom: number): string {
	if (zoom < 0.3) return 'whole board';
	if (zoom < 0.75) return 'wide';
	if (zoom < 1.6) return 'reading';
	return 'close';
}

export type CameraMark = {
	camera: Camera;
	label: string;
};

export type CameraHistory = {
	entries: CameraMark[];
	index: number;
};

const HISTORY_LIMIT = 40;

export function createCameraHistory(mark: CameraMark): CameraHistory {
	return { entries: [mark], index: 0 };
}

/**
 * Records a deliberate move. The entry being left is refreshed with the live
 * camera first, so Back returns to where you actually were rather than to the
 * spot a jump last happened to land on.
 */
export function pushCameraMark(history: CameraHistory, live: Camera, mark: CameraMark): CameraHistory {
	const current = history.entries[history.index];
	const kept = history.entries.slice(0, history.index + 1);
	if (current) kept[history.index] = { ...current, camera: { ...live } };
	if (current && camerasMatch(current.camera, mark.camera)) {
		kept[history.index] = mark;
		return { entries: kept, index: history.index };
	}
	const entries = [...kept, mark].slice(-HISTORY_LIMIT);
	return { entries, index: entries.length - 1 };
}

export function canGoBack(history: CameraHistory): boolean {
	return history.index > 0;
}

export function canGoForward(history: CameraHistory): boolean {
	return history.index < history.entries.length - 1;
}

/** Steps through history, keeping the departed entry's live camera. */
export function stepHistory(history: CameraHistory, live: Camera, direction: -1 | 1): { history: CameraHistory; mark: CameraMark } | null {
	const next = history.index + direction;
	if (next < 0 || next >= history.entries.length) return null;
	const entries = history.entries.map((entry, index) =>
		index === history.index ? { ...entry, camera: { ...live } } : entry
	);
	return { history: { entries, index: next }, mark: entries[next] };
}

/** The camera that shows `bounds` with room to breathe, without over-magnifying. */
export function cameraForBounds(bounds: Bounds, viewport: Viewport, padding = 96, maxZoom = 1.8): Camera {
	const safeWidth = Math.max(1, bounds.width + padding * 2);
	const safeHeight = Math.max(1, bounds.height + padding * 2);
	const zoom = clampZoom(Math.min(maxZoom, Math.min(viewport.width / safeWidth, viewport.height / safeHeight)));
	return {
		zoom,
		x: viewport.width / 2 - (bounds.x + bounds.width / 2) * zoom,
		y: viewport.height / 2 - (bounds.y + bounds.height / 2) * zoom
	};
}

/** The world rectangle the camera can currently see. */
export function visibleBounds(camera: Camera, viewport: Viewport): Bounds {
	return {
		x: -camera.x / camera.zoom,
		y: -camera.y / camera.zoom,
		width: viewport.width / camera.zoom,
		height: viewport.height / camera.zoom
	};
}
