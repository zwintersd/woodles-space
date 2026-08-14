import type { Bounds, Label, WhiteboardDocument, WhiteboardItem } from './model';
import { boundsForItem } from './geometry';
import { itemLabel } from './navigation';
import { labelsOn } from './labels';
import { normalizeLabelName } from './model';

export type MatchField = 'title' | 'body' | 'label' | 'kind' | 'status' | 'source' | 'name';

export type SearchHit = {
	item: WhiteboardItem;
	/** What to call this result in the list. */
	title: string;
	/** The words around the match, so a result explains why it is a result. */
	snippet: string;
	field: MatchField;
	labels: Label[];
	score: number;
};

export type SearchQuery = {
	text: string;
	/** Set when the query was written as `#name` — labels only. */
	labelOnly: boolean;
};

/** Fields are weighted by how much of an answer they are to "what is this". */
const FIELD_WEIGHT: Record<MatchField, number> = {
	title: 100,
	name: 100,
	label: 80,
	kind: 60,
	status: 50,
	body: 40,
	source: 20
};

export function parseQuery(raw: string): SearchQuery {
	const trimmed = raw.trim();
	if (trimmed.startsWith('#')) return { text: normalizeLabelName(trimmed).toLowerCase(), labelOnly: true };
	return { text: trimmed.toLowerCase(), labelOnly: false };
}

/**
 * Everything on the board that answers to this query, best first.
 *
 * Searching is over the material and the optional layer alike: a card found by
 * its label is found the same way as a card found by its words, which is the
 * point of having labels at all — organization that does not depend on where a
 * thing sits.
 */
export function searchBoard(document: WhiteboardDocument, raw: string): SearchHit[] {
	const query = parseQuery(raw);
	if (!query.text) return [];

	const hits: SearchHit[] = [];
	for (const item of document.items) {
		if (item.type === 'connector') continue;
		const labels = labelsOn(document, item);
		const best = bestMatch(item, labels, query);
		if (best) hits.push({ item, labels, ...best });
	}

	return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

type Match = { title: string; snippet: string; field: MatchField; score: number };

function bestMatch(item: WhiteboardItem, labels: Label[], query: SearchQuery): Match | null {
	const title = itemLabel(item);
	const candidates: { field: MatchField; text: string; snippetOf?: string }[] = [];

	for (const label of labels) candidates.push({ field: 'label', text: label.name, snippetOf: `#${label.name}` });
	if (query.labelOnly) return pick(candidates, title, query);

	if (item.type === 'card') {
		if (item.title.trim()) candidates.push({ field: 'title', text: item.title });
		if (item.body.trim()) candidates.push({ field: 'body', text: item.body });
	} else if (item.type === 'frame' || item.type === 'stack') {
		candidates.push({ field: 'title', text: item.title });
	} else if (item.type === 'image') {
		candidates.push({ field: 'name', text: item.name });
	}

	const properties = item.properties;
	if (properties?.kind) candidates.push({ field: 'kind', text: properties.kind });
	if (properties?.status) candidates.push({ field: 'status', text: properties.status });
	if (properties?.source) candidates.push({ field: 'source', text: properties.source });

	return pick(candidates, title, query);
}

function pick(
	candidates: { field: MatchField; text: string; snippetOf?: string }[],
	title: string,
	query: SearchQuery
): Match | null {
	let best: Match | null = null;
	for (const candidate of candidates) {
		const haystack = candidate.text.toLowerCase();
		const at = haystack.indexOf(query.text);
		if (at === -1) continue;
		// A match at the start of a field is a stronger answer than one buried in
		// it, and a short field that is nearly all match is stronger still.
		const position = at === 0 ? 20 : Math.max(0, 12 - at / 4);
		const coverage = (query.text.length / Math.max(1, haystack.length)) * 24;
		const score = FIELD_WEIGHT[candidate.field] + position + coverage;
		if (!best || score > best.score) {
			best = {
				title,
				field: candidate.field,
				score,
				snippet: candidate.snippetOf ?? excerpt(candidate.text, at, query.text.length)
			};
		}
	}
	return best;
}

/** A window of text around the match, cut at word edges where it can be. */
export function excerpt(text: string, at: number, length: number, width = 64): string {
	const flat = text.replace(/\s+/g, ' ').trim();
	if (flat.length <= width) return flat;
	const offset = text.slice(0, at).replace(/\s+/g, ' ').trim().length;
	let start = Math.max(0, offset - Math.floor((width - length) / 2));
	if (start > 0) {
		const space = flat.indexOf(' ', start);
		if (space !== -1 && space - start < 12) start = space + 1;
	}
	const end = Math.min(flat.length, start + width);
	return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`;
}

/** The one rectangle that holds every result, for pulling back to show them all. */
export function hitsBounds(items: WhiteboardItem[], hits: SearchHit[]): Bounds | null {
	const boxes = hits.map((hit) => boundsForItem(items, hit.item));
	if (!boxes.length) return null;
	const left = Math.min(...boxes.map((box) => box.x));
	const top = Math.min(...boxes.map((box) => box.y));
	const right = Math.max(...boxes.map((box) => box.x + box.width));
	const bottom = Math.max(...boxes.map((box) => box.y + box.height));
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Everything wearing a label, for "show me all of these". */
export function itemsWithLabel(document: WhiteboardDocument, labelId: string): WhiteboardItem[] {
	return document.items.filter((item) => item.properties?.labelIds?.includes(labelId));
}
