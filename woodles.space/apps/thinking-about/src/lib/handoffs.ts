// Taking what was handed over — the handoff spine's third receiver.
//
// The companion (apps/companion) sends a page, a line from one, or a link to
// "add to thinking about", and it arrives here as an ordinary entry in
// Reading · Articles, to be moved from there. Three things shape the take:
//
//   - An arrival moves the board's `updatedAt`, and hydrate keeps whichever
//     whole board is newer with no merge. So a take only ever runs right
//     after a hydrate that went through, or on a board with no sync at all —
//     never before one, never after a failed one, never during one. Taking
//     earlier would make a possibly stale board look newest and push it over
//     another device's.
//   - The entry takes the handoff's own id, the same move `sittings.ts` makes
//     with the ledger's, which is also what lets a link name the arrival.
//   - The ids already taken are kept in this browser only, because the queue
//     they came from is too: a deleted arrival stays deleted through drain's
//     `cleared: false`, a capture the companion redelivers, or the queue
//     restored from its persistence backup — all of which happen only here.

import {
	QUEUE_LIMIT,
	createHandoffQueue,
	handoffKey,
	type Handoff,
	type HandoffOptions
} from '@woodles/handoff';
import { htmlToText } from '@woodles/text';
import { columnLabel, sectionLabel } from './constants';
import { blankEntry } from './entries';
import type { ThinkingAboutEntry } from './types';

/** Where every arrival lands. A wrong guess costs one change of section. */
export const ARRIVAL = { columnKey: 'reading', sectionKey: 'article' } as const;

/** The queue this board drains — a `storage` event on it means something arrived. */
export const ARRIVALS_KEY = handoffKey('thinking-about');

/**
 * Never blank: an untitled entry is swept on close (`isUntouched`) and left off
 * the shelf, so an arrival without a title would quietly disappear.
 */
export function arrivalTitle(item: Handoff): string {
	const firstLine = bodyText(item).split('\n')[0].trim();
	return (
		item.title.trim() ||
		item.source.label?.trim() ||
		(firstLine.length > 80 ? firstLine.slice(0, 79) + '…' : firstLine) ||
		hostOf(item.source.href) ||
		'something kept'
	);
}

/**
 * The entry an arrival becomes. Notes are the body, then the link back — the
 * board has no link field, and notes are private (the shelf never copies
 * them). A body that only repeats the title is left out, and so is a link the
 * body already holds.
 */
export function entryFromHandoff(item: Handoff, stamp: string): ThinkingAboutEntry {
	const title = arrivalTitle(item);
	const text = bodyText(item);
	const href = item.source.href?.trim() ?? '';
	const notes = [text === title ? '' : text, href && !text.includes(href) ? href : '']
		.filter(Boolean)
		.join('\n\n');
	// When it was kept, not when the board got round to taking it.
	const kept = Number.isFinite(Date.parse(item.createdAt)) ? new Date(item.createdAt).toISOString() : stamp;
	return {
		...blankEntry(ARRIVAL.columnKey, ARRIVAL.sectionKey, title),
		id: item.id,
		notes,
		dateStarted: kept.slice(0, 10),
		createdAt: kept,
		updatedAt: stamp
	};
}

export type HandoffIngest = {
	entries: ThinkingAboutEntry[];
	/** Ids taken in this browser, newest last, at most `QUEUE_LIMIT`. */
	ingested: string[];
	/** Entries that landed. */
	added: number;
	/** Ids newly recorded, landed or not — zero means nothing to save. */
	accounted: number;
};

/**
 * Fold arrivals into the board, newest on top. An id already taken, or
 * already on the board, is recorded and skipped; a batch with nothing new
 * returns the same `entries` and `accounted: 0`, so the caller writes nothing.
 */
