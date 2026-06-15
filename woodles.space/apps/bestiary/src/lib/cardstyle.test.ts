import { describe, expect, it } from 'vitest';
import {
	defaultCardStyle,
	cardCssVars,
	cardStyleAttr,
	normalizeCardStyle,
	cardPresets,
	FRAME_STYLES,
	BORDER_MAX,
	RADIUS_MAX,
	type CardStyle
} from './cardstyle';

const base = (over: Partial<CardStyle> = {}): CardStyle => ({ ...defaultCardStyle(), ...over });

describe('defaultCardStyle', () => {
	it('is the house frame: domain accent + plate, classic, matte', () => {
		const d = defaultCardStyle();
		expect(d.frame).toBe('classic');
		expect(d.accentMode).toBe('domain');
		expect(d.bgMode).toBe('domain');
		expect(d.finish).toBe('matte');
		expect(d.tint).toBeCloseTo(0.22);
		expect(d.showStats).toBe(true);
	});
});

describe('cardCssVars', () => {
	it('follows the domain token by default', () => {
		const v = cardCssVars(defaultCardStyle(), '--b-temporal');
		expect(v['--domain']).toBe('var(--b-temporal)');
		expect(v['--card-border-color']).toBe('var(--b-border-strong)');
		expect(v['--card-radius']).toBe('18px');
		expect(v['--title-font']).toBe('var(--b-font-codex)');
		expect(v['--title-color']).toBe('var(--b-text)');
		expect(v['--plate']).toContain('color-mix');
		expect(v['--plate']).toContain('22%');
	});
	it('uses a custom accent, plate, border and title colour', () => {
		const v = cardCssVars(
			base({
				accentMode: 'custom',
				accent: '#abcdef',
				bgMode: 'custom',
				bg1: '#111111',
				bg2: '#222222',
				borderMode: 'custom',
				borderColor: '#333333',
				titleColorMode: 'custom',
				titleColor: '#eeeeee'
			}),
			'--b-temporal'
		);
		expect(v['--domain']).toBe('#abcdef');
		expect(v['--plate']).toBe('linear-gradient(160deg, #111111, #222222)');
		expect(v['--card-border-color']).toBe('#333333');
		expect(v['--title-color']).toBe('#eeeeee');
	});
	it('maps the domain title-colour mode onto the accent', () => {
		const v = cardCssVars(base({ titleColorMode: 'domain' }), '--b-spatial');
		expect(v['--title-color']).toBe('var(--b-spatial)');
	});
	it('rounds the tint into a percentage', () => {
		const v = cardCssVars(base({ tint: 0.5 }), '--b-temporal');
		expect(v['--plate']).toContain('50%');
	});
});

describe('cardStyleAttr', () => {
	it('flattens the vars and appends the rarity token', () => {
		const attr = cardStyleAttr(defaultCardStyle(), '--b-temporal', '--b-rare');
		expect(attr).toContain('--domain: var(--b-temporal)');
		expect(attr).toContain('--rarity: var(--b-rare)');
	});
});

describe('normalizeCardStyle', () => {
	it('returns the default for junk', () => {
		expect(normalizeCardStyle(null)).toEqual(defaultCardStyle());
		expect(normalizeCardStyle(42)).toEqual(defaultCardStyle());
	});
	it('clamps numbers and rejects unknown enums', () => {
		const s = normalizeCardStyle({
			tint: 5,
			borderWidth: 99,
			radius: 999,
			finishIntensity: -1,
			textureOpacity: 4,
			finish: 'bogus',
			frame: 'fullart'
		});
		expect(s.tint).toBe(1);
		expect(s.borderWidth).toBe(BORDER_MAX);
		expect(s.radius).toBe(RADIUS_MAX);
		expect(s.finishIntensity).toBe(0);
		expect(s.textureOpacity).toBe(1);
		expect(s.finish).toBe('matte'); // unknown → default
		expect(s.frame).toBe('fullart'); // valid passes
	});
	it('round-trips a full valid style', () => {
		const full = base({ frame: 'cinema', accentMode: 'custom', accent: '#123456', showStats: false });
		expect(normalizeCardStyle(full)).toEqual(full);
	});
});

describe('cardPresets', () => {
	const frames = new Set(FRAME_STYLES.map((f) => f.id));
	it('are all fully-formed styles with unique ids', () => {
		const ids = cardPresets.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const p of cardPresets) {
			expect(frames.has(p.style.frame)).toBe(true);
			// a full style survives normalization unchanged
			expect(normalizeCardStyle(p.style)).toEqual(p.style);
		}
	});
});
