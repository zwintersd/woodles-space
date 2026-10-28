import type { Bounds } from './model';

export const SELECTION_TOOLS = { width: 100, height: 52 };
export type SelectionPlacement = { left: number; top: number; side: 'above' | 'below' | 'right' | 'left' | 'dock' };
export type SelectionViewport = { width: number; height: number; top: number; bottom: number };

function overlaps(a: Bounds, b: Bounds): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(Math.max(min, max), value));

/** Stay outside the selected material; a viewport dock is the last resort. */
export function selectionToolsPosition(bounds: Bounds | null, view: SelectionViewport, obstacles: Bounds[] = []): SelectionPlacement | null {
	if (!bounds || !overlaps(bounds, { x: 0, y: 0, width: view.width, height: view.height })) return null;
	const { width, height } = SELECTION_TOOLS;
	const minX = 12, maxX = Math.max(minX, view.width - width - 12);
	const minY = clamp(view.top, 12, view.height - height - 12);
	const maxY = Math.max(minY, view.height - view.bottom - height);
	const right = bounds.x + bounds.width, bottom = bounds.y + bounds.height;
	const alignedX = clamp(right - width, minX, maxX);
	const alignedY = clamp(bounds.y, minY, maxY);
	const candidates: SelectionPlacement[] = [
		{ left: alignedX, top: bounds.y - height - 12, side: 'above' },
		{ left: alignedX, top: bounds.y - height - 44, side: 'above' },
		{ left: right + 12, top: alignedY, side: 'right' },
		{ left: bounds.x - width - 12, top: alignedY, side: 'left' },
		{ left: alignedX, top: bottom + 12, side: 'below' }
	];
	const box = (p: SelectionPlacement): Bounds => ({ x: p.left, y: p.top, width, height });
	const fits = (p: SelectionPlacement) => p.left >= minX && p.left <= maxX && p.top >= minY && p.top <= maxY && !obstacles.some((b) => overlaps(box(p), b));
	const outside = candidates.find((p) => fits(p) && !overlaps(box(p), bounds));
	if (outside) return outside;
	// A large spread can fill the entire view. Dock away from its header rather
	// than clamping the controls over the first line of its content.
	const docks: SelectionPlacement[] = [
		{ left: maxX, top: maxY, side: 'dock' }, { left: minX, top: maxY, side: 'dock' },
		{ left: maxX, top: minY, side: 'dock' }, { left: minX, top: minY, side: 'dock' }
	];
	return docks.find(fits) ?? docks[0];
}

export function selectionPanelPosition(bounds: Bounds | null, view: SelectionViewport): { left: number; top: number } {
	const width = 300, gap = 16;
	const minY = clamp(view.top, 12, view.height - 160);
	const b = bounds ?? { x: 12, y: minY, width: 0, height: 0 };
	const right = b.x + b.width + gap;
	const left = right + width + 12 <= view.width ? right : b.x - gap - width >= 12 ? b.x - gap - width : b.x;
	return { left: clamp(left, 12, view.width - width - 12), top: clamp(b.y, minY, Math.max(minY, view.height - view.bottom - 560)) };
}
