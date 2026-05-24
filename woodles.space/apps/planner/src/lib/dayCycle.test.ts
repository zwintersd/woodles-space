import { describe, expect, it } from 'vitest';
import { getPaletteForTime, currentModeLabel, getNamedPalette } from './dayCycle';

describe('getPaletteForTime', () => {
	it('returns all token keys', () => {
		const p = getPaletteForTime(new Date(2024, 5, 12, 9, 0));
		expect(Object.keys(p).sort()).toEqual([
			'--p-accent',
			'--p-accent-soft',
			'--p-bg',
			'--p-border',
			'--p-highlight',
			'--p-muted',
			'--p-surface',
			'--p-text'
		]);
	});

	it('returns valid CSS colors', () => {
		const p = getPaletteForTime(new Date(2024, 5, 12, 12, 0));
		// All resolved colors should be either hex stops or rgb() lerps.
		expect(p['--p-bg']).toMatch(/^(#[0-9a-f]{6}|rgb\(\d+,\d+,\d+\))$/i);
		expect(p['--p-text']).toMatch(/^(#[0-9a-f]{6}|rgb\(\d+,\d+,\d+\))$/i);
	});

	it('produces midnight values at hour 0', () => {
		const p = getPaletteForTime(new Date(2024, 5, 12, 0, 0));
		// Hour 0 sits on the first stop (#1c1926 → rgb form via lerp).
		expect(p['--p-bg']).toBe('rgb(28,25,38)');
	});
});

describe('currentModeLabel', () => {
	const cases: Array<[number, ReturnType<typeof currentModeLabel>]> = [
		[5, 'early-light'],
		[10, 'full-day'],
		[15, 'late-afternoon'],
		[19, 'evening'],
		[21, 'dusk'],
		[23, 'night']
	];
	for (const [hour, label] of cases) {
		it(`hour ${hour} → ${label}`, () => {
			expect(currentModeLabel(new Date(2024, 5, 12, hour, 0))).toBe(label);
		});
	}
});

describe('getNamedPalette', () => {
	it('returns a palette for every named mode', () => {
		const modes = ['early-light', 'full-day', 'late-afternoon', 'evening', 'dusk', 'night'] as const;
		for (const m of modes) {
			const p = getNamedPalette(m);
			expect(p['--p-bg']).toBeDefined();
			expect(p['--p-text']).toBeDefined();
		}
	});
});
