import { beforeEach, describe, expect, it } from 'vitest';
import { listHomeSuiteTrash, moveHomeSuiteArtifactToTrash, restoreHomeSuiteArtifact } from '@shared/homesuiteTrash';
import { loadDraft, saveDraft } from '../../../write/src/lib/drafts';
import { boardLibrary } from '../../../whiteboard/src/lib/library';
import { loadCollections } from '../../../data/src/lib/collections';
import { createFolder, folderForRef, loadFolders, moveFilesToFolder } from './folders';
import { listEverything, surfaceFor } from './surfaces';
import {
	emptyBlob,
	fingerprint,
	fingerprints,
	mergeSuite,
	readSuite,
	SuiteSyncRefused,
	writeSuite,
	type HomeSuiteSyncBlob,
	type SyncBase
} from './suiteSync';

const documents = surfaceFor('document')!;
const boards = surfaceFor('board')!;
const collections = surfaceFor('collection')!;

/** Two devices, one localStorage: each test swaps whole contents in and out. */
function snapshot(): Map<string, string> {
	const saved = new Map<string, string>();
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i)!;
		saved.set(key, localStorage.getItem(key)!);
	}
	return saved;
}

function restore(saved: Map<string, string>): void {
	localStorage.clear();
	for (const [key, value] of saved) localStorage.setItem(key, value);
}

/** One round against a server: pull, merge, write, and agree. */
function syncWith(server: { blob: HomeSuiteSyncBlob }, base: SyncBase): SyncBase {
	const merged = mergeSuite(readSuite(), server.blob, base);
	writeSuite(merged);
	server.blob = JSON.parse(JSON.stringify(merged));
	// What the stores hold afterwards is what was agreed, or every sync would push again.
	expect(fingerprints(readSuite())).toEqual(fingerprints(merged));
	return fingerprints(merged);
}

function doc(id: string, updatedAt: string, words = id) {
	return { entry: { id, title: id, updatedAt }, body: { title: id, layers: { foreground: { html: `<p>${words}</p>` } } } };
}

beforeEach(() => localStorage.clear());

describe('HomeSuite sync merge', () => {
	it('fingerprints ignore key order, the way JSONB hands a blob back', () => {
		expect(fingerprint({ a: 1, b: { c: [1, 2], d: 'x' } })).toBe(fingerprint({ b: { d: 'x', c: [1, 2] }, a: 1 }));
		expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
	});

	it('puts both devices together on a first sync, and removes nothing', () => {
		const local = { ...emptyBlob(), documents: { a: doc('a', '2026-10-01') } };
		const remote = { ...emptyBlob(), documents: { b: doc('b', '2026-10-02') } };
		expect(Object.keys(mergeSuite(local, remote, {}).documents).sort()).toEqual(['a', 'b']);
	});

	it('hands the server its own blob back when there is nothing new, so nothing is pushed', () => {
		const remote = { ...emptyBlob(), documents: { b: doc('b', '2026-10-02') } };
		const local = JSON.parse(JSON.stringify(remote)) as HomeSuiteSyncBlob;
		expect(mergeSuite(local, remote, fingerprints(remote))).toBe(remote);
	});

	it('keeps a delete deleted, unless the other side edited since', () => {
		const agreed = { ...emptyBlob(), documents: { a: doc('a', '2026-10-01'), b: doc('b', '2026-10-01') } };
		const base = fingerprints(agreed);
		// Here: `a` deleted. There: `b` deleted, `a` untouched.
		const local = { ...emptyBlob(), documents: { b: agreed.documents.b } };
		const remote = { ...emptyBlob(), documents: { a: agreed.documents.a } };
		expect(mergeSuite(local, remote, base).documents).toEqual({});

		// There, `a` was edited after this device deleted it: the edit stays.
		const edited = { ...emptyBlob(), documents: { a: doc('a', '2026-10-03', 'still wanted') } };
		expect(Object.keys(mergeSuite(local, edited, base).documents)).toEqual(['a']);
	});

	it('takes the one side that changed, and the later edit when both did', () => {
		const agreed = { ...emptyBlob(), documents: { a: doc('a', '2026-10-01') } };
		const base = fingerprints(agreed);
		const theirs = { ...emptyBlob(), documents: { a: doc('a', '2026-10-02', 'phone') } };
		expect(mergeSuite(agreed, theirs, base).documents.a.body?.layers?.foreground?.html).toBe('<p>phone</p>');

		const mine = { ...emptyBlob(), documents: { a: doc('a', '2026-10-05', 'desk') } };
		expect(mergeSuite(mine, theirs, base).documents.a.body?.layers?.foreground?.html).toBe('<p>desk</p>');
		expect(mergeSuite(theirs, mine, base).documents.a.body?.layers?.foreground?.html).toBe('<p>desk</p>');
	});

	it('drops a placement whose folder went away on the other device', () => {
		const agreed = { ...emptyBlob(), folders: { f: { id: 'f', name: 'Trips', parentId: null } } };
		const base = fingerprints(agreed);
		const local = { ...agreed, placements: { '["write","draft","a"]': 'f' } };
		const remote = emptyBlob();
		const merged = mergeSuite(local, remote, base);
		expect(merged.folders).toEqual({});
		expect(merged.placements).toEqual({});
	});
});

