import { beforeEach, describe, expect, it } from 'vitest';
import { dailyLimit, localDayKey } from './dailyLimit';

describe('dailyLimit', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('uses the local calendar day key', () => {
		expect(localDayKey(new Date(2026, 0, 2, 23, 30))).toBe('2026-01-02');
	});

	it('tracks usage and invalidates after increment', () => {
		const limit = dailyLimit('inkblot-test', 2);

		expect(limit.used).toBe(0);
		expect(limit.remaining).toBe(2);
		expect(limit.canPlay).toBe(true);

		limit.increment();
		expect(limit.used).toBe(1);
		expect(limit.remaining).toBe(1);

		limit.increment();
		expect(limit.used).toBe(2);
		expect(limit.remaining).toBe(0);
		expect(limit.canPlay).toBe(false);
	});

	it('keeps cached reads until explicitly invalidated', () => {
		const limit = dailyLimit('cached-test', 5);
		const key = 'arcade.cached-test.daily';

		expect(limit.used).toBe(0);
		localStorage.setItem(key, JSON.stringify({ date: localDayKey(), count: 4 }));
		expect(limit.used).toBe(0);

		limit.invalidate();
		expect(limit.used).toBe(4);
	});

	it('resets stale stored days', () => {
		localStorage.setItem('arcade.stale-test.daily', JSON.stringify({ date: '2000-01-01', count: 5 }));

		const limit = dailyLimit('stale-test', 3);

		expect(limit.used).toBe(0);
		expect(limit.remaining).toBe(3);
	});
});
