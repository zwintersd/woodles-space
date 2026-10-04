import { describe, expect, it } from 'vitest';
import {
	CAPTURE_TARGETS,
	COMPANION_ORIGIN,
	COMPANION_PATH,
	MENU,
	captureFromMenu,
	captureKey,
	envelope,
	isExtensionOrigin,
	pageFromTab,
	pendingCaptures,
	readCapture,
	readMessage,
	safeUrl,
	targetForMenu,
	type CompanionMessage
} from '@extension/protocol.js';
import { HANDOFF_TARGETS } from '@woodles/handoff';
import { appById } from '@woodles/app-manifest';
import { readPanelMessage } from './bridge.svelte';
import extensionManifest from '../../extension/manifest.json';

const stamp = { id: 'c-1', now: '2026-10-04T12:00:00.000Z' };
const tab = { title: 'A good essay', url: 'https://example.com/essay' };
const extension = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

describe('the contract between shell and page', () => {
	it('round-trips every message kind', () => {
		const capture = captureFromMenu({ selectionText: 'a line' }, tab, 'write', stamp)!;
		for (const body of [
			{ kind: 'ready' },
			{ kind: 'hello', version: '0.1.0' },
			{ kind: 'page', page: { title: 'x', url: 'https://example.com/' } },
			{ kind: 'page', page: null },
			{ kind: 'capture', capture },
			{ kind: 'captured', id: 'c-1' }
		] satisfies CompanionMessage[]) {
			expect(readMessage(JSON.parse(JSON.stringify(envelope(body))))).toEqual(body);
		}
	});

	it('ignores other protocols, other versions, and unknown kinds', () => {
		expect(readMessage({ kind: 'ready' })).toBeNull();
		expect(readMessage({ ...envelope({ kind: 'ready' }), v: 2 })).toBeNull();
		expect(readMessage({ ...envelope({ kind: 'ready' }), protocol: 'other' })).toBeNull();
		expect(readMessage({ ...envelope({ kind: 'ready' }), kind: 'delete-everything' })).toBeNull();
		expect(readMessage('ready')).toBeNull();
	});

	it('sends only to targets the handoff spine receives', () => {
		expect([...CAPTURE_TARGETS].sort()).toEqual([...HANDOFF_TARGETS].sort());
		expect(MENU.map((item) => item.target).sort()).toEqual([...CAPTURE_TARGETS].sort());
	});

	it('points at the route the manifest says the companion lives on', () => {
		expect(COMPANION_PATH).toBe(appById.companion.publicPath);
	});

	it('holds host permission for exactly the origin it frames', () => {
		expect(extensionManifest.host_permissions).toEqual([`${COMPANION_ORIGIN}/*`]);
		expect(extensionManifest.side_panel.default_path).toBe('panel.html');
	});
});

describe('urls', () => {
	it('keeps http(s) and drops everything a click could turn against the site', () => {
		expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
		expect(safeUrl('http://example.com')).toBe('http://example.com/');
		for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'chrome://settings', 'file:///etc/passwd', 'not a url', 42]) {
			expect(safeUrl(bad)).toBeNull();
		}
	});

	it('names only pages worth naming', () => {
		expect(pageFromTab(tab)).toEqual(tab);
		expect(pageFromTab({ title: '', url: 'https://example.com/x' })).toEqual({ title: 'example.com', url: 'https://example.com/x' });
		expect(pageFromTab({ title: 'New Tab', url: 'chrome://newtab/' })).toBeNull();
		expect(pageFromTab(undefined)).toBeNull();
	});
});

describe('captures from the page menu', () => {
	it('prefers a selection, then a link, then an image, then the page', () => {
		const all = { selectionText: ' a line ', linkUrl: 'https://l.example/', srcUrl: 'https://i.example/a.png', mediaType: 'image' };
		expect(captureFromMenu(all, tab, 'write', stamp)).toMatchObject({ kind: 'selection', text: 'a line', url: '' });
		expect(captureFromMenu({ ...all, selectionText: '' }, tab, 'write', stamp)).toMatchObject({ kind: 'link', url: 'https://l.example/' });
		expect(captureFromMenu({ srcUrl: all.srcUrl, mediaType: 'image' }, tab, 'write', stamp)).toMatchObject({ kind: 'image', url: all.srcUrl });
		expect(captureFromMenu({}, tab, 'whiteboard', stamp)).toMatchObject({ kind: 'page', url: tab.url, page: tab, target: 'whiteboard' });
	});

	it('skips a link it would not keep and falls through to the page', () => {
		expect(captureFromMenu({ linkUrl: 'javascript:void(0)' }, tab, 'write', stamp)).toMatchObject({ kind: 'page' });
	});

	it('keeps a selection from a page it will not name, without the page', () => {
		const local = { title: 'notes', url: 'file:///home/notes.html' };
		expect(captureFromMenu({ selectionText: 'kept anyway' }, local, 'write', stamp)).toMatchObject({ kind: 'selection', page: null });
		expect(captureFromMenu({}, local, 'write', stamp)).toBeNull();
	});

	it('cuts a long selection rather than refusing it', () => {
		const capture = captureFromMenu({ selectionText: 'x'.repeat(9000) }, tab, 'write', stamp);
		expect(capture?.text.length).toBe(5000);
	});

	it('refuses a capture missing the thing its kind is about', () => {
		const base = { id: 'c', target: 'write', page: tab, createdAt: stamp.now, text: '', url: '' };
		expect(readCapture({ ...base, kind: 'selection' })).toBeNull();
		expect(readCapture({ ...base, kind: 'link' })).toBeNull();
		expect(readCapture({ ...base, kind: 'page', page: null })).toBeNull();
		expect(readCapture({ ...base, kind: 'page', target: 'notebook' })).toBeNull();
	});

	it('knows its own menu items and no one else’s', () => {
		expect(targetForMenu('woodles-keep-write')).toBe('write');
		expect(targetForMenu('woodles-keep-whiteboard')).toBe('whiteboard');
		expect(targetForMenu('someone-else')).toBeNull();
	});

	it('reads pending captures out of session storage, oldest first', () => {
		const later = captureFromMenu({}, tab, 'write', { id: 'b', now: '2026-10-04T12:05:00.000Z' });
		const earlier = captureFromMenu({}, tab, 'write', { id: 'a', now: '2026-10-04T12:01:00.000Z' });
		const items = { [captureKey('b')]: later, [captureKey('a')]: earlier, unrelated: 1, [captureKey('junk')]: { id: 'junk' } };
		expect(pendingCaptures(items).map((capture) => capture.id)).toEqual(['a', 'b']);
	});
});

describe('who the page listens to', () => {
	const parent = {};
	const data = envelope({ kind: 'hello', version: '0.1.0' });

	it('takes messages from its own parent, when that parent is an extension page', () => {
		expect(readPanelMessage({ source: parent, origin: extension, data }, parent)).toEqual({ kind: 'hello', version: '0.1.0' });
	});

	it('ignores another window, a website, or a malformed origin', () => {
		expect(readPanelMessage({ source: {}, origin: extension, data }, parent)).toBeNull();
		expect(readPanelMessage({ source: parent, origin: 'https://example.com', data }, parent)).toBeNull();
		expect(readPanelMessage({ source: parent, origin: 'chrome-extension://short', data }, parent)).toBeNull();
		expect(isExtensionOrigin(`${extension}.evil.example`)).toBe(false);
	});
});
