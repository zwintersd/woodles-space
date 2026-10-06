// @ts-check

/**
 * The companion's one contract: what the Chrome extension (the shell, this
 * directory) and the `/companion` page it frames say to each other.
 *
 * Plain browser JS with checked JSDoc, close to the shape `@woodles/life-points`
 * takes for the same reason — one side has no build. The extension loads this
 * file as-is; the page imports it through Vite and svelte-check reads the
 * JSDoc. One definition, so the two halves cannot drift and nothing has to
 * pin them together.
 *
 * Nothing here touches `chrome.*` or the DOM, so all of it runs under vitest
 * from `apps/companion/src/lib/protocol.test.ts`. See ../DESIGN.md.
 */

export const PROTOCOL = 'woodles-companion';
export const PROTOCOL_VERSION = 1;

/** Where the shell's frame points. The extension's host permission must match. */
export const COMPANION_ORIGIN = 'https://woodles.space';
export const COMPANION_PATH = '/companion';
/** `?panel=1` lets the page lay out for the side panel before `hello` arrives. */
export const COMPANION_URL = `${COMPANION_ORIGIN}${COMPANION_PATH}?panel=1`;

/** The handoff receivers the page menu can send to — `HANDOFF_TARGETS` in `@woodles/handoff`. */
export const CAPTURE_TARGETS = /** @type {const} */ (['write', 'whiteboard', 'thinking-about']);

/** What was right-clicked. `page` means nothing more specific was. */
export const CAPTURE_KINDS = /** @type {const} */ (['selection', 'link', 'image', 'page']);

/**
 * Page-menu items, one per target. Chrome groups them under the extension's
 * name. `contexts` are Chrome's own names, all of them capture kinds.
 *
 * @type {readonly { id: string, target: CaptureTarget, title: string, contexts: [CaptureKind, ...CaptureKind[]] }[]}
 */
export const MENU = Object.freeze([
	{ id: 'woodles-keep-write', target: 'write', title: 'keep in write', contexts: ['selection', 'link', 'image', 'page'] },
	{ id: 'woodles-keep-whiteboard', target: 'whiteboard', title: 'pin to a board', contexts: ['selection', 'link', 'image', 'page'] },
	// A picture on its own isn't something being read — right-click the page around it.
	{ id: 'woodles-keep-thinking-about', target: 'thinking-about', title: 'add to thinking about', contexts: ['selection', 'link', 'page'] }
]);

/** A selection longer than this is cut, not refused — the start is what someone chose. */
export const MAX_TEXT = 5000;
const MAX_TITLE = 300;
const MAX_URL = 2048;

/** Session-storage key prefix for captures the page has not acknowledged yet. */
export const CAPTURE_KEY_PREFIX = 'capture:';

/**
 * @typedef {(typeof CAPTURE_TARGETS)[number]} CaptureTarget
 * @typedef {(typeof CAPTURE_KINDS)[number]} CaptureKind
 * @typedef {{ title: string, url: string }} PageContext
 * @typedef {{
 *   id: string,
 *   target: CaptureTarget,
 *   kind: CaptureKind,
 *   text: string,
 *   url: string,
 *   page: PageContext | null,
 *   createdAt: string
 * }} Capture
 * @typedef {(
 *   | { kind: 'ready' }
 *   | { kind: 'hello', version: string }
 *   | { kind: 'page', page: PageContext | null }
 *   | { kind: 'capture', capture: Capture }
 *   | { kind: 'captured', id: string }
 * )} CompanionMessage
 */

/**
 * Wrap a message for `postMessage`.
 *
 * @param {CompanionMessage} body
 */
export function envelope(body) {
	return { protocol: PROTOCOL, v: PROTOCOL_VERSION, ...body };
}

/**
 * Read whatever arrived over `postMessage`. Null for anything that is not a
 * well-formed message of this protocol and version — a newer shell talking to
 * an older page, or the reverse, is ignored rather than half-understood.
 *
 * @param {unknown} data
 * @returns {CompanionMessage | null}
 */
export function readMessage(data) {
	if (!isRecord(data) || data.protocol !== PROTOCOL || data.v !== PROTOCOL_VERSION) return null;
	switch (data.kind) {
		case 'ready':
			return { kind: 'ready' };
		case 'hello':
			return typeof data.version === 'string' ? { kind: 'hello', version: data.version } : null;
		case 'page':
			return data.page === null ? { kind: 'page', page: null } : mapOrNull(readPage(data.page), (page) => ({ kind: 'page', page }));
		case 'capture':
			return mapOrNull(readCapture(data.capture), (capture) => ({ kind: 'capture', capture }));
		case 'captured':
			return typeof data.id === 'string' && data.id ? { kind: 'captured', id: data.id } : null;
		default:
			return null;
	}
}

/**
 * An http(s) URL, or null. Everything else — `javascript:`, `data:`,
 * `chrome:`, `file:` — stops here, because a captured URL rides into Write
 * as an `href` and into a Whiteboard card as text someone may click.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function safeUrl(value) {
	if (typeof value !== 'string' || value.length > MAX_URL) return null;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
	} catch {
		return null;
	}
}

/**
 * @param {unknown} value
 * @returns {PageContext | null}
 */
