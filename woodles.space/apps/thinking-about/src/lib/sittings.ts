// Taking sittings from Carillon's ledger.
//
// Carillon offers, a person accepts there, and the accepted ones arrive here.
// This is the half that gives a Thinking About session something it has never
// had: a date that isn't necessarily today. `logSession` always means "now",
// so a Sunday afternoon of reading recalled on Tuesday could not be logged at
// all before this — Carillon knows which day its observation was about, and a
// stretch recalled days later lands on the day it happened.
//
// Ingesting is idempotent by construction: the session takes the ledger's own
// id, so re-reading cannot double-log, on this device or any other.

import type { LoggedSitting } from '@woodles/sync';
import type { Session, ThinkingAboutEntry } from './types';

export type SittingIngest = {
	entries: ThinkingAboutEntry[];
	/** Ledger ids now accounted for — whether newly added or deliberately skipped. */
	ingested: string[];
	added: number;
};

/**
 * Fold a ledger into the board.
 *
 * Three things are deliberately *not* an error, and each returns the sitting's
 * id as accounted-for so it is never reconsidered:
 *
 *   - an entry that no longer exists (deleted, or never synced here)
 *   - a sitting already ingested, per `alreadyIngested`
 *   - a session with that id already on the entry
 *
 * The middle one is what keeps a deleted sitting deleted. Without it, removing
 * a session Carillon sent would simply invite it back on the next load.
 */
export function ingestSittings(
	entries: ThinkingAboutEntry[],
	sittings: LoggedSitting[],
	alreadyIngested: string[],
	now: () => string
): SittingIngest {
	const accounted = new Set(alreadyIngested);
	const fresh = sittings.filter((sitting) => !accounted.has(sitting.id));
	if (fresh.length === 0) return { entries, ingested: alreadyIngested, added: 0 };

	const byEntry = new Map<string, LoggedSitting[]>();
	for (const sitting of fresh) {
		const list = byEntry.get(sitting.entryId);
		if (list) list.push(sitting);
		else byEntry.set(sitting.entryId, [sitting]);
	}

	let added = 0;
	const stamp = now();
	const next = entries.map((entry) => {
		const incoming = byEntry.get(entry.id);
		if (!incoming) return entry;

		const existing = new Set(entry.sessions.map((session) => session.id));
		const sessions: Session[] = incoming
			.filter((sitting) => !existing.has(sitting.id))
			.map((sitting) => ({ id: sitting.id, date: sitting.date, note: '' }));
		if (sessions.length === 0) return entry;

		added += sessions.length;
		// Newest first, matching how a sitting logged here is inserted.
		return { ...entry, sessions: [...sessions, ...entry.sessions], updatedAt: stamp };
	});

	return {
		entries: added > 0 ? next : entries,
		// Every fresh id is accounted for, including ones whose entry is gone —
		// a sitting for something no longer on the board should not be retried
		// forever.
		ingested: [...alreadyIngested, ...fresh.map((sitting) => sitting.id)],
		added
	};
}
