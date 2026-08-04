import { describe, expect, it } from 'vitest';
import { entityIndex, slugify } from './entities.js';
import { cozyGarden } from './fixtures/index.js';
import { createRng } from './rng.js';
import { emptyGameDef, GameDefParseError, parseGameDef, serializeGameDef } from './serialize.js';
import { toyDef } from './test-defs.js';
import { validateGameDef } from './validate.js';

describe('round-tripping a project', () => {
	it('survives export and re-import unchanged', () => {
		const text = serializeGameDef(cozyGarden);
		expect(parseGameDef(text).def).toEqual(cozyGarden);
	});

	it('accepts a parsed object as readily as a string', () => {
		expect(parseGameDef(JSON.parse(serializeGameDef(toyDef()))).def).toEqual(toyDef());
	});

	it('exports as readable, diffable text', () => {
		const text = serializeGameDef(toyDef());
		expect(text.endsWith('\n')).toBe(true);
		expect(text).toContain('\n  "meta"');
	});
});

describe('reading a file that is not quite right', () => {
	it('fills in arrays a hand-written file left out', () => {
		const { def } = parseGameDef({
			schemaVersion: 1,
			meta: { id: 'sparse', title: 'Sparse' },
			currencies: [{ id: 'p', name: 'P', color: '#fff', format: { decimalPlaces: 0, notation: 'plain' } }]
		});
		expect(def.generators).toEqual([]);
		expect(def.notes).toEqual([]);
		expect(def.layout).toEqual({});
	});

	it('refuses a schema version it cannot read', () => {
		expect(() => parseGameDef({ schemaVersion: 99, meta: { id: 'x', title: 'X' } })).toThrow(GameDefParseError);
		expect(() => parseGameDef({ schemaVersion: 99, meta: { id: 'x', title: 'X' } })).toThrow(/schema version 99/);
	});

	it('refuses something that is not a game definition at all', () => {
		expect(() => parseGameDef('not json')).toThrow(/could not read that file as JSON/);
		expect(() => parseGameDef([1, 2, 3])).toThrow(/does not contain a game definition/);
		expect(() => parseGameDef(null)).toThrow(GameDefParseError);
	});

	it('refuses a definition the engine could not run, and says why', () => {
		const broken = { ...toyDef(), generators: [{ ...toyDef().generators[0], producesCurrencyId: 'ghost' }] };
		try {
			parseGameDef(broken);
			expect.unreachable('should have thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(GameDefParseError);
			expect((error as GameDefParseError).issues.length).toBeGreaterThan(0);
		}
	});

	it('lets warnings through, because a warning is still playable', () => {
		const def = toyDef();
		def.currencies.push({ id: 'dust', name: 'Dust', color: '#ccc', format: { decimalPlaces: 0, notation: 'plain' } });
		const { issues } = parseGameDef(def);
		expect(issues.some((issue) => issue.code === 'orphan-currency')).toBe(true);
	});
});

describe('a blank project', () => {
	it('is valid and immediately playable', () => {
		const def = emptyGameDef('New Garden');
		expect(validateGameDef(def).filter((issue) => issue.severity === 'error')).toEqual([]);
		expect(def.meta.title).toBe('New Garden');
		expect(def.generators[0].startsOwned).toBe(1);
	});
});

describe('entity bookkeeping', () => {
	it('indexes every entity by id, with its kind', () => {
		const index = entityIndex(cozyGarden);
		expect(index.get('soft-petals')?.kind).toBe('currency');
		expect(index.get('petal-farm')?.kind).toBe('generator');
		expect(index.get('green-thumb')?.kind).toBe('upgrade');
		expect(index.get('rebirth')?.kind).toBe('prestige');
		expect(index.get('unlock-nursery')?.kind).toBe('unlock');
		expect(index.get('one-million')?.kind).toBe('milestone');
	});

	it('slugifies a name and never hands out an id twice', () => {
		expect(slugify('Soft Petals')).toBe('soft-petals');
		expect(slugify('  Wild!! Flowers  ')).toBe('wild-flowers');
		expect(slugify('', [])).toBe('entity');
		expect(slugify('Petal Farm', ['petal-farm'])).toBe('petal-farm-2');
		expect(slugify('Petal Farm', ['petal-farm', 'petal-farm-2'])).toBe('petal-farm-3');
	});
});

describe('the seeded generator', () => {
	it('repeats exactly for the same seed and differs for another', () => {
		const take = (seed: number) => {
			const rng = createRng(seed);
			return Array.from({ length: 8 }, () => rng.next());
		};
		expect(take(42)).toEqual(take(42));
		expect(take(42)).not.toEqual(take(43));
	});

	it('stays inside [0, 1) and copes with a negative or fractional seed', () => {
		for (const seed of [0, -17, 3.7, 2 ** 32 + 5]) {
			const rng = createRng(seed);
			for (let i = 0; i < 200; i += 1) {
				const value = rng.next();
				expect(value, `seed ${seed}`).toBeGreaterThanOrEqual(0);
				expect(value, `seed ${seed}`).toBeLessThan(1);
			}
		}
	});
});
