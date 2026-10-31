import { countWords, countWordsInText } from '@woodles/text';
import { loadDraft } from '../../../write/src/lib/drafts';
import type { WoodlesRef } from '@shared/homesuiteBridge';
import { refKey } from './folders';

/**
 * What HomeSuite knows about a file beyond what its owning app lists: when it
 * was created, when it was last opened here, and (for documents) how long it
 * is. The owning apps keep no creation or open time, so HomeSuite keeps its
 * own small ledger. It stays on this device — nothing here syncs.
 */
export const FILE_META_KEY = 'woodles.homesuite.filemeta.v1';
export const SORT_PREF_KEY = 'woodles.homesuite.sort.v1';

export type FileMeta = { createdAt?: string; openedAt?: string };
export type FileMetaMap = Record<string, FileMeta>;

export type SortKey = 'edited' | 'created' | 'opened' | 'name' | 'words' | 'type';
export type SortDirection = 'asc' | 'desc';
export type SortPref = { key: SortKey; direction: SortDirection };

export const SORT_OPTIONS: readonly { key: SortKey; label: string; verb: string }[] = [
	{ key: 'edited', label: 'Last edited', verb: 'Edited' },
	{ key: 'created', label: 'Date created', verb: 'Created' },
	{ key: 'opened', label: 'Last opened', verb: 'Opened' },
	{ key: 'name', label: 'Name', verb: 'Edited' },
	{ key: 'words', label: 'Word count', verb: 'Edited' },
	{ key: 'type', label: 'Type', verb: 'Edited' }
];

export const DEFAULT_SORT: SortPref = { key: 'edited', direction: 'desc' };

/** Names and types read A→Z first; everything else starts with the biggest or newest. */
export function defaultDirection(key: SortKey): SortDirection {
	return key === 'name' || key === 'type' ? 'asc' : 'desc';
}

export type FileInfo = {
	ref: WoodlesRef;
	kind: string;
	title: string;
	updatedAt: string;
	createdAt?: string;
	openedAt?: string;
	wordCount?: number;
};

function safeParse(raw: string | null): unknown {
	if (!raw) return null;
	try { return JSON.parse(raw); } catch { return null; }
}

function isStamp(value: unknown): value is string {
	return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function loadFileMeta(): FileMetaMap {
	if (typeof localStorage === 'undefined') return {};
	const parsed = safeParse(localStorage.getItem(FILE_META_KEY));
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
	const clean: FileMetaMap = {};
	for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
		if (!value || typeof value !== 'object') continue;
		const { createdAt, openedAt } = value as FileMeta;
		const entry: FileMeta = {};
		if (isStamp(createdAt)) entry.createdAt = createdAt;
		if (isStamp(openedAt)) entry.openedAt = openedAt;
		if (entry.createdAt || entry.openedAt) clean[key] = entry;
	}
	return clean;
}

export function saveFileMeta(map: FileMetaMap): void {
	if (typeof localStorage === 'undefined') return;
	try { localStorage.setItem(FILE_META_KEY, JSON.stringify(map)); } catch { /* quota: the ledger is only a convenience */ }
}

/** Write names drafts `d-<base36 time>`, so a document's age survives without a ledger. */
export function draftCreatedAt(id: string, now = Date.now()): string | undefined {
	const match = /^d-([0-9a-z]{7,10})$/.exec(id);
	if (!match) return undefined;
	const time = parseInt(match[1], 36);
	// Anything before 2015 or after tomorrow is a different kind of id.
	if (!Number.isFinite(time) || time < Date.UTC(2015, 0, 1) || time > now + 864e5) return undefined;
	return new Date(time).toISOString();
}

/**
 * Give every listed file a creation time (a draft's own id, else the first
 * time HomeSuite saw it) and forget files that no longer exist anywhere.
 * `trashedKeys` stay: a restored file keeps its history.
 */
export function syncFileMeta(map: FileMetaMap, listed: readonly { ref: WoodlesRef }[], trashedKeys: Iterable<string>, now: string): { map: FileMetaMap; changed: boolean } {
	const live = new Set<string>([...trashedKeys, ...listed.map((item) => refKey(item.ref))]);
	const next: FileMetaMap = {};
	let changed = false;
	for (const [key, value] of Object.entries(map)) {
		if (live.has(key)) next[key] = value; else changed = true;
	}
	for (const item of listed) {
		const key = refKey(item.ref);
		if (next[key]?.createdAt) continue;
		const guess = item.ref.app === 'write' && item.ref.kind === 'draft' ? draftCreatedAt(item.ref.id, Date.parse(now)) : undefined;
		next[key] = { ...next[key], createdAt: guess ?? now };
		changed = true;
	}
	return { map: next, changed };
}

