import type { Collection, CollectionField, CollectionRecord } from './collections';

/**
 * Find and replace over a Collection's text. Only cells you can type into are
 * searched: Text and URL fields, never synced columns, and never the Primary
 * cell of a referenced record (that one shows its source's name). Everything
 * is literal text — no patterns — so what is typed is what is matched.
 */

export type FindOptions = { matchCase: boolean; wholeCell: boolean };
/** The records and fields in play, in table order — the visible ones, so hidden data is never touched. */
export type FindScope = { recordIds: readonly string[]; fieldIds: readonly string[] };
export type FindMatch = {
	recordId: string;
	fieldId: string;
	/** Positions within the scope, which is the order matches are listed and stepped in. */
	row: number;
	col: number;
	occurrences: number;
};

function searchable(field: CollectionField, record: CollectionRecord): boolean {
	if (field.sourceKey || (field.type !== 'text' && field.type !== 'url')) return false;
	return !(record.sourceRef && field.primary);
}

/** Whether a field can ever be searched, for offering it as a scope. */
export function isSearchableField(field: CollectionField): boolean {
	return !field.sourceKey && (field.type === 'text' || field.type === 'url');
}

function pattern(query: string, options: FindOptions): RegExp {
	const literal = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(options.wholeCell ? `^${literal}$` : literal, options.matchCase ? 'g' : 'gi');
}

/** Every cell containing the query, row by row. An empty query matches nothing. */
export function findMatches(collection: Collection, query: string, options: FindOptions, scope: FindScope): FindMatch[] {
	if (!query) return [];
	const re = pattern(query, options);
	const records = new Map(collection.records.map((record) => [record.id, record]));
	const fields = new Map(collection.fields.map((field) => [field.id, field]));
	const matches: FindMatch[] = [];
	scope.recordIds.forEach((recordId, row) => {
		const record = records.get(recordId);
		if (!record) return;
		scope.fieldIds.forEach((fieldId, col) => {
			const field = fields.get(fieldId);
			const value = record.values[fieldId];
			if (!field || typeof value !== 'string' || !searchable(field, record)) return;
			const occurrences = value.match(re)?.length ?? 0;
			if (occurrences) matches.push({ recordId, fieldId, row, col, occurrences });
		});
	});
	return matches;
}

/** What a set of matches comes to in one field. */
export type FieldTally = { fieldId: string; name: string; cells: number; occurrences: number };

function tally(collection: Collection, entries: Iterable<{ fieldId: string; occurrences: number }>): FieldTally[] {
	const byField = new Map<string, FieldTally>();
	for (const { fieldId, occurrences } of entries) {
		const found = byField.get(fieldId) ?? { fieldId, name: collection.fields.find((field) => field.id === fieldId)?.name ?? '', cells: 0, occurrences: 0 };
		found.cells++;
		found.occurrences += occurrences;
		byField.set(fieldId, found);
	}
	const order = collection.views.table.columnOrder;
	return [...byField.values()].sort((a, b) => order.indexOf(a.fieldId) - order.indexOf(b.fieldId));
}

/** Per-field counts for matches, in column order — what a replace would touch. */
export function matchStats(collection: Collection, matches: readonly FindMatch[]): FieldTally[] {
	return tally(collection, matches);
}

export type ReplaceResult = { collection: Collection; cells: number; occurrences: number; /** What actually changed, per field. */ byField: FieldTally[] };

/**
 * Replaces every match, or just the one cell in `only`. The replacement is
 * inserted as typed. Returns the same Collection when nothing would change.
 */
export function replaceMatches(
	collection: Collection, query: string, replacement: string, options: FindOptions, scope: FindScope,
	only?: { recordId: string; fieldId: string }
): ReplaceResult {
	const re = pattern(query, options);
	const targets = new Map<string, Set<string>>();
	for (const match of findMatches(collection, query, options, scope)) {
		if (only && (match.recordId !== only.recordId || match.fieldId !== only.fieldId)) continue;
		if (!targets.has(match.recordId)) targets.set(match.recordId, new Set());
		targets.get(match.recordId)!.add(match.fieldId);
	}
	const stamp = new Date().toISOString();
	let cells = 0, occurrences = 0;
	const changed: { fieldId: string; occurrences: number }[] = [];
	const records = collection.records.map((record) => {
		const fieldIds = targets.get(record.id);
		if (!fieldIds) return record;
		const values = { ...record.values };
		let touched = false;
		for (const fieldId of fieldIds) {
			const before = values[fieldId] as string;
			const after = before.replace(re, () => replacement);
			if (after === before) continue;
			values[fieldId] = after;
			const count = before.match(re)?.length ?? 0;
			occurrences += count;
			changed.push({ fieldId, occurrences: count });
			cells++;
			touched = true;
		}
		return touched ? { ...record, values, updatedAt: stamp } : record;
	});
	if (!cells) return { collection, cells: 0, occurrences: 0, byField: [] };
	return { collection: { ...collection, records, updatedAt: stamp }, cells, occurrences, byField: tally(collection, changed) };
}
