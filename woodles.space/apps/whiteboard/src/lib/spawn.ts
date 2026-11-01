import { addField, addRecord, createCollection, createStackCollection, mirrorStack, setCellValue, stackRows, type Collection } from '@woodles/collections';
import type { WhiteboardItem } from './model';

export type SpawnContent = { title: string; text: string; rows: { name: string; notes: string }[] };

/** A stack carries its ordered notes; other text objects carry their own words. */
export function spawnContent(item: WhiteboardItem, items: WhiteboardItem[]): SpawnContent | null {
  if (item.type === 'stack') {
    const rows = (stackRows(items, item.id)?.rows ?? []).map(({ name, notes }) => ({ name, notes }));
    return { title: item.title.trim() || 'Untitled collection', text: rows.map((row) => [row.name, row.notes].filter(Boolean).join('\n')).join('\n\n'), rows };
  }
  if (item.type === 'card') return { title: item.title.trim() || 'Untitled document', text: item.body, rows: [{ name: item.title || item.body, notes: item.title ? item.body : '' }] };
  if (item.type === 'slip' || item.type === 'lettering') return { title: item.text.trim().split('\n')[0].slice(0, 100) || 'Untitled document', text: item.text, rows: [{ name: item.text, notes: '' }] };
  return null;
}

/**
 * A Stack becomes a Collection that follows it: Name and Notes belong to the
 * Stack and refresh whenever the Collection is open. Anything else becomes an
 * ordinary Collection with a single row, which nothing keeps up to date.
 */
export function spawnCollection(item: WhiteboardItem, items: WhiteboardItem[], boardId: string): Collection | null {
  const content = spawnContent(item, items);
  if (!content) return null;
  if (item.type === 'stack') {
    const linked = createStackCollection(content.title, { boardId, stackId: item.id });
    return mirrorStack(linked, stackRows(items, item.id)?.rows ?? []);
  }
  let collection = createCollection(content.title === 'Untitled document' ? 'Untitled collection' : content.title);
  if (content.rows.some((row) => row.notes)) collection = addField(collection, 'Notes', 'text');
  for (const row of content.rows) {
    collection = addRecord(collection);
    const record = collection.records[collection.records.length - 1];
    collection = setCellValue(collection, record.id, collection.fields[0].id, row.name);
    if (row.notes) collection = setCellValue(collection, record.id, collection.fields[1].id, row.notes);
  }
  return collection;
}
