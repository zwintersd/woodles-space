import { describe, expect, it } from 'vitest';
import { canonical, fingerprint, fingerprintRecord, mergeKeyed, mergeRecords } from './threeWay';

type Item = { v: string; at: string };
const later = (mine: Item, theirs: Item) => (theirs.at > mine.at ? theirs : mine);
const item = (v: string, at = '2026-10-20T10:00:00Z'): Item => ({ v, at });

describe('canonical and fingerprint', () => {
	it('ignore key order and undefined members, the way JSONB hands a blob back', () => {
		expect(canonical({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe('{"a":{"d":[1,{"x":1,"y":2}]},"b":1}');
		expect(fingerprint({ a: 1, b: { c: [1, 2] } })).toBe(fingerprint({ b: { c: [1, 2] }, a: 1 }));
		expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
		expect(fingerprint([1, 2])).not.toBe(fingerprint([2, 1]));
	});
});

describe('mergeRecords', () => {
	it('is a union without a base, resolving both-present items', () => {
		const merged = mergeRecords({ a: item('mine'), b: item('b') }, { a: item('theirs', '2026-10-20T11:00:00Z'), c: item('c') }, undefined, later);
		expect(merged).toEqual({ a: item('theirs', '2026-10-20T11:00:00Z'), b: item('b'), c: item('c') });
	});

	it('drops what the other side deleted, and keeps what is new on either side', () => {
		const agreed = { a: item('a'), b: item('b') };
		const base = fingerprintRecord(agreed);
		expect(mergeRecords({ a: item('a'), b: item('b') }, { a: item('a'), c: item('c') }, base, later)).toEqual({ a: item('a'), c: item('c') });
		expect(mergeRecords({ a: item('a'), c: item('c') }, { a: item('a'), b: item('b') }, base, later)).toEqual({ a: item('a'), c: item('c') });
	});

	it('lets an edit beat a delete, in either direction', () => {
		const base = fingerprintRecord({ a: item('a') });
		expect(mergeRecords({ a: item('edited') }, {}, base, later)).toEqual({ a: item('edited') });
		expect(mergeRecords({}, { a: item('edited') }, base, later)).toEqual({ a: item('edited') });
	});

	it('takes the side that moved, whatever the clocks say, and resolves only when both did', () => {
		const base = fingerprintRecord({ a: item('a', '2026-10-20T12:00:00Z') });
		// The other device's clock runs behind, but only it changed the item.
		expect(mergeRecords({ a: item('a', '2026-10-20T12:00:00Z') }, { a: item('theirs', '2026-10-20T09:00:00Z') }, base, later).a.v).toBe('theirs');
		expect(mergeRecords({ a: item('mine', '2026-10-20T09:00:00Z') }, { a: item('a', '2026-10-20T12:00:00Z') }, base, later).a.v).toBe('mine');
		expect(mergeRecords({ a: item('mine', '2026-10-20T13:00:00Z') }, { a: item('theirs', '2026-10-20T14:00:00Z') }, base, later).a.v).toBe('theirs');
	});

	it('reads ids that look like Object members as plain keys', () => {
		const merged = mergeRecords({ constructor: item('mine') }, { toString: item('theirs') }, {}, later);
		expect(Object.keys(merged).sort()).toEqual(['constructor', 'toString']);
	});
});

describe('mergeKeyed', () => {
	it('keeps local order, then what only the remote has', () => {
		const local = new Map([['b', item('b')], ['a', item('a')]]);
		const remote = new Map([['c', item('c')], ['a', item('a')], ['10', item('10')]]);
		expect([...mergeKeyed(local, remote, undefined, later).keys()]).toEqual(['b', 'a', 'c', '10']);
	});
});
