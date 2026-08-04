import { SCHEMA_VERSION, type GameDef } from './types.js';

/**
 * Hand-sized definitions whose arithmetic can be worked out on paper. They
 * exist so a failing engine test points at a specific number rather than at
 * "something in the cozy garden changed".
 */

/**
 * Two generators and one upgrade, with round numbers throughout:
 *   - `a` starts owned, makes 1/sec at level 1, costs 10 doubling
 *   - `b` starts unowned, makes 5/sec at level 1, costs 100 doubling
 *   - `boost` is a one-shot ×2 to everything, costing 50
 */
export function toyDef(): GameDef {
	return {
		schemaVersion: SCHEMA_VERSION,
		meta: { id: 'toy', title: 'Toy' },
		currencies: [
			{ id: 'p', name: 'Points', color: '#A78BFA', format: { decimalPlaces: 2, notation: 'plain' } }
		],
		generators: [
			{
				id: 'a',
				name: 'Alpha',
				producesCurrencyId: 'p',
				baseRate: 1,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'p', base: 10, curve: { kind: 'geometric', growth: 2 } },
				startsOwned: 1
			},
			{
				id: 'b',
				name: 'Beta',
				producesCurrencyId: 'p',
				baseRate: 5,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'p', base: 100, curve: { kind: 'geometric', growth: 2 } }
			}
		],
		upgrades: [
			{
				id: 'boost',
				name: 'Boost',
				cost: { currencyId: 'p', amount: 50 },
				effects: [{ target: { type: 'global' }, stat: 'rate', op: 'mul', value: 2 }]
			}
		],
		prestigeLayers: [],
		unlocks: [],
		milestones: [
			{ id: 'seventy-five', name: '75 Points', when: { metric: 'currencyLifetime', currencyId: 'p', op: '>=', value: 75 } }
		],
		notes: [],
		layout: {}
	};
}

/**
 * A prestige round-trip rig. `keep` is produced by a generator the layer does
 * *not* reset, which is how the test can tell "wiped exactly `resets[]`" apart
 * from "wiped everything".
 */
export function prestigeDef(): GameDef {
	return {
		schemaVersion: SCHEMA_VERSION,
		meta: { id: 'prestige-toy', title: 'Prestige Toy' },
		currencies: [
			{ id: 'p', name: 'Points', color: '#A78BFA', format: { decimalPlaces: 2, notation: 'plain' } },
			{ id: 'q', name: 'Relics', color: '#F0A6C8', format: { decimalPlaces: 0, notation: 'plain' } },
			{ id: 'keep', name: 'Keepsakes', color: '#8FD3C7', format: { decimalPlaces: 2, notation: 'plain' } }
		],
		generators: [
			{
				id: 'a',
				name: 'Alpha',
				producesCurrencyId: 'p',
				baseRate: 10,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'p', base: 1000, curve: { kind: 'geometric', growth: 2 } },
				startsOwned: 1
			},
			{
				id: 'k',
				name: 'Kiln',
				producesCurrencyId: 'keep',
				baseRate: 1,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'keep', base: 1000, curve: { kind: 'geometric', growth: 2 } },
				startsOwned: 1
			}
		],
		upgrades: [
			{
				id: 'u',
				name: 'Trinket',
				cost: { currencyId: 'p', amount: 20 },
				effects: [{ target: { type: 'generator', id: 'a' }, stat: 'rate', op: 'add', value: 1 }]
			}
		],
		prestigeLayers: [
			{
				id: 'reset',
				name: 'Reset',
				currencyId: 'q',
				gainFormula: { sourceCurrencyId: 'p', threshold: 100, exponent: 1 },
				multiplier: { perUnit: 0.5 },
				resets: ['p', 'a', 'u']
			}
		],
		unlocks: [],
		milestones: [],
		notes: [],
		layout: {}
	};
}

/** A def with a crit upgrade, so the RNG path is actually exercised. */
export function critDef(): GameDef {
	return {
		schemaVersion: SCHEMA_VERSION,
		meta: { id: 'crit-toy', title: 'Crit Toy' },
		currencies: [
			{ id: 'p', name: 'Points', color: '#A78BFA', format: { decimalPlaces: 2, notation: 'plain' } }
		],
		generators: [
			{
				id: 'a',
				name: 'Alpha',
				producesCurrencyId: 'p',
				baseRate: 10,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'p', base: 50, curve: { kind: 'geometric', growth: 1.2 } },
				startsOwned: 1
			}
		],
		upgrades: [
			{
				id: 'lucky',
				name: 'Lucky',
				cost: { currencyId: 'p', amount: 30 },
				repeatable: { maxLevel: 4, costCurve: { kind: 'geometric', growth: 2 } },
				effects: [{ target: { type: 'generator', id: 'a' }, stat: 'critChance', op: 'add', value: 0.25 }]
			}
		],
		prestigeLayers: [],
		unlocks: [],
		milestones: [],
		notes: [],
		layout: {}
	};
}
