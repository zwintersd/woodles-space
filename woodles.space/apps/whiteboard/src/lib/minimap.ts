import { visibleBounds, type Viewport } from './camera';
import { boundsForItem, documentBounds } from './geometry';
import type { Bounds, Camera, WhiteboardDocument, WhiteboardItem } from './model';

export type MinimapProjection = {
	scale: number;
	offsetX: number;
	offsetY: number;
	/** World rectangle → a rectangle in minimap pixels. */
	project(bounds: Bounds): Bounds;
	/** A point in minimap pixels → the world point under it. */
	toWorld(point: { x: number; y: number }): { x: number; y: number };
};

export type MinimapMark = {
	id: string;
	kind: WhiteboardItem['type'];
	bounds: Bounds;
};

/**
 * What the overview has to cover: everything on the board, plus wherever the
 * camera currently is. Including the view keeps the viewport marker on the map
 * even when you have wandered off past the edge of the material.
 */
export function minimapExtent(document: WhiteboardDocument, camera: Camera, viewport: Viewport): Bounds {
	const view = visibleBounds(camera, viewport);
	const content = documentBounds(document);
	if (!content) return view;
	const left = Math.min(content.x, view.x);
	const top = Math.min(content.y, view.y);
	const right = Math.max(content.x + content.width, view.x + view.width);
	const bottom = Math.max(content.y + content.height, view.y + view.height);
	return { x: left, y: top, width: right - left, height: bottom - top };
}

export function minimapProjection(extent: Bounds, size: Viewport, padding = 8): MinimapProjection {
	const usableWidth = Math.max(1, size.width - padding * 2);
	const usableHeight = Math.max(1, size.height - padding * 2);
	const scale = Math.min(usableWidth / Math.max(1, extent.width), usableHeight / Math.max(1, extent.height));
	// Centre whichever axis has slack, so the board sits in the middle of the map.
	const offsetX = padding + (usableWidth - extent.width * scale) / 2 - extent.x * scale;
	const offsetY = padding + (usableHeight - extent.height * scale) / 2 - extent.y * scale;
	return {
		scale,
		offsetX,
		offsetY,
		project: (bounds) => ({
			x: bounds.x * scale + offsetX,
			y: bounds.y * scale + offsetY,
			width: Math.max(1, bounds.width * scale),
			height: Math.max(1, bounds.height * scale)
		}),
		toWorld: (point) => ({ x: (point.x - offsetX) / scale, y: (point.y - offsetY) / scale })
	};
}

/** The board reduced to shapes: enough to recognise, not enough to read. */
export function minimapMarks(items: WhiteboardItem[]): MinimapMark[] {
	return items
		.filter((item) => item.type !== 'connector' && !(item.type === 'card' && item.stackId))
		.map((item) => ({ id: item.id, kind: item.type, bounds: boundsForItem(items, item) }));
}

/** A camera centred on a world point, keeping the current scale. */
export function cameraCentredOn(point: { x: number; y: number }, camera: Camera, viewport: Viewport): Camera {
	return {
		zoom: camera.zoom,
		x: viewport.width / 2 - point.x * camera.zoom,
		y: viewport.height / 2 - point.y * camera.zoom
	};
}
