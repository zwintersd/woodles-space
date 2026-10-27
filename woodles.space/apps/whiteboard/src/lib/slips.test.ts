import { describe, expect, it } from 'vitest';
import { createCard, createConnector, createEmptyBoard, createSlip, isWhiteboardDocument, slipToCard, snapshotDocument, upgradeDocument } from './model';
import { repairDocument, connectorEndpoints } from './geometry';
import { searchBoard } from './search';
import { createEditHistory, recordEdit, undoEdit, redoEdit } from './history';

describe('slips', () => {
	it('survives a saved document round trip and is searchable by its words', () => {
		const slip = { ...createSlip(12, 24, 1), text: 'a pocket-sized thought' };
		const document = { ...createEmptyBoard(), items: [slip] };
		const restored = upgradeDocument(JSON.parse(JSON.stringify(snapshotDocument(document))));
		expect(isWhiteboardDocument(restored)).toBe(true);
		if (!isWhiteboardDocument(restored)) throw new Error('Unreadable board');
		expect(repairDocument(restored).items).toEqual([slip]);
		expect(searchBoard(restored, 'pocket')[0].item.id).toBe(slip.id);
	});

	it('converts without losing text, position, identity, or connections and can be undone', () => {
		const slip = { ...createSlip(12, 24, 1), text: 'Keep this thought' };
		const other = createCard(300, 0, 2);
		const line = createConnector(slip.id, other.id, 3);
		const before = { ...createEmptyBoard(), items: [slip, other, line] };
		const card = slipToCard(slip);
		const after = repairDocument({ ...before, items: [card, other, line] });
		expect(card).toMatchObject({ id: slip.id, x: 12, y: 24, body: slip.text, title: '', createdAt: slip.createdAt });
		expect(after.items).toContainEqual(line);
		expect(connectorEndpoints(after.items, line)).not.toBeNull();
		const history = recordEdit(createEditHistory(), before);
		const undone = undoEdit(history, after)!;
		expect(undone.document.items[0]).toEqual(slip);
		expect(redoEdit(undone.history, undone.document)!.document.items[0]).toEqual(card);
	});
});
