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

	let record = load();

	function currentRecord(): DailyRecord {
		if (record.date !== todayKey()) {
			record = { date: todayKey(), count: 0 };
		}
		return record;
	}

	return {
		get remaining() { return Math.max(0, limit - currentRecord().count); },
		get used() { return currentRecord().count; },
		get total() { return limit; },
		get canPlay() { return currentRecord().count < limit; },
		increment() {
			const current = currentRecord();
			record = { date: current.date, count: current.count + 1 };
			save(record);
		}
	};
}
