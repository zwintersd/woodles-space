import { describe, expect, it } from 'vitest';
import {
	COMPLETION_BONUS_RATE,
	LIFE_POINTS_APP,
	LIFE_POINTS_SPEND_VERSION,
	LIFE_POINTS_STORAGE_KEY,
	LIFE_POINTS_VERSION,
	LIFE_POINTS_WALLET_KEY,
	LIFE_RANKS,
	POINTS_PER_MINUTE,
	RECENT_BREAKS,
	completionBonus,
	emptyLifePoints,
	lifePointsBalance,
	lifePointsSpendApp,
	lifePointsSpendStorageKey,
	nextRankFor,
	pointsForBreak,
	pointsForElapsed,
	publishLifePoints,
	rankFor,
	readLifePointsBlob,
	readLifePointsSpendBlob,
	wholeMinutes
} from './index.js';

const APP_PATTERN = /^[a-z0-9-]{1,40}$/;

const record = (overrides: Record<string, unknown> = {}) => ({
	date: '2026-08-12',
	minutes: 5,
	points: 8,
	completed: true,
	style: 'stars',
	...overrides
});

describe('ledger keys', () => {
	it('is a valid sync app key, namespaced under its publisher', () => {
		// api/_lib.ts rejects anything else with a 400 before it reaches the table.
		expect(LIFE_POINTS_APP).toMatch(APP_PATTERN);
		expect(LIFE_POINTS_APP.startsWith('landing')).toBe(true);
		// It must not collide with a future private blob for the landing page.
		expect(LIFE_POINTS_APP).not.toBe('landing');
	});

	it('keeps the private wallet on a different key from the published ledger', () => {
		// The whole point of the split: one is authoritative, one is throwaway.
		expect(LIFE_POINTS_WALLET_KEY).not.toBe(LIFE_POINTS_STORAGE_KEY);
	});

	it('namespaces a spender under the spender, not under landing', () => {
		expect(lifePointsSpendApp('marginalia')).toMatch(APP_PATTERN);
		expect(lifePointsSpendApp('marginalia')).toBe('marginalia-life-spend');
		expect(lifePointsSpendStorageKey('marginalia')).toBe('marginalia.lifeSpend.v1');
	});
});

describe('earning', () => {
	it('pays a point per whole minute away', () => {
		expect(pointsForElapsed(5 * 60000)).toBe(5 * POINTS_PER_MINUTE);
	});

	it('does not round a glance up into a break', () => {
		expect(wholeMinutes(59_999)).toBe(0);
		expect(pointsForElapsed(59_999)).toBe(0);
	});

	it('ignores nonsense elapsed times rather than minting from them', () => {
		expect(pointsForElapsed(-1000)).toBe(0);
		expect(pointsForElapsed(Number.NaN)).toBe(0);
		expect(wholeMinutes(Number.POSITIVE_INFINITY)).toBe(0);
	});

	it('pays a completion bonus proportional to what was planned', () => {
		expect(completionBonus(10)).toBe(Math.round(10 * COMPLETION_BONUS_RATE));
		expect(completionBonus(0)).toBe(0);
	});

	it('withholds the bonus from a break that was cut short', () => {
		const planned = { plannedMinutes: 5, elapsedMs: 5 * 60000 };
		expect(pointsForBreak({ ...planned, completed: true })).toBe(5 + completionBonus(5));
		expect(pointsForBreak({ ...planned, completed: false })).toBe(5);
	});

	it('pays nothing for bailing in the first minute', () => {
		expect(pointsForBreak({ elapsedMs: 30_000, plannedMinutes: 5, completed: false })).toBe(0);
	});
});

describe('ranks', () => {
	it('starts on the bottom rung and climbs by lifetime earnings', () => {
		expect(rankFor(0)).toEqual(LIFE_RANKS[0]);
		expect(rankFor(LIFE_RANKS[1].at).name).toBe(LIFE_RANKS[1].name);
		expect(rankFor(LIFE_RANKS[1].at - 1).name).toBe(LIFE_RANKS[0].name);
	});

	it('holds the top rank rather than falling off the ladder', () => {
		const top = LIFE_RANKS[LIFE_RANKS.length - 1];
		expect(rankFor(top.at * 100).name).toBe(top.name);
		expect(nextRankFor(top.at)).toBeNull();
	});

	it('points at the next rung up', () => {
		expect(nextRankFor(0)?.name).toBe(LIFE_RANKS[1].name);
	});

	it('treats a missing total as the beginning', () => {
		expect(rankFor(Number.NaN).name).toBe(LIFE_RANKS[0].name);
	});
});

