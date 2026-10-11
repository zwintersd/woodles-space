import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	HOMESUITE_FOLDERS_KEY, createFolder, folderForRef, folderPath, loadFolders,
	moveFilesToFolder, moveFolder, removeFolder, renameFolder
} from './folders';
import { listEverything, surfaceFor } from './surfaces';
import { moveHomeSuiteArtifactToTrash, restoreHomeSuiteArtifact } from '@shared/homesuiteTrash';

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('HomeSuite folder organization', () => {
	it('persists nested folders and compares names only within siblings', () => {
		const project = createFolder('  Project  ');
		const notes = createFolder('Notes', project.id);
		createFolder('Notes');
		expect(() => createFolder('notes', project.id)).toThrow(/already exists/);
		renameFolder(notes.id, 'Research');
		expect(folderPath(loadFolders().value, notes.id).map((folder) => folder.name)).toEqual(['Project', 'Research']);
		expect(() => renameFolder(notes.id, '  ')).toThrow(/name/);
	});

	it('moves mixed file refs in one save without touching source content or timestamps', () => {
		const folder = createFolder('Project');
		const files = ['document', 'board', 'collection'].map((kind) => surfaceFor(kind)!.create());
		const before = new Map(Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)!)
			.filter((key) => /^(woodles_draft|woodles\.whiteboard|woodles\.data)/.test(key))
			.map((key) => [key, localStorage.getItem(key)]));
		moveFilesToFolder(files.map((file) => file.ref), folder.id);
		expect(listEverything().artifacts).toEqual(expect.arrayContaining(files));
		for (const [key, value] of before) {
			expect(localStorage.getItem(key)).toBe(value);
		}
		moveFilesToFolder([files[0].ref, files[0].ref], folder.id);
		expect(loadFolders().value.placements).toHaveLength(3);
		moveFilesToFolder([files[0].ref], null);
		expect(folderForRef(loadFolders().value, files[0].ref)).toBeNull();
	});

	it('uses the full app/kind/id identity and preserves placement through Trash and restore', () => {
		const a = createFolder('A'); const b = createFolder('B');
		const document = surfaceFor('document')!.create();
		const sameId = { app: 'whiteboard', kind: 'board', id: document.ref.id };
		moveFilesToFolder([document.ref], a.id); moveFilesToFolder([sameId], b.id);
		moveHomeSuiteArtifactToTrash(document);
		expect(listEverything().artifacts).toEqual([]);
		restoreHomeSuiteArtifact(document.ref);
		expect(listEverything().artifacts[0].ref).toEqual(document.ref);
		expect(folderForRef(loadFolders().value, document.ref)).toBe(a.id);
		expect(folderForRef(loadFolders().value, sameId)).toBe(b.id);
	});

	it('rejects cycles, missing destinations, and conflicting moves without changing the save', () => {
		const parent = createFolder('Parent'); const child = createFolder('Child', parent.id);
		const other = createFolder('Other'); createFolder('Child', other.id);
		const before = localStorage.getItem(HOMESUITE_FOLDERS_KEY);
		expect(() => moveFolder(parent.id, child.id)).toThrow(/itself/);
		expect(() => moveFolder(child.id, child.id)).toThrow(/itself/);
		expect(() => moveFolder(child.id, other.id)).toThrow(/already exists/);
		expect(() => moveFilesToFolder([{ app: 'write', kind: 'draft', id: 'x' }], 'missing')).toThrow(/no longer available/);
		expect(localStorage.getItem(HOMESUITE_FOLDERS_KEY)).toBe(before);
		moveFolder(child.id, null);
		expect(folderPath(loadFolders().value, child.id).map((folder) => folder.name)).toEqual(['Child']);
	});

	it('removes only the folder and lifts its files and subfolders, preserving colliding names', () => {
		const parent = createFolder('Parent'); const removed = createFolder('Removed', parent.id);
		const sibling = createFolder('Notes', parent.id); const child = createFolder('Notes', removed.id);
		const document = surfaceFor('document')!.create();
		moveFilesToFolder([document.ref], removed.id); removeFolder(removed.id);
		const library = loadFolders().value;
		expect(folderForRef(library, document.ref)).toBe(parent.id);
		expect(library.folders.find((folder) => folder.id === child.id)).toMatchObject({ name: 'Notes (2)', parentId: parent.id });
		expect(library.folders.find((folder) => folder.id === sibling.id)?.name).toBe('Notes');
		removeFolder(parent.id);
		expect(folderForRef(loadFolders().value, document.ref)).toBeNull();
		expect(listEverything().artifacts[0].ref).toEqual(document.ref);
	});

	it('re-reads the live library for mutations and refuses unreadable data', () => {
		const stale = loadFolders().value;
		const otherTab = createFolder('Other tab');
		createFolder('This tab');
		expect(stale.folders).toEqual([]);
		expect(loadFolders().value.folders.some((folder) => folder.id === otherTab.id)).toBe(true);
		localStorage.removeItem(`${HOMESUITE_FOLDERS_KEY}.backup`);
		localStorage.setItem(HOMESUITE_FOLDERS_KEY, '{broken');
		expect(() => createFolder('Unsafe')).toThrow(/Nothing was saved/);
		expect(localStorage.getItem(HOMESUITE_FOLDERS_KEY)).toBe('{broken');
	});

	it('keeps a lifted child name when its removed parent was the only conflict', () => {
		const parent = createFolder('Project'); const child = createFolder('Project', parent.id);
		removeFolder(parent.id);
		expect(loadFolders().value.folders).toEqual([{ ...child, parentId: null }]);
	});

	it('reports storage failure without claiming success', () => {
		const before = localStorage.getItem(HOMESUITE_FOLDERS_KEY);
		vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
		expect(() => createFolder('No room')).toThrow();
		expect(localStorage.getItem(HOMESUITE_FOLDERS_KEY)).toBe(before);
	});

	it('recovers a valid backup and rejects cyclic or future data without overwriting it', () => {
		const folder = createFolder('Kept'); createFolder('Second');
		localStorage.setItem(HOMESUITE_FOLDERS_KEY, '{broken');
		const recovered = loadFolders();
		expect(recovered.source).toBe('backup');
		expect(recovered.value.folders[0].id).toBe(folder.id);
		localStorage.removeItem(`${HOMESUITE_FOLDERS_KEY}.backup`);
		const envelope = { woodles: 'woodles-persistence', schemaVersion: 1, savedAt: 'now',
			data: { folders: [{ id: 'cycle', name: 'Cycle', parentId: 'cycle' }], placements: [] } };
		localStorage.setItem(HOMESUITE_FOLDERS_KEY, JSON.stringify(envelope));
		expect(() => createFolder('Unsafe')).toThrow(/Nothing was saved/);
		localStorage.setItem(HOMESUITE_FOLDERS_KEY, JSON.stringify({ ...envelope, schemaVersion: 99 }));
		expect(() => createFolder('Unsafe')).toThrow(/schema 99/);
	});
});
