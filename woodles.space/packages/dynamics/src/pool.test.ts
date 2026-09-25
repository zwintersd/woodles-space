import { describe, expect, it } from 'vitest';
import { canAfford, credit, debit, type Pool } from './pool.js';

describe('pool', () => {
	it('credits without limit', () => {
		const pool: Pool = { amount: 0 };
		credit(pool, 5);
		credit(pool, 2.5);
		expect(pool.amount).toBe(7.5);
	});

	it('debits when affordable', () => {
		const pool: Pool = { amount: 10 };
		expect(debit(pool, 4)).toBe(true);
		expect(pool.amount).toBe(6);
	});

	it('refuses an unaffordable debit as a no-op', () => {
		const pool: Pool = { amount: 3 };
		expect(debit(pool, 4)).toBe(false);
		expect(pool.amount).toBe(3);
	});

	it('affords exactly the balance', () => {
		expect(canAfford({ amount: 5 }, 5)).toBe(true);
	});
});
