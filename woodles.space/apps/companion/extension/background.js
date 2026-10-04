// The service worker: opens the panel, and turns a page-menu click into a
// capture the panel will hand to the companion page. It never talks to
// woodles.space itself — only the page in the panel's frame can reach the
// site's storage. See ../DESIGN.md.

import { MENU, captureFromMenu, captureKey, newCaptureId, targetForMenu } from './protocol.js';

// Persisted by Chrome, but cheap to repeat on every start.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.removeAll(() => {
		for (const item of MENU) {
			chrome.contextMenus.create({
				id: item.id,
				title: item.title,
				contexts: ['selection', 'link', 'image', 'page']
			});
		}
	});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	const target = targetForMenu(info.menuItemId);
	if (!target || !tab) return;

	// First, before any await: `sidePanel.open` only works inside the click's
	// user gesture, and awaiting anything ahead of it loses the gesture.
	if (tab.windowId !== undefined) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});

	const capture = captureFromMenu(info, tab, target, { id: newCaptureId(), now: new Date().toISOString() });
	// The panel may already be listening, or may load after this lands; it
	// reads pending captures on `ready` and on every change, so either order works.
	if (capture) chrome.storage.session.set({ [captureKey(capture.id)]: capture });
});

chrome.commands.onCommand.addListener((command, tab) => {
	if (command !== 'open-companion' || tab?.windowId === undefined) return;
	chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
});
