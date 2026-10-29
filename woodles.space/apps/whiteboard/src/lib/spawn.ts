import type { WhiteboardItem } from './model';

export type SpawnContent = { title: string; text: string; rows: { name: string; notes: string }[] };

/** A stack carries its ordered notes; other text objects carry their own words. */
export function spawnContent(item: WhiteboardItem, items: WhiteboardItem[]): SpawnContent | null {
  if (item.type === 'stack') {
    const rows = item.cardIds.flatMap((id) => {
      const member = items.find((entry) => entry.id === id);
      if (!member || (member.type !== 'card' && member.type !== 'slip')) return [];
      return [member.type === 'card' ? { name: member.title || member.body, notes: member.title ? member.body : '' } : { name: member.text, notes: '' }];
    });
    return { title: item.title.trim() || 'Untitled collection', text: rows.map((row) => [row.name, row.notes].filter(Boolean).join('\n')).join('\n\n'), rows };
  }
  if (item.type === 'card') return { title: item.title.trim() || 'Untitled document', text: item.body, rows: [{ name: item.title || item.body, notes: item.title ? item.body : '' }] };
  if (item.type === 'slip' || item.type === 'lettering') return { title: item.text.trim().split('\n')[0].slice(0, 100) || 'Untitled document', text: item.text, rows: [{ name: item.text, notes: '' }] };
  return null;
}
