import { describe, expect, it } from 'vitest';
import { createBoardLibrary, LEGACY_BOARD_KEY, summarize } from './library';
import { createCard, createEmptyBoard, createFrame, createImage, now, type WhiteboardDocument } from './model';

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
		keys: () => [...values.keys()]
	};
}

function boardNamed(title: string, items: WhiteboardDocument['items'] = []): WhiteboardDocument {
	return { ...createEmptyBoard(), board: { ...createEmptyBoard().board, title }, items };
}

describe('the board shelf', () => {
	it('keeps boards apart, each with its own material', () => {
		const library = createBoardLibrary(memoryStorage());
		const first = boardNamed('Makeup Game', [createCard(0, 0)]);
		const second = boardNamed('Studio', [createFrame(0, 0), createFrame(700, 0)]);
		library.save(first);
		library.save(second);

		expect(library.list().map((entry) => entry.title).sort()).toEqual(['Makeup Game', 'Studio']);
		expect(library.open(first.board.id)!.document.items).toHaveLength(1);
		expect(library.open(second.board.id)!.document.items).toHaveLength(2);
	});

	it('lists the most recently touched board first', () => {
		const library = createBoardLibrary(memoryStorage());
		library.save({ ...boardNamed('older'), updatedAt: '2026-01-01T00:00:00.000Z' });
		library.save({ ...boardNamed('newer'), updatedAt: '2026-08-01T00:00:00.000Z' });
		expect(library.list().map((entry) => entry.title)).toEqual(['newer', 'older']);
	});

	it('counts what is on a board without opening it', () => {
		const summary = summarize(boardNamed('Studio', [createFrame(0, 0), createCard(0, 0), createCard(40, 40)]));
		expect(summary).toMatchObject({ title: 'Studio', items: 3, frames: 1 });
	});

	it('has nothing to open for a board that was never on the shelf', () => {
		const library = createBoardLibrary(memoryStorage());
		expect(library.open('board-nowhere')).toBeNull();
	});

	it('starts a new board and makes it the one that opens next time', () => {
		const library = createBoardLibrary(memoryStorage());
		const created = library.create('Fresh');
		expect(library.activeId()).toBe(created.board.id);
		expect(library.open(created.board.id)!.document.board.title).toBe('Fresh');
	});

	it('copies a board without tying the copy to the original', () => {
		const library = createBoardLibrary(memoryStorage());
		const original = boardNamed('Makeup Game', [createCard(0, 0)]);
		library.save(original);
		const copy = library.duplicate(original.board.id)!;

		expect(copy.board.id).not.toBe(original.board.id);
		expect(copy.board.title).toBe('Makeup Game copy');
		library.save({ ...copy, items: [] });
		expect(library.open(original.board.id)!.document.items).toHaveLength(1);
	});

	it('forgets a deleted board, its backup, and its place as the open one', () => {
		const storage = memoryStorage();
		const library = createBoardLibrary(storage);
		const board = boardNamed('Temporary', [createCard(0, 0)]);
		library.save(board);
		library.save({ ...board, updatedAt: now() });
		library.setActiveId(board.board.id);

		library.remove(board.board.id);
		expect(library.list()).toEqual([]);
		expect(library.activeId()).toBeNull();
		expect(storage.keys().some((key) => key.includes(board.board.id))).toBe(false);
	});

	it('renames a board on the shelf and in the board itself', () => {
		const library = createBoardLibrary(memoryStorage());
		const board = boardNamed('Untitled whiteboard');
		library.save(board);
		library.rename(board.board.id, 'Foundation notes');
		expect(library.list()[0].title).toBe('Foundation notes');
		expect(library.open(board.board.id)!.document.board.title).toBe('Foundation notes');
	});
});

describe('images shared between boards', () => {
	it('counts an asset as spoken for while another board still holds it', () => {
		const library = createBoardLibrary(memoryStorage());
		const keeper = boardNamed('Keeper', [createImage(0, 0, 'asset-shared', 'shared.png', 1.5)]);
		const leaving = boardNamed('Leaving', [
			createImage(0, 0, 'asset-shared', 'shared.png', 1.5),
			createImage(0, 0, 'asset-own', 'own.png', 1.5)
		]);
		library.save(keeper);
		library.save(leaving);

		const stillUsed = library.referencedAssets(leaving.board.id);
		expect(stillUsed.has('asset-shared')).toBe(true);
		expect(stillUsed.has('asset-own')).toBe(false);
	});
});

describe('the board that came before the shelf', () => {
	it('moves the single saved board onto the shelf and opens it', () => {
		const storage = memoryStorage();
		const legacy = { ...createEmptyBoard(), board: { id: 'board-legacy', title: 'The only board' }, items: [createCard(10, 20)] };
		const { home: _home, viewpoints: _viewpoints, journey: _journey, ...schemaOne } = legacy;
		storage.setItem(LEGACY_BOARD_KEY, JSON.stringify({
			woodles: 'woodles-persistence',
			schemaVersion: 1,
			savedAt: '2026-08-13T00:00:00.000Z',
			data: schemaOne
		}));

		const library = createBoardLibrary(storage);
		const adopted = library.adoptLegacyBoard()!;
		expect(adopted.board.title).toBe('The only board');
		expect(adopted.items).toHaveLength(1);
		// Schema 2's navigation arrives filled in rather than missing.
		expect(adopted.viewpoints).toEqual([]);
		expect(adopted.journey).toEqual({ stops: [], loop: false });
		expect(library.list().map((entry) => entry.title)).toEqual(['The only board']);
		expect(library.activeId()).toBe('board-legacy');
	});

	it('runs only once, leaving nothing behind to adopt twice', () => {
		const storage = memoryStorage();
		storage.setItem(LEGACY_BOARD_KEY, JSON.stringify({
			woodles: 'woodles-persistence',
			schemaVersion: 1,
			savedAt: '2026-08-13T00:00:00.000Z',
			data: { ...createEmptyBoard(), board: { id: 'board-legacy', title: 'Once' } }
		}));
		const library = createBoardLibrary(storage);
		expect(library.adoptLegacyBoard()).not.toBeNull();
		expect(library.adoptLegacyBoard()).toBeNull();
		expect(library.list()).toHaveLength(1);
	});

	it('has nothing to adopt when there was never an old board', () => {
		expect(createBoardLibrary(memoryStorage()).adoptLegacyBoard()).toBeNull();
	});
});
