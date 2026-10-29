import { describe, expect, it } from 'vitest';
import { boundsForItem, galleryColumns, insertIntoStack, reorderStackItem, stackColumns, stackContentHeight, stackInsertionIndex, stackMemberBounds, stackMinimumWidth, stackTopInset } from './geometry';
import { createEditHistory, recordEdit, redoEdit, undoEdit } from './history';
import { createCard, createEmptyBoard, createSlip, createStack, isStackColumns, isWhiteboardDocument, MAX_STACK_COLUMNS, snapshotDocument, upgradeDocument, type StackBehavior, type StackItem, type WhiteboardDocument } from './model';
import { createWhiteboardStorage } from './persistence';
import { setStackBehavior, setStackColumns } from './stacks';

function fixture(behavior: StackBehavior = 'plain') {
	const notes = [
		{ ...createSlip(20, 30, 1), id: 'a', text: 'A long thought', height: 210 },
		{ ...createCard(400, 30, 2), id: 'b', title: 'A full Card', height: 180 },
		{ ...createSlip(20, 300, 3), id: 'c', text: 'A little thought', height: 48 },
		{ ...createCard(400, 300, 4), id: 'd', title: 'Another Card', height: 260 },
		{ ...createSlip(20, 600, 5), id: 'e', text: 'One more', height: 80 }
	];
	const stack = { ...createStack(800, 100, 6), id: 'stack', height: 100 };
	let document: WhiteboardDocument = { ...createEmptyBoard(), items: [...notes, stack] };
	for (const note of notes) document = insertIntoStack(document, note.id, stack.id);
	return setStackBehavior(document, stack.id, behavior);
}

function stackIn(document: WhiteboardDocument): StackItem {
	return document.items.find((item): item is StackItem => item.id === 'stack' && item.type === 'stack')!;
}

function boxesIn(document: WhiteboardDocument) {
	const stack = stackIn(document);
	return stack.cardIds.map((id) => {
		const note = document.items.find((item) => item.id === id)!;
		if (note.type !== 'card' && note.type !== 'slip') throw new Error('Expected a note');
		return stackMemberBounds(document.items, stack, note);
	});
}

describe('Stack column layouts', () => {
	it('keeps old Stacks in one column and old galleries automatic', () => {
		const plain = stackIn(fixture());
		expect(plain.columns).toBeUndefined();
		expect(stackColumns(plain)).toBe(1);
		expect(stackMinimumWidth(plain)).toBe(0);
		expect(stackColumns({ ...plain, behavior: 'gallery' })).toBe(2);
		expect(galleryColumns({ ...plain, behavior: 'gallery', width: 900 })).toBe(7);
	});

	it.each(['plain', 'status', 'checklist', 'queue'] as const)('wraps mixed notes in %s Stacks, keeping the full heights and row order', (behavior) => {
		const document = setStackColumns(fixture(behavior), 'stack', 2);
		const stack = stackIn(document);
		const [a, b, c, d, e] = boxesIn(document);
		expect(a).toMatchObject({ x: stack.x + 14, y: stack.y + stackTopInset(stack), height: 210 });
		expect(b).toMatchObject({ y: a.y, height: 180 });
		expect(b.x).toBe(a.x + a.width + 10);
		expect(c).toMatchObject({ x: a.x, y: a.y + 220, height: 48 });
		expect(d).toMatchObject({ y: c.y, height: 260 });
		expect(e).toMatchObject({ x: a.x, y: d.y + 270, height: 80 });
		expect(stackContentHeight(document.items, stack)).toBe(e.y + e.height + 14 - stack.y);
	});

	it('uses the selected gallery count while keeping its Card tiles and long Slip rows', () => {
		const document = setStackColumns(fixture('gallery'), 'stack', 3);
		const stack = stackIn(document);
		const [a, b, c, d, e] = boxesIn(document);
		expect(stackColumns(stack)).toBe(3);
		expect(galleryColumns(stack)).toBe(3);
		expect(stack.width).toBe(360);
		expect([a.height, b.height, c.height, d.height, e.height]).toEqual([210, 96, 48, 96, 80]);
		expect([a.y, b.y, c.y]).toEqual([a.y, a.y, a.y]);
		expect(d.y).toBe(a.y + 220);
		expect(e.y).toBe(d.y);
	});

	it('keeps explicit single columns above the CSS minimum and grows stored width when gallery tiles become full Cards', () => {
		for (const behavior of ['plain', 'gallery'] as const) {
			const stack = { ...stackIn(fixture(behavior)), width: 100, columns: 1 };
			expect(stackMinimumWidth(stack)).toBe(180);
			expect(boundsForItem([], stack).width).toBe(180);
		}
		const gallery = setStackColumns(fixture('gallery'), 'stack', 3);
		expect(stackIn(gallery).width).toBe(360);
		const plain = setStackBehavior(gallery, 'stack', 'plain');
		expect(stackIn(plain)).toMatchObject({ columns: 3, width: 408 });
		expect(stackIn(plain)).not.toHaveProperty('behavior');
		expect(stackIn(gallery).width).toBe(360);
		expect(boxesIn(plain)[1].height).toBe(180);
	});

	it.each(['plain', 'gallery'] as const)('keeps an externally narrowed explicit %s Stack and all its notes within matching effective bounds', (behavior) => {
		const document = setStackColumns(fixture(behavior), 'stack', 3);
		const stack = stackIn(document);
		stack.width = 100;
		const outer = boundsForItem(document.items, stack);
		expect(outer.width).toBe(behavior === 'gallery' ? 360 : 408);
		for (const box of boxesIn(document)) {
			expect(box.x).toBeGreaterThanOrEqual(outer.x + 14);
			expect(box.x + box.width).toBeLessThanOrEqual(outer.x + outer.width - 14);
		}
	});

	it('uses both axes for grid insertion and reorders without changing membership or note content', () => {
		const document = setStackColumns(fixture(), 'stack', 2);
		const stack = stackIn(document);
		const [a, b, c] = boxesIn(document);
		expect(stackInsertionIndex(document.items, stack, { x: a.x + 5, y: a.y + 5 })).toBe(0);
		expect(stackInsertionIndex(document.items, stack, { x: b.x + 5, y: b.y + 5 })).toBe(1);
		expect(stackInsertionIndex(document.items, stack, { x: b.x + b.width, y: b.y + 5 })).toBe(2);
		expect(stackInsertionIndex(document.items, stack, { x: c.x + 5, y: c.y + 5 })).toBe(2);
		const reordered = reorderStackItem(document, stack.id, 'd', a.y + 5, a.x + 5);
		expect(stackIn(reordered).cardIds).toEqual(['d', 'a', 'b', 'c', 'e']);
		expect(reordered.items.find((item) => item.id === 'd')).toEqual(document.items.find((item) => item.id === 'd'));
		expect(stack.cardIds).toEqual(['a', 'b', 'c', 'd', 'e']);
	});
});

