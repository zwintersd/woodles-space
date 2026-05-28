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
		// Hour 0 sits on the first stop (#1a1638 → rgb form via lerp).
		expect(p['--p-bg']).toBe('rgb(26,22,56)');
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

// ── Contrast guarantee ────────────────────────────────────────────
// The mode-flip transition zones (around 06:30 and 20:30) used to
// produce mid-grey text on mid-tone bg. The combination of a
// contrast-aware text picker + quintic ease on the bg curve must
// keep text readable (≥3:1 AA-Large) at every minute of the day.

function parseColor(css: string): [number, number, number] {
	const hex = css.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	if (hex) return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
	const rgb = css.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
	if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
	throw new Error(`Unrecognized color: ${css}`);
}

function lum([r, g, b]: [number, number, number]): number {
	const lin = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
	const la = lum(parseColor(a));
	const lb = lum(parseColor(b));
	const [hi, lo] = la > lb ? [la, lb] : [lb, la];
	return (hi + 0.05) / (lo + 0.05);
}

describe('palette contrast across the day', () => {
	// Sample every 15 minutes through the day, including the known
	// problem zones around mode flips (06:00–07:00 and 19:00–21:00).
	const samples: Array<[number, number]> = [];
	for (let h = 0; h < 24; h++) {
		for (let m = 0; m < 60; m += 15) samples.push([h, m]);
	}

	for (const [h, m] of samples) {
		it(`text ≥ 3:1 against bg at ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, () => {
			const p = getPaletteForTime(new Date(2024, 5, 12, h, m));
			expect(contrast(p['--p-text'], p['--p-bg'])).toBeGreaterThanOrEqual(3);
		});
	}

	// The same check on muted at AA-Large. Body-text muted may dip
	// briefly during the mode-flip window, but display-sized muted
	// (eyebrows, footers) must stay readable.
	it('muted ≥ 3:1 against bg at the worst transition moment (19:30)', () => {
		const p = getPaletteForTime(new Date(2024, 5, 12, 19, 30));
		expect(contrast(p['--p-muted'], p['--p-bg'])).toBeGreaterThanOrEqual(3);
	});
});
