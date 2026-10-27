import { describe, expect, it } from 'vitest';
import { alignItems, compositionUnits, duplicateItems, expandGroups, groupItems, isLocked, orderedItems, reorderLayers, snapTranslation } from './composition';
import { canRotate, connectorEndpoints, documentBounds, insertCardIntoStack, removeItems, repairDocument, resizedBounds, rotatePoint, rotationOf, snappedAngle, visualBoundsForItem } from './geometry';
import { createCard, createConnector, createEmptyBoard, createFrame, createImage, createLettering, createSlip, createStack, isWhiteboardDocument, slipToCard, snapshotDocument, upgradeDocument } from './model';
import { createEditHistory, recordEdit, undoEdit, redoEdit } from './history';
import { patchAppearance } from './appearance';
import { searchBoard, hitsBounds } from './search';
import { targetBounds } from './navigation';
import { minimapMarks } from './minimap';

describe('Compose compositions', () => {
	it('round-trips editable lettering and its typography through history and search', () => {
		const lettering = { ...createLettering(20, 40, 1), text: 'Little wonders', rotation: -15, appearance: { font: 'hand' as const, fontSize: 48, highlight: '#f7dfbb', backing: 'strip' as const, lineHeight: 1.6 } };
		const before = { ...createEmptyBoard(), items: [lettering] };
		const history = recordEdit(createEditHistory(), before);
		const after = snapshotDocument(before); after.items[0].appearance!.fontSize = 64;
		const restored = upgradeDocument(JSON.parse(JSON.stringify(after)));
		expect(isWhiteboardDocument(restored)).toBe(true);
		if (!isWhiteboardDocument(restored)) throw new Error('Unreadable lettering');
		expect(searchBoard(restored, 'wonders')[0].item.id).toBe(lettering.id);
		const back = undoEdit(history, after)!;
		expect(back.document).toEqual(before);
		expect(redoEdit(back.history, back.document)!.document).toEqual(after);
	});

	it('groups a whole selection, regroups existing groups flatly and leaves source links intact', () => {
		const a = { ...createCard(0, 0, 1), properties: { source: 'https://woodles.space/write?document=canonical' } };
		const b = createLettering(20, 200, 2); const c = createSlip(500, 200, 3);
		const grouped = groupItems([a, b, c], [a.id, b.id]);
		expect(expandGroups(grouped, [a.id])).toEqual([a.id, b.id]);
		const merged = groupItems(grouped, [a.id, c.id]);
		expect(new Set(merged.map((item) => item.groupId)).size).toBe(1);
		expect(merged[0].properties).toEqual(a.properties);
		const ungrouped = groupItems(merged, [b.id], true);
		expect(ungrouped.every((item) => item.groupId === undefined)).toBe(true);
	});

	it('never groups a card independently of its owning stack', () => {
		const stack = createStack(400, 0, 1); const card = createCard(10, 10, 2); const slip = createSlip(0, 0, 3);
		const board = insertCardIntoStack({ ...createEmptyBoard(), items: [stack, card, slip] }, card.id, stack.id);
		const result = groupItems(board.items, [card.id, slip.id]);
		expect(result).toBe(board.items);
		expect(compositionUnits(board.items, [card.id, slip.id])).toHaveLength(1);
	});

	it('dissolves a singleton group after one member is deleted', () => {
		const a = createCard(0, 0, 1); const b = createSlip(100, 0, 2);
		const board = { ...createEmptyBoard(), items: groupItems([a, b], [a.id, b.id]) };
		const after = removeItems(board, new Set([a.id]));
		expect(after.items[0].groupId).toBeUndefined();
	});

	it('aligns groups as units without changing the spacing inside a group', () => {
		const a = createSlip(0, 0, 1); const b = createSlip(40, 100, 2); const c = createCard(500, 400, 3);
		const grouped = groupItems([a, b, c], [a.id, b.id]);
		const aligned = alignItems(grouped, [a.id, b.id, c.id], 'bottom');
		const first = aligned.find((item) => item.id === a.id)!; const second = aligned.find((item) => item.id === b.id)!;
		expect(second.y - first.y).toBe(100); expect(second.x - first.x).toBe(40);
		const units = compositionUnits(aligned, [a.id, c.id]);
		expect(units[0].bounds.y + units[0].bounds.height).toBe(units[1].bounds.y + units[1].bounds.height);
	});

	it('distributes unequal widths with equal gaps and fixed outer edges', () => {
		const a = createSlip(0, 0, 1); const b = createCard(260, 100, 2); const c = createLettering(800, 20, 3);
		const items = alignItems([a, b, c], [a.id, b.id, c.id], 'horizontal');
		expect(items[0].x).toBe(0); expect(items[2].x).toBe(800);
		expect(items[1].x - items[0].x - items[0].width).toBe(items[2].x - items[1].x - items[1].width);
	});

	it('protects a locked group and cards inside a locked stack', () => {
		const a = { ...createSlip(0, 0, 1), locked: true }; const b = { ...createCard(500, 0, 2), groupId: 'g' };
		const grouped = [{ ...a, groupId: 'g' }, b];
		expect(isLocked(grouped, b)).toBe(true);
		expect(alignItems(grouped, [a.id, b.id], 'left')).toBe(grouped);
		expect(groupItems(grouped, [a.id, b.id], true)).toBe(grouped);
		const stack = { ...createStack(0, 0, 3), locked: true };
		const board = insertCardIntoStack({ ...createEmptyBoard(), items: [stack, b] }, b.id, stack.id);
		expect(isLocked(board.items, board.items[1])).toBe(true);
	});

	it('brings a grouped composition forward and keeps stack contents above their container', () => {
		const a = createCard(0, 0, 1); const b = createSlip(50, 50, 2); const c = createCard(500, 0, 3);
		const grouped = groupItems([a, b, c], [a.id, b.id]);
		const front = reorderLayers(grouped, [a.id], 'front');
		expect(orderedItems(front).map((item) => item.id)).toEqual([c.id, a.id, b.id]);
		expect(orderedItems(reorderLayers(front, [a.id], 'back')).map((item) => item.id)).toEqual([a.id, b.id, c.id]);
		const stack = createStack(0, 0, 1); const card = createCard(0, 0, 2);
		const board = insertCardIntoStack({ ...createEmptyBoard(), items: [stack, card, c] }, card.id, stack.id);
		const ordered = orderedItems(reorderLayers(board.items, [stack.id], 'front'));
		expect(ordered.map((item) => item.id)).toEqual([c.id, stack.id, card.id]);
	});

	it('duplicates groups, internal connections and references without tying clones to originals', () => {
		const a = { ...createCard(0, 0, 1), properties: { source: 'https://woodles.space/write?document=canonical' }, appearance: { fill: '#d6e2c9' }, rotation: 15 };
		const b = createLettering(400, 100, 2); const line = createConnector(a.id, b.id, 3);
		const before = { ...createEmptyBoard(), items: [...groupItems([a, b], [a.id, b.id]), line] };
		const after = duplicateItems(before, [a.id]);
		const clones = after.items.filter((item) => !before.items.some((old) => old.id === item.id));
		expect(clones).toHaveLength(3); expect(after.ids).toHaveLength(2);
		expect(clones[0].groupId).not.toBe(before.items[0].groupId);
		expect(clones[0].groupId).toBe(clones[1].groupId);
		expect(clones[0].properties).toEqual(a.properties);
		const copiedLine = clones.find((item) => item.type === 'connector')!;
		expect(connectorEndpoints(after.items, copiedLine)).not.toBeNull();
		clones[0].appearance!.fill = '#ffffff'; expect(a.appearance.fill).toBe('#d6e2c9');
	});

	it('duplicates a stack with independently owned board cards and shared original image assets', () => {
		const stack = createStack(0, 0, 1); const card = createCard(20, 20, 2); const image = createImage(500, 0, 'canonical-asset', 'Photo', 2, 3);
		const board = insertCardIntoStack({ ...createEmptyBoard(), items: [stack, card, image] }, card.id, stack.id);
		const after = duplicateItems(board, [stack.id, image.id]);
		const copies = after.items.filter((item) => !board.items.some((old) => old.id === item.id));
		const copiedStack = copies.find((item) => item.type === 'stack')!; const copiedCard = copies.find((item) => item.type === 'card')!;
		expect(copiedStack.cardIds).toEqual([copiedCard.id]); expect(copiedCard.stackId).toBe(copiedStack.id);
		expect(copies.find((item) => item.type === 'image')!.assetId).toBe(image.assetId);
	});
});

