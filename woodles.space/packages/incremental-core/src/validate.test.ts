import { describe, expect, it } from 'vitest';
import { cozyGarden } from './fixtures/index.js';
import { apiaryToyDef, prestigeDef, toyDef } from './test-defs.js';
import { hasErrors, issuesFor, validateGameDef } from './validate.js';
import type { GameDef } from './types.js';

const codes = (def: GameDef, severity: 'error' | 'warning' = 'error') =>
	validateGameDef(def)
		.filter((issue) => issue.severity === severity)
		.map((issue) => issue.code);

describe('valid definitions', () => {
	it('passes the shipped fixtures without errors', () => {
		for (const def of [cozyGarden, toyDef(), prestigeDef(), apiaryToyDef()]) {
			expect(codes(def), def.meta.id).toEqual([]);
			expect(hasErrors(validateGameDef(def))).toBe(false);
		}
	});
});

describe('population boosts', () => {
	it('rejects a negative per-unit multiplier', () => {
		const def = apiaryToyDef();
		def.generators[0].populationBoost = { metric: 'unequippedUpgrades', perUnit: -1 };
		expect(codes(def)).toContain('invalid-number');
	});

	it('leaves a def with no populationBoost alone', () => {
		const def = toyDef();
		expect(codes(def)).toEqual([]);
	});
});

describe('dangling references', () => {
	it('catches a generator producing a currency that is not there', () => {
		const def = toyDef();
		def.generators[0].producesCurrencyId = 'ghost';
		expect(codes(def)).toContain('dangling-reference');
	});

	it('catches a price in a currency that is not there', () => {
		const def = toyDef();
		def.upgrades[0].cost.currencyId = 'ghost';
		expect(codes(def)).toContain('dangling-reference');
	});

	it('catches an effect aimed at nothing', () => {
		const def = toyDef();
		def.upgrades[0].effects[0].target = { type: 'generator', id: 'ghost' };
		expect(codes(def)).toContain('dangling-reference');
	});

	it('catches a condition reading something that does not exist', () => {
		const def = toyDef();
		def.milestones[0].when = { metric: 'generatorLevel', generatorId: 'ghost', op: '>=', value: 1 };
		expect(codes(def)).toContain('dangling-reference');
	});

	it('catches an unlock revealing nothing real, and a reset of nothing real', () => {
		const def = prestigeDef();
		def.unlocks.push({ id: 'u1', name: 'Ghost Gate', reveals: ['ghost'], when: { metric: 'upgradeOwned', upgradeId: 'u' } });
		def.prestigeLayers[0].resets.push('ghost');
		expect(codes(def).filter((code) => code === 'dangling-reference')).toHaveLength(2);
	});

	it('reports a stale layout position as a warning, not an error', () => {
		// Dropping it silently would lose a position the author may want back.
		const def = toyDef();
		def.layout.ghost = { x: 0, y: 0 };
		expect(codes(def)).toEqual([]);
		expect(codes(def, 'warning')).toContain('dangling-reference');
	});
});

describe('ids', () => {
	it('rejects two entities sharing an id', () => {
		const def = toyDef();
		def.generators[1].id = 'a';
		expect(codes(def)).toContain('duplicate-id');
	});

	it('rejects an id that is not slug-shaped', () => {
		const def = toyDef();
		def.currencies[0].id = 'not a slug!';
		expect(codes(def)).toContain('invalid-id');
	});
});

describe('numbers and curves', () => {
	it('rejects a cost of zero or less', () => {
		const def = toyDef();
		def.generators[0].cost.base = 0;
		expect(codes(def)).toContain('invalid-number');

		const other = toyDef();
		other.upgrades[0].cost.amount = -5;
		expect(codes(other)).toContain('invalid-number');
	});

	it('rejects a negative base rate', () => {
		const def = toyDef();
		def.generators[0].baseRate = -1;
		expect(codes(def)).toContain('invalid-number');
	});

	it('rejects a geometric growth of zero or less', () => {
		const def = toyDef();
		def.generators[0].cost.curve = { kind: 'geometric', growth: 0 };
		expect(codes(def)).toContain('invalid-curve');
	});

	it('rejects step breakpoints that are out of order or nonsensical', () => {
		const def = toyDef();
		def.generators[0].rateCurve = {
			kind: 'steps',
			breakpoints: [
				{ level: 50, multiplier: 2 },
				{ level: 25, multiplier: 2 }
			]
		};
		expect(codes(def)).toContain('invalid-curve');

		const zeroed = toyDef();
		zeroed.generators[0].rateCurve = { kind: 'steps', breakpoints: [{ level: 0, multiplier: 0 }] };
		expect(codes(zeroed).filter((code) => code === 'invalid-curve').length).toBeGreaterThan(1);
	});

	it('rejects a prestige threshold or exponent of zero', () => {
		const def = prestigeDef();
		def.prestigeLayers[0].gainFormula.threshold = 0;
		def.prestigeLayers[0].gainFormula.exponent = 0;
		expect(codes(def).filter((code) => code === 'invalid-number')).toHaveLength(2);
	});
});

