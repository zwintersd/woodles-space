// What HomeSuite syncs: every document, board, Collection, folder and Trash
// entry, as one blob under sync key `homesuite`. The owning apps keep their
// storage; this reads them into the blob and writes a merged one back through
// the same functions the shell already uses.
//
// The merge is three-way and per item. `base` is the fingerprint of each item
// as of the last time this device and the server agreed, so a thing missing on
// one side can be told apart: never seen here (keep it) or deleted here since
// (drop it). Both sides changed → the later `updatedAt` wins; an edit beats a
// delete. Fingerprints are of canonical JSON, because the server stores the
// blob as JSONB and hands it back with its keys reordered. The merge itself is
// `mergeRecords` in `@woodles/sync`, shared with Carillon.

import {
	clearActiveDraftId,
	getActiveDraftId,
	listDrafts,
	loadDraft,
	removeDraftBody,
	saveDraft,
	writeIndex,
	type DraftBody,
	type DraftIndexItem
} from '../../../write/src/lib/drafts';
import { boardLibrary } from '../../../whiteboard/src/lib/library';
import type { WhiteboardDocument } from '../../../whiteboard/src/lib/model';
import { loadCollections, removeCollection, saveCollection, type Collection } from '../../../data/src/lib/collections';
import { listHomeSuiteTrash, replaceHomeSuiteTrash, type HomeSuiteTrashEntry } from '@shared/homesuiteTrash';
import { canonical, fingerprint, fingerprintRecord, mergeRecords } from '@woodles/sync';
import { loadFolders, refKey, replaceFolders, type FolderLibrary, type HomeSuiteFolder } from './folders';
import { trashKey } from './surfaces';

export { fingerprint };

export const HOMESUITE_SYNC_APP = 'homesuite';
export const HOMESUITE_SYNC_BASE_KEY = 'woodles.homesuite.sync.base.v1';

export type SyncedDocument = { entry: DraftIndexItem; body: DraftBody | null };
export type HomeSuiteSyncBlob = {
	format: 1;
	documents: Record<string, SyncedDocument>;
	boards: Record<string, WhiteboardDocument>;
	collections: Record<string, Collection>;
	trash: Record<string, HomeSuiteTrashEntry>;
	folders: Record<string, HomeSuiteFolder>;
	/** refKey → folder id. */
	placements: Record<string, string>;
};

export const SECTIONS = ['documents', 'boards', 'collections', 'trash', 'folders', 'placements'] as const;
export type Section = (typeof SECTIONS)[number];
export type SyncBase = Partial<Record<Section, Record<string, string>>>;

const WHEN: Record<Section, (value: never) => string> = {
	documents: (value: SyncedDocument) => value.entry.updatedAt,
	boards: (value: WhiteboardDocument) => value.updatedAt,
	collections: (value: Collection) => value.updatedAt,
	trash: (value: HomeSuiteTrashEntry) => value.trashedAt,
	// Neither carries a time; when both devices moved the same one, this one's stands.
	folders: () => '',
	placements: () => ''
};

export function emptyBlob(): HomeSuiteSyncBlob {
	return { format: 1, documents: {}, boards: {}, collections: {}, trash: {}, folders: {}, placements: {} };
}

export function fingerprints(blob: HomeSuiteSyncBlob): SyncBase {
	const base: SyncBase = {};
	for (const section of SECTIONS) {
		base[section] = fingerprintRecord(blob[section] ?? {});
	}
	return base;
}

/** Local changes since the last agreement — the cue to push. */
export function differsFromBase(blob: HomeSuiteSyncBlob, base: SyncBase): boolean {
	const now = fingerprints(blob);
	return SECTIONS.some((section) => canonical(now[section] ?? {}) !== canonical(base[section] ?? {}));
}

/** Placements that point nowhere are dropped, and a parent loop is cut. */
function repairFolders(blob: HomeSuiteSyncBlob): void {
	const folders = blob.folders;
	for (const folder of Object.values(folders)) {
		if (folder.parentId !== null && !folders[folder.parentId]) folders[folder.id] = { ...folder, parentId: null };
	}
	for (const id of Object.keys(folders)) {
		const seen = new Set([id]);
		let parent = folders[id].parentId;
		while (parent !== null) {
			if (seen.has(parent)) { folders[id] = { ...folders[id], parentId: null }; break; }
			seen.add(parent);
			parent = folders[parent].parentId;
		}
	}
	for (const [key, folderId] of Object.entries(blob.placements)) {
		if (!folders[folderId]) delete blob.placements[key];
	}
}

/**
 * Returns `remote` itself when the merge adds nothing to it, so the sync
 * client sees there is nothing to push.
 */
export function mergeSuite(local: HomeSuiteSyncBlob, remote: HomeSuiteSyncBlob, base: SyncBase): HomeSuiteSyncBlob {
	const theirs = { ...emptyBlob(), ...remote };
	const merged = emptyBlob();
	for (const section of SECTIONS) {
		const when = WHEN[section] as (value: unknown) => string;
		(merged as Record<Section, unknown>)[section] = mergeRecords(
			local[section] as Record<string, unknown>,
			theirs[section] as Record<string, unknown>,
			base[section],
			(mine, theirs) => (when(theirs) > when(mine) ? theirs : mine)
		);
	}
	repairFolders(merged);
	const same = SECTIONS.every((section) => canonical(merged[section]) === canonical(theirs[section]));
	return same && remote.format === 1 ? remote : merged;
}

