import { createVersionedStorage, type PersistenceIssue } from '@woodles/persistence';
import type { WoodlesRef } from '@shared/homesuiteBridge';

export type FieldType = 'text' | 'number' | 'checkbox' | 'date' | 'select' | 'multi-select' | 'url' | 'relation';
export type SelectOption = { id: string; label: string; tint: string };
export type FieldConfig = { options?: SelectOption[]; format?: 'plain' | 'percent' | 'currency' };
export type FieldValue = string | number | boolean | string[] | WoodlesRef | null;
export type CollectionSource = 'bestiary-creatures' | 'marginalia-life' | 'marginalia-field-notes';
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
const TINTS = ['#e8dff0', '#f5e5d9', '#e0ece5', '#e5eafa', '#f4ebc9'];

export function isWoodlesRef(value: unknown): value is WoodlesRef {
	if (!isRecord(value)) return false;
	return typeof value.app === 'string' && !!value.app && typeof value.kind === 'string' && !!value.kind && typeof value.id === 'string' && !!value.id;
}

export function isCollection(value: unknown): value is Collection {
	if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string' || !Array.isArray(value.fields) || !Array.isArray(value.records)) return false;
	if (!isStamp(value.createdAt) || !isStamp(value.updatedAt)) return false;
	if (value.sources !== undefined && (!Array.isArray(value.sources) || !value.sources.every((source) => ['bestiary-creatures', 'marginalia-life', 'marginalia-field-notes'].includes(source)))) return false;
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
function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function field(id: string, name: string, type: FieldType, primary = false, options?: string[]): CollectionField {
	const createdAt = now();
	return { id, name, type, primary, createdAt, ...(options ? { config: { options: options.map((label, index) => ({ id: makeId('opt'), label, tint: TINTS[index % TINTS.length] })) } } : {}) };
}

export type CollectionTemplate = 'blank' | 'tracker' | 'media' | 'projects' | 'research' | 'living-world';
const TEMPLATE_FIELDS: Record<CollectionTemplate, Array<[string, FieldType, string[]?, string?]>> = {
	blank: [['Name', 'text']],
	tracker: [['Name', 'text'], ['Status', 'select', ['Not started', 'In progress', 'Done']], ['Notes', 'text']],
	media: [['Title', 'text'], ['Medium', 'select', ['Book', 'Game', 'Film', 'Music']], ['Status', 'select', ['Want to try', 'In progress', 'Finished']], ['Rating', 'number'], ['Started', 'date'], ['Finished', 'date'], ['Favorite', 'checkbox'], ['Related', 'relation'], ['Notes', 'text']],
	projects: [['Project', 'text'], ['Status', 'select', ['Not started', 'In progress', 'Done']], ['Priority', 'select', ['Low', 'Medium', 'High']], ['Due', 'date'], ['Related', 'relation']],
	research: [['Source', 'text'], ['URL', 'url'], ['Status', 'select', ['To read', 'Reading', 'Read']], ['Notes', 'text'], ['Related', 'relation']],
	'living-world': [['Name', 'text', undefined, 'name'], ['Source', 'text', undefined, 'source'], ['Kind', 'text', undefined, 'kind'], ['Category', 'text', undefined, 'category'], ['Domain', 'text', undefined, 'domain'], ['Stage', 'text', undefined, 'stage'], ['Details', 'text', undefined, 'details'], ['Updated', 'text', undefined, 'updated'], ['My notes', 'text']]
};

const TEMPLATE_SOURCES: Partial<Record<CollectionTemplate, CollectionSource[]>> = {
	'living-world': ['bestiary-creatures', 'marginalia-life', 'marginalia-field-notes']
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
	if (type === 'text' && collection.fields.some((entry) => entry.primary)) type = 'text';
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

export const collectionStorage = createVersionedStorage<CollectionLibrary>({
	key: STORAGE_KEY, version: SCHEMA_VERSION, fallback: () => ({ collections: [] }), validate: isCollectionLibrary, migrate: migrateLibrary
});

const transientImportStorage = {
	values: new Map<string, string>(),
	getItem(key: string) { return this.values.get(key) ?? null; },
	setItem(key: string, value: string) { this.values.set(key, value); },
	removeItem(key: string) { this.values.delete(key); }
};
const collectionImportStorage = createVersionedStorage<CollectionLibrary>({
	key: 'woodles.data.import.transient', version: SCHEMA_VERSION, fallback: () => ({ collections: [] }), validate: isCollectionLibrary, migrate: migrateLibrary, storage: transientImportStorage
});

export function loadCollections() { return collectionStorage.load(); }
export function saveCollections(library: CollectionLibrary) { return collectionStorage.save(library); }
export function exportCollections(library: CollectionLibrary): string { return collectionStorage.exportText(library); }
export function importCollections(text: string) { return collectionImportStorage.importText(text); }
export type { PersistenceIssue };
