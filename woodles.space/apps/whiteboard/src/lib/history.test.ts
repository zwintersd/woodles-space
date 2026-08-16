import { describe, expect, it } from 'vitest';
import { applyRestoredDocument, canRedo, canUndo, createEditHistory, recordEdit, redoEdit, undoEdit } from './history';
import { createCard, createEmptyBoard, type WhiteboardDocument } from './model';

function withItems(items: WhiteboardDocument['items'] = []): WhiteboardDocument {
	return { ...createEmptyBoard(), items };
}

describe('edit history', () => {
	it('starts with nothing to undo or redo', () => {
		const history = createEditHistory();
		expect(canUndo(history)).toBe(false);
		expect(canRedo(history)).toBe(false);
	});

	it('undoes back to the document as it stood before the recorded edit', () => {
		const before = withItems([createCard(0, 0)]);
		let history = createEditHistory();
		history = recordEdit(history, before);
		const after = withItems([createCard(0, 0), createCard(100, 100)]);

		const step = undoEdit(history, after)!;
		expect(step.document.items).toHaveLength(1);
		expect(canUndo(step.history)).toBe(false);
		expect(canRedo(step.history)).toBe(true);
	});

	it('redoes back to the document as it stood before the undo', () => {
		const before = withItems([createCard(0, 0)]);
		const after = withItems([createCard(0, 0), createCard(100, 100)]);
		let history = recordEdit(createEditHistory(), before);

		const back = undoEdit(history, after)!;
		const forward = redoEdit(back.history, back.document)!;
		expect(forward.document.items).toHaveLength(2);
		expect(canRedo(forward.history)).toBe(false);
	});

	it('refuses to step past either end', () => {
		const document = withItems();
		expect(undoEdit(createEditHistory(), document)).toBeNull();
		const history = recordEdit(createEditHistory(), document);
		const back = undoEdit(history, document)!;
		expect(redoEdit(back.history, back.document)).not.toBeNull();
		expect(redoEdit(createEditHistory(), document)).toBeNull();
	});

	it('drops the redo branch once a new edit is recorded', () => {
		const first = withItems([createCard(0, 0)]);
		const second = withItems([createCard(0, 0), createCard(100, 100)]);
		let history = recordEdit(createEditHistory(), first);
		const back = undoEdit(history, second)!;
		expect(canRedo(back.history)).toBe(true);

		// A fresh edit instead of a redo — the undone future is gone.
		const branched = recordEdit(back.history, back.document);
		expect(canRedo(branched)).toBe(false);
	});

	it('coalesces edits sharing a key within the window into one step', () => {
		const document = withItems([createCard(0, 0)]);
		let history = createEditHistory();
		history = recordEdit(history, document, 'card-title:card-1', 1_000);
		history = recordEdit(history, document, 'card-title:card-1', 1_400);
		history = recordEdit(history, document, 'card-title:card-1', 1_799);
		expect(history.past).toHaveLength(1);
	});

	it('starts a new step once the coalescing window has passed', () => {
		const document = withItems([createCard(0, 0)]);
		let history = createEditHistory();
		history = recordEdit(history, document, 'card-title:card-1', 1_000);
		history = recordEdit(history, document, 'card-title:card-1', 1_900);
		expect(history.past).toHaveLength(2);
	});

	it('never coalesces edits with different keys, even back to back', () => {
		const document = withItems([createCard(0, 0)]);
		let history = createEditHistory();
		history = recordEdit(history, document, 'card-title:card-1', 1_000);
		history = recordEdit(history, document, 'card-title:card-2', 1_010);
		expect(history.past).toHaveLength(2);
	});

	it('never coalesces a discrete action (no key) with anything', () => {
		const document = withItems([createCard(0, 0)]);
		let history = createEditHistory();
		history = recordEdit(history, document, null, 1_000);
		history = recordEdit(history, document, null, 1_010);
		expect(history.past).toHaveLength(2);
	});

	it('keeps only the most recent 50 steps', () => {
		let history = createEditHistory();
		for (let i = 0; i < 60; i += 1) {
			history = recordEdit(history, withItems([createCard(i, i)]), null, i);
		}
		expect(history.past).toHaveLength(50);
		// The oldest ten fell off; the entry from step 10 is now the first one kept.
		expect(history.past[0].snapshot.items[0].x).toBe(10);
	});

	it('records a deep copy, immune to the live document changing afterward', () => {
		const items = [createCard(0, 0)];
		const document = withItems(items);
		const history = recordEdit(createEditHistory(), document);
		items.push(createCard(1, 1));
		document.items = items;

		const step = undoEdit(history, document)!;
		expect(step.document.items).toHaveLength(1);
	});

	it('restores everything but the camera, which stays where the viewer is', () => {
		const restored = { ...withItems([createCard(5, 5)]), camera: { x: -900, y: 200, zoom: 2 } };
		const current = { ...withItems(), camera: { x: 0, y: 0, zoom: 1 } };
		const applied = applyRestoredDocument(current, restored);
		expect(applied.items).toEqual(restored.items);
		expect(applied.camera).toEqual({ x: 0, y: 0, zoom: 1 });
	});
});
