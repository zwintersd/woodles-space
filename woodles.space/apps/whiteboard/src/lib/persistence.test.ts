import { describe, expect, it } from 'vitest';
import { createCard, createEmptyBoard } from './model';
import { createWhiteboardStorage, restoreWhiteboard } from './persistence';

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key)
	};
}

describe('whiteboard persistence', () => {
	it('round-trips the camera and the exact spatial document', () => {
		const store = createWhiteboardStorage(memoryStorage());
		const document = createEmptyBoard();
		document.board.title = 'Makeup Game';
		document.camera = { x: -820, y: 465, zoom: 0.34 };
		document.items = [createCard(350, -120)];
		expect(store.save(document).ok).toBe(true);
		const loaded = store.load();
		expect(loaded.value).toEqual(document);
	});

	it('recovers a valid last-known-good board when the primary is corrupt', () => {
		const storage = memoryStorage();
		const store = createWhiteboardStorage(storage);
		const first = createEmptyBoard();
		first.board.title = 'safe board';
		store.save(first);
		const second = { ...first, board: { ...first.board, title: 'newer board' } };
		store.save(second);
		storage.setItem(store.key, '{not valid json');
		const loaded = store.load();
		expect(loaded.source).toBe('backup');
		expect(loaded.value.board.title).toBe('safe board');
	});

	it('cleans dangling connector relationships during restoration', () => {
		const document = createEmptyBoard();
		document.items = [
			{
				id: 'line', type: 'connector', x: 0, y: 0, width: 0, height: 0, zIndex: 2,
				createdAt: '2026-01-01', updatedAt: '2026-01-01', fromId: 'missing', toId: 'also-missing', arrow: true
			}
		];
		expect(restoreWhiteboard(document).items).toHaveLength(0);
	});

	it('uses the backup when a primary board has invalid camera geometry or duplicate ids', () => {
		const storage = memoryStorage();
		const store = createWhiteboardStorage(storage);
		const safe = createEmptyBoard();
		safe.board.title = 'safe board';
		store.save(safe);
		store.save({ ...safe, board: { ...safe.board, title: 'newer board' } });
		const duplicate = createCard(0, 0);
		storage.setItem(store.key, JSON.stringify({
			woodles: 'woodles-persistence',
			schemaVersion: 1,
			savedAt: '2026-08-13T00:00:00.000Z',
			data: { ...safe, camera: { ...safe.camera, zoom: 0 }, items: [duplicate, { ...duplicate }] }
		}));

		const loaded = store.load();
		expect(loaded.source).toBe('backup');
		expect(loaded.value.board.title).toBe('safe board');
	});
});
