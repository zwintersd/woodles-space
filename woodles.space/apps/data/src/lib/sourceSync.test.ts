import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPerson, getPerson, MYCELIUM_STORAGE_KEY, updatePerson } from '@woodles/mycelium';
import { addRecord, createCollection, isCollection, removeRecord, setCellValue } from './collections';
import { marginaliaRows, mergePulledRows, pullCollectionSources, readMyceliumRows, type PulledSourceRow } from './sourceSync';

beforeEach(() => {
	const items = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => { items.set(key, value); },
		removeItem: (key: string) => { items.delete(key); }
	});
});
afterEach(() => vi.unstubAllGlobals());

describe('connected Collection sources', () => {
	it('reveals only Marginalia life whose conditions are written and includes its field notes', () => {
		const rows = marginaliaRows({
			writtenConditions: ['holding'],
			observation: { salt_deposit: 2 },
			fieldNotes: [{ id: 'note-a', t: 1_750_000_000_000, text: 'The tide leaves a white line.' }]
		});
		expect(rows.map((row) => row.ref)).toEqual([
			{ app: 'marginalia', kind: 'life', id: 'salt_deposit' },
			{ app: 'marginalia', kind: 'field-note', id: 'note-a' }
		]);
		expect(rows[0].values.stage).toBe('studied');
		expect(rows[0].values.details).toContain('Halite cristata');
		expect(rows[1].values.details).toBe('The tide leaves a white line.');
	});

	it('refreshes source columns in place while leaving local columns and unmatched rows alone', () => {
		let collection = createCollection('Living things', 'living-world');
		collection = addRecord(collection);
		const notesField = collection.fields.find((field) => field.name === 'My notes')!;
		const localRecord = collection.records[0];
		collection = setCellValue(collection, localRecord.id, notesField.id, 'Keep this annotation.');
		const firstPull: PulledSourceRow[] = [{
			ref: { app: 'bestiary', kind: 'card', id: 'creature-1' }, label: 'Glass moth', hint: 'Bestiary · moth',
			values: { name: 'Glass moth', source: 'Bestiary', kind: 'Creature', category: 'Moth', domain: 'mist', stage: '', details: 'rare · 2/3', updated: '2026-09-26' }
		}];
		const synced = mergePulledRows(collection, firstPull, '2026-09-26T12:00:00.000Z');
		const imported = synced.records.find((record) => record.sourceRef?.id === 'creature-1')!;
		expect(synced.records).toHaveLength(2);
		expect(synced.records[0].values[notesField.id]).toBe('Keep this annotation.');
		expect(imported.values[collection.fields.find((field) => field.primary)!.id]).toBe('Glass moth');

		const changed = mergePulledRows(synced, [{ ...firstPull[0], label: 'Night glass moth', values: { ...firstPull[0].values, name: 'Night glass moth', details: 'rare · 2/4' } }], '2026-09-26T12:05:00.000Z');
		expect(changed.records).toHaveLength(2);
		expect(changed.records.find((record) => record.sourceRef?.id === 'creature-1')!.values[collection.fields.find((field) => field.primary)!.id]).toBe('Night glass moth');
		expect(changed.records.find((record) => record.id === localRecord.id)!.values[notesField.id]).toBe('Keep this annotation.');
		expect(changed.sourceSyncedAt).toBe('2026-09-26T12:05:00.000Z');
		expect(isCollection(changed)).toBe(true);
	});

	it('returns the same Collection when a pull changes nothing', () => {
		const collection = createCollection('Living things', 'living-world');
		expect(mergePulledRows(collection, [], '2026-09-26T12:00:00.000Z')).toBe(collection);

		const pull: PulledSourceRow[] = [{
			ref: { app: 'marginalia', kind: 'life', id: 'salt_deposit' }, label: 'Salt deposit', hint: 'Marginalia · noticed',
			values: { name: 'Salt deposit', source: 'Marginalia', kind: 'Life', category: 'mineral', domain: 'shore', stage: 'noticed', details: '', updated: '' }
		}];
		const synced = mergePulledRows(collection, pull, '2026-09-26T12:00:00.000Z');
		const again = mergePulledRows(synced, pull, '2026-09-26T12:01:00.000Z');
		expect(again).toBe(synced);
		expect(again.updatedAt).toBe('2026-09-26T12:00:00.000Z');
	});

	it('stamps only the rows whose source values changed', () => {
		const row = (id: string, stage: string): PulledSourceRow => ({
			ref: { app: 'marginalia', kind: 'life', id }, label: id, hint: 'Marginalia',
			values: { name: id, source: 'Marginalia', kind: 'Life', category: '', domain: '', stage, details: '', updated: '' }
		});
		const synced = mergePulledRows(createCollection('Living things', 'living-world'), [row('kelp', 'noticed'), row('moss', 'noticed')], '2026-09-26T12:00:00.000Z');
		const next = mergePulledRows(synced, [row('kelp', 'noticed'), row('moss', 'observed')], '2026-09-26T12:05:00.000Z');
		const stamp = (collection: typeof next, id: string) => collection.records.find((record) => record.sourceRef?.id === id)!.updatedAt;
		expect(stamp(next, 'kelp')).toBe(stamp(synced, 'kelp'));
		expect(stamp(next, 'moss')).toBe('2026-09-26T12:05:00.000Z');
		expect(next.updatedAt).toBe('2026-09-26T12:05:00.000Z');
	});

	it('validates connected-source configuration as part of the persisted Collection', () => {
		const collection = createCollection('Sources', 'living-world');
		expect(collection.sources).toEqual(['bestiary-creatures', 'marginalia-life', 'marginalia-field-notes']);
		expect(collection.fields.filter((field) => field.sourceKey)).toHaveLength(8);
	});

	it('reads canonical people, refreshes owner fields, and keeps Collection notes local', async () => {
		const person = createPerson({ name: 'Juniper Lane', role: 'Illustrator', emails: [{ id: 'email-1', label: 'Work', value: 'juniper@example.com' }], notes: 'Prefers email.' });
		let collection = mergePulledRows(createCollection('People', 'mycelium-people'), await pullCollectionSources(['mycelium-people']));
		const record = collection.records[0];
		const name = collection.fields.find((field) => field.sourceKey === 'name')!;
		const email = collection.fields.find((field) => field.sourceKey === 'emails')!;
		const notes = collection.fields.find((field) => field.name === 'My notes')!;
		expect(record.sourceRef).toEqual({ app: 'mycelium', kind: 'person', id: person.id });
		expect(record.values[email.id]).toBe('Work: juniper@example.com');
		collection = setCellValue(collection, record.id, notes.id, 'Ask about the mural.');
		expect(setCellValue(collection, record.id, name.id, 'A local rename')).toBe(collection);
		updatePerson(person.id, { name: 'Juniper Rivers', notes: 'Prefers text now.' });
		const refreshed = mergePulledRows(collection, readMyceliumRows());
		expect(refreshed.records[0].values[name.id]).toBe('Juniper Rivers');
		expect(refreshed.records[0].values[notes.id]).toBe('Ask about the mural.');
		expect(getPerson(person.id)?.notes).toBe('Prefers text now.');
		expect(isCollection(refreshed)).toBe(true);
	});

	it('removes only Collection membership and excludes the complete reference from later pulls', () => {
		const person = createPerson({ name: 'Robin' });
		const rows = readMyceliumRows();
		let collection = mergePulledRows(createCollection('People', 'mycelium-people'), rows);
		collection = removeRecord(collection, collection.records[0].id);
		const ownerSave = localStorage.getItem(MYCELIUM_STORAGE_KEY);
		expect(mergePulledRows(collection, rows).records).toHaveLength(0);
		expect(getPerson(person.id)?.name).toBe('Robin');
		expect(localStorage.getItem(MYCELIUM_STORAGE_KEY)).toBe(ownerSave);
		const differentOwner = { ...rows[0], ref: { ...rows[0].ref, app: 'another-app' } };
		const differentKind = { ...rows[0], ref: { ...rows[0].ref, kind: 'another-kind' } };
		expect(mergePulledRows(collection, [differentOwner, differentKind]).records).toHaveLength(2);
	});

	it('refuses a failed source read without writing or replacing Collection rows', () => {
		createPerson({ name: 'Robin' });
		const collection = mergePulledRows(createCollection('People', 'mycelium-people'), readMyceliumRows());
		localStorage.setItem(MYCELIUM_STORAGE_KEY, '{broken');
		expect(() => readMyceliumRows()).toThrow();
		expect(collection.records).toHaveLength(1);
		expect(localStorage.getItem(MYCELIUM_STORAGE_KEY)).toBe('{broken');
	});
});