describe('readLifePointsBlob', () => {
	const ledger = (overrides: Record<string, unknown> = {}) => ({
		version: LIFE_POINTS_VERSION,
		earned: 90,
		minutes: 60,
		breaks: 7,
		longest: 20,
		rank: 'took the long way',
		recent: [record()],
		publishedAt: '2026-08-12T00:00:00.000Z',
		...overrides
	});

	it('reads a well-formed ledger', () => {
		expect(readLifePointsBlob(ledger())?.earned).toBe(90);
		expect(readLifePointsBlob(ledger())?.recent).toHaveLength(1);
	});

	it('treats anything unrecognisable as nothing published yet', () => {
		expect(readLifePointsBlob(null)).toBeNull();
		expect(readLifePointsBlob('90 points')).toBeNull();
		expect(readLifePointsBlob({ ...ledger(), version: 2 })).toBeNull();
	});

	it('drops malformed break records rather than the whole ledger', () => {
		const blob = readLifePointsBlob(ledger({ recent: [record(), { date: '2026-08-11' }, 7] }));
		expect(blob?.recent).toHaveLength(1);
		expect(blob?.earned).toBe(90);
	});

	it('refuses to read a negative or fractional balance', () => {
		expect(readLifePointsBlob(ledger({ earned: -500 }))?.earned).toBe(0);
		expect(readLifePointsBlob(ledger({ earned: 12.7 }))?.earned).toBe(12);
	});

	it('recomputes a missing rank rather than rendering a blank', () => {
		expect(readLifePointsBlob(ledger({ rank: undefined }))?.rank).toBe(rankFor(90).name);
	});

	it('caps recent breaks so a reader cannot be handed the whole history', () => {
		const many = Array.from({ length: RECENT_BREAKS + 20 }, () => record());
		expect(readLifePointsBlob(ledger({ recent: many }))?.recent).toHaveLength(RECENT_BREAKS);
	});
});

describe('publishLifePoints', () => {
	it('projects the wallet, carrying the rank so JSON alone is renderable', () => {
		const blob = publishLifePoints(
			{ earned: 210, minutes: 140, breaks: 12, longest: 20, history: [record()] },
			'2026-08-12T00:00:00.000Z'
		);
		expect(blob.rank).toBe(rankFor(210).name);
		expect(blob.publishedAt).toBe('2026-08-12T00:00:00.000Z');
		expect(readLifePointsBlob(blob)).toEqual(blob);
	});

	it('narrows a long history down to the recent window', () => {
		const history = Array.from({ length: 40 }, () => record());
		expect(publishLifePoints({ earned: 1, history }, '').recent).toHaveLength(RECENT_BREAKS);
	});

	it('publishes an empty wallet without inventing anything', () => {
		const blob = publishLifePoints({}, '');
		expect(blob.earned).toBe(0);
		expect(blob.recent).toEqual([]);
		expect(blob.rank).toBe(LIFE_RANKS[0].name);
	});

	it('round-trips an empty ledger', () => {
		expect(readLifePointsBlob(emptyLifePoints())).toEqual(emptyLifePoints());
	});
});

describe('spending', () => {
	const spend = (entries: unknown[]) => ({
		version: LIFE_POINTS_SPEND_VERSION,
		app: 'marginalia',
		spent: 999,
		entries,
		publishedAt: '2026-08-12T00:00:00.000Z'
	});

	it('totals from the entries, not from a figure it was handed', () => {
		// A stale or hostile `spent` would otherwise mint points out of nowhere.
		const blob = readLifePointsSpendBlob(
			spend([{ id: 'a', label: 'a theme', points: 40, date: '2026-08-12' }])
		);
		expect(blob?.spent).toBe(40);
	});

	it('rejects a ledger with no named spender', () => {
		expect(readLifePointsSpendBlob({ ...spend([]), app: '' })).toBeNull();
		expect(readLifePointsSpendBlob({ ...spend([]), version: 2 })).toBeNull();
	});

	it('drops entries that would credit rather than debit', () => {
		const blob = readLifePointsSpendBlob(
			spend([
				{ id: 'a', label: 'ok', points: 10, date: '2026-08-12' },
				{ id: 'b', label: 'refund', points: -100, date: '2026-08-12' }
			])
		);
		expect(blob?.entries).toHaveLength(1);
		expect(blob?.spent).toBe(10);
	});

	it('leaves the balance as everything earned when nothing spends', () => {
		const ledger = publishLifePoints({ earned: 120 }, '');
		expect(lifePointsBalance(ledger)).toBe(120);
		expect(lifePointsBalance(null)).toBe(0);
	});

	it('subtracts every spender it can see', () => {
		const ledger = publishLifePoints({ earned: 120 }, '');
		const one = readLifePointsSpendBlob(spend([{ id: 'a', label: 'x', points: 40, date: 'd' }]));
		const two = readLifePointsSpendBlob(spend([{ id: 'b', label: 'y', points: 30, date: 'd' }]));
		expect(lifePointsBalance(ledger, [one, two])).toBe(50);
	});

	it('never shows a negative wallet when a spend arrives before the earnings', () => {
		const ledger = publishLifePoints({ earned: 10 }, '');
		const big = readLifePointsSpendBlob(spend([{ id: 'a', label: 'x', points: 400, date: 'd' }]));
		expect(lifePointsBalance(ledger, [big])).toBe(0);
	});

	it('ignores a spender whose ledger has not arrived', () => {
		const ledger = publishLifePoints({ earned: 120 }, '');
		expect(lifePointsBalance(ledger, [null])).toBe(120);
	});
});
