// @ts-check

/*
 * HomeSuite's recent things, as a narrow local ledger for the homepage's
 * HomeSuite widget. The same two rules as the cross-app ledgers in
 * packages/sync/src/crossAppBlobs.ts: one writer (HomeSuite, rebuilt from
 * its own listing every time the index is read) and derived, never
 * authoritative — safe to throw away, never read back into HomeSuite.
 *
 * Plain browser JS rather than TypeScript because apps/landing is a static
 * page that imports it as-is, the way it imports @woodles/life-points.
 * It stays on this device: nothing here syncs.
 */

export const HOMESUITE_RECENT_STORAGE_KEY = 'homesuite.recent.v1';
export const HOMESUITE_RECENT_VERSION = 1;
export const HOMESUITE_RECENT_LIMIT = 6;

/** @typedef {'document' | 'board' | 'collection'} HomeSuiteRecentKind */

/**
 * @typedef {{
 *   kind: HomeSuiteRecentKind;
 *   id: string;
 *   title: string;
 *   updatedAt: string;
 *   recordCount?: number;
 * }} HomeSuiteRecentItem
 */

/**
 * @typedef {{
 *   version: 1;
 *   publishedAt: string;
 *   counts: Record<HomeSuiteRecentKind, number>;
 *   recent: HomeSuiteRecentItem[];
 * }} HomeSuiteRecentBlob
 */

const KINDS = /** @type {const} */ (['document', 'board', 'collection']);

/**
 * Build the ledger from HomeSuite's listing, newest first.
 *
 * @param {readonly { kind: string; ref: { id: string }; title: string; updatedAt: string; recordCount?: number }[]} artifacts
 * @param {string} publishedAt
 * @returns {HomeSuiteRecentBlob}
 */
export function buildHomeSuiteRecent(artifacts, publishedAt) {
	/** @type {Record<HomeSuiteRecentKind, number>} */
	const counts = { document: 0, board: 0, collection: 0 };
	/** @type {HomeSuiteRecentItem[]} */
	const recent = [];
	for (const artifact of artifacts) {
		const kind = KINDS.find((k) => k === artifact.kind);
		if (!kind) continue;
		counts[kind] += 1;
		if (recent.length >= HOMESUITE_RECENT_LIMIT) continue;
		recent.push({
			kind,
			id: artifact.ref.id,
			title: artifact.title,
			updatedAt: artifact.updatedAt,
			...(artifact.recordCount === undefined ? {} : { recordCount: artifact.recordCount })
		});
	}
	recent.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	return { version: HOMESUITE_RECENT_VERSION, publishedAt, counts, recent };
}

/**
 * Validate whatever was stored; null when there is nothing usable.
 *
 * @param {unknown} value
 * @returns {HomeSuiteRecentBlob | null}
 */
export function readHomeSuiteRecent(value) {
	if (typeof value !== 'object' || value === null) return null;
	const blob = /** @type {Partial<HomeSuiteRecentBlob>} */ (value);
	if (blob.version !== HOMESUITE_RECENT_VERSION || !Array.isArray(blob.recent)) return null;
	const raw = /** @type {Partial<Record<string, unknown>>} */ (blob.counts ?? {});
	const count = (/** @type {string} */ k) => {
		const n = raw[k];
		return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
	};
	return {
		version: HOMESUITE_RECENT_VERSION,
		publishedAt: typeof blob.publishedAt === 'string' ? blob.publishedAt : '',
		counts: { document: count('document'), board: count('board'), collection: count('collection') },
		recent: blob.recent.filter(
			(item) =>
				typeof item === 'object' && item !== null &&
				KINDS.includes(item.kind) &&
				typeof item.id === 'string' && typeof item.title === 'string' &&
				typeof item.updatedAt === 'string'
		)
	};
}

/**
 * Write the ledger. Never throws: a full or walled-off localStorage costs the
 * homepage a stale widget, and must not disturb HomeSuite.
 *
 * @param {HomeSuiteRecentBlob} blob
 */
export function publishHomeSuiteRecent(blob) {
	try {
		localStorage.setItem(HOMESUITE_RECENT_STORAGE_KEY, JSON.stringify(blob));
	} catch {
		/* the widget keeps what it last had */
	}
}

/** @returns {HomeSuiteRecentBlob | null} */
export function loadHomeSuiteRecent() {
	try {
		return readHomeSuiteRecent(JSON.parse(localStorage.getItem(HOMESUITE_RECENT_STORAGE_KEY) || 'null'));
	} catch {
		return null;
	}
}
