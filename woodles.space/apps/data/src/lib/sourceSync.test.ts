import { describe, expect, it } from 'vitest';
import { addRecord, createCollection, isCollection, setCellValue } from './collections';
import { marginaliaRows, mergePulledRows, type PulledSourceRow } from './sourceSync';

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

	it('validates connected-source configuration as part of the persisted Collection', () => {
		const collection = createCollection('Sources', 'living-world');
		expect(collection.sources).toEqual(['bestiary-creatures', 'marginalia-life', 'marginalia-field-notes']);
		expect(collection.fields.filter((field) => field.sourceKey)).toHaveLength(8);
	});
});