describe('saved Stack column choices', () => {
	it('validates bounded whole counts and discards an unreadable optional choice without losing its Stack', () => {
		expect(isStackColumns(1)).toBe(true);
		expect(isStackColumns(MAX_STACK_COLUMNS)).toBe(true);
		for (const columns of [0, -1, 1.5, MAX_STACK_COLUMNS + 1, NaN, Infinity, '2', null]) {
			expect(isStackColumns(columns)).toBe(false);
			const document = fixture();
			const invalid = { ...document, items: document.items.map((item) => item.id === 'stack' ? { ...item, columns } : item) };
			expect(isWhiteboardDocument(invalid)).toBe(false);
			const upgraded = upgradeDocument(invalid);
			expect(isWhiteboardDocument(upgraded)).toBe(true);
			if (!isWhiteboardDocument(upgraded)) throw new Error('Unreadable upgraded board');
			expect(stackIn(upgraded)).not.toHaveProperty('columns');
			expect(stackIn(upgraded).cardIds).toEqual(stackIn(document).cardIds);
		}
	});

	it('round-trips the choice and enlarged width through storage and document undo/redo', () => {
		const before = fixture();
		const after = setStackColumns(before, 'stack', 3);
		expect(stackIn(before)).not.toHaveProperty('columns');
		expect(stackIn(after)).toMatchObject({ columns: 3, width: 408 });
		const values = new Map<string, string>();
		const store = createWhiteboardStorage({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } });
		expect(store.save(after).ok).toBe(true);
		expect(store.load().value).toEqual(after);
		expect(snapshotDocument(after)).toEqual(after);
		const back = undoEdit(recordEdit(createEditHistory(), before), after)!;
		expect(back.document).toEqual(before);
		expect(redoEdit(back.history, back.document)!.document).toEqual(after);
	});

	it('returns to automatic layout without dropping notes or shrinking the Stack, and rejects invalid edits', () => {
		const explicit = setStackColumns(fixture('gallery'), 'stack', 3);
		const automatic = setStackColumns(explicit, 'stack');
		expect(stackIn(automatic)).not.toHaveProperty('columns');
		expect(stackIn(automatic).width).toBe(360);
		expect(stackIn(automatic).cardIds).toEqual(stackIn(explicit).cardIds);
		expect(automatic.items.filter((item) => item.type !== 'stack')).toEqual(explicit.items.filter((item) => item.type !== 'stack'));
		expect(setStackColumns(automatic, 'stack', 2.5)).toBe(automatic);
		expect(setStackColumns(automatic, 'missing', 2)).toBe(automatic);
		expect(setStackColumns(automatic, 'stack')).toBe(automatic);
	});
});
