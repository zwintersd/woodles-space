import { createVersionedStorage, type StorageLike } from '@woodles/persistence';
import { createEmptyBoard, isWhiteboardDocument, type WhiteboardDocument } from './model';
import { repairDocument } from './geometry';

export const WHITEBOARD_STORAGE_KEY = 'woodles.whiteboard.board.v1';

export function createWhiteboardStorage(storage?: StorageLike | null) {
	return createVersionedStorage<WhiteboardDocument>({
		key: WHITEBOARD_STORAGE_KEY,
		version: 1,
		fallback: createEmptyBoard,
		validate: isWhiteboardDocument,
		migrate: () => createEmptyBoard(),
		...(storage === undefined ? {} : { storage })
	});
}

export function restoreWhiteboard(document: WhiteboardDocument): WhiteboardDocument {
	return repairDocument(document);
}

export const whiteboardStorage = createWhiteboardStorage();