describe('warnings for things that are legal but wrong', () => {
	it('flags a currency nothing produces', () => {
		const def = toyDef();
		def.currencies.push({
			id: 'dust',
			name: 'Dust',
			color: '#ccc',
			format: { decimalPlaces: 0, notation: 'plain' }
		});
		expect(codes(def, 'warning')).toContain('orphan-currency');
		expect(codes(def)).toEqual([]);
	});

	it('does not flag a currency that a prestige layer awards', () => {
		// Nothing "produces" a prestige currency; a reset hands it over.
		expect(codes(prestigeDef(), 'warning')).not.toContain('orphan-currency');
	});

	it('flags a prestige layer that resets its own reward', () => {
		const def = prestigeDef();
		def.prestigeLayers[0].resets.push('q');
		expect(codes(def, 'warning')).toContain('self-reset');
	});

	it('flags an upgrade that does nothing', () => {
		const def = toyDef();
		def.upgrades[0].effects = [];
		expect(codes(def, 'warning')).toContain('unreachable');
	});
});

describe('gating loops', () => {
	it('catches two upgrades each waiting on the other', () => {
		const def = toyDef();
		def.upgrades.push({
			id: 'second',
			name: 'Second',
			cost: { currencyId: 'p', amount: 10 },
			effects: [{ target: { type: 'global' }, stat: 'rate', op: 'mul', value: 2 }],
			purchasableWhen: { metric: 'upgradeOwned', upgradeId: 'boost' }
		});
		def.upgrades[0].purchasableWhen = { metric: 'upgradeOwned', upgradeId: 'second' };

		const issues = validateGameDef(def);
		expect(issues.filter((issue) => issue.code === 'unlock-cycle')).toHaveLength(2);
		expect(issuesFor(issues, 'boost').some((issue) => issue.code === 'unlock-cycle')).toBe(true);
	});

	it('catches an unlock chain that closes on itself', () => {
		const def = toyDef();
		def.unlocks.push(
			{ id: 'gate-a', name: 'Gate A', reveals: ['a'], when: { metric: 'generatorLevel', generatorId: 'b', op: '>=', value: 1 } },
			{ id: 'gate-b', name: 'Gate B', reveals: ['b'], when: { metric: 'generatorLevel', generatorId: 'a', op: '>=', value: 1 } }
		);
		expect(codes(def)).toContain('unlock-cycle');
	});

	it('leaves a long but finite chain alone', () => {
		const def = toyDef();
		def.unlocks.push(
			{ id: 'gate-b', name: 'Gate B', reveals: ['b'], when: { metric: 'generatorLevel', generatorId: 'a', op: '>=', value: 5 } },
			{ id: 'gate-u', name: 'Gate U', reveals: ['boost'], when: { metric: 'generatorLevel', generatorId: 'b', op: '>=', value: 5 } }
		);
		expect(codes(def)).toEqual([]);
	});
});

describe('schema and meta', () => {
	it('rejects a version it cannot read', () => {
		const def = { ...toyDef(), schemaVersion: 2 } as unknown as GameDef;
		expect(codes(def)).toContain('schema-version');
	});

	it('requires a title', () => {
		const def = toyDef();
		def.meta.title = '   ';
		expect(codes(def)).toContain('missing-meta');
	});
});

describe('issue lookup', () => {
	it('groups issues by the entity the editor should badge', () => {
		const def = toyDef();
		def.generators[0].producesCurrencyId = 'ghost';
		const mine = issuesFor(validateGameDef(def), 'a');
		expect(mine).toHaveLength(1);
		expect(mine[0].path).toBe('generators[0].producesCurrencyId');
	});
});
