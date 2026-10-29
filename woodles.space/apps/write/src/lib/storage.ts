// localStorage key constants for the write app. Centralized so a future
// schema change has one place to look.

export const LETTERS_KEY = 'woodles_letters';
export const ISSUE_KEY = 'woodles_issue_count';
export const POCKETS_ORDER_KEY = 'woodles_pockets_order';
// How you like to sit at the desk — page or spread, ruled or plain, which
// layer is on which page. A device preference, never part of a draft.
export const VIEW_PREFS_KEY = 'woodles_write_view';

export { ACTIVE_DRAFT_ID_KEY, DRAFTS_INDEX_KEY, DRAFT_PREFIX } from '@woodles/write-drafts';

// Legacy keys — read on first migration of pre-indexed-drafts state,
// and written-through on publish so older viewer code paths still see
// "the latest letter".
export const LEGACY_DRAFT_KEY = 'woodles_write_draft';
export const LEGACY_PUBLISHED_KEY = 'woodles_published';
