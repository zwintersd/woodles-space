// The side panel: a frame around woodles.space/companion, and the bridge that
// tells it which page you're on and what you kept from the page menu. The page
// does everything with the site's storage; this only carries messages. See
// ../DESIGN.md for why the split falls here.

import {
	CAPTURE_KEY_PREFIX,
	COMPANION_ORIGIN,
	COMPANION_URL,
	captureKey,
	envelope,
	pageFromTab,
	pendingCaptures,
	readMessage
} from './protocol.js';

/** How long the page gets to say `ready` before the panel admits it isn't coming. */
const READY_TIMEOUT_MS = 8000;

const frame = /** @type {HTMLIFrameElement} */ (document.getElementById('companion'));
const waiting = /** @type {HTMLElement} */ (document.getElementById('waiting'));
const status = /** @type {HTMLElement} */ (document.getElementById('status'));
const pendingNote = /** @type {HTMLElement} */ (document.getElementById('pending'));
const retry = /** @type {HTMLButtonElement} */ (document.getElementById('retry'));

let ready = false;
let timer = 0;
/** @type {number | undefined} */ let windowId;
/** @type {number | undefined} */ let activeTabId;
/** The last page sent, so a burst of tab updates sends one message. */
let lastPage = '';

function load() {
	ready = false;
	frame.hidden = true;
	waiting.hidden = false;
	waiting.classList.remove('stalled');
	retry.hidden = true;
	status.textContent = 'opening woodles…';
	frame.src = COMPANION_URL;
	clearTimeout(timer);
	timer = setTimeout(unreachable, navigator.onLine ? READY_TIMEOUT_MS : 0);
}

async function unreachable() {
	if (ready) return;
	status.textContent = 'woodles.space didn’t answer.';
	waiting.classList.add('stalled');
	retry.hidden = false;
	await showPending();
}

async function showPending() {
	const count = pendingCaptures(await chrome.storage.session.get(null)).length;
	pendingNote.hidden = count === 0;
	pendingNote.textContent =
		count === 1
			? 'one thing you kept is waiting here, and goes through when it does.'
			: `${count} things you kept are waiting here, and go through when it does.`;
}

/** @param {import('./protocol.js').CompanionMessage} body */
function post(body) {
	if (!ready || !frame.contentWindow) return;
	// Never '*': if the frame has wandered off woodles.space, this is dropped.
	frame.contentWindow.postMessage(envelope(body), COMPANION_ORIGIN);
}

async function sendPage() {
	if (windowId === undefined) return;
	const [tab] = await chrome.tabs.query({ active: true, windowId });
	activeTabId = tab?.id;
	const page = pageFromTab(tab);
	const key = JSON.stringify(page);
	if (!ready || key === lastPage) return;
	lastPage = key;
	post({ kind: 'page', page });
}

/** @param {Record<string, unknown>} items */
function deliver(items) {
	for (const capture of pendingCaptures(items)) post({ kind: 'capture', capture });
}

window.addEventListener('message', (event) => {
	if (event.source !== frame.contentWindow || event.origin !== COMPANION_ORIGIN) return;
	const message = readMessage(event.data);
	if (!message) return;

	if (message.kind === 'ready') {
		// Also arrives when the page reloads itself — the handshake starts over.
		ready = true;
		clearTimeout(timer);
		waiting.hidden = true;
		frame.hidden = false;
		lastPage = '';
		post({ kind: 'hello', version: chrome.runtime.getManifest().version });
		sendPage();
		chrome.storage.session.get(null).then(deliver);
	} else if (message.kind === 'captured') {
		chrome.storage.session.remove(captureKey(message.id));
	}
});

chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== 'session') return;
	/** @type {Record<string, unknown>} */
	const added = {};
	for (const [key, change] of Object.entries(changes)) {
		if (key.startsWith(CAPTURE_KEY_PREFIX) && change.newValue !== undefined) added[key] = change.newValue;
	}
	if (Object.keys(added).length === 0) return;
	if (ready) deliver(added);
	else showPending();
});

chrome.tabs.onActivated.addListener((info) => {
	if (info.windowId === windowId) sendPage();
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
	if (tabId === activeTabId && (info.url !== undefined || info.title !== undefined)) sendPage();
});

chrome.windows.getCurrent().then((win) => {
	windowId = win.id;
	sendPage();
});

retry.addEventListener('click', load);
window.addEventListener('online', () => {
	if (!ready) load();
});

load();
