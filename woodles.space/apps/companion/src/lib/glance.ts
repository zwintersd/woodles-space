import { entityHref } from '@woodles/app-manifest';
import { HANDOFF_TARGETS, handoffKey, pendingCounts, type HandoffTarget } from '@woodles/handoff';
import {
	LIFE_POINTS_STORAGE_KEY,
	lifePointsBalance,
	nextRankFor,
	rankFor,
	readLifePointsBlob
} from '@woodles/life-points';
import { HOMESUITE_RECENT_STORAGE_KEY, readHomeSuiteRecent } from '@shared/homesuiteRecent.js';

/**
 * Everything the companion shows that it didn't make: what's waiting in the
 * handoff queues, what HomeSuite last listed, and the Life Points ledger.
 * All of it is read, none of it written — each has one writer elsewhere
 * (the receivers drain the queues, HomeSuite publishes its recent list,
 * landing mints Life Points), and the companion is never it.
 */
export type Glance = {
	waiting: Record<HandoffTarget, number>;
	recent: {
		publishedAt: string;
		items: { kind: string; title: string; updatedAt: string; href: string }[];
	} | null;
	life: {
		balance: number;
		earned: number;
		rank: string;
		next: { name: string; at: number } | null;
		/** 0–1, through the current rank toward the next. */
		progress: number;
	} | null;
};

/** Keys whose change, from another tab, should redraw the glance. */
export const GLANCE_KEYS: readonly string[] = [
	...HANDOFF_TARGETS.map(handoffKey),
	HOMESUITE_RECENT_STORAGE_KEY,
	LIFE_POINTS_STORAGE_KEY
];

type Readable = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readGlance(storage: Readable | null = defaultStorage()): Glance {
	const recent = readHomeSuiteRecent(parse(storage, HOMESUITE_RECENT_STORAGE_KEY));
	const ledger = readLifePointsBlob(parse(storage, LIFE_POINTS_STORAGE_KEY));
	return {
		waiting: pendingCounts({ storage }),
		recent: recent && {
			publishedAt: recent.publishedAt,
			items: recent.recent.map((item) => ({
				kind: item.kind,
				title: item.title || 'untitled',
				updatedAt: item.updatedAt,
				href: entityHref('homesuite', item.kind, item.id)
			}))
		},
		life: ledger && lifeFrom(ledger.earned, lifePointsBalance(ledger))
	};
}

function lifeFrom(earned: number, balance: number): NonNullable<Glance['life']> {
	const rank = rankFor(earned);
	const next = nextRankFor(earned);
	return {
		balance,
		earned,
		rank: rank.name,
		next,
		progress: next ? (earned - rank.at) / (next.at - rank.at) : 1
	};
}

/** "just now", "12 min ago", "3 h ago", "2 days ago" — the ledgers are only as fresh as their last writer. */
export function ago(iso: string, now: Date = new Date()): string {
	const then = Date.parse(iso);
	if (!Number.isFinite(then)) return '';
	const minutes = Math.floor((now.getTime() - then) / 60000);
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} h ago`;
	const days = Math.floor(hours / 24);
	return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** The homepage widget's own greeting, so the two say the same thing at the same hour. */
export function greeting(hour: number): string {
	if (hour < 5) return 'still up';
	if (hour < 12) return 'good morning';
	if (hour < 17) return 'good afternoon';
	if (hour < 22) return 'good evening';
	return 'goodnight';
}

function parse(storage: Readable | null, key: string): unknown {
	try {
		return JSON.parse(storage?.getItem(key) ?? 'null');
	} catch {
		return null;
	}
}

function defaultStorage(): Readable | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}