export function ingestHandoffs(
	entries: ThinkingAboutEntry[],
	items: Handoff[],
	alreadyIngested: string[],
	now: () => string
): HandoffIngest {
	const accounted = new Set(alreadyIngested);
	const onBoard = new Set(entries.map((entry) => entry.id));
	const newlyAccounted: string[] = [];
	const fresh: ThinkingAboutEntry[] = [];
	const stamp = now();

	for (const item of items) {
		if (accounted.has(item.id)) continue;
		accounted.add(item.id);
		newlyAccounted.push(item.id);
		if (onBoard.has(item.id)) continue;
		fresh.push(entryFromHandoff(item, stamp));
	}

	if (newlyAccounted.length === 0) return { entries, ingested: alreadyIngested, added: 0, accounted: 0 };
	return {
		entries: fresh.length > 0 ? [...fresh.reverse(), ...entries] : entries,
		// A queue never holds more than QUEUE_LIMIT, and ids are recorded in
		// queue order, so the newest QUEUE_LIMIT cover anything that can return.
		ingested: [...alreadyIngested, ...newlyAccounted].slice(-QUEUE_LIMIT),
		added: fresh.length,
		accounted: newlyAccounted.length
	};
}

/** What a take needs to know about sync — `syncState`, read-only. */
export type SyncGate = {
	readonly status: 'idle' | 'ok' | 'error';
	readonly syncing: boolean;
	readonly connected: boolean;
};

/**
 * Drain and ingest, unless sync says the board might be stale: a hydrate that
 * failed (`error`) or one still running. Then the queue is left alone, the
 * companion keeps counting it as waiting, a later take picks it up, and this
 * returns null — held back, as opposed to a take that ran and found nothing.
 * `cleared: false` is ignored — the ledger is what stops a second landing.
 */
export function takeHandoffs(
	sync: SyncGate,
	ingest: (items: Handoff[]) => number,
	options: HandoffOptions = {}
): number | null {
	if (sync.status === 'error' || sync.syncing) return null;
	const { items } = createHandoffQueue('thinking-about', options).drain();
	return items.length > 0 ? ingest(items) : 0;
}

/**
 * The two moments a take happens: once the load's sync settles, and live —
 * when the queue changes in another tab, or the board regains focus. A live
 * take catches up with the server first, so it is exactly a reload's
 * hydrate-then-take and never lands on a copy that went stale while open.
 *
 * `onFirstTake` runs once, after the first take that wasn't held back — the
 * moment a held `?entry=` link can be settled. A load whose sync failed
 * doesn't count, so the link waits for the live take that lands the arrival.
 */
export function createArrivals({
	sync,
	catchUp,
	ingest,
	onFirstTake,
	options = {}
}: {
	sync: SyncGate;
	catchUp: () => Promise<void>;
	ingest: (items: Handoff[]) => number;
	onFirstTake?: () => void;
	options?: HandoffOptions;
}) {
	let settled = false;
	let busy = false;
	let taken = false;

	function take(): number {
		const landed = takeHandoffs(sync, ingest, options);
		if (landed === null) return 0;
		if (!taken) {
			taken = true;
			onFirstTake?.();
		}
		return landed;
	}

	return {
		takeAfterLoadSync(): number {
			settled = true;
			return take();
		},

		async live(): Promise<number> {
			if (!settled || busy || sync.syncing) return 0;
			// Nothing waiting means no reason to touch the network on every focus.
			if (createHandoffQueue('thinking-about', options).count() === 0) return 0;
			busy = true;
			try {
				if (sync.connected) await catchUp();
				return take();
			} catch {
				return 0;
			} finally {
				busy = false;
			}
		}
	};
}

/** Said once, after a take that landed something — Whiteboard's wording, this board's place. */
export function arrivalNotice(count: number): string {
	return `${count} handed over from elsewhere, in ${columnLabel(ARRIVAL.columnKey)} · ${sectionLabel(ARRIVAL.sectionKey)}.`;
}

function bodyText(item: Handoff): string {
	return (item.format === 'html' ? htmlToText(item.body) : item.body).trim();
}

function hostOf(href: string | undefined): string {
	if (!href) return '';
	try {
		return new URL(href).hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
}
