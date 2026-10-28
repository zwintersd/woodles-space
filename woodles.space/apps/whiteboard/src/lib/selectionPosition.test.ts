import { describe, expect, it } from 'vitest';
import { SELECTION_TOOLS, selectionPanelPosition, selectionToolsPosition } from './selectionPosition';
import type { Bounds } from './model';

const view = { width: 1280, height: 900, top: 130, bottom: 100 };
function overlaps(a: Bounds, b: Bounds) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

describe('selection controls placement', () => {
	it('keeps the controls outside ordinary selected material', () => {
		const selected = { x: 300, y: 350, width: 400, height: 250 };
		const placed = selectionToolsPosition(selected, view)!;
		expect(placed.side).toBe('above');
		expect(overlaps({ x: placed.left, y: placed.top, ...SELECTION_TOOLS }, selected)).toBe(false);
	});
	it('does not clamp a stack toolbar into its title when the top edge is unavailable', () => {
		const stack = { x: 12, y: 12, width: 340, height: 500 };
		const placed = selectionToolsPosition(stack, { width: 390, height: 844, top: 166, bottom: 100 })!;
		expect(placed.side).toBe('below'); expect(placed.top).toBeGreaterThan(stack.y + stack.height);
	});
	it('uses a side when the selection is too tall for above or below', () => {
		const selected = { x: 300, y: 0, width: 300, height: 1000 };
		const placed = selectionToolsPosition(selected, view)!;
		expect(placed.side).toBe('right'); expect(placed.left).toBeGreaterThan(selected.x + selected.width);
	});
	it('clears the rotation handle instead of competing for the same space', () => {
		const selected = { x: 300, y: 350, width: 170, height: 100 };
		const grip = { x: 371, y: 312, width: 28, height: 28 };
		const placed = selectionToolsPosition(selected, view, [grip])!;
		expect(overlaps({ x: placed.left, y: placed.top, ...SELECTION_TOOLS }, grip)).toBe(false);
	});
	it('docks a full-view spread away from both the top chrome and bottom dock', () => {
		const placed = selectionToolsPosition({ x: -200, y: -200, width: 2000, height: 1400 }, view)!;
		expect(placed.side).toBe('dock'); expect(placed.top).toBeGreaterThan(view.top);
		expect(placed.top + SELECTION_TOOLS.height).toBeLessThanOrEqual(view.height - view.bottom);
	});
	it('hides when the whole selection is offscreen', () => {
		expect(selectionToolsPosition({ x: -500, y: 300, width: 100, height: 100 }, view)).toBeNull();
	});
	it('stays inside narrow views and respects the actual chrome height', () => {
		for (const width of [320, 390, 600]) for (const height of [568, 844]) {
			const viewport = { width, height, top: 166, bottom: 100 };
			const placed = selectionToolsPosition({ x: -20, y: 12, width: 400, height: 700 }, viewport)!;
			expect(placed.left).toBeGreaterThanOrEqual(12); expect(placed.left + SELECTION_TOOLS.width).toBeLessThanOrEqual(width - 12);
			expect(placed.top).toBeGreaterThanOrEqual(166); expect(placed.top + SELECTION_TOOLS.height).toBeLessThanOrEqual(height - 100);
		}
	});
	it('keeps the expanded panel below chrome as well', () => {
		const placed = selectionPanelPosition({ x: 20, y: 12, width: 500, height: 400 }, view);
		expect(placed.top).toBeGreaterThanOrEqual(view.top); expect(placed.left).toBeGreaterThanOrEqual(12);
	});
});
