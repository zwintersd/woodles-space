import { beforeEach, describe, expect, it } from 'vitest';
import { createVersionedStorage, type StorageLike } from '@woodles/persistence';
import {
	addField, addRecord, createCollection, createCollectionStore, deleteField, duplicateRecord, importCollections, isCollection,
	isCollectionLibrary, removeRecord, renameField, resizeColumn, setCellValue, type CollectionLibrary
} from './collections';

class MemoryStorage implements StorageLike {
	values = new Map<string, string>();
	getItem(key: string) { return this.values.get(key) ?? null; }
	setItem(key: string, value: string) { this.values.set(key, value); }
	removeItem(key: string) { this.values.delete(key); }
}

describe('Collection model', () => {
	it('creates one stable, required Primary field and protects it from deletion', () => {
		const collection = createCollection('Media', 'media');
		const primary = collection.fields.filter((entry) => entry.primary);
		expect(primary).toHaveLength(1);
		expect(primary[0].name).toBe('Title');
		expect(deleteField(collection, primary[0].id).fields).toHaveLength(collection.fields.length);
		expect(renameField(collection, primary[0].id, 'Film').fields[0].id).toBe(primary[0].id);
		expect(renameField(collection, primary[0].id, 'Film').fields[0].name).toBe('Film');
	});

	it('keeps table state separate from record values and rejects data corruption', () => {
		const collection = createCollection();
		const withRecord = addRecord(collection);
		const record = withRecord.records[0];
		const primary = collection.fields[0];
		const edited = setCellValue(withRecord, record.id, primary.id, 'A title');
		const resized = resizeColumn(edited, primary.id, 320);
		expect(resized.records[0].values[primary.id]).toBe('A title');
		expect(resized.views.table.columnWidths[primary.id]).toBe(320);
		const corrupted = structuredClone(resized) as any;
		corrupted.fields.push({ ...primary, id: 'second-primary' });
		expect(isCollection(corrupted)).toBe(false);
	});

	it('keeps referenced membership and local values independent of its source', () => {
		const collection = createCollection('Research');
		const sourceRef = { app: 'thinking-about', kind: 'entry', id: 'entry-1' };
		let next = addRecord(collection, sourceRef);
		const record = next.records[0];
		next = addField(next, 'Priority', 'text');
		const localField = next.fields.at(-1)!;
		next = setCellValue(next, record.id, localField.id, 'High');
		expect(next.records[0].sourceRef).toEqual(sourceRef);
		expect(next.records[0].values[localField.id]).toBe('High');
		const removed = removeRecord(next, record.id);
		expect(removed.records).toHaveLength(0);
		expect(sourceRef.id).toBe('entry-1');
	});

	it('duplicates membership identity while preserving a referenced source and local values', () => {
		let collection = addRecord(createCollection(), { app: 'write', kind: 'draft', id: 'draft-1' });
		const record = collection.records[0];
		collection = setCellValue(collection, record.id, collection.fields[0].id, 'Note');
		collection = duplicateRecord(collection, record.id);
		expect(collection.records).toHaveLength(2);
		expect(collection.records[1].id).not.toBe(record.id);
		expect(collection.records[1].sourceRef).toEqual(record.sourceRef);
		expect(collection.records[1].values[collection.fields[0].id]).toBe('Note');
	});

	it('stores WoodlesRef relations as local fields and retains cold references', () => {
		let collection = addRecord(createCollection('Projects'));
		const record = collection.records[0];
		collection = addField(collection, 'Source', 'relation');
		const relation = collection.fields.at(-1)!;
		const ref = { app: 'thinking-about', kind: 'entry', id: 'gone-cold' };
		collection = setCellValue(collection, record.id, relation.id, ref);
		expect(collection.records[0].values[relation.id]).toEqual(ref);
		const parsed = JSON.parse(JSON.stringify({ collections: [collection] }));
		expect(isCollectionLibrary(parsed)).toBe(true);
		expect(parsed.collections[0].records[0].values[relation.id]).toEqual(ref);
		expect(setCellValue(collection, record.id, relation.id, 'not-a-reference')).toBe(collection);
	});
});

