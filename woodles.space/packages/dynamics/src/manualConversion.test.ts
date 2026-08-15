import { describe, expect, it } from 'vitest';
import { canAffordAll, convert } from './manualConversion.js';

describe('convert', () => {
	it('debits a single-currency cost when affordable', () => {
		const balances = { insight: 100, essence: 0 };
		expect(convert(balances, { insight: 60 })).toBe(true);
		expect(balances.insight).toBe(40);
	});

	it('requires every entry in the cost to be affordable at once — geology needs both', () => {
		const balances = { insight: 200, essence: 1 };
		expect(canAffordAll(balances, { insight: 150, essence: 2 })).toBe(false);
		expect(convert(balances, { insight: 150, essence: 2 })).toBe(false);
		// A partial affordability doesn't leave a partial debit behind.
		expect(balances).toEqual({ insight: 200, essence: 1 });
	});

	it('debits every entry together when all are affordable', () => {
		const balances = { insight: 200, essence: 5 };
		expect(convert(balances, { insight: 150, essence: 2 })).toBe(true);
		expect(balances).toEqual({ insight: 50, essence: 3 });
	});
});
