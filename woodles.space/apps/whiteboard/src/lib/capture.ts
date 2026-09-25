import { appManifest } from '@woodles/app-manifest';
import { insertCardIntoStack, STACK_GAP } from './geometry';
import { setProperty } from './properties';
import {
	createCard,
	createStack,
	makeId,
	nextZ,
	now,
	type CardItem,
	type StackItem,
	type WhiteboardDocument,
	type WhiteboardItem
} from './model';

/** A Woodles address a captured link turned out to be. */
export type WoodleRef = {
	appId: string;
	appName: string;
	/** The record kind and id, when the link addresses one thing inside the app. */
	kind: string | null;
	recordId: string | null;
};

export type CaptureItem =
	| { kind: 'link'; url: string; title: string; host: string; woodle: WoodleRef | null }
	| { kind: 'note'; title: string; body: string };

const WOODLES_HOSTS = ['woodles.space'];

/** Lower-cased, without `www.` and without a port, so callers may pass either. */
function bareHost(value: string): string {
	return value.toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '');
}

function isWoodlesHost(hostname: string, extra: string[]): boolean {
	const host = bareHost(hostname);
	return WOODLES_HOSTS.includes(host) || extra.some((candidate) => bareHost(candidate) === host);
}

export function parseUrl(text: string): URL | null {
	const trimmed = text.trim();
	if (!/^https?:\/\/\S+$/i.test(trimmed)) return null;
	try {
		const url = new URL(trimmed);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
	} catch {
		return null;
	}
}

/**
 * Which app in the workspace a link points at, and which record inside it.
 *
 * The manifest already owns every app's public path and the record kinds it
 * answers to, so a Woodles link resolves to a real identity with no lookup and
 * no network. This is the one place a "rich" preview can be genuinely rich.
 */
export function resolveWoodle(url: URL, sameOriginHosts: string[] = []): WoodleRef | null {
	if (!isWoodlesHost(url.hostname, sameOriginHosts)) return null;
	const path = url.pathname.replace(/\/+$/, '') || '/';

	// Longest match wins, so `/hygge/motion` resolves to Hygge rather than to
	// the landing page at `/`.
	let best: (typeof appManifest)[number] | null = null;
	for (const app of appManifest) {
		const routes = [app.publicPath, ...(app.aliases ?? [])];
		for (const route of routes) {
			const matches = route === '/' ? path === '/' : path === route || path.startsWith(`${route}/`);
			if (matches && (!best || route.length > best.publicPath.length)) best = app;
		}
	}
	if (!best) return null;

	let kind: string | null = null;
	let recordId: string | null = null;
	for (const candidate of best.addressableBy ?? []) {
		const value = url.searchParams.get(candidate);
		if (value) {
			kind = candidate;
			recordId = value;
			break;
		}
	}
	return { appId: best.id, appName: best.name, kind, recordId };
}

/**
 * A readable name for a link, without asking the network for one.
 *
 * There is no server here, so a page's real title cannot be fetched — what a
 * link can be called honestly is what its own address already says. A Woodles
 * link says the most: the app it belongs to, by name.
 */
export function titleForUrl(url: URL, woodle: WoodleRef | null): string {
	if (woodle) {
		return woodle.recordId ? `${woodle.appName} · ${woodle.kind}` : woodle.appName;
	}
	const segments = url.pathname.split('/').filter(Boolean);
	const last = segments[segments.length - 1];
	if (!last) return hostOf(url);
	const cleaned = decodeURIComponent(last)
		.replace(/\.[a-z0-9]{1,5}$/i, '')
		.replace(/[-_+]+/g, ' ')
		.trim();
	return cleaned || hostOf(url);
}

export function hostOf(url: URL): string {
	return url.hostname.replace(/^www\./, '');
}

export function describeLink(text: string, sameOriginHosts: string[] = []): CaptureItem | null {
	const url = parseUrl(text);
	if (!url) return null;
	const woodle = resolveWoodle(url, sameOriginHosts);
	return { kind: 'link', url: url.href, title: titleForUrl(url, woodle), host: hostOf(url), woodle };
}

/**
 * What a piece of pasted or dropped text most usefully becomes.
 *
 * The rules are the ones a person would apply without thinking: a URL is a
 * link; a page of URLs is that many links; anything else is a note, with its
 * first line as the title because that is how people write. Nothing is asked.
 */
export function inferCapture(text: string, sameOriginHosts: string[] = []): CaptureItem[] {
	const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	if (!lines.length) return [];

	const links = lines.map((line) => describeLink(line, sameOriginHosts));
	if (links.every((link) => link !== null)) return links as CaptureItem[];

	const [title, ...rest] = lines;
	return [{ kind: 'note', title, body: rest.join('\n') }];
}

/** A captured thing, as a card. A link is a card that knows where it came from. */
export function cardFor(item: CaptureItem, x: number, y: number, zIndex: number): CardItem {
	const card = { ...createCard(x, y, zIndex), title: item.title };
	if (item.kind === 'note') return { ...card, body: item.body };

	// A link is not a new kind of object. It is a card whose Source is the link
	// — the property that has meant "where this came from" since it existed.
	let described: WhiteboardItem = setProperty(card, 'source', item.url);
	described = setProperty(described, 'kind', item.woodle ? item.woodle.appName.toLowerCase() : 'link');
	return described as CardItem;
}

export const INBOX_TITLE = 'Inbox';

export function findInbox(document: WhiteboardDocument): StackItem | null {
	return document.items.find(
		(item): item is StackItem => item.type === 'stack' && item.title.trim().toLowerCase() === INBOX_TITLE.toLowerCase()
	) ?? null;
}

/**
 * The Inbox, made if this board has not needed one yet. It is an ordinary
 * stack — nothing about it is a special case, so it can be moved, renamed,
 * given a behaviour, or emptied by dragging its cards out onto the board.
 * That is what makes "capture first, organize when ready" cost nothing.
 */
export function ensureInbox(document: WhiteboardDocument, at: { x: number; y: number }): { document: WhiteboardDocument; stack: StackItem } {
	const existing = findInbox(document);
	if (existing) return { document, stack: existing };
	const stack: StackItem = { ...createStack(at.x, at.y, nextZ(document.items)), id: makeId('stack'), title: INBOX_TITLE };
	return { document: { ...document, items: [...document.items, stack] }, stack };
}

/** Captured material, laid out on the board where it was put down. */
export function captureAt(
	document: WhiteboardDocument,
	items: CaptureItem[],
	at: { x: number; y: number }
): { document: WhiteboardDocument; ids: string[] } {
	const made = items.map((item, index) =>
		cardFor(item, at.x + index * 26, at.y + index * 26, nextZ(document.items) + index)
	);
	return { document: { ...document, items: [...document.items, ...made] }, ids: made.map((card) => card.id) };
}

/** Captured material, put in the Inbox to be placed later. */
export function captureToInbox(
	document: WhiteboardDocument,
	items: CaptureItem[],
	near: { x: number; y: number }
): { document: WhiteboardDocument; ids: string[]; stackId: string } {
	const { document: withInbox, stack } = ensureInbox(document, near);
	const placed = captureAt(withInbox, items, { x: stack.x + STACK_GAP, y: stack.y + STACK_GAP });
	const filed = placed.ids.reduce(
		(next, cardId) => insertCardIntoStack(next, cardId, stack.id),
		placed.document
	);
	return { document: { ...filed, updatedAt: now() }, ids: placed.ids, stackId: stack.id };
}
