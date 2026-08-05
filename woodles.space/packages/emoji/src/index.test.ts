import { describe, expect, it } from 'vitest';
import { CURRENCY_SYMBOL_PALETTE, OPENMOJI_CODEPOINTS, openmojiCodepoint } from './index.js';

describe('OPENMOJI_CODEPOINTS', () => {
	it('maps every codepoint as uppercase hex with no stray characters', () => {
		for (const [char, code] of Object.entries(OPENMOJI_CODEPOINTS)) {
			expect(code, char).toMatch(/^[0-9A-F]+$/);
		}
	});
});

describe('CURRENCY_SYMBOL_PALETTE', () => {
	it('only offers characters that actually resolve to a codepoint', () => {
		for (const char of CURRENCY_SYMBOL_PALETTE) {
			expect(openmojiCodepoint(char), char).toBeDefined();
		}
	});

	it('has no duplicate entries', () => {
		expect(new Set(CURRENCY_SYMBOL_PALETTE).size).toBe(CURRENCY_SYMBOL_PALETTE.length);
	});
});

describe('openmojiCodepoint', () => {
	it('returns undefined for a character with no bundled artwork', () => {
		expect(openmojiCodepoint('🛸')).toBeUndefined();
	});
});
