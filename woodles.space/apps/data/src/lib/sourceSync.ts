import { world1Life } from '@woodles/witch-engine';
import type { WoodlesRef } from '@shared/homesuiteBridge';
import { createRecord, type Collection, type CollectionSource } from './collections';

export type PulledSourceRow = {
	ref: WoodlesRef;
	label: string;
	hint: string;
	values: Record<string, string>;
};

type MarginaliaSave = {
	writtenConditions?: string[];
	observation?: Record<string, number>;
	fieldNotes?: { id: string; t: number; text: string }[];
};
type BestiaryRecord = {
	id: string;
	name?: string;
	kind?: string;
	domain?: string;
	rarity?: string;
	power?: number;
	toughness?: number;
	abilities?: string;
	flavor?: string;
	foundIn?: string;
	updated?: string;
};

const BESTIARY_DB = 'bestiary';
const BESTIARY_STORE = 'kv';
const BESTIARY_KEY = 'bestiary.creatures.v1';
const MARGINALIA_KEY = 'witch.book.save.v1';
const STAGES: readonly ('noticed' | 'observed' | 'studied' | 'known')[] = ['noticed', 'observed', 'studied', 'known'];

function values(source: string, kind: string, category: string, domain: string, stage: string, details: string, updated: string): Record<string, string> {
	return { name: '', source, kind, category, domain, stage, details, updated };
}

export async function readBestiaryRows(): Promise<PulledSourceRow[]> {
	if (typeof indexedDB === 'undefined') return [];
	try {
		// Listing is necessary here: opening a missing database can create it,
		// which would turn this read-only integration into a source-side write.
		if (typeof indexedDB.databases !== 'function') return [];
		const databases = await indexedDB.databases();
		if (!databases.some((database) => database.name === BESTIARY_DB)) return [];
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(BESTIARY_DB, 1);
			request.onupgradeneeded = () => {
				// Do not create or alter the Bestiary database if this device has no
				// local shelf to read.
				request.transaction?.abort();
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		let records: BestiaryRecord[];
		try {
			records = await new Promise<BestiaryRecord[]>((resolve, reject) => {
				if (!db.objectStoreNames.contains(BESTIARY_STORE)) { resolve([]); return; }
				const request = db.transaction(BESTIARY_STORE, 'readonly').objectStore(BESTIARY_STORE).get(BESTIARY_KEY);
				request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result as BestiaryRecord[] : []);
				request.onerror = () => reject(request.error);
			});
		} finally {
			db.close();
		}
		return records.filter((record) => record && typeof record.id === 'string').map((creature) => {
			const detail = [creature.kind, creature.rarity, `${creature.power ?? '—'}/${creature.toughness ?? '—'}`, creature.abilities, creature.flavor, creature.foundIn].filter(Boolean).join(' · ');
			return {
				ref: { app: 'bestiary', kind: 'card', id: creature.id },
				label: typeof creature.name === 'string' && creature.name.trim() ? creature.name : 'Untitled creature',
				hint: `Bestiary · ${creature.kind || creature.domain || 'creature'}`,
				values: { ...values('Bestiary', 'Creature', creature.kind ?? '', creature.domain ?? '', '', detail, creature.updated ?? ''), name: creature.name || 'Untitled creature' }
			};
		});
	} catch {
		return [];
	}
}

export function marginaliaRows(save: MarginaliaSave | null | undefined): PulledSourceRow[] {
	if (!save) return [];
	const written = new Set(Array.isArray(save.writtenConditions) ? save.writtenConditions : []);
	const observations = save.observation ?? {};
	const lifeRows = world1Life.filter((life) => life.requires.every((condition) => written.has(condition))).map((life) => {
		const storedStage = Number(observations[life.id] ?? 0);
		const stage = Number.isFinite(storedStage) ? Math.max(0, Math.min(STAGES.length - 1, storedStage)) : 0;
		const stageName = STAGES[stage];
		const narrative = life[stageName === 'known' ? 'know' : stageName === 'studied' ? 'study' : stageName === 'observed' ? 'observe' : 'notice'];
		const details = [life.scientificName, narrative].filter(Boolean).join(' · ');
		return {
			ref: { app: 'marginalia', kind: 'life', id: life.id },
			label: life.name,
			hint: `Marginalia · ${stageName}`,
			values: { ...values('Marginalia', 'Life', life.category, life.domain, stageName, details, ''), name: life.name }
		};
	});
	const noteRows = (Array.isArray(save.fieldNotes) ? save.fieldNotes : []).filter((note) => note && typeof note.id === 'string' && typeof note.text === 'string').map((note) => ({
		ref: { app: 'marginalia', kind: 'field-note', id: note.id },
		label: note.text.length > 72 ? `${note.text.slice(0, 69)}…` : note.text,
		hint: 'Marginalia · field note',
		values: { ...values('Marginalia', 'Field note', 'Field note', '', '', note.text, Number.isFinite(note.t) ? new Date(note.t).toISOString() : ''), name: note.text }
	}));
	return [...lifeRows, ...noteRows];
}

export function readMarginaliaRows(): PulledSourceRow[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(MARGINALIA_KEY);
		if (!raw) return [];
		const save = JSON.parse(raw) as MarginaliaSave;
		return marginaliaRows(save);
	} catch {
		return [];
	}
}

export async function pullCollectionSources(sources: CollectionSource[]): Promise<PulledSourceRow[]> {
	const rows: PulledSourceRow[] = [];
	if (sources.includes('bestiary-creatures')) rows.push(...await readBestiaryRows());
	if (sources.includes('marginalia-life') || sources.includes('marginalia-field-notes')) {
		const marginalia = readMarginaliaRows();
		rows.push(...marginalia.filter((row) => row.ref.kind === 'life' ? sources.includes('marginalia-life') : sources.includes('marginalia-field-notes')));
	}
	return rows;
}

function refKey(ref: WoodlesRef): string { return `${ref.app}\u0000${ref.kind}\u0000${ref.id}`; }

/** Update only source-owned columns; collection-owned fields remain untouched. */
export function mergePulledRows(collection: Collection, rows: PulledSourceRow[], syncedAt = new Date().toISOString()): Collection {
	const sourceFields = collection.fields.filter((field) => field.sourceKey);
	const bySource = new Map(collection.records.filter((record) => record.sourceRef).map((record) => [refKey(record.sourceRef!), record]));
	let records = [...collection.records];
	for (const row of rows) {
		const key = refKey(row.ref);
		const existing = bySource.get(key);
		if (existing) {
			const values = { ...existing.values };
			for (const field of sourceFields) values[field.id] = row.values[field.sourceKey!] ?? '';
			records = records.map((record) => record.id === existing.id ? { ...record, values, updatedAt: syncedAt } : record);
		} else {
			const record = createRecord(collection, row.ref);
			for (const field of sourceFields) record.values[field.id] = row.values[field.sourceKey!] ?? '';
			records.push(record);
		}
	}
	return { ...collection, records, sourceSyncedAt: syncedAt, updatedAt: syncedAt };
}