export function readPage(value) {
	if (!isRecord(value)) return null;
	const url = safeUrl(value.url);
	if (!url) return null;
	const title = clean(value.title, MAX_TITLE) || new URL(url).hostname;
	return { title, url };
}

/**
 * The page a tab is showing, if it is one worth naming — an http(s) page.
 * A new-tab page, `chrome://` settings, or a local file is null: the panel
 * then offers to keep a thought, not the page.
 *
 * @param {{ title?: string, url?: string } | undefined | null} tab
 * @returns {PageContext | null}
 */
export function pageFromTab(tab) {
	return tab ? readPage({ title: tab.title, url: tab.url }) : null;
}

/**
 * @param {unknown} value
 * @returns {Capture | null}
 */
export function readCapture(value) {
	if (!isRecord(value)) return null;
	if (typeof value.id !== 'string' || !value.id) return null;
	if (!CAPTURE_TARGETS.includes(/** @type {CaptureTarget} */ (value.target))) return null;
	if (!CAPTURE_KINDS.includes(/** @type {CaptureKind} */ (value.kind))) return null;
	if (typeof value.createdAt !== 'string') return null;
	const kind = /** @type {CaptureKind} */ (value.kind);
	const page = value.page === null ? null : readPage(value.page);
	const text = clean(value.text, MAX_TEXT);
	const url = safeUrl(value.url) ?? '';
	// Each kind has to carry the one thing it is about.
	if (kind === 'selection' && !text) return null;
	if ((kind === 'link' || kind === 'image') && !url) return null;
	if (kind === 'page' && !page) return null;
	return {
		id: value.id,
		target: /** @type {CaptureTarget} */ (value.target),
		kind,
		text,
		url: kind === 'page' && page ? page.url : url,
		page,
		createdAt: value.createdAt
	};
}

/**
 * Which target a page-menu item sends to, or null for an id that is not ours.
 *
 * @param {unknown} menuItemId
 * @returns {CaptureTarget | null}
 */
export function targetForMenu(menuItemId) {
	return MENU.find((entry) => entry.id === menuItemId)?.target ?? null;
}

/**
 * Build a capture from a page-menu click. The most specific thing that was
 * right-clicked wins: a selection over the link it sits in, a link over the
 * image inside it, any of those over the page — skipping any kind the target's
 * menu item leaves out, which Chrome can still hand over (an image inside a
 * link shows every item that takes links). Null when there is nothing worth
 * keeping (a menu click on a page the protocol won't name).
 *
 * @param {{ selectionText?: string, linkUrl?: string, srcUrl?: string, mediaType?: string, pageUrl?: string }} info
 * @param {{ title?: string, url?: string } | undefined | null} tab
 * @param {CaptureTarget} target
 * @param {{ id: string, now: string }} stamp
 * @returns {Capture | null}
 */
export function captureFromMenu(info, tab, target, stamp) {
	const page = pageFromTab(tab) ?? readPage({ title: '', url: info.pageUrl });
	/** @type {readonly CaptureKind[]} */
	const allowed = MENU.find((item) => item.target === target)?.contexts ?? CAPTURE_KINDS;
	/** @type {Pick<Capture, 'kind' | 'text' | 'url'>} */
	let what;
	if (allowed.includes('selection') && clean(info.selectionText, MAX_TEXT)) what = { kind: 'selection', text: info.selectionText ?? '', url: '' };
	else if (allowed.includes('link') && safeUrl(info.linkUrl)) what = { kind: 'link', text: '', url: info.linkUrl ?? '' };
	else if (allowed.includes('image') && info.mediaType === 'image' && safeUrl(info.srcUrl)) what = { kind: 'image', text: '', url: info.srcUrl ?? '' };
	else what = { kind: 'page', text: '', url: page?.url ?? '' };
	return readCapture({ id: stamp.id, target, ...what, page, createdAt: stamp.now });
}

/** @param {string} id */
export function captureKey(id) {
	return CAPTURE_KEY_PREFIX + id;
}

/**
 * The captures waiting in a `chrome.storage.session` snapshot, oldest first.
 * One key per capture, so the worker adding one and the panel removing
 * another never read-modify-write the same value.
 *
 * @param {Record<string, unknown>} items
 * @returns {Capture[]}
 */
export function pendingCaptures(items) {
	return Object.entries(items)
		.filter(([key]) => key.startsWith(CAPTURE_KEY_PREFIX))
		.map(([, value]) => readCapture(value))
		.filter(/** @returns {capture is Capture} */ (capture) => capture !== null)
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** A fresh capture id. Also used as the handoff's id, which is what makes redelivery safe. */
export function newCaptureId() {
	return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Whether a `postMessage` origin is an extension page — the only thing the
 * companion page will take messages from. Not the security boundary (see
 * DESIGN.md, "trust"); a check that the message is the kind it claims to be.
 *
 * @param {string} origin
 */
export function isExtensionOrigin(origin) {
	return /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}

// ── helpers ─────────────────────────────────────────────────────────────

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Trimmed, length-capped text; empty for anything that is not a string.
 *
 * @param {unknown} value
 * @param {number} max
 */
function clean(value, max) {
	return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * @template T, U
 * @param {T | null} value
 * @param {(value: T) => U} fn
 * @returns {U | null}
 */
function mapOrNull(value, fn) {
	return value === null ? null : fn(value);
}
