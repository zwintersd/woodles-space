import { describe, expect, it } from 'vitest';
import { addField, addRecord, createCollection, isCollection, setCellValue, type Collection } from './collections';
import { findMatches, isSearchableField, replaceMatches, type FindOptions } from './findReplace';

const loose: FindOptions = { matchCase: false, wholeCell: false };

function scopeOf(collection: Collection) {
	return { recordIds: collection.records.map((record) => record.id), fieldIds: collection.views.table.columnOrder };
}

/** Name / Notes, with a row each for "Red apple", "green APPLE pie", and "Banana". */
function fruit(): Collection {
	let collection = addField(createCollection('Fruit', 'blank'), 'Notes', 'text');
	const [name, notes] = collection.fields;
	for (const [title, note] of [['Red apple', 'apple apple'], ['green APPLE pie', ''], ['Banana', 'no match']]) {
		collection = addRecord(collection);
		const id = collection.records.at(-1)!.id;
		collection = setCellValue(setCellValue(collection, id, name.id, title), id, notes.id, note);
	}
	return collection;
}

describe('finding', () => {
	it('lists matching cells in table order and counts repeats within a cell', () => {
		const collection = fruit();
		const matches = findMatches(collection, 'apple', loose, scopeOf(collection));
		expect(matches.map(({ row, col, occurrences }) => [row, col, occurrences])).toEqual([[0, 0, 1], [0, 1, 2], [1, 0, 1]]);
	});

	it('ignores case unless asked', () => {
		const collection = fruit();
		expect(findMatches(collection, 'apple', { ...loose, matchCase: true }, scopeOf(collection))).toHaveLength(2);
	});

	it('can require the whole cell to match', () => {
		const collection = fruit();
		const scope = scopeOf(collection);
		expect(findMatches(collection, 'banana', { matchCase: false, wholeCell: true }, scope)).toHaveLength(1);
		expect(findMatches(collection, 'apple', { matchCase: false, wholeCell: true }, scope)).toHaveLength(0);
	});

	it('matches the query literally, so punctuation is not a pattern', () => {
		let collection = createCollection('Dots', 'blank');
		collection = addRecord(collection);
		collection = setCellValue(collection, collection.records[0].id, collection.fields[0].id, 'a.b axb (c)');
		const scope = scopeOf(collection);
		expect(findMatches(collection, 'a.b', loose, scope)).toHaveLength(1);
		expect(findMatches(collection, '.', loose, scope)[0].occurrences).toBe(1);
		expect(findMatches(collection, '(c)', loose, scope)).toHaveLength(1);
	});

	it('matches nothing for an empty query', () => {
		const collection = fruit();
		expect(findMatches(collection, '', loose, scopeOf(collection))).toEqual([]);
	});

	it('stays inside the scope, so hidden records and fields are never searched', () => {
		const collection = fruit();
		const [name] = collection.fields;
		const scope = { recordIds: [collection.records[0].id], fieldIds: [name.id] };
		expect(findMatches(collection, 'apple', loose, scope)).toHaveLength(1);
	});

	it('skips synced columns, non-text fields, and the Primary cell of a referenced record', () => {
		let collection = createCollection('Mixed', 'blank');
		collection = addField(addField(collection, 'Count', 'number'), 'Done', 'checkbox');
		const synced = { ...collection.fields[0], sourceKey: 'name' };
		const syncedCollection = { ...collection, fields: [synced, ...collection.fields.slice(1)] };
		expect(isSearchableField(synced)).toBe(false);
		expect(isSearchableField(collection.fields[1])).toBe(false);
		expect(isSearchableField(collection.fields[0])).toBe(true);

		const withRef = addRecord(collection, { app: 'bestiary', kind: 'creature', id: 'apple-sprite' });
		const record = { ...withRef.records[0], values: { ...withRef.records[0].values, [collection.fields[0].id]: 'apple' } };
		const refCollection = { ...withRef, records: [record] };
		expect(findMatches(refCollection, 'apple', loose, scopeOf(refCollection))).toEqual([]);
		expect(findMatches({ ...syncedCollection, records: [record] }, 'apple', loose, scopeOf(syncedCollection))).toEqual([]);
	});
});

describe('replacing', () => {
	it('replaces every occurrence in every matching cell and reports what it did', () => {
		const collection = fruit();
		const result = replaceMatches(collection, 'apple', 'pear', loose, scopeOf(collection));
		expect(result).toMatchObject({ cells: 3, occurrences: 4 });
		const [name, notes] = collection.fields;
		expect(result.collection.records.map((record) => [record.values[name.id], record.values[notes.id]])).toEqual([
			['Red pear', 'pear pear'], ['green pear pie', ''], ['Banana', 'no match']
		]);
		expect(isCollection(result.collection)).toBe(true);
	});

	it('leaves the original Collection and untouched records as they were', () => {
		const collection = fruit();
		const result = replaceMatches(collection, 'apple', 'pear', loose, scopeOf(collection));
		expect(collection.records[0].values[collection.fields[0].id]).toBe('Red apple');
		expect(result.collection.records[2]).toBe(collection.records[2]);
	});

	it('inserts the replacement as typed, including characters that are special to patterns', () => {
		const collection = fruit();
		const result = replaceMatches(collection, 'Banana', '$& $1 $$', loose, scopeOf(collection));
		expect(result.collection.records[2].values[collection.fields[0].id]).toBe('$& $1 $$');
	});

	it('replaces a whole cell when asked, and deletes with an empty replacement', () => {
		const collection = fruit();
		const whole = replaceMatches(collection, 'banana', 'Plantain', { matchCase: false, wholeCell: true }, scopeOf(collection));
		expect(whole.collection.records[2].values[collection.fields[0].id]).toBe('Plantain');
		const gone = replaceMatches(collection, ' apple', '', { matchCase: true, wholeCell: false }, scopeOf(collection));
		expect(gone.collection.records[0].values[collection.fields[0].id]).toBe('Red');
	});

	it('can replace just one cell', () => {
		const collection = fruit();
		const [name] = collection.fields;
		const result = replaceMatches(collection, 'apple', 'pear', loose, scopeOf(collection), { recordId: collection.records[1].id, fieldId: name.id });
		expect(result).toMatchObject({ cells: 1, occurrences: 1 });
		expect(result.collection.records.map((record) => record.values[name.id])).toEqual(['Red apple', 'green pear pie', 'Banana']);
	});

	it('returns the same Collection when nothing changes', () => {
		const collection = fruit();
		expect(replaceMatches(collection, 'zzz', 'x', loose, scopeOf(collection)).collection).toBe(collection);
		expect(replaceMatches(collection, 'Banana', 'Banana', loose, scopeOf(collection)).collection).toBe(collection);
	});

	it('does not loop when the replacement contains the query', () => {
		const collection = fruit();
		const result = replaceMatches(collection, 'apple', 'apple pie', { matchCase: true, wholeCell: false }, scopeOf(collection));
		expect(result.collection.records[0].values[collection.fields[0].id]).toBe('Red apple pie');
	});
});
