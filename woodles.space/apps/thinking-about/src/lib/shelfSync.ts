// Publishing the shelf to the sync server, so a reader on another device sees
// it without Thinking About ever having been opened there.
//
// The machinery — push-only, version cache, deduplication, one retry on a
// compare-and-swap rejection, and never throwing — lives in @woodles/sync's
// `createLedgerPublisher`, extracted once Carillon's commitments ledger needed
// exactly the same of it. What stays here is only what is specific to this
// ledger: which app key it publishes under, and what counts as a change.

import {
	createLedgerPublisher,
	THINKING_ABOUT_SHELF_APP,
	type LedgerPublishResult,
	type ThinkingAboutShelfBlob
} from '@woodles/sync';
import { shelvesMatch } from './shelf';

const publisher = createLedgerPublisher<ThinkingAboutShelfBlob>({
	app: THINKING_ABOUT_SHELF_APP,
	matches: shelvesMatch
});

export type ShelfPublishResult = LedgerPublishResult;

/** Publish one shelf snapshot. Never throws. */
export function publishShelf(blob: ThinkingAboutShelfBlob): Promise<ShelfPublishResult> {
	return publisher.publish(blob);
}

/** Test seam — the publisher's cache would otherwise leak between cases. */
export function resetPublishedShelfCache(): void {
	publisher.reset();
}
