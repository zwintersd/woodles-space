import { describe, expect, it } from 'vitest';
import { appearanceCss, patchAppearance, RESET_APPEARANCE, validAppearance } from './appearance';
import { createCard, createConnector, createEmptyBoard, createImage, createSlip, isWhiteboardDocument, slipToCard, snapshotDocument, upgradeDocument } from './model';
import { createEditHistory, recordEdit, undoEdit, redoEdit } from './history';
import { connectorEndpoints } from './geometry';
import { createWhiteboardStorage } from './persistence';

describe('board-local appearance', () => {
	it('round-trips appearance and saved colours while older objects keep their original look', () => {
		const values = new Map<string, string>();
		const storage = createWhiteboardStorage({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } });
		const board = createEmptyBoard();
		board.items = [{ ...createCard(1, 2, 1), appearance: { fill: '#edc9cf', outlineWidth: 4, corners: 'round' } }, createSlip(5, 8, 2)];
		board.swatches = ['#604c46'];
		expect(storage.save(board).ok).toBe(true);
		expect(storage.load().value).toEqual(board);
		expect(appearanceCss(board.items[1].appearance)).toBe('');
	});

	it.each([{ opacity: NaN }, { opacity: 0 }, { outlineWidth: 500 }, { fill: 'url(https://example.com)' }, { corners: 'banana' }, { shadow: '0 0 100vw red' }, { mystery: true }, []])('rejects unsafe or unreadable appearance %j', (appearance) => {
		expect(validAppearance(appearance)).toBe(false);
		const board = { ...createEmptyBoard(), items: [{ ...createCard(0, 0, 1), appearance }] };
		expect(isWhiteboardDocument(board)).toBe(false);
		const recovered = upgradeDocument(board);
		expect(isWhiteboardDocument(recovered)).toBe(true);
		if (!isWhiteboardDocument(recovered)) throw new Error('Board lost');
		expect(recovered.items[0].appearance).toBeUndefined();
	});

	it('recovers a board with invalid saved colours without discarding its contents', () => {
		const board = { ...createEmptyBoard(), items: [createSlip(0, 0, 1)], swatches: ['red; background:url(x)'] };
		expect(isWhiteboardDocument(board)).toBe(false);
		const recovered = upgradeDocument(board);
		expect(isWhiteboardDocument(recovered)).toBe(true);
		if (!isWhiteboardDocument(recovered)) throw new Error('Board lost');
		expect(recovered.items).toEqual(board.items);
		expect(recovered.swatches).toBeUndefined();
	});

	it('styles mixed selections independently without replacing other overrides', () => {
		const card = { ...createCard(0, 0, 1), appearance: { fill: '#edc9cf' } };
		const slip = { ...createSlip(0, 0, 2), appearance: { fill: '#d6e2c9' } };
		const patch = { ink: '#604c46' };
		const first = patchAppearance(card, patch)!;
		const second = patchAppearance(slip, patch)!;
		expect(first).toEqual({ fill: '#edc9cf', ink: '#604c46' });
		expect(second).toEqual({ fill: '#d6e2c9', ink: '#604c46' });
		first.ink = '#ffffff';
		expect(second.ink).toBe('#604c46');
		expect(card.appearance).toEqual({ fill: '#edc9cf' });
	});

	it('limits pasted appearance to fields relevant to the destination', () => {
		const image = createImage(1, 2, 'asset', 'Photo', 2, 1);
		expect(patchAppearance(image, { fill: '#edc9cf', ink: '#604c46' })).toEqual({ fill: '#edc9cf' });
		expect(image.assetId).toBe('asset');
		expect(patchAppearance(createConnector('a', 'b', 1), { fill: '#edc9cf' })).toBeUndefined();
	});

	it('copies appearance and swatches independently into history, including redo', () => {
		const before = { ...createEmptyBoard(), items: [{ ...createSlip(2, 4, 1), appearance: { fill: '#edc9cf' } }], swatches: ['#edc9cf'] };
		const history = recordEdit(createEditHistory(), before);
		const after = snapshotDocument(before);
		after.items[0].appearance!.fill = '#d6e2c9';
		after.swatches!.push('#d6e2c9');
		expect(before.items[0].appearance!.fill).toBe('#edc9cf');
		const back = undoEdit(history, after)!;
		expect(back.document).toEqual(before);
		expect(redoEdit(back.history, back.document)!.document).toEqual(after);
	});

	it('keeps identity, references and connectors when a styled slip becomes a card', () => {
		const slip = { ...createSlip(12, 24, 1), text: 'Hello', appearance: { fill: '#d6e2c9' }, properties: { source: 'https://woodles.space/write?document=source' } };
		const card = slipToCard(slip);
		const other = createCard(300, 50, 2);
		const line = createConnector(slip.id, other.id, 3);
		expect(card).toMatchObject({ id: slip.id, appearance: slip.appearance, properties: slip.properties });
		expect(connectorEndpoints([card, other, line], line)).not.toBeNull();
		card.appearance!.fill = '#edc9cf';
		expect(slip.appearance.fill).toBe('#d6e2c9');
		expect(patchAppearance(card, RESET_APPEARANCE)).toBeUndefined();
	});
});
