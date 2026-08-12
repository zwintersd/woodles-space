// @ts-check

/**
 * Life Points — the workspace's first cross-app currency.
 *
 * Minted by the landing page's screensaver: a break is time deliberately spent
 * *away* from the computer, and Life Points are what that time is worth. The
 * name is the whole argument. Nothing here rewards using an app harder.
 *
 * ── why this is a package and not a section of crossAppBlobs.ts ──────────
 *
 * Every other cross-app ledger lives in `packages/sync/src/crossAppBlobs.ts`,
 * for the reason stated there: defined in neither app, so writer and reader
 * cannot drift. That reason is why this is *not* there. The writer is
 * `apps/landing/index.html`, a static page with no build step, which cannot
 * import TypeScript — so putting the shapes in `crossAppBlobs.ts` would leave
 * the landing page hand-rolling the keys *and* the earning formula, pinned by
 * a test, which is exactly the drift the rule exists to prevent. `apps/letter`
 * hand-rolls a request that way and it is the awkward case, not the model.
 *
 * Plain browser-ready `.js` with a `.d.ts` sidecar — the shape
 * `@woodles/spellcraft` documents for precisely this situation — so the static
 * writer and every built reader import the same file. There is no second copy
 * to pin.
 *
 * ── the two stores ───────────────────────────────────────────────────────
 *
 * Life Points break the "derived, never authoritative" rule that every ledger
 * in `crossAppBlobs.ts` obeys, because a wallet has no richer store behind it
 * to be rebuilt from: throw it away and the currency is gone. So it is split
 * rather than excepted, and both rules hold as written.
 *
 *   • The **wallet** (`LIFE_POINTS_WALLET_KEY`) is landing's own private,
 *     authoritative store — every break ever taken. Only landing touches it.
 *   • The **ledger** (`LIFE_POINTS_STORAGE_KEY`, sync `LIFE_POINTS_APP`) is a
 *     narrow projection of the wallet, republished on every change, and is what
 *     other apps read. Safe to throw away; never hydrated back.
 *
 * One writer, as everywhere else: landing mints, nobody else pushes to that
 * key. An app that wants to *spend* publishes its own spend ledger in the
 * other direction — see `lifePointsSpendApp` at the bottom of this file —
 * and the balance is the difference. That is the same answer Carillon's
 * commitments ledger gives to Thinking About's shelf.
 */

export const LIFE_POINTS_VERSION = 1;

/**
 * Sync app key. Matched by `/^[a-z0-9-]{1,40}$/` in api/_lib.ts, and namespaced
 * under its publisher so it cannot collide with a future `landing` blob.
 */
export const LIFE_POINTS_APP = 'landing-life-points';

/** Where the published ledger is mirrored for same-origin readers. */
export const LIFE_POINTS_STORAGE_KEY = 'landing.lifePoints.v1';

/**
 * Landing's private wallet. Not a ledger key — no other app reads this, and
 * nothing outside landing may write it.
 */
export const LIFE_POINTS_WALLET_KEY = 'woodles-life-points';

// ── the economy ─────────────────────────────────────────────────────────

/**
 * One point per whole minute away. Deliberately not tuned for scarcity: the
 * only way to earn is to actually be gone, and the ceiling is the day.
 */
export const POINTS_PER_MINUTE = 1;

/**
 * Seeing a break through to its end pays a bonus on top, proportional to what
 * was planned. This is the only lever that distinguishes a break from an
 * interruption, and it is why the timer is worth setting honestly: bail at 4:59
 * of five minutes and you keep the four minutes but not the bonus.
 */
export const COMPLETION_BONUS_RATE = 0.5;

/** How many recent breaks the published ledger carries. The wallet keeps more. */
export const RECENT_BREAKS = 12;

/** How many breaks the wallet itself remembers before dropping the oldest. */
export const WALLET_HISTORY = 60;

/**
 * Points for time already spent. Whole minutes only — a ten-second look at the
 * stars is not a break, and rounding up would make it one.
 *
 * @param {number} elapsedMs
 * @returns {number}
 */
export function pointsForElapsed(elapsedMs) {
	return wholeMinutes(elapsedMs) * POINTS_PER_MINUTE;
}

/**
 * Whole minutes elapsed, floored at zero. Exported because the landing page
 * accrues live against it and the two must agree to the minute.
 *
 * @param {number} elapsedMs
 * @returns {number}
 */
export function wholeMinutes(elapsedMs) {
	if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
	return Math.floor(elapsedMs / 60000);
}

/**
 * The bonus for finishing a break of `plannedMinutes`. Zero for a break that
 * was ended early.
 *
 * @param {number} plannedMinutes
 * @returns {number}
 */
export function completionBonus(plannedMinutes) {
	if (!Number.isFinite(plannedMinutes) || plannedMinutes <= 0) return 0;
	return Math.round(plannedMinutes * COMPLETION_BONUS_RATE);
}

