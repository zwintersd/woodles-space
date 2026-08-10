import { describe, expect, it } from 'vitest';
import {
	CUSTOM_PALETTE_ROLES,
	CUSTOM_PALETTE_CSS_VARS,
	isValidCustomPalette,
	encodeCustomPalette,
	decodeCustomPalette,
	customPaletteTokens
} from '@shared/library.js';

// shared/library.js is the wire format and derivation logic that lets a
// palette mixed in Hygge become a live theme in Write — see
// shared/library.js's own "custom palettes" section for the shape. Tested
// here, from write, because shared/ isn't its own pnpm package and write is
// the app that actually round-trips this data through drafts and letters.

const ROLES: Record<string, string> = {
	bg: '#faf6f0',
	text: '#2e2040',
	muted: '#7a6b90',
	lavender: '#c9bfee',
	aqua: '#8eddd4',
	peach: '#f5c8a8',
	lilac: '#dbb8e8',
	lapis: '#3a2d72',
	plum: '#5c3464'
};

describe('isValidCustomPalette', () => {
	it('accepts a full set of nine lowercase hex roles', () => {
		expect(isValidCustomPalette(ROLES)).toBe(true);
	});

	it('accepts uppercase hex too', () => {
		expect(isValidCustomPalette({ ...ROLES, bg: '#FAF6F0' })).toBe(true);
	});

	it('rejects a missing role', () => {
		const { plum: _plum, ...rest } = ROLES;
		expect(isValidCustomPalette(rest)).toBe(false);
	});

	it('rejects a malformed hex value', () => {
		expect(isValidCustomPalette({ ...ROLES, bg: 'not-a-color' })).toBe(false);
		expect(isValidCustomPalette({ ...ROLES, bg: '#fff' })).toBe(false);
	});

	it('rejects non-objects', () => {
		expect(isValidCustomPalette(null)).toBe(false);
		expect(isValidCustomPalette(undefined)).toBe(false);
		expect(isValidCustomPalette('cream')).toBe(false);
		expect(isValidCustomPalette(42)).toBe(false);
	});
});

describe('encodeCustomPalette / decodeCustomPalette', () => {
	it('round trips a full role set', () => {
		const code = encodeCustomPalette(ROLES);
		expect(code).toHaveLength(CUSTOM_PALETTE_ROLES.length * 6);
		expect(decodeCustomPalette(code!)).toEqual(ROLES);
	});

	it('lowercases the encoded output regardless of input case', () => {
		const code = encodeCustomPalette({ ...ROLES, bg: '#FAF6F0' });
		expect(code!.startsWith('faf6f0')).toBe(true);
	});

	it('refuses to encode an invalid role set', () => {
		const { bg: _bg, ...rest } = ROLES;
		expect(encodeCustomPalette(rest)).toBeNull();
	});

	it('rejects a code of the wrong length', () => {
		expect(decodeCustomPalette('abc')).toBeNull();
		expect(decodeCustomPalette('a'.repeat(53))).toBeNull();
	});

	it('rejects a code with non-hex characters', () => {
		expect(decodeCustomPalette('zz'.repeat(27))).toBeNull();
	});

	it('rejects non-string input', () => {
		expect(decodeCustomPalette(null as unknown as string)).toBeNull();
		expect(decodeCustomPalette(undefined as unknown as string)).toBeNull();
	});
});

describe('customPaletteTokens', () => {
	const tokens = customPaletteTokens(ROLES);

	it('carries every role through to its matching custom property', () => {
		expect(tokens.vars['--bg']).toBe(ROLES.bg);
		expect(tokens.vars['--text']).toBe(ROLES.text);
		expect(tokens.vars['--muted']).toBe(ROLES.muted);
		expect(tokens.vars['--lavender']).toBe(ROLES.lavender);
		expect(tokens.vars['--aqua']).toBe(ROLES.aqua);
		expect(tokens.vars['--peach']).toBe(ROLES.peach);
		expect(tokens.vars['--lilac']).toBe(ROLES.lilac);
		expect(tokens.vars['--lapis']).toBe(ROLES.lapis);
		expect(tokens.vars['--plum']).toBe(ROLES.plum);
	});

	it('mirrors cream to bg, like every named theme does', () => {
		expect(tokens.vars['--cream']).toBe(ROLES.bg);
	});

	it('aliases the accent roles the same way shared/palette.css does', () => {
		expect(tokens.vars['--accent']).toBe(ROLES.lavender);
		expect(tokens.vars['--accent-soft']).toBe(ROLES.aqua);
		expect(tokens.vars['--accent-warm']).toBe(ROLES.peach);
		expect(tokens.vars['--accent-strong']).toBe(ROLES.lapis);
		expect(tokens.vars['--accent-deep']).toBe(ROLES.plum);
	});

	it('derives surface and rule as translucent washes, not raw hex', () => {
		expect(tokens.vars['--surface']).toMatch(/^rgba\(\d+, \d+, \d+, 0\.74\)$/);
		expect(tokens.vars['--rule']).toMatch(/^rgba\(\d+, \d+, \d+, 0\.24\)$/);
	});

	it('sets every var this palette can produce, matching CUSTOM_PALETTE_CSS_VARS', () => {
		expect(Object.keys(tokens.vars).sort()).toEqual([...CUSTOM_PALETTE_CSS_VARS].sort());
	});

	it('reads light for a pale background', () => {
		expect(customPaletteTokens(ROLES).colorScheme).toBe('light');
	});

	it('reads dark for a near-black background', () => {
		expect(customPaletteTokens({ ...ROLES, bg: '#0a0a14' }).colorScheme).toBe('dark');
	});
});
