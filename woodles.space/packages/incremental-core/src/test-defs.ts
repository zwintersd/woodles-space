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

/**
 * A miniature "Apiary of Bad Decisions": `bees` makes 2 honey/sec at level 1,
 * boosted 50% for every owned-but-unequipped upgrade. `petal-a` and `petal-b`
 * each add a flat +3/sec to `bees` while equipped and nothing while not.
 *
 * Hand-worked rates at level 1, 0 unequipped: 2. Both equipped: 8. Both
 * unequipped: 2 × (1 + 0.5×2) = 4. One of each: (2 + 3) × 1.5 = 7.5.
 */
export function apiaryToyDef(): GameDef {
	return {
		schemaVersion: SCHEMA_VERSION,
		meta: { id: 'apiary-toy', title: 'Apiary Toy' },
		currencies: [
			{ id: 'honey', name: 'Honey', color: '#E8B830', format: { decimalPlaces: 2, notation: 'plain' } }
		],
		generators: [
			{
				id: 'bees',
				name: 'Bees',
				producesCurrencyId: 'honey',
				baseRate: 2,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'honey', base: 5, curve: { kind: 'geometric', growth: 2 } },
				startsOwned: 1,
				populationBoost: { metric: 'unequippedUpgrades', perUnit: 0.5 }
			}
		],
		upgrades: [
			{
				id: 'petal-a',
				name: 'Petal A',
				cost: { currencyId: 'honey', amount: 1 },
				effects: [{ target: { type: 'generator', id: 'bees' }, stat: 'rate', op: 'add', value: 3 }]
			},
			{
				id: 'petal-b',
				name: 'Petal B',
				cost: { currencyId: 'honey', amount: 1 },
				effects: [{ target: { type: 'generator', id: 'bees' }, stat: 'rate', op: 'add', value: 3 }]
			}
		],
		prestigeLayers: [],
		unlocks: [],
		milestones: [],
		notes: [],
		layout: {}
	};
}

/**
 * A miniature "Confession Booth": buying `trinket` (10 coins) taxes 10 guilt
 * into existence via `coins.spendTax`. `booth` converts guilt into absolution
 * 1:1, ceiling 3/sec, so it runs at full rate until the 10 guilt runs dry —
 * at 3/sec that's 3.33s, then it starves back to 0 until the next purchase.
 */
export function confessionToyDef(): GameDef {
	return {
		schemaVersion: SCHEMA_VERSION,
		meta: { id: 'confession-toy', title: 'Confession Toy' },
		currencies: [
			{
				id: 'coins',
				name: 'Coins',
				color: '#E8B830',
				format: { decimalPlaces: 2, notation: 'plain' },
				spendTax: { intoCurrencyId: 'guilt', rate: 1 }
			},
			{ id: 'guilt', name: 'Guilt', color: '#6B4C6E', format: { decimalPlaces: 2, notation: 'plain' } },
			{ id: 'absolution', name: 'Absolution', color: '#F5E6C8', format: { decimalPlaces: 2, notation: 'plain' } }
		],
		generators: [
			{
				id: 'miner',
				name: 'Miner',
				producesCurrencyId: 'coins',
				baseRate: 2,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'coins', base: 1000, curve: { kind: 'geometric', growth: 2 } },
				startsOwned: 1
			},
			{
				id: 'booth',
				name: 'Confession Booth',
				producesCurrencyId: 'absolution',
				baseRate: 3,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'coins', base: 5, curve: { kind: 'geometric', growth: 2 } },
				startsOwned: 1,
				converts: { fromCurrencyId: 'guilt', ratio: 1 }
			}
		],
		upgrades: [
			{
				id: 'trinket',
				name: 'Trinket',
				cost: { currencyId: 'coins', amount: 10 },
				effects: [{ target: { type: 'generator', id: 'miner' }, stat: 'rate', op: 'add', value: 0.5 }]
			}
		],
		prestigeLayers: [],
		unlocks: [],
		milestones: [],
		notes: [],
		layout: {}
	};
}

/**
 * A miniature "Choir of Unspoken Names": `choir` produces 2/sec on its own
 * curve, boosted 10% per summed level of everything tagged `devotional` —
 * `penitent` (a generator), `vow` (an upgrade), and `order` (a prestige
 * layer's reset count). `choir` itself carries no tag, so it never boosts
 * itself. `order`'s multiplier is deliberately zero, so the ordinary prestige
 * multiplier can't be mistaken for the tag sum in a test that reads it.
 */
export function choirToyDef(): GameDef {
	return {
		schemaVersion: SCHEMA_VERSION,
		meta: { id: 'choir-toy', title: 'Choir Toy' },
		currencies: [
			{ id: 'faith', name: 'Faith', color: '#E8A93A', format: { decimalPlaces: 2, notation: 'plain' } },
			{ id: 'grace', name: 'Grace', color: '#9B6FD1', format: { decimalPlaces: 0, notation: 'plain' } }
		],
		generators: [
			{
				id: 'penitent',
				name: 'Penitent',
				producesCurrencyId: 'faith',
				baseRate: 5,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'faith', base: 10, curve: { kind: 'geometric', growth: 1.5 } },
				startsOwned: 1,
				tags: ['devotional']
			},
			{
				id: 'choir',
				name: 'Choir',
				producesCurrencyId: 'faith',
				baseRate: 2,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'faith', base: 1000, curve: { kind: 'geometric', growth: 2 } },
				startsOwned: 1,
				populationBoost: { metric: 'taggedLevelSum', tag: 'devotional', perUnit: 0.1 }
			}
		],
		upgrades: [
			{
				id: 'vow',
				name: 'Vow',
				cost: { currencyId: 'faith', amount: 5 },
				repeatable: { maxLevel: 5, costCurve: { kind: 'geometric', growth: 2 } },
				tags: ['devotional'],
				effects: [{ target: { type: 'generator', id: 'penitent' }, stat: 'rate', op: 'add', value: 1 }]
			}
		],
		prestigeLayers: [
			{
				id: 'order',
				name: 'The Unspoken Order',
				currencyId: 'grace',
				gainFormula: { sourceCurrencyId: 'faith', threshold: 1, exponent: 1 },
				multiplier: { perUnit: 0 },
				resets: ['faith', 'penitent', 'vow'],
				tags: ['devotional']
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
