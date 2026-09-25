import { repairDocument } from './geometry';
import {
	createLabel,
	normalizeLabelName,
	TINTS,
	type Label,
	type Tint,
	type WhiteboardDocument,
	type WhiteboardItem
} from './model';

/** Labels are equal when they read the same, whatever case they were typed in. */
function key(name: string): string {
	return normalizeLabelName(name).toLowerCase();
}

export function findLabel(document: WhiteboardDocument, name: string): Label | null {
	const wanted = key(name);
	return document.labels.find((label) => key(label.name) === wanted) ?? null;
}

export function labelsById(document: WhiteboardDocument): Map<string, Label> {
	return new Map(document.labels.map((label) => [label.id, label]));
}

/** The labels an object wears, in the board's own order rather than the item's. */
export function labelsOn(document: WhiteboardDocument, item: WhiteboardItem): Label[] {
	const ids = new Set(item.properties?.labelIds ?? []);
	return document.labels.filter((label) => ids.has(label.id));
}

export function labelCount(document: WhiteboardDocument, labelId: string): number {
	return document.items.filter((item) => item.properties?.labelIds?.includes(labelId)).length;
}

/**
 * The next tint to hand out: whichever is least spoken for, so a board of six
 * labels is six colours rather than four and a coincidence.
 */
export function nextTint(document: WhiteboardDocument): Tint {
	const used = new Map<Tint, number>(TINTS.map((tint) => [tint, 0]));
	for (const label of document.labels) used.set(label.tint, (used.get(label.tint) ?? 0) + 1);
	return [...used.entries()].reduce((least, entry) => (entry[1] < least[1] ? entry : least))[0];
}

/** Returns the existing label of that name, or makes one. Never a duplicate. */
export function ensureLabel(document: WhiteboardDocument, name: string, tint?: Tint): { document: WhiteboardDocument; label: Label } | null {
	if (!normalizeLabelName(name)) return null;
	const existing = findLabel(document, name);
	if (existing) return { document, label: existing };
	const label = createLabel(name, tint ?? nextTint(document));
	return { document: { ...document, labels: [...document.labels, label] }, label };
}

function withProperties(item: WhiteboardItem, labelIds: string[]): WhiteboardItem {
	const properties = { ...item.properties };
	if (labelIds.length) properties.labelIds = labelIds;
	else delete properties.labelIds;
	if (!Object.keys(properties).length) {
		const { properties: _none, ...rest } = item;
		return rest as WhiteboardItem;
	}
	return { ...item, properties } as WhiteboardItem;
}

export function attachLabel(document: WhiteboardDocument, itemId: string, labelId: string): WhiteboardDocument {
	if (!document.labels.some((label) => label.id === labelId)) return document;
	const items = document.items.map((item) => {
		if (item.id !== itemId) return item;
		const current = item.properties?.labelIds ?? [];
		return current.includes(labelId) ? item : withProperties(item, [...current, labelId]);
	});
	return { ...document, items };
}

export function detachLabel(document: WhiteboardDocument, itemId: string, labelId: string): WhiteboardDocument {
	const items = document.items.map((item) => {
		if (item.id !== itemId) return item;
		const current = item.properties?.labelIds ?? [];
		return current.includes(labelId) ? withProperties(item, current.filter((id) => id !== labelId)) : item;
	});
	return { ...document, items };
}

export function toggleLabel(document: WhiteboardDocument, itemId: string, labelId: string): WhiteboardDocument {
	const item = document.items.find((candidate) => candidate.id === itemId);
	if (!item) return document;
	return item.properties?.labelIds?.includes(labelId)
		? detachLabel(document, itemId, labelId)
		: attachLabel(document, itemId, labelId);
}

/**
 * Names a label onto every given object at once, making the label if it is new.
 * This is the path the "＋" on a card takes, and the one that makes labels feel
 * like typing a word rather than administering a taxonomy.
 */
export function labelItems(document: WhiteboardDocument, itemIds: string[], name: string): WhiteboardDocument {
	const ensured = ensureLabel(document, name);
	if (!ensured) return document;
	return itemIds.reduce((next, itemId) => attachLabel(next, itemId, ensured.label.id), ensured.document);
}

export function renameLabel(document: WhiteboardDocument, labelId: string, name: string): WhiteboardDocument {
	const cleaned = normalizeLabelName(name);
	if (!cleaned) return document;
	const clash = findLabel(document, cleaned);
	// Renaming onto an existing label would make two labels read the same, so
	// the two become one and everything wearing either wears the survivor.
	if (clash && clash.id !== labelId) return mergeLabels(document, labelId, clash.id);
	return { ...document, labels: document.labels.map((label) => (label.id === labelId ? { ...label, name: cleaned } : label)) };
}

export function retintLabel(document: WhiteboardDocument, labelId: string, tint: Tint): WhiteboardDocument {
	return { ...document, labels: document.labels.map((label) => (label.id === labelId ? { ...label, tint } : label)) };
}

export function mergeLabels(document: WhiteboardDocument, fromId: string, intoId: string): WhiteboardDocument {
	if (fromId === intoId) return document;
	const carried = document.items.reduce<WhiteboardDocument>(
		(next, item) => (item.properties?.labelIds?.includes(fromId) ? attachLabel(next, item.id, intoId) : next),
		document
	);
	return deleteLabel(carried, fromId);
}

/** Deleting a label takes it off everything; `repairDocument` does the sweeping. */
export function deleteLabel(document: WhiteboardDocument, labelId: string): WhiteboardDocument {
	return repairDocument({ ...document, labels: document.labels.filter((label) => label.id !== labelId) });
}

/** Labels not yet on this object, narrowed by whatever has been typed so far. */
export function suggestLabels(document: WhiteboardDocument, item: WhiteboardItem | null, typed: string): Label[] {
	const worn = new Set(item?.properties?.labelIds ?? []);
	const needle = key(typed);
	return document.labels
		.filter((label) => !worn.has(label.id))
		.filter((label) => !needle || key(label.name).includes(needle))
		.sort((a, b) => {
			if (!needle) return labelCount(document, b.id) - labelCount(document, a.id);
			const aStarts = key(a.name).startsWith(needle) ? 0 : 1;
			const bStarts = key(b.name).startsWith(needle) ? 0 : 1;
			return aStarts - bStarts || a.name.localeCompare(b.name);
		});
}
