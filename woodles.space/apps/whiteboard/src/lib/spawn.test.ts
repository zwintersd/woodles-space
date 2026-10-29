import { describe, expect, it } from 'vitest';
import { createCard, createSlip, createStack, isWhiteboardDocument, createEmptyBoard, slipToCard, snapshotDocument } from './model';
import { spawnContent } from './spawn';

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
});
