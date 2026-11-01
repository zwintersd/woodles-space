import { describe, expect, it } from 'vitest';
import { createCard, createSlip, createStack, isWhiteboardDocument, createEmptyBoard, slipToCard, snapshotDocument } from './model';
import { mirrorStack, stackRows } from '@woodles/collections';
import { spawnCollection, spawnContent } from './spawn';

describe('creating from board objects', () => {
  it('takes stack members in their explicit order and keeps card body separately', () => {
    const a = { ...createCard(0, 0, 1), title: 'First', body: 'More detail' };
    const b = { ...createSlip(0, 0, 2), text: 'Second thought' };
    const stack = { ...createStack(0, 0, 3), title: 'Ideas', cardIds: [b.id, a.id] };
    expect(spawnContent(stack, [a, stack, b])).toEqual({ title: 'Ideas', text: 'Second thought\n\nFirst\nMore detail', rows: [{ name: 'Second thought', notes: '' }, { name: 'First', notes: 'More detail' }] });
  });
  it('preserves full owner references across snapshots and Slip to Card', () => {
    const slip = { ...createSlip(0, 0, 1), artifacts: [{ app: 'write', kind: 'draft', id: 'one' }] };
    const board = createEmptyBoard(); board.items = [slip];
    const snapshot = snapshotDocument(board);
    expect(isWhiteboardDocument(snapshot)).toBe(true);
    expect(slipToCard(slip).artifacts).toEqual(slip.artifacts);
    slip.artifacts[0].id = 'changed';
    expect(snapshot.items[0].artifacts?.[0].id).toBe('one');
  });
  it('spawns a Collection from a Stack that follows it', () => {
    const a = { ...createCard(0, 0, 1), title: 'First', body: 'More detail' };
    const b = { ...createSlip(0, 0, 2), text: 'Second thought' };
    const stack = { ...createStack(0, 0, 3), title: 'Ideas', cardIds: [a.id, b.id] };
    const items = [a, b, stack];
    const collection = spawnCollection(stack, items, 'board-1')!;
    expect(collection.stackLink).toEqual({ boardId: 'board-1', stackId: stack.id });
    expect(collection.fields.map((field) => [field.name, field.sourceKey])).toEqual([['Name', 'name'], ['Notes', 'notes']]);
    const [name, notes] = collection.fields;
    expect(collection.records.map((record) => [record.values[name.id], record.values[notes.id]])).toEqual([['First', 'More detail'], ['Second thought', '']]);

    // The Stack changes: reorder, edit, add, and take one out.
    const c = { ...createSlip(0, 0, 4), text: 'Third' };
    const changed = [{ ...a, title: 'First, renamed' }, b, c, { ...stack, cardIds: [c.id, a.id] }];
    const next = mirrorStack(collection, stackRows(changed, stack.id)!.rows);
    expect(next.records.map((record) => record.values[name.id])).toEqual(['Third', 'First, renamed']);
    // A row that survived keeps its identity; nothing changing saves nothing.
    expect(next.records[1].id).toBe(collection.records[0].id);
    expect(mirrorStack(next, stackRows(changed, stack.id)!.rows)).toBe(next);
  });
  it('keeps columns and rows made in the Collection when the Stack changes', () => {
    const a = { ...createSlip(0, 0, 1), text: 'One' };
    const stack = { ...createStack(0, 0, 2), title: 'List', cardIds: [a.id] };
    const collection = spawnCollection(stack, [a, stack], 'board-1')!;
    const withLocal = mirrorStack({ ...collection, records: [...collection.records, { id: 'local', values: { [collection.fields[0].id]: 'Mine', [collection.fields[1].id]: '' }, createdAt: collection.createdAt, updatedAt: collection.updatedAt }] }, stackRows([a, stack], stack.id)!.rows);
    expect(withLocal.records.map((record) => record.id)).toContain('local');
    const emptied = mirrorStack(withLocal, stackRows([{ ...stack, cardIds: [] }], stack.id)!.rows);
    expect(emptied.records.map((record) => record.id)).toEqual(['local']);
  });
  it('spawns a single Slip as an ordinary Collection with no link', () => {
    const slip = { ...createSlip(0, 0, 1), text: 'Just this' };
    const collection = spawnCollection(slip, [slip], 'board-1')!;
    expect(collection.stackLink).toBeUndefined();
    expect(collection.fields.every((field) => !field.sourceKey)).toBe(true);
    expect(collection.records).toHaveLength(1);
  });
});
