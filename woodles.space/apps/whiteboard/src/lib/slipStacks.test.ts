import { describe, expect, it } from 'vitest';
import { boundsForItem, connectorEndpoints, extractFromStack, insertIntoStack, removeItems, repairDocument, reorderStackItem, rotationOf, stackContentHeight, stackInsertionIndex, stackMemberBounds, stackMembers } from './geometry';
import { createCard, createConnector, createEmptyBoard, createSlip, createStack, isWhiteboardDocument, slipToCard, snapshotDocument, upgradeDocument, type StackItem, type WhiteboardDocument } from './model';
import { createEditHistory, recordEdit, undoEdit, redoEdit } from './history';
import { checklistProgress, queueHeads, setStackBehavior, shiftCardColumn, takeFromQueue, toggleChecked } from './stacks';
import { duplicateItems, isLocked, orderedItems } from './composition';

describe('Slips in Stacks', () => {
	it('shares an ordered layout with Cards while retaining compact Slip heights and identity', () => {
		const slip = { ...createSlip(30, 40, 1), text: 'A small thought', height: 50, rotation: -12, appearance: { fill: '#d6e2c9' } };
		const card = createCard(300, 40, 2); const stack = createStack(600, 100, 3);
		let board: WhiteboardDocument = { ...createEmptyBoard(), items: [slip, card, stack] };
		board = insertIntoStack(insertIntoStack(board, card.id, stack.id), slip.id, stack.id, 0);
		const notes = stackMembers(board.items, board.items.find((item) => item.type === 'stack')!);
		expect(notes.map((item) => item.id)).toEqual([slip.id, card.id]);
		const first = boundsForItem(board.items, notes[0]); const second = boundsForItem(board.items, notes[1]);
		expect(first).toMatchObject({ x: 614, width: 252, height: 50 });
		expect(second.y).toBe(first.y + first.height + 10);
		expect(notes[0]).toMatchObject({ id: slip.id, type: 'slip', text: slip.text, appearance: slip.appearance, freePosition: { x: 30, y: 40 } });
		expect(rotationOf(notes[0])).toBe(0);
	});

	it('preserves membership, nested metadata and order across saved data and undo/redo', () => {
		const slip = { ...createSlip(1, 2, 1), text: 'Keep me', properties: { source: 'https://woodles.space/write?document=source' } };
		const stack = createStack(400, 0, 2); const before = { ...createEmptyBoard(), items: [slip, stack] };
		const after = insertIntoStack(before, slip.id, stack.id);
		const restored = upgradeDocument(JSON.parse(JSON.stringify(snapshotDocument(after))));
		expect(isWhiteboardDocument(restored)).toBe(true);
		if (!isWhiteboardDocument(restored)) throw new Error('Unreadable stack');
		expect(repairDocument(restored).items).toEqual(after.items);
		const back = undoEdit(recordEdit(createEditHistory(), before), after)!;
		expect(back.document).toEqual(before);
		expect(redoEdit(back.history, back.document)!.document).toEqual(after);
	});

	it('reorders inside a stack and restores free width, position and angle on extraction', () => {
		const slip = { ...createSlip(10, 20, 1), rotation: 20 }; const card = createCard(300, 0, 2); const stack = createStack(500, 0, 3);
		let board = insertIntoStack(insertIntoStack({ ...createEmptyBoard(), items: [slip, card, stack] }, slip.id, stack.id), card.id, stack.id);
		board = reorderStackItem(board, stack.id, card.id, 0);
		expect(stackMembers(board.items, board.items.find((item) => item.type === 'stack')!).map((item) => item.id)).toEqual([card.id, slip.id]);
		const extracted = extractFromStack(board, slip.id);
		const note = extracted.items.find((item) => item.id === slip.id)!;
		expect(note).toMatchObject({ x: 10, y: 20, width: 170, rotation: 20 });
		expect(rotationOf(note)).toBe(20);
	});

	it('keeps a converted Slip in the same stack slot, connected to the same object', () => {
		const slip = { ...createSlip(20, 30, 1), text: 'Needs more room' }; const stack = createStack(400, 0, 2); const other = createCard(800, 0, 3); const line = createConnector(slip.id, other.id, 4);
		const before = insertIntoStack({ ...createEmptyBoard(), items: [slip, stack, other, line] }, slip.id, stack.id);
		const current = before.items.find((item) => item.type === 'slip')!;
		const after = repairDocument({ ...before, items: before.items.map((item) => item.id === slip.id ? slipToCard(current) : item) });
		expect(after.items.find((item) => item.id === slip.id)).toMatchObject({ type: 'card', stackId: stack.id, body: slip.text, freePosition: { x: 20, y: 30 } });
		expect(connectorEndpoints(after.items, line)).not.toBeNull();
		expect(after.items.find((item) => item.type === 'stack')!.cardIds).toEqual([slip.id]);
	});

	it('grows vertical and gallery layouts without overlapping long Slips', () => {
		const a = { ...createSlip(0, 0, 1), height: 210 }; const b = createCard(0, 0, 2); const c = createSlip(0, 0, 3); const stack = { ...createStack(400, 0, 4), width: 300, height: 120 };
		let board: WhiteboardDocument = { ...createEmptyBoard(), items: [a, b, c, stack] };
		for (const item of [a, b, c]) board = insertIntoStack(board, item.id, stack.id);
		expect(stackContentHeight(board.items, board.items.find((item) => item.type === 'stack')!)).toBeGreaterThan(400);
		board = setStackBehavior(board, stack.id, 'gallery');
		const gallery = board.items.find((item) => item.type === 'stack')!;
		const first = stackMemberBounds(board.items, gallery, a); const nextRow = stackMemberBounds(board.items, gallery, c);
		expect(nextRow.y).toBeGreaterThan(first.y + first.height);
		expect(stackContentHeight(board.items, gallery)).toBeGreaterThan(nextRow.y - gallery.y + nextRow.height);
		expect(stackInsertionIndex(board.items, gallery, { x: 400, y: first.y })).toBe(0);
	});

	it('includes Slips in the chosen status, checklist and queue behaviours', () => {
		const slip = createSlip(0, 0, 1); const stack = { ...createStack(400, 0, 2), title: 'Ready' };
		let board = insertIntoStack({ ...createEmptyBoard(), items: [slip, stack] }, slip.id, stack.id);
		board = setStackBehavior(board, stack.id, 'status');
		expect(board.items.find((item) => item.id === slip.id)!.properties?.status).toBe('Ready');
		board = toggleChecked(board, slip.id);
		expect(checklistProgress(board.items, board.items.find((item) => item.type === 'stack')!)).toEqual({ done: 1, total: 1 });
		expect(queueHeads(board.items, board.items.find((item) => item.type === 'stack')!).now?.id).toBe(slip.id);
		const taken = takeFromQueue(board, stack.id).items.find((item) => item.id === slip.id)!;
		expect(taken.type === 'slip' && taken.stackId).toBeUndefined();
	});

	it('moves a Slip between status columns using the existing keyboard operation', () => {
		const slip = createSlip(0, 0, 1); const a = { ...createStack(200, 0, 2), behavior: 'status' as const }; const b = { ...createStack(700, 0, 3), behavior: 'status' as const, title: 'Next' };
		const before = insertIntoStack({ ...createEmptyBoard(), items: [slip, a, b] }, slip.id, a.id);
		const after = shiftCardColumn(before, slip.id, 1);
		expect(after.items.find((item) => item.id === slip.id)).toMatchObject({ stackId: b.id, properties: { status: 'Next' } });
	});

	it('duplicates stacked Slips independently, paints them above the stack, and inherits its lock', () => {
		const slip = { ...createSlip(0, 0, 1), appearance: { fill: '#edc9cf' } }; const stack = { ...createStack(400, 0, 2), locked: true, layer: 50000 };
		const before = insertIntoStack({ ...createEmptyBoard(), items: [slip, stack] }, slip.id, stack.id);
		expect(isLocked(before.items, before.items[0])).toBe(true);
		expect(orderedItems(before.items).map((item) => item.id)).toEqual([stack.id, slip.id]);
		const copies = duplicateItems(before, [stack.id]).items.slice(2);
		const copiedStack = copies.find((item) => item.type === 'stack')!; const copiedSlip = copies.find((item) => item.type === 'slip')!;
		expect(copiedStack.cardIds).toEqual([copiedSlip.id]); expect(copiedSlip.stackId).toBe(copiedStack.id);
		copiedSlip.appearance!.fill = '#ffffff'; expect(slip.appearance.fill).toBe('#edc9cf');
	});

	it('releases Slips when their stack is removed and repairs contradictory saved membership', () => {
		const slip = createSlip(20, 40, 1); const stack = createStack(400, 0, 2); const other = createStack(800, 0, 3);
		const board = insertIntoStack({ ...createEmptyBoard(), items: [slip, stack, other] }, slip.id, stack.id);
		const after = removeItems(board, new Set([stack.id]));
		expect(after.items.find((item) => item.id === slip.id)).toMatchObject({ x: 20, y: 40, stackId: undefined });
		const repaired = repairDocument({ ...board, items: board.items.map((item) => item.id === other.id && item.type === 'stack' ? { ...item, cardIds: [slip.id] } : item) });
		expect(repaired.items.find((item): item is StackItem => item.id === other.id && item.type === 'stack')!.cardIds).toEqual([]);
	});
});
