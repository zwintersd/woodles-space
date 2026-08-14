import {
	isStatus,
	isTint,
	now,
	type ItemProperties,
	type Status,
	type Tint,
	type WhiteboardDocument,
	type WhiteboardItem
} from './model';

export type PropertyKey = 'status' | 'kind' | 'source' | 'tint';

/** Trimmed to the length a card can wear without becoming a form. */
const MAX_KIND = 24;
const MAX_SOURCE = 300;

/**
 * The one place a property is written. Setting anything to nothing removes the
 * field, and removing the last field removes the sheet — so an object that has
 * been cleared is indistinguishable from one that was never touched.
 */
export function setProperty(item: WhiteboardItem, key: PropertyKey, value: string | null): WhiteboardItem {
	// Frames have carried their colour in `tint` since before there were
	// properties. Keep writing it there rather than giving a frame two colours.
	if (key === 'tint' && item.type === 'frame') {
		return isTint(value) ? ({ ...item, tint: value, updatedAt: now() } as WhiteboardItem) : item;
	}

	const properties: ItemProperties = { ...item.properties };
	const cleaned = clean(key, value);
	if (cleaned === null) delete properties[key];
	else properties[key] = cleaned as never;

	if (!Object.keys(properties).length) {
		const { properties: _none, ...rest } = item;
		return { ...rest, updatedAt: now() } as WhiteboardItem;
	}
	return { ...item, properties, updatedAt: now() } as WhiteboardItem;
}

function clean(key: PropertyKey, value: string | null): string | null {
	if (value === null) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (key === 'status') return isStatus(trimmed) ? trimmed : null;
	if (key === 'tint') return isTint(trimmed) ? trimmed : null;
	if (key === 'kind') return trimmed.slice(0, MAX_KIND);
	return trimmed.slice(0, MAX_SOURCE);
}

export function setItemProperty(
	document: WhiteboardDocument,
	itemId: string,
	key: PropertyKey,
	value: string | null
): WhiteboardDocument {
	return { ...document, items: document.items.map((item) => (item.id === itemId ? setProperty(item, key, value) : item)) };
}

export function statusOf(item: WhiteboardItem): Status | null {
	return item.properties?.status ?? null;
}

export function kindOf(item: WhiteboardItem): string | null {
	return item.properties?.kind ?? null;
}

export function sourceOf(item: WhiteboardItem): string | null {
	return item.properties?.source ?? null;
}

/** Frames answer with the tint they have always had; everything else with theirs. */
export function colorOf(item: WhiteboardItem): Tint | null {
	if (item.type === 'frame') return isTint(item.tint) ? item.tint : null;
	return item.properties?.tint ?? null;
}

/**
 * A source that is a link is worth linking. Anything else is a note about where
 * something came from, and stays text — this never invents a scheme to make a
 * bare word clickable.
 */
export function sourceLink(source: string): string | null {
	const trimmed = source.trim();
	if (!/^https?:\/\//i.test(trimmed)) return null;
	try {
		const url = new URL(trimmed);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
	} catch {
		return null;
	}
}

export function sourceLabel(source: string): string {
	const href = sourceLink(source);
	if (!href) return source;
	try {
		const url = new URL(href);
		return url.hostname.replace(/^www\./, '') + (url.pathname === '/' ? '' : url.pathname);
	} catch {
		return source;
	}
}

export function hasProperties(item: WhiteboardItem): boolean {
	return Boolean(item.properties && Object.keys(item.properties).length);
}

/** How many things have been said about this object, for a quiet count in the UI. */
export function propertyCount(item: WhiteboardItem): number {
	const properties = item.properties;
	if (!properties) return 0;
	let count = 0;
	if (properties.labelIds?.length) count += properties.labelIds.length;
	if (properties.status) count += 1;
	if (properties.kind) count += 1;
	if (properties.source) count += 1;
	if (properties.tint) count += 1;
	return count;
}

/** Created and Updated, read off the item rather than stored a second time. */
export function timestamps(item: WhiteboardItem): { created: string; updated: string } {
	return { created: item.createdAt, updated: item.updatedAt };
}

export function formatStamp(iso: string): string {
	const when = new Date(iso);
	if (Number.isNaN(when.getTime())) return 'unknown';
	return when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