describe('rotation geometry', () => {
	it('uses the same rotated extent for fit, search, navigation and the minimap', () => {
		const item = { ...createCard(50, 100, 1), title: 'Rotated thought', rotation: 90 };
		const board = { ...createEmptyBoard(), items: [item] };
		const expected = { x: 100, y: 50, width: 150, height: 250 };
		const visual = visualBoundsForItem(board.items, item);
		expect(visual.x).toBeCloseTo(expected.x); expect(visual.y).toBeCloseTo(expected.y);
		expect(visual.width).toBeCloseTo(expected.width); expect(visual.height).toBeCloseTo(expected.height);
		for (const bounds of [documentBounds(board), targetBounds(board.items, item.id), hitsBounds(board.items, searchBoard(board, 'thought')), minimapMarks(board.items)[0].bounds]) {
			for (const key of ['x', 'y', 'width', 'height'] as const) expect(bounds![key]).toBeCloseTo(visual[key]);
		}
	});

	it('keeps the opposite corner anchored when resizing a rotated object', () => {
		const original = { x: 50, y: 40, width: 250, height: 150 };
		const angle = 35; const delta = rotatePoint({ x: 80, y: 40 }, angle);
		const after = resizedBounds(original, angle, delta, { width: 150, height: 90 });
		const corner = (b: typeof original) => { const v = rotatePoint({ x: -b.width / 2, y: -b.height / 2 }, angle); return { x: b.x + b.width / 2 + v.x, y: b.y + b.height / 2 + v.y }; };
		expect(after.width).toBeCloseTo(330); expect(after.height).toBeCloseTo(190);
		expect(corner(after).x).toBeCloseTo(corner(original).x); expect(corner(after).y).toBeCloseTo(corner(original).y);
	});

	it('keeps connected centers attached through rotation, movement and Slip conversion', () => {
		const slip = { ...createSlip(20, 40, 1), rotation: 30, layer: 7, groupId: 'group', locked: false };
		const other = createCard(400, 100, 2); const connector = createConnector(slip.id, other.id, 3);
		const before = connectorEndpoints([slip, other, connector], connector)!;
		const rotated = { ...slip, rotation: -75 };
		expect(connectorEndpoints([rotated, other, connector], connector)).toEqual(before);
		const converted = slipToCard(rotated);
		expect(converted).toMatchObject({ id: slip.id, rotation: -75, layer: 7, groupId: 'group' });
		expect(connectorEndpoints([{ ...converted, x: 120 }, other, connector], connector)!.from.x).toBe(245);
	});

	it('snaps gently to angles, retains free angles, and holds stored rotation while a card is stacked', () => {
		expect(snappedAngle(28)).toBe(30); expect(snappedAngle(37)).toBe(37); expect(snappedAngle(37, true)).toBe(30);
		const card = { ...createCard(0, 0, 1), rotation: 35, stackId: 'stack' };
		expect(canRotate(card)).toBe(false); expect(rotationOf(card)).toBe(0); expect(card.rotation).toBe(35);
	});

	it('snaps a dragged composition to nearby edges and returns finite world guides', () => {
		const moving = createSlip(0, 0, 1); const other = createCard(200, 250, 2);
		const result = snapTranslation([moving, other], [moving.id], moving, 28, 40, 6);
		expect(result.dx).toBe(30); expect(result.guides.some((guide) => guide.axis === 'x' && guide.at === 200)).toBe(true);
		expect(snapTranslation([moving, other], [moving.id], moving, 10, 40, 6).guides).toHaveLength(0);
	});

	it('validates composition metadata and carries earlier documents forward without losing objects', () => {
		const card = createCard(0, 0, 1);
		for (const patch of [{ rotation: Infinity }, { groupId: [] }, { locked: 'yes' }, { layer: 2.5 }]) {
			const broken = { ...createEmptyBoard(), items: [{ ...card, ...patch }] };
			expect(isWhiteboardDocument(broken)).toBe(false);
			const repaired = upgradeDocument(broken);
			expect(isWhiteboardDocument(repaired)).toBe(true);
		}
		const styled = { ...card, appearance: { fill: '#d6e2c9', material: 'index' as const } };
		expect(patchAppearance(styled, { material: null })).toEqual({ fill: '#d6e2c9' });
		expect(repairDocument({ ...createEmptyBoard(), items: [styled] }).items[0]).toEqual(styled);
	});
});
