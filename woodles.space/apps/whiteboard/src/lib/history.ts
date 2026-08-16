import { snapshotDocument, type WhiteboardDocument } from './model';

/**
 * Undo/redo for document edits. Deliberately separate from camera.ts's
 * CameraHistory, which records *where you looked*, not *what you did* — the
 * two histories are independent, and restoring an entry here never touches
 * the live camera (see `applyRestoredDocument`).
 */

const MAX_EDIT_HISTORY = 50;
/**
 * Calls sharing a `coalesceKey` within this window merge into the same
 * entry, so typing a sentence into a card is one undo step, not one per
 * keystroke. A discrete action (a click) always gets its own step: pass no
 * key, or a key nothing else is currently sharing.
 */
const COALESCE_WINDOW_MS = 800;

type HistoryEntry = {
	snapshot: WhiteboardDocument;
	coalesceKey: string | null;
	at: number;
};

export type EditHistory = {
	past: HistoryEntry[];
	future: HistoryEntry[];
};

export function createEditHistory(): EditHistory {
	return { past: [], future: [] };
}

export function canUndo(history: EditHistory): boolean {
	return history.past.length > 0;
}

export function canRedo(history: EditHistory): boolean {
	return history.future.length > 0;
}

/**
 * Call before a mutation, with the document as it stood immediately before
 * that mutation. A genuinely new action always clears the redo branch — the
 * same rule camera history and every other undo stack follows.
 */
export function recordEdit(
	history: EditHistory,
	before: WhiteboardDocument,
	coalesceKey: string | null = null,
	at = Date.now()
): EditHistory {
	const last = history.past[history.past.length - 1];
	if (last && coalesceKey !== null && last.coalesceKey === coalesceKey && at - last.at < COALESCE_WINDOW_MS) {
		// Continuation of the same burst: the original "before" still stands,
		// only the clock resets so the burst can keep absorbing edits.
		return { past: history.past.slice(0, -1).concat({ ...last, at }), future: history.future };
	}
	const past = [...history.past, { snapshot: snapshotDocument(before), coalesceKey, at }];
	return {
		past: past.length > MAX_EDIT_HISTORY ? past.slice(past.length - MAX_EDIT_HISTORY) : past,
		future: []
	};
}

export type EditStep = { history: EditHistory; document: WhiteboardDocument };

/** Steps back one entry, carrying `current` onto the redo branch. Null at the start of history. */
export function undoEdit(history: EditHistory, current: WhiteboardDocument): EditStep | null {
	if (!history.past.length) return null;
	const entry = history.past[history.past.length - 1];
	const past = history.past.slice(0, -1);
	const future = [...history.future, { snapshot: snapshotDocument(current), coalesceKey: entry.coalesceKey, at: entry.at }];
	return { history: { past, future }, document: entry.snapshot };
}

/** Steps forward one entry, carrying `current` back onto the past. Null when there is nothing to redo. */
export function redoEdit(history: EditHistory, current: WhiteboardDocument): EditStep | null {
	if (!history.future.length) return null;
	const entry = history.future[history.future.length - 1];
	const future = history.future.slice(0, -1);
	const past = [...history.past, { snapshot: snapshotDocument(current), coalesceKey: entry.coalesceKey, at: entry.at }];
	return { history: { past, future }, document: entry.snapshot };
}

/**
 * Restoring an entry brings back everything the entry remembers except the
 * camera — undo takes the board back to what it *said*, never to where you
 * happened to be looking when you said it.
 */
export function applyRestoredDocument(current: WhiteboardDocument, restored: WhiteboardDocument): WhiteboardDocument {
	return { ...snapshotDocument(restored), camera: { ...current.camera } };
}
