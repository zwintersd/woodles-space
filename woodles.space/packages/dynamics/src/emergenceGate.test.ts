import { describe, expect, it } from 'vitest';
import { isRevealed } from './emergenceGate.js';

describe('isRevealed', () => {
	it('is true once every required token is owned', () => {
		expect(isRevealed(['flow', 'reaching'], new Set(['flow', 'reaching', 'holding']))).toBe(true);
	});

	it('is false while any required token is missing', () => {
		expect(isRevealed(['flow', 'reaching'], new Set(['flow']))).toBe(false);
	});

	it('is true with no requirements at all', () => {
		expect(isRevealed([], new Set())).toBe(true);
	});
});