/**
 * What a break is worth in total. The landing page credits minutes as they
 * pass rather than calling this at the end — a browser crash twenty minutes
 * into a walk should not cost the walk — so this is the accounting statement
 * of the same rule, and what any app should use to explain the economy.
 *
 * @param {{ elapsedMs: number, plannedMinutes: number, completed: boolean }} breakTaken
 * @returns {number}
 */
export function pointsForBreak({ elapsedMs, plannedMinutes, completed }) {
	return pointsForElapsed(elapsedMs) + (completed ? completionBonus(plannedMinutes) : 0);
}

/**
 * The ladder. Thresholds are lifetime points earned, not the current balance —
 * spending something you worked for should never demote you.
 *
 * @type {readonly { at: number, name: string }[]}
 */
export const LIFE_RANKS = [
	{ at: 0, name: 'newly here' },
	{ at: 25, name: 'stepped outside' },
	{ at: 75, name: 'took the long way' },
	{ at: 200, name: 'afternoon keeper' },
	{ at: 500, name: 'seasoned wanderer' },
	{ at: 1200, name: 'keeper of hours' },
	{ at: 2500, name: 'mostly elsewhere' }
];

/**
 * The rank held at a given lifetime total.
 *
 * @param {number} earned
 * @returns {{ at: number, name: string }}
 */
export function rankFor(earned) {
	const total = Number.isFinite(earned) ? earned : 0;
	let held = LIFE_RANKS[0];
	for (const rank of LIFE_RANKS) if (total >= rank.at) held = rank;
	return held;
}

/**
 * The next rank up, or null at the top of the ladder.
 *
 * @param {number} earned
 * @returns {{ at: number, name: string } | null}
 */
export function nextRankFor(earned) {
	const total = Number.isFinite(earned) ? earned : 0;
	return LIFE_RANKS.find((rank) => total < rank.at) ?? null;
}

// ── the ledger ──────────────────────────────────────────────────────────

/**
 * @typedef {object} BreakRecord
 * @property {string} date `YYYY-MM-DD` the break was taken.
 * @property {number} minutes Whole minutes away.
 * @property {number} points Life Points it paid, bonus included.
 * @property {boolean} completed Whether the timer ran out rather than being cut short.
 * @property {string} style Which screensaver was running, for colour.
 */

/**
 * @typedef {object} LifePointsLedger
 * @property {1} version
 * @property {number} earned Lifetime Life Points minted. Never decreases.
 * @property {number} minutes Lifetime whole minutes away.
 * @property {number} breaks How many breaks have been taken.
 * @property {number} longest The longest single break, in minutes.
 * @property {string} rank The rank name held at `earned`, so a reader with only
 *   the JSON can render it without recomputing the ladder.
 * @property {BreakRecord[]} recent Newest first, at most `RECENT_BREAKS`.
 * @property {string} publishedAt
 */

/** A wallet or ledger with nothing in it yet. Readers treat null the same way. */
export function emptyLifePoints() {
	return {
		version: LIFE_POINTS_VERSION,
		earned: 0,
		minutes: 0,
		breaks: 0,
		longest: 0,
		rank: LIFE_RANKS[0].name,
		/** @type {BreakRecord[]} */ recent: [],
		publishedAt: ''
	};
}

/**
 * Structural check for a ledger arriving from storage or the server. Returns a
 * usable ledger or null, and null means exactly "nothing published yet" — the
 * same fallback every reader in this workspace already has for an empty or
 * unreachable source.
 *
 * @param {unknown} value
 * @returns {LifePointsLedger | null}
 */
export function readLifePointsBlob(value) {
	if (typeof value !== 'object' || value === null) return null;
	const blob = /** @type {Partial<LifePointsLedger>} */ (value);
	if (blob.version !== LIFE_POINTS_VERSION) return null;
	const earned = count(blob.earned);
	return {
		version: LIFE_POINTS_VERSION,
		earned,
		minutes: count(blob.minutes),
		breaks: count(blob.breaks),
		longest: count(blob.longest),
		rank: typeof blob.rank === 'string' && blob.rank ? blob.rank : rankFor(earned).name,
		recent: Array.isArray(blob.recent) ? blob.recent.filter(isBreakRecord).slice(0, RECENT_BREAKS) : [],
		publishedAt: typeof blob.publishedAt === 'string' ? blob.publishedAt : ''
	};
}

/**
 * Project a wallet into the ledger other apps read. Pure, so publishing is
 * always safe to redo and two devices deriving from the same wallet agree.
 *
 * @param {{ earned?: number, minutes?: number, breaks?: number, longest?: number, history?: BreakRecord[] }} wallet
 * @param {string} publishedAt
 * @returns {LifePointsLedger}
 */
