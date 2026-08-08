// Opening the board on one entry.
//
// `/thinking-about?entry=<id>` is what Carillon's "about <title>" link hands
// over. The board's own view state is deliberately transient — it always
// starts on the board, nothing is persisted — and this doesn't change that:
// a deep link is a one-time instruction, read once on load and then taken out
// of the address bar so a reload lands on the board like any other visit.

import { entityHref } from '@woodles/app-manifest';

/** The query parameter Thinking About answers to — declared in the manifest. */
export const ENTRY_PARAM = 'entry';

/**
 * The entry id in a URL, or null. Takes a string rather than reading
 * `location` so it is testable without a browser.
 */
export function parseEntryLink(url: string): string | null {
	try {
		const value = new URL(url, 'https://woodles.space').searchParams.get(ENTRY_PARAM);
		return value && value.trim() !== '' ? value : null;
	} catch {
		return null;
	}
}

/** Drop the parameter once it has been acted on. */
export function clearEntryLinkFromAddressBar(): void {
	if (typeof window === 'undefined' || typeof history === 'undefined') return;
	const url = new URL(window.location.href);
	if (!url.searchParams.has(ENTRY_PARAM)) return;
	url.searchParams.delete(ENTRY_PARAM);
	history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

/** Where "find time for this" goes. */
export function findTimeHref(entryId: string): string {
	return entityHref('planner', 'thinking-about-entry', entryId);
}
