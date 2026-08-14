import { cameraForBounds, visibleBounds, type Viewport } from './camera';
import { boundsForItem, documentBounds } from './geometry';
import type { Bounds, Camera, FrameItem, WhiteboardDocument, WhiteboardItem } from './model';

/** A frame counts as "where you are" only once it fills this much of the view. */
const PRESENCE_RATIO = 0.22;
/** Containment tolerance, so a frame drawn flush against another still nests. */
const NESTING_SLACK = 2;

export function frames(items: WhiteboardItem[]): FrameItem[] {
	return items.filter((item): item is FrameItem => item.type === 'frame');
}

export function frameTitle(frame: FrameItem): string {
	return frame.title.trim() || 'Untitled frame';
}

/**
 * Frames in reading order: banded into rows top to bottom, then left to right
 * within a row. This is the order the keyboard walks, and it stays true as
 * frames move, so the sequence never needs maintaining by hand.
 *
 * A nested frame lands in its parent's band and, because containment forces
 * `parent.x <= child.x`, always after the parent.
 */
export function frameSequence(items: WhiteboardItem[]): FrameItem[] {
	const ordered = frames(items).sort((a, b) => a.y - b.y || a.x - b.x);
	const bands: FrameItem[][] = [];
	for (const frame of ordered) {
		const band = bands[bands.length - 1];
		const centre = frame.y + frame.height / 2;
		if (band) {
			const top = Math.min(...band.map((member) => member.y));
			const bottom = Math.max(...band.map((member) => member.y + member.height));
			if (centre >= top && centre <= bottom) {
				band.push(frame);
				continue;
			}
		}
		bands.push([frame]);
	}
	return bands.flatMap((band) => band.sort((a, b) => a.x - b.x || a.y - b.y));
}

export function frameContains(outer: Bounds, inner: Bounds): boolean {
	return outer.x - NESTING_SLACK <= inner.x &&
		outer.y - NESTING_SLACK <= inner.y &&
		outer.x + outer.width + NESTING_SLACK >= inner.x + inner.width &&
		outer.y + outer.height + NESTING_SLACK >= inner.y + inner.height;
}

function containsPoint(bounds: Bounds, point: { x: number; y: number }): boolean {
	return point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
		point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

/** Every frame enclosing this one, outermost first, with the frame itself last. */
export function frameAncestry(items: WhiteboardItem[], frame: FrameItem): FrameItem[] {
	const ancestors = frames(items)
		.filter((candidate) => candidate.id !== frame.id && frameContains(candidate, frame))
		.sort((a, b) => b.width * b.height - a.width * a.height);
	return [...ancestors, frame];
}

/**
 * Where the camera is, as the chain of frames it is inside — the board's answer
 * to a breadcrumb. Frames too small to fill a meaningful share of the view are
 * left out: from high above you are over the board, not in any one place.
 */
export function locateCamera(items: WhiteboardItem[], camera: Camera, viewport: Viewport): FrameItem[] {
	const view = visibleBounds(camera, viewport);
	const centre = { x: view.x + view.width / 2, y: view.y + view.height / 2 };
	const present = frames(items).filter((frame) => {
		if (!containsPoint(frame, centre)) return false;
		return frame.width >= view.width * PRESENCE_RATIO || frame.height >= view.height * PRESENCE_RATIO;
	});
	if (!present.length) return [];
	const innermost = present.reduce((smallest, frame) =>
		frame.width * frame.height < smallest.width * smallest.height ? frame : smallest
	);
	return frameAncestry(items, innermost);
}

/** The frame the camera is most plainly in, or null when it is above them all. */
export function currentFrame(items: WhiteboardItem[], camera: Camera, viewport: Viewport): FrameItem | null {
	const path = locateCamera(items, camera, viewport);
	return path.length ? path[path.length - 1] : null;
}

export function stepFrame(sequence: FrameItem[], currentId: string | null, direction: -1 | 1): FrameItem | null {
	if (!sequence.length) return null;
	const index = currentId ? sequence.findIndex((frame) => frame.id === currentId) : -1;
	if (index === -1) return direction === 1 ? sequence[0] : sequence[sequence.length - 1];
	const next = (index + direction + sequence.length) % sequence.length;
	return sequence[next];
}

/** The bounds a navigation target should frame, resolved through stack layout. */
export function targetBounds(items: WhiteboardItem[], id: string): Bounds | null {
	const item = items.find((candidate) => candidate.id === id);
	if (!item || item.type === 'connector') return null;
	return boundsForItem(items, item);
}

/** Padding scaled to the thing being framed, so a card is not lost in margin. */
function framingPadding(bounds: Bounds): number {
	return Math.max(56, Math.min(180, Math.max(bounds.width, bounds.height) * 0.1));
}

/** The camera that puts one item on screen as its own place. */
export function focusCamera(items: WhiteboardItem[], id: string, viewport: Viewport): Camera | null {
	const bounds = targetBounds(items, id);
	return bounds ? cameraForBounds(bounds, viewport, framingPadding(bounds), 1.7) : null;
}

/** The camera that shows everything on the board at once. */
export function fitBoardCamera(document: WhiteboardDocument, viewport: Viewport): Camera {
	const bounds = documentBounds(document);
	if (bounds) return cameraForBounds(bounds, viewport, 120, 1.2);
	return { x: viewport.width / 2, y: viewport.height / 2, zoom: 1 };
}

export function itemLabel(item: WhiteboardItem): string {
	switch (item.type) {
		case 'frame':
			return frameTitle(item);
		case 'stack':
			return item.title.trim() || 'Untitled stack';
		case 'card':
			return item.title.trim() || item.body.trim().split('\n')[0]?.slice(0, 40) || 'Untitled card';
		case 'image':
			return item.name.trim() || 'Image';
		default:
			return 'Connector';
	}
}
