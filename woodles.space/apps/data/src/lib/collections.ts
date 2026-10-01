import { createVersionedStorage, type PersistenceIssue, type SaveResult, type StorageLike } from '@woodles/persistence';
import type { WoodlesRef } from '@shared/homesuiteBridge';

export type FieldType = 'text' | 'number' | 'checkbox' | 'date' | 'select' | 'multi-select' | 'url' | 'relation';
export type SelectOption = { id: string; label: string; tint: string };
export type FieldConfig = { options?: SelectOption[]; format?: 'plain' | 'percent' | 'currency' };
export type FieldValue = string | number | boolean | string[] | WoodlesRef | null;
export type CollectionSource =
	| 'bestiary-creatures'
	| 'marginalia-life'
	| 'marginalia-field-notes'
	| 'marginalia-arcade-games'
	| 'marginalia-arcade-primitives'
	| 'marginalia-arcade-copy';
export type CollectionField = {
	id: string;
	name: string;
	type: FieldType;
	primary: boolean;
	config?: FieldConfig;
	/** Source-owned columns are refreshed from their app; ordinary fields stay local. */
	sourceKey?: string;
	createdAt: string;
};
export type CollectionRecord = {
	id: string;
	sourceRef?: WoodlesRef;
	values: Record<string, FieldValue>;
	createdAt: string;
	updatedAt: string;
};
export type TableViewState = { columnOrder: string[]; columnWidths: Record<string, number> };
export type Collection = {
	id: string;
	title: string;
	fields: CollectionField[];
	records: CollectionRecord[];
	views: { table: TableViewState };
	createdAt: string;
	updatedAt: string;
	sources?: CollectionSource[];
	/** When a source pull last changed this Collection — not every time one ran. */
	sourceSyncedAt?: string;
	/** Source-backed rows the user removed here; sync must not re-add them. */
	excludedRefs?: WoodlesRef[];
};
export type CollectionLibrary = { collections: Collection[] };

const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'woodles.data.collections.v1';
const FIELD_TYPES: FieldType[] = ['text', 'number', 'checkbox', 'date', 'select', 'multi-select', 'url', 'relation'];
const COLLECTION_SOURCES: readonly CollectionSource[] = [
	'bestiary-creatures', 'marginalia-life', 'marginalia-field-notes',
	'marginalia-arcade-games', 'marginalia-arcade-primitives', 'marginalia-arcade-copy'
];
const TINTS = ['#e8dff0', '#f5e5d9', '#e0ece5', '#e5eafa', '#f4ebc9'];

export function isWoodlesRef(value: unknown): value is WoodlesRef {
	if (!isRecord(value)) return false;
	return typeof value.app === 'string' && !!value.app && typeof value.kind === 'string' && !!value.kind && typeof value.id === 'string' && !!value.id;
}

export function isCollection(value: unknown): value is Collection {
	if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string' || !Array.isArray(value.fields) || !Array.isArray(value.records)) return false;
	if (!isStamp(value.createdAt) || !isStamp(value.updatedAt)) return false;
	if (value.sources !== undefined && (!Array.isArray(value.sources) || !value.sources.every((source) => COLLECTION_SOURCES.includes(source)))) return false;
	if (value.sourceSyncedAt !== undefined && !isStamp(value.sourceSyncedAt)) return false;
	if (value.excludedRefs !== undefined && (!Array.isArray(value.excludedRefs) || !value.excludedRefs.every(isWoodlesRef))) return false;
	const fields = value.fields as unknown[];
	if (fields.filter((field) => isRecord(field) && field.primary === true).length !== 1 || !fields.every(isCollectionField)) return false;
	if (new Set((fields as CollectionField[]).map((field) => field.id)).size !== fields.length) return false;
	const fieldMap = new Map((fields as CollectionField[]).map((field) => [field.id, field]));
	if (!value.records.every((record) => isCollectionRecord(record, fieldMap)) || new Set((value.records as CollectionRecord[]).map((record) => record.id)).size !== value.records.length) return false;
	if (!isRecord(value.views) || !isRecord(value.views.table)) return false;
	const table = value.views.table;
	return Array.isArray(table.columnOrder) && table.columnOrder.every((id) => fieldMap.has(id)) && isRecord(table.columnWidths) && Object.entries(table.columnWidths).every(([id, width]) => fieldMap.has(id) && typeof width === 'number' && width >= 72 && width <= 640);
}

