import { announceNotice } from './arcadeNotices.svelte';

interface DailyRecord {
	date: string;
	count: number;
}

export function localDayKey(date = new Date()): string {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export interface DailyLimit {
	readonly remaining: number;
	readonly used: number;
	readonly total: number;
	readonly canPlay: boolean;
	invalidate(): void;
	increment(): void;
}

export function dailyLimit(gameId: string, limit: number): DailyLimit {
	const storageKey = `arcade.${gameId}.daily`;
	let cached: DailyRecord | null = null;

	function freshRecord(): DailyRecord {
		return { date: localDayKey(), count: 0 };
	}

	function loadStorage(): DailyRecord {
		if (typeof localStorage === 'undefined') return freshRecord();
		try {
			const raw = localStorage.getItem(storageKey);
			if (!raw) return freshRecord();
			const parsed = JSON.parse(raw) as DailyRecord;
			if (parsed.date !== localDayKey()) return freshRecord();
			return {
				date: parsed.date,
				count: typeof parsed.count === 'number' ? parsed.count : 0
			};
		} catch {
			return freshRecord();
		}
	}

	function save(record: DailyRecord) {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(storageKey, JSON.stringify(record));
	}

	function current(): DailyRecord {
		if (!cached) cached = loadStorage();
		if (cached.date !== localDayKey()) cached = freshRecord();
		return cached;
	}

	function invalidate() {
		cached = null;
	}

	return {
		get remaining() { return Math.max(0, limit - current().count); },
		get used() { return current().count; },
		get total() { return limit; },
		get canPlay() { return current().count < limit; },
		invalidate,
		increment() {
			const record = current();
			const count = record.count + 1;
			save({ date: record.date, count });
			invalidate();
			// fires exactly once, the moment the cap is reached — not on every
			// subsequent (already-blocked) attempt.
			if (count === limit) {
				const label = gameId.charAt(0).toUpperCase() + gameId.slice(1);
				announceNotice(`${label}'s paid plays are spent for today — practice stays open`);
			}
		}
	};
}
