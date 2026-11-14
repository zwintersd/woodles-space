import { describe, expect, it } from 'vitest';
import { addRecord, createCollection, setCellValue, setHidden } from '@woodles/collections';
import { atLimit, cleanItems, collectionItems, DEFAULT_RAPID_OPTIONS, endorsementLabel, pick, rapidOptions, rapidSources, remaining, startRound, toEndorsement, unpick, type RapidItem } from './rapidFire';

const items = (count: number): RapidItem[] => Array.from({ length: count }, (_, index) => ({ id: `i${index}`, label: `Item ${index}` }));
/** No shuffle: Fisher–Yates swaps each index with itself. */
const inOrder = () => 0.999999;

describe('rapid fire', () => {
	it('deals a grid and hides the rest', () => {
		const round = startRound(items(60), 20, inOrder);
		expect(round.slots).toHaveLength(20);
		expect(round.pool).toHaveLength(40);
		expect(round.total).toBe(60);
		expect(new Set([...round.slots, ...round.pool].map((item) => item!.id)).size).toBe(60);
	});

	it('refills the picked slot, and only that slot, from the pool', () => {
		const round = startRound(items(25), 20, inOrder);
		const next = pick(round, 7);
		expect(next.picks.map((item) => item.id)).toEqual(['i7']);
		expect(next.slots[7]?.id).toBe('i20');
		expect(next.slots.filter((_, index) => index !== 7)).toEqual(round.slots.filter((_, index) => index !== 7));
		expect(next.seen).toHaveLength(21);
	});

	it('leaves the slot empty once the pool runs dry, and ends when nothing is left', () => {
		let round = startRound(items(3), 20, inOrder);
		expect(round.slots).toHaveLength(3);
		round = pick(round, 1);
		expect(round.slots[1]).toBeNull();
		expect(pick(round, 1)).toBe(round);
		round = pick(pick(round, 0), 2);
		expect(remaining(round)).toBe(0);
		expect(round.picks).toHaveLength(3);
	});

	it('undoes a pick without counting it as shown twice', () => {
		let round = pick(startRound(items(30), 20, inOrder), 0);
		round = unpick(round, 'i0');
		expect(round.picks).toEqual([]);
		expect(round.pool[0].id).toBe('i0');
		round = pick(round, 3);
		expect(round.slots[3]?.id).toBe('i0');
		expect(round.seen).toHaveLength(21);

		let small = pick(startRound(items(2), 20, inOrder), 0);
		small = unpick(small, 'i0');
		expect(small.slots[0]?.id).toBe('i0');
	});

	it('records what was endorsed out of what was shown', () => {
		const round = pick(pick(startRound(items(60), 20, inOrder), 2), 5);
		const endorsement = toEndorsement(round, { kind: 'collection', id: 'collection-1', title: 'Reinforcers' });
		expect(endorsement).toEqual({
			source: { kind: 'collection', id: 'collection-1', title: 'Reinforcers' },
			picks: [{ id: 'i2', label: 'Item 2' }, { id: 'i5', label: 'Item 5' }],
			shown: 22, pool: 60
		});
		expect(endorsementLabel(endorsement)).toBe('Item 2, Item 5');
		expect(endorsementLabel({ ...endorsement, picks: [] })).toBe('Nothing fit · Reinforcers');
	});

	it('keeps what was shown and passed over, when asked', () => {
		let round = pick(pick(startRound(items(8), 4, inOrder), 0), 1);
		round = unpick(round, 'i1');
		const endorsement = toEndorsement(round, { kind: 'thinking-about', title: 'Thinking About' }, true);
		expect(endorsement.picks.map((item) => item.id)).toEqual(['i0']);
		expect(endorsement.passed?.map((item) => item.id).sort()).toEqual(['i1', 'i2', 'i3', 'i4', 'i5']);
		expect(endorsement.shown).toBe(6);
		expect(toEndorsement(round, { kind: 'thinking-about', title: 'Thinking About' }).passed).toBeUndefined();
	});

	it('deals in list order, and leaves slots empty, when set to', () => {
		const shuffled = startRound(items(10), 4, () => 0);
		expect(shuffled.slots.map((item) => item!.id)).not.toEqual(['i0', 'i1', 'i2', 'i3']);
		let round = startRound(items(10), 4, () => 0, { shuffle: false, refill: false });
		expect(round.slots.map((item) => item!.id)).toEqual(['i0', 'i1', 'i2', 'i3']);
		round = pick(round, 2);
		expect(round.slots[2]).toBeNull();
		expect(round.pool).toHaveLength(6);
		expect(remaining(round)).toBe(3);
		expect(toEndorsement(round, { kind: 'thinking-about', title: 'Thinking About' })).toMatchObject({ shown: 4, pool: 10 });
	});

	it('knows when a pick limit is met', () => {
		const round = pick(startRound(items(10), 4, inOrder), 0);
		expect(atLimit(round, 0)).toBe(false);
		expect(atLimit(round, 2)).toBe(false);
		expect(atLimit(round, 1)).toBe(true);
	});

	it('falls back on unusable saved settings', () => {
		expect(rapidOptions(undefined)).toEqual(DEFAULT_RAPID_OPTIONS);
		expect(rapidOptions({ size: 9, refill: false, maxPicks: 1 })).toEqual({ ...DEFAULT_RAPID_OPTIONS, size: 9, refill: false, maxPicks: 1 });
		expect(rapidOptions({ size: -3, maxPicks: 2.5, shuffle: 'no' as unknown as boolean })).toEqual(DEFAULT_RAPID_OPTIONS);
	});

	it('drops blank and repeated labels', () => {
		expect(cleanItems([{ id: 'a', label: ' Tea ' }, { id: 'b', label: 'tea' }, { id: 'c', label: '  ' }])).toEqual([{ id: 'a', label: 'Tea' }]);
	});

	it('draws a Collection by its Primary field, skipping hidden and unnamed rows', () => {
		let collection = createCollection('Reinforcers', 'tracker');
		const primary = collection.fields.find((field) => field.primary)!;
		for (const name of ['Walk', 'Tea', '']) {
			collection = addRecord(collection);
			collection = setCellValue(collection, collection.records.at(-1)!.id, primary.id, name);
		}
		collection = setHidden(collection, 'rows', collection.records[1].id, true);
		expect(collectionItems(collection).map((item) => item.label)).toEqual(['Walk']);

		const sources = rapidSources([], [collection, createCollection('Empty')]);
		expect(sources.map((source) => source.key)).toEqual([`collection:${collection.id}`]);
		const withShelf = rapidSources([{ id: 'e1', title: 'Piranesi', columnKey: 'reading', sectionKey: 'book', color: '#3f51b5', lastSessionDate: null }], [collection]);
		expect(withShelf[0]).toMatchObject({ key: 'thinking-about', title: 'Thinking About', items: [{ id: 'e1', label: 'Piranesi', color: '#3f51b5' }] });
	});
});
