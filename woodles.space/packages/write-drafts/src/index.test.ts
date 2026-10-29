import { describe, expect, it } from 'vitest';
import { ACTIVE_DRAFT_ID_KEY, createDraftFromText, DRAFT_PREFIX, DRAFTS_INDEX_KEY } from './index';

function makeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; }, clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null, key: (n) => [...data.keys()][n] ?? null,
    removeItem: (key) => { data.delete(key); }, setItem: (key, value) => { data.set(key, value); }
  };
}

describe('creating a Write draft from another surface', () => {
  it('keeps the active draft, safely carries text, and makes distinct indexed drafts', () => {
    const storage = makeStorage();
    storage.setItem(ACTIVE_DRAFT_ID_KEY, 'existing');
    storage.setItem(DRAFTS_INDEX_KEY, JSON.stringify([{ id: 'existing', title: 'Existing', updatedAt: '2020' }]));
    const ref = createDraftFromText({ title: 'A thought', text: '<hello> & you\nnext\n\nAnother' }, storage);
    const second = createDraftFromText({ title: 'Again', text: '' }, storage);
    expect(ref).toMatchObject({ app: 'write', kind: 'draft' });
    expect(second.id).not.toBe(ref.id);
    expect(storage.getItem(ACTIVE_DRAFT_ID_KEY)).toBe('existing');
    expect(JSON.parse(storage.getItem(DRAFTS_INDEX_KEY)!).map((d: { id: string }) => d.id)).toEqual(['existing', ref.id, second.id]);
    const body = JSON.parse(storage.getItem(DRAFT_PREFIX + ref.id)!);
    expect(body.title).toBe('A thought');
    expect(body.layers.foreground.html).toBe('<p>&lt;hello&gt; &amp; you<br>next</p><p>Another</p>');
  });

  it('does not overwrite an unreadable index or leave a body after an index write fails', () => {
    const corrupt = makeStorage();
    corrupt.setItem(DRAFTS_INDEX_KEY, '{oops');
    expect(() => createDraftFromText({ title: '', text: '' }, corrupt)).toThrow();
    expect(corrupt.getItem(DRAFTS_INDEX_KEY)).toBe('{oops');
    expect(corrupt.length).toBe(1);
    const full = makeStorage();
    const set = full.setItem;
    full.setItem = (key, value) => { if (key === DRAFTS_INDEX_KEY) throw new Error('quota'); set(key, value); };
    expect(() => createDraftFromText({ title: '', text: '' }, full)).toThrow('quota');
    expect(full.length).toBe(0);
  });
});
