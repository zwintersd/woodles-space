export interface BreakRecord {
	/** `YYYY-MM-DD` the break was taken. */
	date: string;
	/** Whole minutes away. */
	minutes: number;
	/** Life Points it paid, bonus included. */
	points: number;
	/** Whether the timer ran out rather than being cut short. */
	completed: boolean;
	/** Which screensaver was running, for colour. */
	style: string;
}

export interface LifePointsLedger {
	version: 1;
	/** Lifetime Life Points minted. Never decreases. */
	earned: number;
	/** Lifetime whole minutes away. */
	minutes: number;
	/** How many breaks have been taken. */
	breaks: number;
	/** The longest single break, in minutes. */
	longest: number;
	/** The rank name held at `earned`. */
	rank: string;
	/** Newest first, at most `RECENT_BREAKS`. */
	recent: BreakRecord[];
	publishedAt: string;
}

export interface SpendRecord {
	/** Stable and deterministic, so re-reading cannot double-count. */
	id: string;
	/** What it bought, in the spender's own words. */
	label: string;
	/** What it cost. */
	points: number;
	/** `YYYY-MM-DD`. */
	date: string;
}

export interface LifePointsSpendLedger {
	version: 1;
	/** The spender, matching the key it published under. */
	app: string;
	/** Total spent — the sum of `entries`. */
	spent: number;
	entries: SpendRecord[];
	publishedAt: string;
}

export interface LifePointsWallet {
	earned?: number;
	minutes?: number;
	breaks?: number;
	longest?: number;
	history?: BreakRecord[];
}

export interface LifeRank {
	at: number;
	name: string;
}

export const LIFE_POINTS_VERSION: 1;
export const LIFE_POINTS_APP: string;
export const LIFE_POINTS_STORAGE_KEY: string;
export const LIFE_POINTS_WALLET_KEY: string;

export const POINTS_PER_MINUTE: number;
export const COMPLETION_BONUS_RATE: number;
export const RECENT_BREAKS: number;
export const WALLET_HISTORY: number;
export const LIFE_RANKS: readonly LifeRank[];

export function wholeMinutes(elapsedMs: number): number;
export function pointsForElapsed(elapsedMs: number): number;
export function completionBonus(plannedMinutes: number): number;
export function pointsForBreak(breakTaken: {
	elapsedMs: number;
	plannedMinutes: number;
	completed: boolean;
}): number;

export function rankFor(earned: number): LifeRank;
export function nextRankFor(earned: number): LifeRank | null;

export function emptyLifePoints(): LifePointsLedger;
export function readLifePointsBlob(value: unknown): LifePointsLedger | null;
export function publishLifePoints(wallet: LifePointsWallet, publishedAt: string): LifePointsLedger;

export const LIFE_POINTS_SPEND_VERSION: 1;
export function lifePointsSpendApp(app: string): string;
export function lifePointsSpendStorageKey(app: string): string;
export function readLifePointsSpendBlob(value: unknown): LifePointsSpendLedger | null;
export function lifePointsBalance(
	ledger: LifePointsLedger | null,
	spends?: (LifePointsSpendLedger | null)[]
): number;
