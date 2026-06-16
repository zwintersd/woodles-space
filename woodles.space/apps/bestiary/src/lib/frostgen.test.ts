import { describe, expect, it } from 'vitest';
import { seededRng } from './prng';
import { generateFrostPaths } from './frostgen';

const rect = (width: number, height: number) => ({ width, height });

describe('generateFrostPaths', () => {
	it('produces both border frost and corner cracks', () => {
		const { borderPaths, crackPaths } = generateFrostPaths(seededRng('hourling'), rect(200, 260));
		expect(borderPaths.length).toBeGreaterThan(0);
		expect(crackPaths.length).toBeGreaterThan(0);
	});

	it('emits well-formed polyline `d` strings', () => {
		const { borderPaths, crackPaths } = generateFrostPaths(seededRng('echo'), rect(200, 260));
		for (const d of [...borderPaths, ...crackPaths]) {
			expect(d.startsWith('M ')).toBe(true);
			expect(d).toContain(' L ');
			// only the move/line commands, numbers, dots, signs and spaces
			expect(d).toMatch(/^[ML\d.\-\s]+$/);
			expect(d).not.toContain('NaN');
		}
	});

	it('is deterministic for a given seed', () => {
		const a = generateFrostPaths(seededRng('mossback'), rect(180, 240));
		const b = generateFrostPaths(seededRng('mossback'), rect(180, 240));
		expect(a).toEqual(b);
	});

	it('grows a different fingerprint for a different seed', () => {
		const a = generateFrostPaths(seededRng('mossback'), rect(180, 240));
		const b = generateFrostPaths(seededRng('driftwisp'), rect(180, 240));
		expect(a).not.toEqual(b);
	});

	it('keeps border frost within the art box, give or take a crystal tip', () => {
		const w = 200;
		const h = 260;
		const { borderPaths } = generateFrostPaths(seededRng('contained'), rect(w, h));
		const coords = borderPaths
			.join(' ')
			.replace(/[ML]/g, ' ')
			.trim()
			.split(/\s+/)
			.map(Number);
		// pairs of x,y — frost reaches inward, so it must stay loosely in-bounds
		for (let i = 0; i < coords.length; i += 2) {
			expect(coords[i]).toBeGreaterThan(-w * 0.2);
			expect(coords[i]).toBeLessThan(w * 1.2);
			expect(coords[i + 1]).toBeGreaterThan(-h * 0.2);
			expect(coords[i + 1]).toBeLessThan(h * 1.2);
		}
	});

	it('returns empty families for a zero-sized box', () => {
		const { borderPaths, crackPaths } = generateFrostPaths(seededRng('void'), rect(0, 0));
		expect(borderPaths).toEqual([]);
		expect(crackPaths).toEqual([]);
	});
});
