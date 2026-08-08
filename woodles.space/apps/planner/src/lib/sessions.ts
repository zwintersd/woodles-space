// The sittings ledger — Thinking About sessions Carillon was told to log.
//
// The reason the pair is better than either alone. A Thinking About session
// carries a date and no clock, and its one-tap log always means *today*, so
// there has never been a way to say "I read for an hour on Sunday" on Tuesday.
// Carillon knows which day an observation was about — including a stretch
// recalled days later through the catch-up card — so a sitting logged from
// here lands on the day it actually happened.
//
// Derived from `loggedSessions`, which only exist because a person accepted an
// offer. Carillon never turns an observation into a session on its own: an
// observation is a fact about the day, and converting them wholesale would be
// the instrument deciding on someone's behalf.

import {
	CARILLON_SESSIONS_VERSION,
	type CarillonSessionsBlob,
	type LoggedSitting
} from '@woodles/sync';
import type { LoggedSession } from './types';

/**
 * How far back the ledger reaches. A sitting is ingested once, by
 * deterministic id, so an older one has long since landed — carrying it
 * forever would grow a blob that nothing reads. Ninety days is comfortably
 * past any device that has been offline and still opens both apps.
 */
export const SESSION_LEDGER_DAYS = 90;

export function buildSessions(
	sessions: LoggedSession[],
	today = new Date(),
	publishedAt = new Date().toISOString()
): CarillonSessionsBlob {
	const cutoff = new Date(today);
	cutoff.setDate(cutoff.getDate() - SESSION_LEDGER_DAYS);
	const cutoffKey = cutoff.toISOString().slice(0, 10);

	const sittings: LoggedSitting[] = sessions
		.filter((session) => session.date >= cutoffKey)
		.map((session) => ({ id: session.id, entryId: session.entryId, date: session.date }))
		.sort((a, b) => a.date.localeCompare(b.date));

	return { version: CARILLON_SESSIONS_VERSION, sittings, publishedAt };
}

/** True when the two ledgers would read identically to a consumer. */
export function sessionsMatch(a: CarillonSessionsBlob, b: CarillonSessionsBlob): boolean {
	if (a.sittings.length !== b.sittings.length) return false;
	return a.sittings.every((item, index) => {
		const other = b.sittings[index];
		return item.id === other.id && item.entryId === other.entryId && item.date === other.date;
	});
}
