// localStorage key constants for the write app. Centralized so a future
// schema change has one place to look.

export const LETTERS_KEY = 'woodles_letters';
export const ISSUE_KEY = 'woodles_issue_count';
export const POCKETS_ORDER_KEY = 'woodles_pockets_order';

export const ACTIVE_DRAFT_ID_KEY = 'woodles_active_draft_id';
export const DRAFTS_INDEX_KEY = 'woodles_drafts_index';
export const DRAFT_PREFIX = 'woodles_draft_';

// Legacy keys — read on first migration of pre-indexed-drafts state,
// and written-through on publish so older viewer code paths still see
// "the latest letter".
export const LEGACY_DRAFT_KEY = 'woodles_write_draft';
export const LEGACY_PUBLISHED_KEY = 'woodles_published';
