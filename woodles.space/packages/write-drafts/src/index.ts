/** Write owns these drafts; this package is the shared storage contract. */
export const ACTIVE_DRAFT_ID_KEY = 'woodles_active_draft_id';
export const DRAFTS_INDEX_KEY = 'woodles_drafts_index';
export const DRAFT_PREFIX = 'woodles_draft_';

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Blank lines separate paragraphs; single newlines are soft breaks. */
export function textToHtml(text: string): string {
  return text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
    .map((block) => '<p>' + escapeHtml(block).replace(/\n/g, '<br>') + '</p>').join('');
}

export type DraftRef = { app: 'write'; kind: 'draft'; id: string };

/** Create an indexed Write draft without changing the active draft.
 * A failed index write rolls back the new body, and a malformed index is never overwritten.
 */
export function createDraftFromText(
  input: { title: string; text: string },
  storage: Storage = localStorage
): DraftRef {
  const raw = storage.getItem(DRAFTS_INDEX_KEY);
  let index: unknown = [];
  if (raw !== null) {
    try { index = JSON.parse(raw); } catch { throw new Error('Write drafts index is unreadable'); }
    if (!Array.isArray(index)) throw new Error('Write drafts index is unreadable');
  }
  const entries = index as unknown[];
  let id: string;
  do {
    const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    id = `d-${suffix}`;
  } while (entries.some((entry) => typeof entry === 'object' && entry !== null && 'id' in entry && entry.id === id) || storage.getItem(DRAFT_PREFIX + id) !== null);
  const stamp = new Date().toISOString();
  const body = { title: input.title, layers: { foreground: { html: textToHtml(input.text), updatedAt: stamp } }, savedAt: stamp };
  const key = DRAFT_PREFIX + id;
  storage.setItem(key, JSON.stringify(body));
  try {
    storage.setItem(DRAFTS_INDEX_KEY, JSON.stringify([...entries, { id, title: input.title, updatedAt: stamp }]));
  } catch (error) {
    try { storage.removeItem(key); } catch { /* Retain the original storage error. */ }
    throw error;
  }
  return { app: 'write', kind: 'draft', id };
}
