import type { Condition } from './types.js';
import { countUnequippedUpgrades, type SimState } from './state.js';

/**
 * Conditions read state and nothing else — no time, no randomness — so an
 * unlock either holds for a given state or it doesn't, and the editor can show
 * that without running a simulation.
 */
export function evaluateCondition(condition: Condition, state: SimState): boolean {
	if ('all' in condition) return condition.all.every((child) => evaluateCondition(child, state));
	if ('any' in condition) return condition.any.some((child) => evaluateCondition(child, state));

	switch (condition.metric) {
		case 'currencyAmount':
			return compare(state.currencies[condition.currencyId]?.amount ?? 0, condition.op, condition.value);
		case 'currencyLifetime':
			return compare(state.currencies[condition.currencyId]?.lifetime ?? 0, condition.op, condition.value);
		case 'generatorLevel':
			return compare(state.generators[condition.generatorId]?.level ?? 0, condition.op, condition.value);
		case 'upgradeOwned':
			return (state.upgrades[condition.upgradeId]?.level ?? 0) >= Math.max(1, condition.level ?? 1);
		case 'prestigeCount':
			return compare(state.prestige[condition.layerId]?.count ?? 0, condition.op, condition.value);
		case 'unequippedUpgrades':
			return compare(countUnequippedUpgrades(state), condition.op, condition.value);
		default:
			return false;
	}
}

function compare(left: number, op: string, right: number): boolean {
	switch (op) {
		case '>=':
			return left >= right;
		case '>':
			return left > right;
		case '<':
			return left < right;
		case '<=':
			return left <= right;
		default:
			return false;
	}
}

/**
 * Every entity id a condition reads. Validation uses it to find dangling
 * references and unlock deadlocks; the canvas uses it to draw requirement
 * edges, which is why edges never need storing separately.
 */
export function conditionReferences(condition: Condition): string[] {
	const found: string[] = [];
	collectReferences(condition, found);
	return found;
}

function collectReferences(condition: Condition, into: string[]): void {
	if ('all' in condition) {
		for (const child of condition.all) collectReferences(child, into);
		return;
	}
	if ('any' in condition) {
		for (const child of condition.any) collectReferences(child, into);
		return;
	}

	switch (condition.metric) {
		case 'currencyAmount':
		case 'currencyLifetime':
			into.push(condition.currencyId);
			return;
		case 'generatorLevel':
			into.push(condition.generatorId);
			return;
		case 'upgradeOwned':
			into.push(condition.upgradeId);
			return;
		case 'prestigeCount':
			into.push(condition.layerId);
			return;
		case 'unequippedUpgrades':
			// A def-wide count, not a reference to any one entity.
			return;
	}
}

/** Human-readable form for node badges, the log, and validation messages. */
export function describeCondition(condition: Condition, nameOf: (id: string) => string): string {
	if ('all' in condition) {
		if (!condition.all.length) return 'always';
		return condition.all.map((child) => describeCondition(child, nameOf)).join(' and ');
	}
	if ('any' in condition) {
		if (!condition.any.length) return 'never';
		return condition.any.map((child) => describeCondition(child, nameOf)).join(' or ');
	}

	switch (condition.metric) {
		case 'currencyAmount':
			return `${nameOf(condition.currencyId)} ${condition.op} ${condition.value}`;
		case 'currencyLifetime':
			return `lifetime ${nameOf(condition.currencyId)} ${condition.op} ${condition.value}`;
		case 'generatorLevel':
			return `${nameOf(condition.generatorId)} level ${condition.op} ${condition.value}`;
		case 'upgradeOwned':
			return condition.level && condition.level > 1
				? `${nameOf(condition.upgradeId)} level >= ${condition.level}`
				: `${nameOf(condition.upgradeId)} owned`;
		case 'prestigeCount':
			return `${nameOf(condition.layerId)} count ${condition.op} ${condition.value}`;
		case 'unequippedUpgrades':
			return `unequipped upgrades ${condition.op} ${condition.value}`;
		default:
			return 'unknown condition';
	}
}