describe('HomeSuite sync between two devices', () => {
	it('carries documents, boards, Collections, folders, and Trash from the phone to the computer', () => {
		const server = { blob: emptyBlob() };

		// The phone makes things and files one.
		const note = documents.create();
		saveDraft(note.ref.id, { title: 'Packing list', layers: { foreground: { html: '<p>socks</p>' } } });
		const board = boards.create();
		const table = collections.create('blank');
		const folder = createFolder('Trips');
		moveFilesToFolder([note.ref], folder.id);
		moveHomeSuiteArtifactToTrash({ ref: table.ref, kind: 'collection', title: table.title, updatedAt: table.updatedAt });
		let phoneBase = syncWith(server, {});
		const phone = snapshot();

		// The computer had one thing of its own.
		localStorage.clear();
		const own = boards.create();
		let deskBase = syncWith(server, {});
		expect(listEverything().artifacts.map((item) => item.ref.id).sort()).toEqual([note.ref.id, board.ref.id, own.ref.id].sort());
		expect(loadDraft(note.ref.id)?.layers?.foreground?.html).toBe('<p>socks</p>');
		expect(folderForRef(loadFolders().value, note.ref)).toBe(folder.id);
		expect(listHomeSuiteTrash().map((entry) => entry.ref.id)).toEqual([table.ref.id]);
		expect(loadCollections().collections.map((entry) => entry.id)).toEqual([table.ref.id]);

		// The computer restores the Collection and permanently deletes the phone's board.
		restoreHomeSuiteArtifact(table.ref);
		boardLibrary.remove(board.ref.id);
		deskBase = syncWith(server, deskBase);
		const desk = snapshot();

		restore(phone);
		phoneBase = syncWith(server, phoneBase);
		expect(listHomeSuiteTrash()).toEqual([]);
		expect(boardLibrary.list().map((entry) => entry.id).sort()).toEqual([own.ref.id]);
		expect(listEverything().artifacts.map((item) => item.ref.id).sort()).toEqual([note.ref.id, table.ref.id, own.ref.id].sort());

		// Nothing new either way: the server's blob comes back untouched.
		restore(desk);
		const before = server.blob;
		expect(mergeSuite(readSuite(), before, deskBase)).toBe(before);
		void phoneBase;
	});

	it('refuses to sync when Collections cannot be read, rather than reporting them deleted', () => {
		localStorage.setItem('woodles.data.collections.v1', '{"woodles":"woodles-persistence","schemaVersion":99,"savedAt":"x","data":{}}');
		expect(() => readSuite()).toThrow(SuiteSyncRefused);
	});
});