export function isSuiteBlob(value: unknown): value is HomeSuiteSyncBlob {
	if (!value || typeof value !== 'object') return false;
	const blob = value as Record<string, unknown>;
	return blob.format === 1 && SECTIONS.every((section) => blob[section] === undefined || (typeof blob[section] === 'object' && blob[section] !== null && !Array.isArray(blob[section])));
}

// ── the stores ────────────────────────────────────────────────────────────

export class SuiteSyncRefused extends Error {}

/**
 * Everything HomeSuite lists, plus what Trash holds. Refuses rather than
 * reporting an empty library it could not read: an empty section would read
 * as "deleted here" and take the other devices' copies with it.
 */
export function readSuite(): HomeSuiteSyncBlob {
	const blob = emptyBlob();
	for (const entry of listDrafts()) blob.documents[entry.id] = { entry, body: loadDraft(entry.id) };
	for (const summary of boardLibrary.list()) {
		const opened = boardLibrary.open(summary.id);
		if (!opened || opened.source === 'fallback') throw new SuiteSyncRefused(`The board “${summary.title || 'Untitled board'}” could not be read on this device, so nothing was synced.`);
		blob.boards[summary.id] = opened.document;
	}
	const collections = loadCollections();
	if (!collections.writable || collections.quarantined) {
		throw new SuiteSyncRefused(`${collections.issue?.message ?? 'Collections could not be read on this device.'} Nothing was synced.`);
	}
	for (const collection of collections.collections) blob.collections[collection.id] = collection;
	for (const entry of listHomeSuiteTrash()) blob.trash[trashKey(entry.ref)] = entry;
	const folders = loadFolders();
	if (folders.source === 'fallback' && folders.issue) throw new SuiteSyncRefused(`Folder organization could not be read. Nothing was synced. ${folders.issue.message}`);
	for (const folder of folders.value.folders) blob.folders[folder.id] = folder;
	for (const placement of folders.value.placements) blob.placements[refKey(placement.ref)] = placement.folderId;
	return blob;
}

function changed<T>(now: Record<string, T>, next: Record<string, T>) {
	const save = Object.entries(next).filter(([id, value]) => !now[id] || fingerprint(now[id]) !== fingerprint(value));
	const drop = Object.keys(now).filter((id) => !(id in next));
	return { save, drop, any: save.length > 0 || drop.length > 0 };
}

/** Writes only what differs, so an unchanged sync touches no storage. */
export function writeSuite(next: HomeSuiteSyncBlob): void {
	const now = readSuite();
	const blob = { ...emptyBlob(), ...next };

	const documents = changed(now.documents, blob.documents);
	if (documents.any) {
		for (const [id, doc] of documents.save) if (doc.body) saveDraft(id, doc.body);
		for (const id of documents.drop) {
			removeDraftBody(id);
			if (getActiveDraftId() === id) clearActiveDraftId();
		}
		// Keep this device's order; new arrivals go on the end, as Write appends.
		const index = listDrafts().filter((entry) => entry.id in blob.documents).map((entry) => blob.documents[entry.id].entry);
		const known = new Set(index.map((entry) => entry.id));
		writeIndex([...index, ...Object.values(blob.documents).filter((doc) => !known.has(doc.entry.id)).map((doc) => doc.entry)]);
	}

	const boards = changed(now.boards, blob.boards);
	const active = boardLibrary.activeId();
	for (const [, document] of boards.save) {
		const result = boardLibrary.save(document);
		if (!result.ok) throw new SuiteSyncRefused(result.issue?.message ?? 'Could not save a synced board.');
	}
	for (const id of boards.drop) boardLibrary.remove(id);
	if (active && active !== boardLibrary.activeId() && blob.boards[active]) boardLibrary.setActiveId(active);

	const collections = changed(now.collections, blob.collections);
	for (const [, collection] of collections.save) {
		const result = saveCollection(collection);
		if (!result.ok) throw new SuiteSyncRefused(result.issue?.message ?? 'Could not save a synced Collection.');
	}
	for (const id of collections.drop) {
		const result = removeCollection(id);
		if (!result.ok) throw new SuiteSyncRefused(result.issue?.message ?? 'Could not remove a Collection deleted on another device.');
	}

	if (changed(now.trash, blob.trash).any) replaceHomeSuiteTrash(Object.values(blob.trash));

	if (changed(now.folders, blob.folders).any || changed(now.placements, blob.placements).any) {
		const library: FolderLibrary = {
			folders: Object.values(blob.folders),
			placements: Object.entries(blob.placements).flatMap(([key, folderId]) => {
				const ref = parseRefKey(key);
				return ref ? [{ ref, folderId }] : [];
			})
		};
		replaceFolders(library);
	}
}

function parseRefKey(key: string): { app: string; kind: string; id: string } | null {
	try {
		const [app, kind, id] = JSON.parse(key) as unknown[];
		return typeof app === 'string' && typeof kind === 'string' && typeof id === 'string' ? { app, kind, id } : null;
	} catch {
		return null;
	}
}

export function loadBase(): SyncBase {
	try {
		const value: unknown = JSON.parse(localStorage.getItem(HOMESUITE_SYNC_BASE_KEY) ?? '{}');
		return value && typeof value === 'object' ? value as SyncBase : {};
	} catch {
		return {};
	}
}

export function saveBase(base: SyncBase): void {
	try { localStorage.setItem(HOMESUITE_SYNC_BASE_KEY, JSON.stringify(base)); } catch { /* the next sync merges without it */ }
}

export function clearBase(): void {
	try { localStorage.removeItem(HOMESUITE_SYNC_BASE_KEY); } catch { /* as above */ }
}
