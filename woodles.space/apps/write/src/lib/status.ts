/**
 * How far along a draft is. Ported from Spores' `sporeStatus`/`nextStatus`,
 * which had itself ported it from the Ologypedia Textbook — both apps are
 * retiring into Write, and this is the one piece of their lifecycle model
 * worth carrying across: **a seed is a legitimate finished state**, not a
 * nag. A `note` caught by the capture import or typed on a whim can sit as a
 * seed indefinitely; nothing here ever asks it to become more.
 *
 * Optional and forward-only, same as the source: a draft with no status
 * simply has none, and once something reaches `grown` this never demotes it.
 */
export type DraftStatus = 'seed' | 'growing' | 'grown';

export const DRAFT_STATUSES: DraftStatus[] = ['seed', 'growing', 'grown'];

/**
 * The effective status of a draft. An explicit status always wins; absent
 * one, a draft with words in it reads as `growing` and an empty one as
 * `seed` — never `grown`, which is a claim only a person can make by
 * cycling it there themselves.
 */
export function draftStatus(stored: DraftStatus | undefined, hasWords: boolean): DraftStatus {
	if (stored && DRAFT_STATUSES.includes(stored)) return stored;
	return hasWords ? 'growing' : 'seed';
}

/** The next status in the cycle. `grown` stays put. */
export function nextDraftStatus(status: DraftStatus): DraftStatus {
	if (status === 'seed') return 'growing';
	if (status === 'growing') return 'grown';
	return 'grown';
}