export function isCollectionLibrary(value: unknown): value is CollectionLibrary {
	return isRecord(value) && Array.isArray(value.collections) && value.collections.every(isCollection) && new Set(value.collections.map((item) => item.id)).size === value.collections.length;
}

function isCollectionField(value: unknown): value is CollectionField {
	if (!isRecord(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !FIELD_TYPES.includes(value.type as FieldType) || typeof value.primary !== 'boolean' || !isStamp(value.createdAt)) return false;
	if (value.primary && value.type !== 'text') return false;
	if (value.config !== undefined && !isFieldConfig(value.config)) return false;
	if (value.sourceKey !== undefined && (typeof value.sourceKey !== 'string' || !value.sourceKey)) return false;
	return true;
}

function isFieldConfig(value: unknown): value is FieldConfig {
	if (!isRecord(value)) return false;
	if (value.format !== undefined && !['plain', 'percent', 'currency'].includes(String(value.format))) return false;
	if (value.options !== undefined && (!Array.isArray(value.options) || !value.options.every((option) => isRecord(option) && typeof option.id === 'string' && typeof option.label === 'string' && typeof option.tint === 'string'))) return false;
	return true;
}

	function isCollectionRecord(value: unknown, fields: Map<string, CollectionField>): value is CollectionRecord {
	if (!isRecord(value)) return false;
	if (typeof value.id !== 'string' || !isStamp(value.createdAt) || !isStamp(value.updatedAt) || !isRecord(value.values)) return false;
	if (value.sourceRef !== undefined && !isWoodlesRef(value.sourceRef)) return false;
	return Object.entries(value.values).every(([id, entry]) => {
		const field = fields.get(id);
		return !!field && isFieldValue(field, entry);
	});
}

function isFieldValue(field: CollectionField, value: unknown): boolean {
	if (value === null) return field.type !== 'checkbox' && field.type !== 'multi-select';
	switch (field.type) {
		case 'text': case 'url': case 'date': return typeof value === 'string';
		case 'number': return typeof value === 'number' && Number.isFinite(value);
		case 'checkbox': return typeof value === 'boolean';
		case 'select': return typeof value === 'string';
		case 'multi-select': return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
		case 'relation': return isWoodlesRef(value);
	}
}

function isRecord(value: unknown): value is Record<string, any> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isStamp(value: unknown): value is string { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }
function makeId(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
function now(): string { return new Date().toISOString(); }
export function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function field(id: string, name: string, type: FieldType, primary = false, options?: string[]): CollectionField {
	const createdAt = now();
	return { id, name, type, primary, createdAt, ...(options ? { config: { options: options.map((label, index) => ({ id: makeId('opt'), label, tint: TINTS[index % TINTS.length] })) } } : {}) };
}

export type CollectionTemplate =
	| 'blank' | 'tracker' | 'media' | 'projects' | 'research' | 'living-world'
	| 'arcade-games' | 'arcade-primitives' | 'arcade-copy';

/** How each template is offered, and what a new Collection from it is called. */
export const COLLECTION_TEMPLATES: readonly { id: CollectionTemplate; name: string; detail: string; title: string }[] = [
	{ id: 'blank', name: 'Blank', detail: 'A Primary field, ready for records', title: 'Untitled collection' },
	{ id: 'tracker', name: 'Simple tracker', detail: 'Name, status, and notes', title: 'Untitled collection' },
	{ id: 'media', name: 'Media', detail: 'Title, medium, progress, rating, and more', title: 'Untitled collection' },
	{ id: 'projects', name: 'Projects', detail: 'Status, priority, due date, and links', title: 'Untitled collection' },
	{ id: 'research', name: 'Research / sources', detail: 'Sources, URLs, notes, and links', title: 'Untitled collection' },
	{ id: 'living-world', name: 'Bestiary + Marginalia', detail: 'Pull creatures, discovered life, and field notes into one live table', title: 'Bestiary + Marginalia' },
	{ id: 'arcade-games', name: 'Arcade games', detail: 'Track game concepts, loops, mastery, and implementation links', title: 'Marginalia Arcade games' },
	{ id: 'arcade-primitives', name: 'Arcade primitives', detail: 'Map shared code, game-local patterns, and reuse boundaries', title: 'Marginalia Arcade primitives' },
	{ id: 'arcade-copy', name: 'Arcade copy desk', detail: 'Review current card copy and keep proposed wording beside its source', title: 'Marginalia Arcade copy' }
];
const TEMPLATE_FIELDS: Record<CollectionTemplate, Array<[string, FieldType, string[]?, string?]>> = {
	blank: [['Name', 'text']],
	tracker: [['Name', 'text'], ['Status', 'select', ['Not started', 'In progress', 'Done']], ['Notes', 'text']],
	media: [['Title', 'text'], ['Medium', 'select', ['Book', 'Game', 'Film', 'Music']], ['Status', 'select', ['Want to try', 'In progress', 'Finished']], ['Rating', 'number'], ['Started', 'date'], ['Finished', 'date'], ['Favorite', 'checkbox'], ['Related', 'relation'], ['Notes', 'text']],
	projects: [['Project', 'text'], ['Status', 'select', ['Not started', 'In progress', 'Done']], ['Priority', 'select', ['Low', 'Medium', 'High']], ['Due', 'date'], ['Related', 'relation']],
	research: [['Source', 'text'], ['URL', 'url'], ['Status', 'select', ['To read', 'Reading', 'Read']], ['Notes', 'text'], ['Related', 'relation']],
	'living-world': [['Name', 'text', undefined, 'name'], ['Source', 'text', undefined, 'source'], ['Kind', 'text', undefined, 'kind'], ['Category', 'text', undefined, 'category'], ['Domain', 'text', undefined, 'domain'], ['Stage', 'text', undefined, 'stage'], ['Details', 'text', undefined, 'details'], ['Updated', 'text', undefined, 'updated'], ['My notes', 'text']],
	'arcade-games': [
		['Name', 'text', undefined, 'name'], ['Status', 'text', undefined, 'status'], ['Pitch', 'text', undefined, 'pitch'],
		['Tags', 'text', undefined, 'tags'], ['Core loop', 'text', undefined, 'coreLoop'], ['Mastery', 'text', undefined, 'mastery'],
		['Roadmap note', 'text', undefined, 'roadmapNote'], ['Implementation path', 'text', undefined, 'sourcePath'],
		['Design notes', 'text'], ['Next experiment', 'text'], ['My notes', 'text']
	],
	'arcade-primitives': [
		['Name', 'text', undefined, 'name'], ['Category', 'text', undefined, 'category'], ['Reuse status', 'text', undefined, 'status'],
		['Summary', 'text', undefined, 'summary'], ['API / exports', 'text', undefined, 'api'], ['Used by', 'text', undefined, 'consumers'],
		['Source path', 'text', undefined, 'sourcePath'], ['Reuse boundary', 'text', undefined, 'boundary'],
		['Example game', 'text', undefined, 'exampleGame'], ['Next extraction', 'text'], ['My notes', 'text']
	],
	'arcade-copy': [
		['Name', 'text', undefined, 'name'], ['Game', 'text', undefined, 'game'], ['Placement', 'text', undefined, 'placement'],
		['Status', 'text', undefined, 'status'], ['Current title', 'text', undefined, 'title'], ['Current tagline', 'text', undefined, 'text'],
		['Source path', 'text', undefined, 'sourcePath'], ['Proposed title', 'text'], ['Proposed tagline', 'text'], ['Review notes', 'text']
	]
};

const TEMPLATE_SOURCES: Partial<Record<CollectionTemplate, CollectionSource[]>> = {
	'living-world': ['bestiary-creatures', 'marginalia-life', 'marginalia-field-notes'],
	'arcade-games': ['marginalia-arcade-games'],
	'arcade-primitives': ['marginalia-arcade-primitives'],
	'arcade-copy': ['marginalia-arcade-copy']
};

export function createCollection(title = 'Untitled collection', template: CollectionTemplate = 'blank'): Collection {
	const stamp = now();
	const fields = TEMPLATE_FIELDS[template].map(([name, type, options, sourceKey], index) => ({ ...field(index === 0 ? makeId('field-primary') : makeId('field'), name, type, index === 0, options), ...(sourceKey ? { sourceKey } : {}) }));
	return {
		id: makeId('collection'), title: title.trim() || 'Untitled collection', fields, records: [],
		views: { table: { columnOrder: fields.map((entry) => entry.id), columnWidths: Object.fromEntries(fields.map((entry) => [entry.id, entry.primary ? 240 : 160])) } },
		createdAt: stamp, updatedAt: stamp, ...(TEMPLATE_SOURCES[template] ? { sources: [...TEMPLATE_SOURCES[template]!] } : {})
	};
}

export function createRecord(collection: Collection, sourceRef?: WoodlesRef): CollectionRecord {
	const stamp = now();
	const values = Object.fromEntries(collection.fields.map((entry) => [entry.id, entry.type === 'checkbox' ? false : entry.type === 'multi-select' ? [] : null])) as Record<string, FieldValue>;
	return { id: makeId('record'), ...(sourceRef ? { sourceRef: { ...sourceRef } } : {}), values, createdAt: stamp, updatedAt: stamp };
}

export function addRecord(collection: Collection, sourceRef?: WoodlesRef): Collection {
	const record = createRecord(collection, sourceRef);
	const excludedRefs = sourceRef ? (collection.excludedRefs ?? []).filter((ref) => ref.app !== sourceRef.app || ref.kind !== sourceRef.kind || ref.id !== sourceRef.id) : collection.excludedRefs;
	return { ...collection, records: [...collection.records, record], ...(excludedRefs ? { excludedRefs } : {}), updatedAt: now() };
}

export function addField(collection: Collection, name: string, type: FieldType): Collection {
	const entry = field(makeId('field'), name.trim() || 'New field', type, false, type === 'select' || type === 'multi-select' ? ['Option 1', 'Option 2'] : undefined);
	return {
		...collection, fields: [...collection.fields, entry],
		records: collection.records.map((record) => ({ ...record, values: { ...record.values, [entry.id]: entry.type === 'checkbox' ? false : entry.type === 'multi-select' ? [] : null } })),
		views: { table: { ...collection.views.table, columnOrder: [...collection.views.table.columnOrder, entry.id], columnWidths: { ...collection.views.table.columnWidths, [entry.id]: 160 } } },
		updatedAt: now()
	};
}

export function renameField(collection: Collection, fieldId: string, name: string): Collection {
	return { ...collection, fields: collection.fields.map((entry) => entry.id === fieldId ? { ...entry, name: name.trim() || entry.name } : entry), updatedAt: now() };
}

export function deleteField(collection: Collection, fieldId: string): Collection {
	if (collection.fields.find((entry) => entry.id === fieldId)?.primary) return collection;
	const fields = collection.fields.filter((entry) => entry.id !== fieldId);
	return {
		...collection, fields,
		records: collection.records.map((record) => { const values = { ...record.values }; delete values[fieldId]; return { ...record, values }; }),
		views: { table: { columnOrder: collection.views.table.columnOrder.filter((id) => id !== fieldId), columnWidths: Object.fromEntries(Object.entries(collection.views.table.columnWidths).filter(([id]) => id !== fieldId)) } },
		updatedAt: now()
	};
}

export function setCellValue(collection: Collection, recordId: string, fieldId: string, value: FieldValue): Collection {
	const target = collection.fields.find((entry) => entry.id === fieldId);
	if (!target || !isFieldValue(target, value)) return collection;
	return {
		...collection, records: collection.records.map((record) => record.id === recordId ? { ...record, values: { ...record.values, [fieldId]: value }, updatedAt: now() } : record), updatedAt: now()
	};
}

export function removeRecord(collection: Collection, recordId: string): Collection {
	const removed = collection.records.find((record) => record.id === recordId);
	const excludedRefs = removed?.sourceRef
		? [...(collection.excludedRefs ?? []).filter((ref) => ref.app !== removed.sourceRef?.app || ref.kind !== removed.sourceRef?.kind || ref.id !== removed.sourceRef?.id), { ...removed.sourceRef }]
		: collection.excludedRefs;
	return { ...collection, records: collection.records.filter((record) => record.id !== recordId), ...(excludedRefs ? { excludedRefs } : {}), updatedAt: now() };
}

export function duplicateRecord(collection: Collection, recordId: string): Collection {
	const source = collection.records.find((record) => record.id === recordId);
	if (!source) return collection;
	const stamp = now();
	const copy: CollectionRecord = { ...source, id: makeId('record'), values: cloneJson(source.values), createdAt: stamp, updatedAt: stamp };
	return { ...collection, records: [...collection.records, copy], updatedAt: stamp };
}

export function resizeColumn(collection: Collection, fieldId: string, width: number): Collection {
	if (!collection.fields.some((entry) => entry.id === fieldId)) return collection;
	return { ...collection, views: { table: { ...collection.views.table, columnWidths: { ...collection.views.table.columnWidths, [fieldId]: Math.max(72, Math.min(640, width)) } } }, updatedAt: now() };
}

export function reorderColumns(collection: Collection, order: string[]): Collection {
	if (order.length !== collection.fields.length || new Set(order).size !== order.length || order.some((id) => !collection.fields.some((entry) => entry.id === id))) return collection;
	return { ...collection, views: { table: { ...collection.views.table, columnOrder: [...order] } } };
}

function migrateLibrary(value: unknown, fromVersion: number): unknown {
	if (fromVersion !== 0) throw new Error('Unsupported Collection library version');
	if (Array.isArray(value)) return { collections: value };
	if (isRecord(value) && Array.isArray(value.collections)) return value;
	return { collections: [] };
}

/**
 * What storage holds: every Collection as it was saved, readable or not.
 * Validation happens per Collection (see `readLibrary`), so one bad value sets
 * aside one Collection instead of hiding — and then overwriting — them all.
 */
type StoredLibrary = { collections: unknown[] };

function isStoredLibrary(value: unknown): value is StoredLibrary {
	return isRecord(value) && Array.isArray(value.collections);
}

function storedId(value: unknown): string | null {
	return isRecord(value) && typeof value.id === 'string' ? value.id : null;
}

export type CollectionLoad = {
	/** Readable Collections, first of each id. */
	collections: Collection[];
	/** Saved Collections that failed validation; kept in storage untouched. */
	quarantined: number;
	issue: PersistenceIssue | null;
	/** False when the library itself could not be read; writes are refused. */
	writable: boolean;
};

function readLibrary(persistence: ReturnType<typeof createVersionedStorage<StoredLibrary>>): CollectionLoad & { stored: unknown[] } {
	const loaded = persistence.load();
	// Primary and backup both unreadable — a newer schema, or corruption. What
	// is there may still be someone's work, so nothing may be written over it.
	const writable = !(loaded.source === 'fallback' && loaded.issue);
	const stored = loaded.value.collections;
	const seen = new Set<string>();
	const collections: Collection[] = [];
	for (const entry of stored) {
		if (!isCollection(entry) || seen.has(entry.id)) continue;
		seen.add(entry.id);
		collections.push(entry);
	}
	const quarantined = stored.length - collections.length;
	const setAside: PersistenceIssue | null = quarantined
		? { kind: 'validation', message: `${quarantined === 1 ? 'One Collection' : `${quarantined} Collections`} could not be read on this device and ${quarantined === 1 ? 'was' : 'were'} set aside unchanged.` }
		: null;
	return { stored, collections, quarantined, writable, issue: loaded.issue ?? setAside };
}

function refused(issue: PersistenceIssue | null): SaveResult {
	return {
		ok: false, savedAt: null, bytes: 0,
		issue: { kind: 'write', message: `${issue?.message ?? 'The Collection library could not be read.'} Nothing was saved, so it stays as it was.` }
	};
}

/** Every write reads the library fresh and touches only its own Collection. */
export function createCollectionStore(storage?: StorageLike | null) {
	const persistence = createVersionedStorage<StoredLibrary>({
		key: STORAGE_KEY, version: SCHEMA_VERSION, fallback: () => ({ collections: [] }), validate: isStoredLibrary, migrate: migrateLibrary,
		...(storage !== undefined ? { storage } : {})
	});

	function load(): CollectionLoad {
		const { collections, quarantined, issue, writable } = readLibrary(persistence);
		return { collections, quarantined, issue, writable };
	}

	function save(collection: Collection): SaveResult {
		if (!isCollection(collection)) return { ok: false, savedAt: null, bytes: 0, issue: { kind: 'validation', message: 'Refused to save a Collection that does not match the expected shape.' } };
		const { stored, writable, issue } = readLibrary(persistence);
		if (!writable) return refused(issue);
		const index = stored.findIndex((entry) => storedId(entry) === collection.id);
		const collections = index === -1 ? [...stored, collection] : stored.map((entry, at) => at === index ? collection : entry);
		return persistence.save({ collections });
	}

	function remove(id: string): SaveResult {
		const { stored, writable, issue } = readLibrary(persistence);
		if (!writable) return refused(issue);
		return persistence.save({ collections: stored.filter((entry) => storedId(entry) !== id) });
	}

	return { load, save, remove, exportText: (collections: Collection[]) => persistence.exportText({ collections }) };
}

export const collectionStore = createCollectionStore();

const transientImportStorage = {
	values: new Map<string, string>(),
	getItem(key: string) { return this.values.get(key) ?? null; },
	setItem(key: string, value: string) { this.values.set(key, value); },
	removeItem(key: string) { this.values.delete(key); }
};
const collectionImportStorage = createVersionedStorage<StoredLibrary>({
	key: 'woodles.data.import.transient', version: SCHEMA_VERSION, fallback: () => ({ collections: [] }), validate: isStoredLibrary, migrate: migrateLibrary, storage: transientImportStorage
});

export function loadCollections(): CollectionLoad { return collectionStore.load(); }
export function saveCollection(collection: Collection): SaveResult { return collectionStore.save(collection); }
export function removeCollection(id: string): SaveResult { return collectionStore.remove(id); }
export function exportCollections(collections: Collection[]): string { return collectionStore.exportText(collections); }
/** The readable Collections in an exported file; unreadable ones are skipped. */
export function importCollections(text: string): { collections: Collection[]; issue: PersistenceIssue | null } {
	const result = collectionImportStorage.importText(text);
	if (!result.ok || !result.value) return { collections: [], issue: result.issue };
	const collections = result.value.collections.filter(isCollection);
	return { collections, issue: collections.length ? null : { kind: 'validation', message: 'This file contains no readable Collections.' } };
}
export type { PersistenceIssue };
