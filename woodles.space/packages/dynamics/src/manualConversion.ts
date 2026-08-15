/**
 * Shape J — Manual Conversion. The only primitive in the palette with no
 * rate at all: a player decision, checked for affordability across however
 * many balances it draws from, and executed in full or not at all — never
 * throttled, never partial.
 */

/** Named `All` to stay distinct from `pool.ts`'s single-balance `canAfford` — this checks every entry in `cost` at once. */
export function canAffordAll<K extends string>(balances: Record<K, number>, cost: Partial<Record<K, number>>): boolean {
	for (const key in cost) {
		if ((balances[key as K] ?? 0) < (cost[key as K] ?? 0)) return false;
	}
	return true;
}

/** Debits every entry in `cost` if all are affordable at once. Returns whether it happened. */
export function convert<K extends string>(balances: Record<K, number>, cost: Partial<Record<K, number>>): boolean {
	if (!canAffordAll(balances, cost)) return false;
	for (const key in cost) {
		balances[key as K] -= cost[key as K] ?? 0;
	}
	return true;
}
