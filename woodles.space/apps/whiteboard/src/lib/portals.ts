import type { Viewport } from './camera';
import { cameraForBounds } from './camera';
import { fitBoardCamera, frameTitle, locateCamera } from './navigation';
import type { Bounds, Camera, PortalItem, WhiteboardDocument, WhiteboardItem } from './model';

/**
 * One board you passed through on the way here, with the camera you left it at,
 * so coming back up puts you exactly where you were rather than at its front
 * door. The trail is where you are, not what any board contains — no document
 * knows it, and it is the same shape whether you got here by clicking down or
 * by resuming a session.
 */
export type TrailStep = {
	boardId: string;
	title: string;
	camera: Camera;
	/** The portal that was stepped through, for the way back out. */
	portalId: string | null;
};

export function isPortal(item: WhiteboardItem | null | undefined): item is PortalItem {
	return Boolean(item && item.type === 'portal');
}

export function portals(items: WhiteboardItem[]): PortalItem[] {
	return items.filter(isPortal);
}

/** A portal's own name, or the name of the board it opens onto. */
export function portalTitle(portal: PortalItem, boardTitle?: string | null): string {
	return portal.title.trim() || (boardTitle ?? '').trim() || 'Untitled board';
}

export function portalsTo(items: WhiteboardItem[], boardId: string): PortalItem[] {
	return portals(items).filter((portal) => portal.boardId === boardId);
}

/** Descend: the trail with this board pushed on, remembering where we stood. */
export function pushTrail(trail: TrailStep[], from: TrailStep): TrailStep[] {
	return [...trail, from];
}

/**
 * Climb back to a board already on the trail, dropping everything below it.
 * Returns the step to restore and the trail that remains above it.
 */
export function popTrailTo(trail: TrailStep[], depth: number): { step: TrailStep; trail: TrailStep[] } | null {
	if (depth < 0 || depth >= trail.length) return null;
	return { step: trail[depth], trail: trail.slice(0, depth) };
}

export function trailHasBoard(trail: TrailStep[], boardId: string): boolean {
	return trail.some((step) => step.boardId === boardId);
}

export type Crumb =
	| { kind: 'board'; label: string; depth: number }
	| { kind: 'here'; label: string }
	| { kind: 'frame'; label: string; id: string };

/**
 * `Makeup Game / Brushes / Pickup Physics` — the boards descended through, then
 * this board, then the frames the camera is inside. One line that answers both
 * "which whiteboard am I in" and "where in it", because from the inside those
 * are the same question.
 */
export function breadcrumbs(
	trail: TrailStep[],
	document: WhiteboardDocument,
	camera: Camera,
	viewport: Viewport
): Crumb[] {
	const above: Crumb[] = trail.map((step, depth) => ({
		kind: 'board' as const,
		label: step.title.trim() || 'Untitled board',
		depth
	}));
	const here: Crumb = { kind: 'here', label: document.board.title.trim() || 'Untitled board' };
	const inside: Crumb[] = locateCamera(document.items, camera, viewport).map((frame) => ({
		kind: 'frame' as const,
		label: frameTitle(frame),
		id: frame.id
	}));
	return [...above, here, ...inside];
}

/**
 * The camera that puts a portal past the edges of the screen — the last frame
 * of going in. Overshooting is what sells it: the doorway stops being an object
 * on the board and becomes the board.
 */
export function enterCamera(portal: Bounds, viewport: Viewport, overshoot = 1.7): Camera {
	const zoom = (viewport.width / Math.max(1, portal.width)) * overshoot;
	return {
		zoom,
		x: viewport.width / 2 - (portal.x + portal.width / 2) * zoom,
		y: viewport.height / 2 - (portal.y + portal.height / 2) * zoom
	};
}

/**
 * Where a child board should be standing when you arrive. It is the same
 * framing the portal's miniature was showing, so the shapes you were flying
 * toward are the shapes that greet you — that continuity is the whole illusion.
 */
export function arrivalCamera(child: WhiteboardDocument, viewport: Viewport): Camera {
	return child.home ?? fitBoardCamera(child, viewport);
}

/**
 * Going back up: the parent, framed on the portal you came out of, so the
 * child appears to shrink back into the doorway before the view settles.
 */
export function returnCamera(portal: Bounds | null, resting: Camera, viewport: Viewport): Camera {
	return portal ? cameraForBounds(portal, viewport, 40, 2.6) : resting;
}
