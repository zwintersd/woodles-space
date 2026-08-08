// Arriving from another app, holding a reference.
//
// `/planner?thinking-about-entry=<id>` is what Thinking About's "find time for
// this" hands over. Carillon's answer is deliberately *what it already has*
// rather than a blank form: if a thing is already on Thursday, opening a
// composer would quietly invite a second copy of it, and the person asking
// "when am I doing this" would have to go looking for the answer they came for.
//
// So: existing commitments first, composing as an explicit second step, and
// the composer only opens on its own when there is genuinely nothing to show.

import { entityHref } from '@woodles/app-manifest';

/** The query parameter Carillon answers to — declared in the manifest. */
export const ARRIVAL_PARAM = 'thinking-about-entry';

export class Arrival {
	/** The Thinking About entry id we arrived holding, or null for an ordinary visit. */
	entryId = $state<string | null>(null);

	get active(): boolean {
		return this.entryId !== null;
	}

	/**
	 * Read the reference out of a URL. Returns the id so a caller can act on it
	 * without reaching into state, and takes a string rather than reading
	 * `location` so it is testable without a browser.
	 */
	static parse(url: string): string | null {
		try {
			const value = new URL(url, 'https://woodles.space').searchParams.get(ARRIVAL_PARAM);
			return value && value.trim() !== '' ? value : null;
		} catch {
			return null;
		}
	}

	open(entryId: string): void {
		this.entryId = entryId;
	}

	close(): void {
		this.entryId = null;
	}

	/**
	 * Take the reference out of the address bar once it has been handled, so a
	 * reload lands on Carillon rather than re-opening the arrival over whatever
	 * the person moved on to. Same `replaceState` housekeeping Write does after
	 * following a `?draft=` reference — the visit happened, the URL shouldn't
	 * keep re-enacting it.
	 */
	static clearFromAddressBar(): void {
		if (typeof window === 'undefined' || typeof history === 'undefined') return;
		const url = new URL(window.location.href);
		if (!url.searchParams.has(ARRIVAL_PARAM)) return;
		url.searchParams.delete(ARRIVAL_PARAM);
		history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
	}
}

/** The link back the other way, for a chip that names an entry. */
export function thinkingAboutEntryHref(entryId: string): string {
	return entityHref('thinking-about', 'entry', entryId);
}

export const arrival = new Arrival();
