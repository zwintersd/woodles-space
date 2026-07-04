import { describe, expect, it } from 'vitest';
import { applyMarginaliaCheat, normalizeCheatCode, type CheatTarget } from './cheats';
import { conditions } from './content/conditions';
import { world1Life } from './content/life';
import { neutralStocks } from './vitals';
import { emptyWorldShape, sedimentCoverage } from './worldShape';

function target(): CheatTarget & { persistCount: number } {
	const state = {
		insight: 0,
		essence: 6,
		knowing: 0,
		favor: 60,
		stocks: neutralStocks(),
		vitality: {},
		attentionCapacity: 2,
		attending: [],
		study: {},
		writtenConditions: [],
		observation: {},
		categoryMastered: {},
		worldShape: emptyWorldShape(),
		bookOpen: false,
		mode: 'web' as const,
		persistCount: 0,
		persist() {
			this.persistCount += 1;
		}
	};
	return state;
}

describe('Marginalia cheat codes', () => {
	it('normalizes codes like a forgiving cheat console', () => {
		expect(normalizeCheatCode('  Free   Real Estate  ')).toBe('free real estate');
	});

	it('applies Sims-style resource codes and persists them', () => {
		const book = target();
		const result = applyMarginaliaCheat('motherlode', book);
		expect(result.ok).toBe(true);
		expect(book.insight).toBe(50000);
		expect(book.essence).toBe(31);
		expect(book.persistCount).toBe(1);
	});

	it('writes every condition through freerealestate', () => {
		const book = target();
		applyMarginaliaCheat('free real estate', book);
		expect(book.writtenConditions).toEqual(conditions.map((condition) => condition.id));
		expect(book.knowing).toBe(conditions.length);
		expect(book.bookOpen).toBe(true);
		expect(book.mode).toBe('web');
	});

	it('can trigger the shallows ceremony without marking it seen', () => {
		const book = target();
		applyMarginaliaCheat('unlockshallows', book);
		expect(book.worldShape.sedimentUnlocked).toBe(true);
		expect(book.worldShape.unlockedWorldspaces).toContain('shallows');
		expect(book.worldShape.activeWorldspace).toBe('water');
		expect(book.worldShape.seenUnlocks).not.toContain('shallows');
		expect(sedimentCoverage(book.worldShape.sedimentGrid)).toBeGreaterThanOrEqual(0.6);
	});

	it('worldparty opens a full sandbox world', () => {
		const book = target();
		applyMarginaliaCheat('worldparty', book);
		expect(book.insight).toBeGreaterThanOrEqual(250000);
		expect(book.essence).toBeGreaterThanOrEqual(100);
		expect(book.attentionCapacity).toBeGreaterThanOrEqual(12);
		expect(book.worldShape.activeWorldspace).toBe('shallows');
		expect(book.worldShape.placedFeatures.length).toBeGreaterThan(0);
		expect(world1Life.every((life) => book.observation[life.id] === 3)).toBe(true);
		expect(book.mode).toBe('world');
	});

	it('help reports codes without mutating or persisting', () => {
		const book = target();
		const result = applyMarginaliaCheat('help', book);
		expect(result.ok).toBe(true);
		expect(result.message).toContain('motherlode');
		expect(book.persistCount).toBe(0);
	});
});
