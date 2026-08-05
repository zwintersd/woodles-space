import { describe, expect, it } from 'vitest';
import { conditionReferences, describeCondition, evaluateCondition } from './conditions.js';
import { initialState, type SimState } from './state.js';
import { prestigeDef } from './test-defs.js';
import type { Condition } from './types.js';

function stateWith(changes: (state: SimState) => void): SimState {
	const state = initialState(prestigeDef());
	changes(state);
	return state;
}

describe('evaluating conditions', () => {
	const state = stateWith((next) => {
		next.currencies.p = { amount: 40, lifetime: 900 };
		next.generators.a.level = 7;
		next.upgrades.u.level = 3;
		next.prestige.reset = { count: 2, currencyAmount: 5 };
	});

	it('compares a balance and a lifetime separately', () => {
		expect(evaluateCondition({ metric: 'currencyAmount', currencyId: 'p', op: '>=', value: 40 }, state)).toBe(true);
		expect(evaluateCondition({ metric: 'currencyAmount', currencyId: 'p', op: '>', value: 40 }, state)).toBe(false);
		expect(evaluateCondition({ metric: 'currencyLifetime', currencyId: 'p', op: '>=', value: 900 }, state)).toBe(true);
		expect(evaluateCondition({ metric: 'currencyAmount', currencyId: 'p', op: '<', value: 100 }, state)).toBe(true);
		expect(evaluateCondition({ metric: 'currencyAmount', currencyId: 'p', op: '<=', value: 40 }, state)).toBe(true);
	});

	it('compares generator levels and prestige counts', () => {
		expect(evaluateCondition({ metric: 'generatorLevel', generatorId: 'a', op: '>=', value: 7 }, state)).toBe(true);
		expect(evaluateCondition({ metric: 'generatorLevel', generatorId: 'a', op: '>', value: 7 }, state)).toBe(false);
		expect(evaluateCondition({ metric: 'prestigeCount', layerId: 'reset', op: '>=', value: 2 }, state)).toBe(true);
	});

	it('treats a plain upgradeOwned as "owned at all" and an explicit level as a threshold', () => {
		expect(evaluateCondition({ metric: 'upgradeOwned', upgradeId: 'u' }, state)).toBe(true);
		expect(evaluateCondition({ metric: 'upgradeOwned', upgradeId: 'u', level: 3 }, state)).toBe(true);
		expect(evaluateCondition({ metric: 'upgradeOwned', upgradeId: 'u', level: 4 }, state)).toBe(false);
	});

	it('counts owned-but-unequipped upgrades across the whole def', () => {
		const hoarding = stateWith((next) => {
			next.upgrades.u = { level: 3, equipped: false };
		});
		expect(evaluateCondition({ metric: 'unequippedUpgrades', op: '>=', value: 1 }, hoarding)).toBe(true);
		expect(evaluateCondition({ metric: 'unequippedUpgrades', op: '>=', value: 2 }, hoarding)).toBe(false);
		// Unowned or equipped upgrades don't count.
		expect(evaluateCondition({ metric: 'unequippedUpgrades', op: '>=', value: 1 }, state)).toBe(false);
	});

	it('reads a missing entity as zero rather than throwing', () => {
		// A dangling reference is the validator's job to report. The engine still
		// has to not crash while the author is mid-edit.
		expect(evaluateCondition({ metric: 'currencyAmount', currencyId: 'ghost', op: '>=', value: 1 }, state)).toBe(false);
		expect(evaluateCondition({ metric: 'generatorLevel', generatorId: 'ghost', op: '>=', value: 1 }, state)).toBe(false);
		expect(evaluateCondition({ metric: 'upgradeOwned', upgradeId: 'ghost' }, state)).toBe(false);
	});

	it('combines with all and any', () => {
		const both: Condition = {
			all: [
				{ metric: 'generatorLevel', generatorId: 'a', op: '>=', value: 5 },
				{ metric: 'upgradeOwned', upgradeId: 'u' }
			]
		};
		const either: Condition = {
			any: [
				{ metric: 'generatorLevel', generatorId: 'a', op: '>=', value: 900 },
				{ metric: 'upgradeOwned', upgradeId: 'u' }
			]
		};
		expect(evaluateCondition(both, state)).toBe(true);
		expect(evaluateCondition(either, state)).toBe(true);
		expect(evaluateCondition({ all: [both, { metric: 'prestigeCount', layerId: 'reset', op: '>=', value: 9 }] }, state)).toBe(
			false
		);
	});

	it('reads an empty all as true and an empty any as false', () => {
		expect(evaluateCondition({ all: [] }, state)).toBe(true);
		expect(evaluateCondition({ any: [] }, state)).toBe(false);
	});
});

describe('reading references out of a condition', () => {
	it('finds every id, however deeply nested', () => {
		const condition: Condition = {
			all: [
				{ metric: 'currencyAmount', currencyId: 'p', op: '>=', value: 1 },
				{
					any: [
						{ metric: 'generatorLevel', generatorId: 'a', op: '>=', value: 1 },
						{ metric: 'upgradeOwned', upgradeId: 'u' },
						{ metric: 'prestigeCount', layerId: 'reset', op: '>=', value: 1 }
					]
				}
			]
		};
		expect(conditionReferences(condition).sort()).toEqual(['a', 'p', 'reset', 'u']);
	});
});

describe('describing conditions', () => {
	const nameOf = (id: string) => id.toUpperCase();

	it('reads as a sentence', () => {
		expect(describeCondition({ metric: 'currencyAmount', currencyId: 'p', op: '>=', value: 10 }, nameOf)).toBe('P >= 10');
		expect(describeCondition({ metric: 'currencyLifetime', currencyId: 'p', op: '>=', value: 10 }, nameOf)).toBe(
			'lifetime P >= 10'
		);
		expect(describeCondition({ metric: 'upgradeOwned', upgradeId: 'u' }, nameOf)).toBe('U owned');
		expect(describeCondition({ metric: 'upgradeOwned', upgradeId: 'u', level: 10 }, nameOf)).toBe('U level >= 10');
		expect(describeCondition({ metric: 'unequippedUpgrades', op: '>=', value: 5 }, nameOf)).toBe(
			'unequipped upgrades >= 5'
		);
	});

	it('joins groups with and / or', () => {
		expect(
			describeCondition(
				{
					all: [
						{ metric: 'upgradeOwned', upgradeId: 'u' },
						{ metric: 'generatorLevel', generatorId: 'a', op: '>=', value: 3 }
					]
				},
				nameOf
			)
		).toBe('U owned and A level >= 3');
		expect(describeCondition({ any: [] }, nameOf)).toBe('never');
		expect(describeCondition({ all: [] }, nameOf)).toBe('always');
	});
});
