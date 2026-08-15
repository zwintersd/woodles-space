/**
 * Shape A — Pool. A spendable balance with no ceiling and nothing that ever
 * decays: every increase is either a continuous rate (the caller's own
 * `pool.amount += rate * dt`, too small a step to warrant a wrapper here) or
 * one of the two operations below.
 */

export interface Pool {
	amount: number;
}

export function credit(pool: Pool, amount: number): void {
	pool.amount += amount;
}

export function canAfford(pool: Pool, cost: number): boolean {
	return pool.amount >= cost;
}

/** Debits `cost` if affordable. Returns whether it happened — an unaffordable spend is a no-op, not an error. */
export function debit(pool: Pool, cost: number): boolean {
	if (!canAfford(pool, cost)) return false;
	pool.amount -= cost;
	return true;
}