describe('Collection persistence', () => {
	let storage: MemoryStorage;
	let persistence: ReturnType<typeof createVersionedStorage<CollectionLibrary>>;
	beforeEach(() => {
		storage = new MemoryStorage();
		persistence = createVersionedStorage({ key: 'test.collections', version: 1, storage, fallback: () => ({ collections: [] }), validate: isCollectionLibrary, migrate: (value) => Array.isArray(value) ? { collections: value } : value });
	});

	it('round trips native and referenced records through JSON export/import', () => {
		const collection = addRecord(addRecord(createCollection(), { app: 'thinking-about', kind: 'entry', id: 'e1' }));
		const library = { collections: [collection] };
		const text = persistence.exportText(library);
		const imported = persistence.importText(text);
		expect(imported.ok).toBe(true);
		expect(imported.value).toEqual(library);
	});

	it('migrates a v0 collection list and rejects malformed imported collections', () => {
		const collection = createCollection();
		storage.setItem('test.collections', JSON.stringify({ woodles: 'woodles-persistence', schemaVersion: 0, savedAt: new Date().toISOString(), data: [collection] }));
		const migrated = persistence.load();
		expect(migrated.value.collections).toEqual([collection]);
		expect(migrated.migrated).toBe(true);
		expect(persistence.load().migrated).toBe(false);
		expect(persistence.importText(JSON.stringify({ collections: [{ id: 'bad', fields: [], records: [] }] })).ok).toBe(false);
	});

	it('recovers a corrupt saved library from the last-known-good backup', () => {
		const first = { collections: [createCollection('First')] };
		const second = { collections: [createCollection('Second')] };
		expect(persistence.save(first).ok).toBe(true);
		expect(persistence.save(second).ok).toBe(true);
		storage.setItem('test.collections', '{broken');
		const recovered = persistence.load();
		expect(recovered.source).toBe('backup');
		expect(recovered.value).toEqual(first);
	});
});

describe('Collection store', () => {
	const KEY = 'woodles.data.collections.v1';
	let storage: MemoryStorage;
	let store: ReturnType<typeof createCollectionStore>;
	beforeEach(() => {
		storage = new MemoryStorage();
		store = createCollectionStore(storage);
	});

	function storedTitles(): unknown[] {
		return JSON.parse(storage.getItem(KEY)!).data.collections.map((entry: { title?: unknown }) => entry.title);
	}

	it('sets aside one unreadable Collection and never writes over it', () => {
		const good = createCollection('Reading list');
		const bad = { ...createCollection('Garden beds'), records: [{ id: 'r', values: { nope: 1 }, createdAt: 'x', updatedAt: 'x' }] };
		storage.setItem(KEY, JSON.stringify({ woodles: 'woodles-persistence', schemaVersion: 1, savedAt: new Date().toISOString(), data: { collections: [good, bad] } }));

		const loaded = store.load();
		expect(loaded.collections.map((collection) => collection.title)).toEqual(['Reading list']);
		expect(loaded.quarantined).toBe(1);
		expect(loaded.issue?.message).toMatch(/set aside/);

		expect(store.save(createCollection('New')).ok).toBe(true);
		expect(storedTitles()).toEqual(['Reading list', 'Garden beds', 'New']);
		expect(JSON.parse(storage.getItem(KEY)!).data.collections[1]).toEqual(bad);
	});

	it('writes only its own Collection, so two open copies do not undo each other', () => {
		const first = createCollection('First');
		store.save(first);
		const otherTab = createCollectionStore(storage);
		otherTab.save(createCollection('Made elsewhere'));
		expect(store.save({ ...first, title: 'First, renamed' }).ok).toBe(true);
		expect(storedTitles()).toEqual(['First, renamed', 'Made elsewhere']);

		expect(store.remove(first.id).ok).toBe(true);
		expect(storedTitles()).toEqual(['Made elsewhere']);
	});

	it('refuses to write over a library it cannot read', () => {
		const text = JSON.stringify({ woodles: 'woodles-persistence', schemaVersion: 99, savedAt: new Date().toISOString(), data: { collections: [createCollection('From the future')] } });
		storage.setItem(KEY, text);
		const loaded = store.load();
		expect(loaded.writable).toBe(false);
		expect(loaded.collections).toEqual([]);
		const saved = store.save(createCollection('Would overwrite'));
		expect(saved.ok).toBe(false);
		expect(saved.issue?.message).toMatch(/Nothing was saved/);
		expect(store.remove('anything').ok).toBe(false);
		expect(storage.getItem(KEY)).toBe(text);
	});

	it('refuses to save a Collection that does not validate', () => {
		const collection = createCollection();
		expect(store.save({ ...collection, fields: [] }).ok).toBe(false);
		expect(storage.getItem(KEY)).toBeNull();
	});

	it('imports the readable Collections in a file and skips the rest', () => {
		const good = createCollection('Keep me');
		const text = JSON.stringify({ woodles: 'woodles-persistence', schemaVersion: 1, savedAt: new Date().toISOString(), data: { collections: [{ id: 'bad' }, good] } });
		expect(importCollections(text).collections.map((collection) => collection.title)).toEqual(['Keep me']);
		expect(importCollections(JSON.stringify({ collections: [{ id: 'bad' }] })).collections).toEqual([]);
	});
});