export function withOpened(map: FileMetaMap, ref: WoodlesRef, now: string): FileMetaMap {
	const key = refKey(ref);
	return { ...map, [key]: { ...map[key], openedAt: now } };
}

const wordCache = new Map<string, { stamp: string; count: number | undefined }>();

/** Words in a document's main text; undefined for lists and anything unreadable. */
export function documentWordCount(id: string, stamp: string): number | undefined {
	const hit = wordCache.get(id);
	if (hit && hit.stamp === stamp) return hit.count;
	const body = loadDraft(id);
	let count: number | undefined;
	if (body && !body.liquid) {
		const html = body.layers?.foreground?.html;
		if (typeof html === 'string') count = countWords(html);
		else if (typeof body.content === 'string') count = countWordsInText(body.content);
		else count = 0;
	}
	wordCache.set(id, { stamp, count });
	return count;
}

export function describeFiles<T extends { ref: WoodlesRef; kind: string; updatedAt: string }>(items: readonly T[], map: FileMetaMap): (T & Pick<FileInfo, 'createdAt' | 'openedAt' | 'wordCount'>)[] {
	return items.map((item) => {
		const meta = map[refKey(item.ref)];
		const wordCount = item.kind === 'document' ? documentWordCount(item.ref.id, item.updatedAt) : undefined;
		return { ...item, createdAt: meta?.createdAt, openedAt: meta?.openedAt, ...(wordCount === undefined ? {} : { wordCount }) };
	});
}

function time(stamp: string | undefined): number | undefined {
	if (!stamp) return undefined;
	const value = Date.parse(stamp);
	return Number.isNaN(value) ? undefined : value;
}

function sortValue(item: FileInfo, key: SortKey): number | string | undefined {
	switch (key) {
		case 'edited': return time(item.updatedAt);
		case 'created': return time(item.createdAt);
		case 'opened': return time(item.openedAt);
		case 'words': return item.wordCount;
		case 'name': return item.title.toLowerCase();
		case 'type': return item.kind;
	}
}

/** Files missing the sorted value (never opened, no word count) go last in either direction. */
export function sortFiles<T extends FileInfo>(items: readonly T[], pref: SortPref): T[] {
	const sign = pref.direction === 'asc' ? 1 : -1;
	return [...items].sort((a, b) => {
		const left = sortValue(a, pref.key);
		const right = sortValue(b, pref.key);
		if (left === undefined && right !== undefined) return 1;
		if (right === undefined && left !== undefined) return -1;
		if (left !== undefined && right !== undefined && left !== right) {
			const order = typeof left === 'string' ? left.localeCompare(String(right)) : (left as number) - (right as number);
			if (order !== 0) return order * sign;
		}
		return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || (time(b.updatedAt) ?? 0) - (time(a.updatedAt) ?? 0);
	});
}

export function loadSortPref(): SortPref {
	if (typeof localStorage === 'undefined') return DEFAULT_SORT;
	const parsed = safeParse(localStorage.getItem(SORT_PREF_KEY)) as Partial<SortPref> | null;
	const key = SORT_OPTIONS.find((option) => option.key === parsed?.key)?.key;
	if (!key) return DEFAULT_SORT;
	return { key, direction: parsed?.direction === 'asc' || parsed?.direction === 'desc' ? parsed.direction : defaultDirection(key) };
}

export function saveSortPref(pref: SortPref): void {
	if (typeof localStorage === 'undefined') return;
	try { localStorage.setItem(SORT_PREF_KEY, JSON.stringify(pref)); } catch { /* preference only */ }
}

/** The date a row leads with: whichever one the list is sorted by, else last edited. */
export function leadingStamp(item: FileInfo, key: SortKey): { verb: string; stamp: string | undefined } {
	if (key === 'created') return { verb: 'Created', stamp: item.createdAt };
	if (key === 'opened') return { verb: 'Opened', stamp: item.openedAt };
	return { verb: 'Edited', stamp: item.updatedAt };
}
