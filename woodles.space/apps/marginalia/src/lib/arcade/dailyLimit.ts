interface DailyRecord {
	date: string;
	count: number;
}

function todayKey(): string {
	return new Date().toISOString().slice(0, 10);
}

export interface DailyLimit {
	readonly remaining: number;
	readonly used: number;
	readonly total: number;
	readonly canPlay: boolean;
	increment(): void;
}

export function dailyLimit(gameId: string, limit: number): DailyLimit {
	const storageKey = `arcade.${gameId}.daily`;

	function load(): DailyRecord {
		try {
			const raw = localStorage.getItem(storageKey);
			if (!raw) return { date: todayKey(), count: 0 };
			const parsed = JSON.parse(raw) as DailyRecord;
			if (parsed.date !== todayKey()) return { date: todayKey(), count: 0 };
			return parsed;
		} catch {
			return { date: todayKey(), count: 0 };
		}
	}

	function save(record: DailyRecord) {
		localStorage.setItem(storageKey, JSON.stringify(record));
	}

	const record = load();

	return {
		get remaining() { return Math.max(0, limit - load().count); },
		get used() { return load().count; },
		get total() { return limit; },
		get canPlay() { return load().count < limit; },
		increment() {
			const current = load();
			save({ date: current.date, count: current.count + 1 });
		}
	};
}
