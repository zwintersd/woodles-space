import { describe, expect, it } from 'vitest';
import {
	getPaletteForTime,
	currentModeLabel,
	getNamedPalette,
	getChromeForTime,
	getNamedChrome
} from './dayCycle';

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
		// Hour 0 sits on the neutral night stop (#eef0f5 → rgb form via lerp).
		expect(p['--p-bg']).toBe('rgb(238,240,245)');
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

// ── Carillon chrome ───────────────────────────────────────────────
// The instrument chrome used to be a fixed night skin, so Carillon
// opened at 9am looking like 11pm. It now rides the same clock. The
// checks below are the ones that keep it honest: it must actually be
// light during waking hours, dark at night, and readable at every
// minute in between — including inside the two flip windows.

describe('getChromeForTime', () => {
	it('returns every chrome token', () => {
		const c = getChromeForTime(new Date(2024, 5, 12, 9, 0));
		expect(Object.keys(c).sort()).toEqual([
			'--car-cream',
			'--car-glow-cool',
			'--car-glow-warm',
			'--car-grid',
			'--car-ground-bottom',
			'--car-ground-top',
			'--car-inset',
			'--car-line',
			'--car-mist',
			'--car-night',
			'--car-panel',
			'--car-pink',
			'--car-shadow',
			'--car-surge',
			'--car-surge-ink',
			'--car-wash'
		]);
	});

	// The bug this cycle exists to fix: a bright ground during the hours
	// somebody is actually awake and looking at it.
	const daylight: number[] = [7, 8, 9, 11, 13, 15, 17, 19];
	for (const hour of daylight) {
		it(`ground is light at ${String(hour).padStart(2, '0')}:00`, () => {
			const c = getChromeForTime(new Date(2024, 5, 12, hour, 0));
			expect(lum(parseColor(c['--car-night']))).toBeGreaterThan(0.5);
		});
	}

	const nighttime: number[] = [0, 2, 4, 22, 23];
	for (const hour of nighttime) {
		it(`ground is the night instrument at ${String(hour).padStart(2, '0')}:00`, () => {
			const c = getChromeForTime(new Date(2024, 5, 12, hour, 0));
			expect(lum(parseColor(c['--car-night']))).toBeLessThan(0.1);
		});
	}

	it('holds the paper cards outside the cycle', () => {
		// --car-paper / --car-ink / --car-pink-dark are static tokens: a
		// field sheet is paper at every hour. Nothing here may emit them.
		const c = getChromeForTime(new Date(2024, 5, 12, 9, 0));
		expect(c['--car-paper']).toBeUndefined();
		expect(c['--car-ink']).toBeUndefined();
	});
});

describe('getNamedChrome', () => {
	it('returns a chrome for every named mode', () => {
		const modes = ['early-light', 'full-day', 'late-afternoon', 'evening', 'dusk', 'night'] as const;
		for (const m of modes) {
			expect(getNamedChrome(m)['--car-night']).toBeDefined();
		}
	});

	it('gives night the dark ground and full-day the light one', () => {
		expect(lum(parseColor(getNamedChrome('night')['--car-night']))).toBeLessThan(0.1);
		expect(lum(parseColor(getNamedChrome('full-day')['--car-night']))).toBeGreaterThan(0.5);
	});
});

describe('chrome contrast across the day', () => {
	const samples: Array<[number, number]> = [];
	for (let h = 0; h < 24; h++) {
		for (let m = 0; m < 60; m += 15) samples.push([h, m]);
	}

	for (const [h, m] of samples) {
		const at = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
		it(`chrome text stays readable at ${at}`, () => {
			const c = getChromeForTime(new Date(2024, 5, 12, h, m));
			const ground = c['--car-night'];
			// Body text on the ground: AA.
			expect(contrast(c['--car-cream'], ground)).toBeGreaterThanOrEqual(4.5);
			// Muted labels and the two accents are display-sized: AA-Large.
			expect(contrast(c['--car-mist'], ground)).toBeGreaterThanOrEqual(3);
			expect(contrast(c['--car-pink'], ground)).toBeGreaterThanOrEqual(3);
			expect(contrast(c['--car-surge'], ground)).toBeGreaterThanOrEqual(3);
			// A surge-filled control has to keep its own label legible.
			expect(contrast(c['--car-surge-ink'], c['--car-surge'])).toBeGreaterThanOrEqual(4.5);
		});
	}

	it('never lands on a mid-tone ground', () => {
		// The flip windows are the dangerous part: a ground stuck halfway
		// between paper and night reads as mud whichever text it carries.
		for (const [h, m] of samples) {
			const l = lum(parseColor(getChromeForTime(new Date(2024, 5, 12, h, m))['--car-night']));
			expect(l < 0.16 || l > 0.42).toBe(true);
		}
	});
});