export function publishLifePoints(wallet, publishedAt) {
	const earned = count(wallet.earned);
	return {
		version: LIFE_POINTS_VERSION,
		earned,
		minutes: count(wallet.minutes),
		breaks: count(wallet.breaks),
		longest: count(wallet.longest),
		rank: rankFor(earned).name,
		recent: (Array.isArray(wallet.history) ? wallet.history : [])
			.filter(isBreakRecord)
			.slice(0, RECENT_BREAKS),
		publishedAt
	};
}

// ── spending ────────────────────────────────────────────────────────────
//
// Nothing spends Life Points yet. The shape is here because the one-writer
// rule decides it and the decision is easier to make once: an app that spends
// does *not* write to landing's ledger, it publishes what it took, in its own
// key, in the other direction. The balance is the difference.
//
// The consequence worth knowing before the first spender ships: an app can
// only ever spend against what it can see, so a spend made on a device that
// has never synced is a spend the other devices don't know about until it
// does. That is the same eventual-consistency every ledger here has, and it
// is why `lifePointsBalance` floors at zero rather than trusting arithmetic.

export const LIFE_POINTS_SPEND_VERSION = 1;

/**
 * The sync key an app publishes its spending under. Namespaced under the
 * *spender*, because that app is its writer.
 *
 * @param {string} app
 * @returns {string}
 */
export function lifePointsSpendApp(app) {
	return `${app}-life-spend`;
}

/**
 * Where that spender mirrors its own spend ledger for same-origin readers.
 *
 * @param {string} app
 * @returns {string}
 */
export function lifePointsSpendStorageKey(app) {
	return `${app}.lifeSpend.v1`;
}

/**
 * @typedef {object} SpendRecord
 * @property {string} id Stable and deterministic, so re-reading cannot double-count.
 * @property {string} label What it bought, in the spender's own words.
 * @property {number} points What it cost.
 * @property {string} date `YYYY-MM-DD`.
 */

/**
 * @typedef {object} LifePointsSpendLedger
 * @property {1} version
 * @property {string} app The spender, matching the key it published under.
 * @property {number} spent Total spent — the sum of `entries`, carried so a
 *   reader can show a balance without walking the list.
 * @property {SpendRecord[]} entries
 * @property {string} publishedAt
 */

/**
 * @param {unknown} value
 * @returns {LifePointsSpendLedger | null}
 */
export function readLifePointsSpendBlob(value) {
	if (typeof value !== 'object' || value === null) return null;
	const blob = /** @type {Partial<LifePointsSpendLedger>} */ (value);
	if (blob.version !== LIFE_POINTS_SPEND_VERSION) return null;
	if (typeof blob.app !== 'string' || !blob.app) return null;
	const entries = Array.isArray(blob.entries) ? blob.entries.filter(isSpendRecord) : [];
	return {
		version: LIFE_POINTS_SPEND_VERSION,
		app: blob.app,
		// Trust the entries over the total: the sum is the thing that was
		// actually recorded, and a stale `spent` would quietly mint points.
		spent: entries.reduce((total, entry) => total + entry.points, 0),
		entries,
		publishedAt: typeof blob.publishedAt === 'string' ? blob.publishedAt : ''
	};
}

/**
 * What is left to spend: everything minted, less everything the given spenders
 * report taking. Floored at zero — a ledger that has not reached this device
 * yet must not be able to show a negative wallet.
 *
 * @param {LifePointsLedger | null} ledger
 * @param {(LifePointsSpendLedger | null)[]} [spends]
 * @returns {number}
 */
export function lifePointsBalance(ledger, spends = []) {
	const earned = ledger ? count(ledger.earned) : 0;
	const spent = spends.reduce((total, entry) => total + (entry ? count(entry.spent) : 0), 0);
	return Math.max(0, earned - spent);
}

// ── guards ──────────────────────────────────────────────────────────────

/**
 * @param {unknown} value
 * @returns {number}
 */
function count(value) {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * @param {unknown} value
 * @returns {value is BreakRecord}
 */
function isBreakRecord(value) {
	if (typeof value !== 'object' || value === null) return false;
	const record = /** @type {Partial<BreakRecord>} */ (value);
	return (
		typeof record.date === 'string' &&
		typeof record.minutes === 'number' &&
		typeof record.points === 'number' &&
		typeof record.completed === 'boolean' &&
		typeof record.style === 'string'
	);
}

/**
 * @param {unknown} value
 * @returns {value is SpendRecord}
 */
function isSpendRecord(value) {
	if (typeof value !== 'object' || value === null) return false;
	const record = /** @type {Partial<SpendRecord>} */ (value);
	return (
		typeof record.id === 'string' &&
		typeof record.label === 'string' &&
		typeof record.points === 'number' &&
		Number.isFinite(record.points) &&
		record.points >= 0 &&
		typeof record.date === 'string'
	);
}
