import { describe, expect, it } from 'vitest';
import type { Spore, SporeAccent } from './types';
import { SPORE_ACCENTS } from './types';
import {
	ACCENT_COLOR,
	DEFAULT_GLYPH,
	coverAccent,
	coverBlurb,
	coverGlyph,
	nextStatus,
	sporeStatus
} from './cover';

function spore(over: Partial<Spore> = {}): Spore {
	return {
		id: 'abc123',
		title: 'Moss',
		body: '',
		data: {},
		spellbookIds: [],
		tags: [],
		created: '2026-07-01T00:00:00.000Z',
		updated: '2026-07-01T00:00:00.000Z',
		...over
	};
}

describe('status', () => {
	it('takes the stored status when there is one', () => {
		expect(sporeStatus(spore({ status: 'grown' }))).toBe('grown');
	});

	it('defaults a pre-merge spore by whether anything was written', () => {
		expect(sporeStatus(spore({ body: '' }))).toBe('seed');
		expect(sporeStatus(spore({ body: '   ' }))).toBe('seed');
		expect(sporeStatus(spore({ body: 'some words' }))).toBe('growing');
	});

	it('never guesses grown — that is a claim only a person makes', () => {
		const long = spore({ body: 'x'.repeat(5000) });
		expect(sporeStatus(long)).toBe('growing');
	});

	it('advances forward only, and stops at grown', () => {
		expect(nextStatus('seed')).toBe('growing');
		expect(nextStatus('growing')).toBe('grown');
		expect(nextStatus('grown')).toBe('grown');
	});
});

describe('covers need no design step', () => {
	it('derives a stable accent from the id', () => {
		const first = coverAccent(spore({ id: 'stable-id' }));
		expect(coverAccent(spore({ id: 'stable-id' }))).toBe(first);
		expect(SPORE_ACCENTS).toContain(first);
	});

	it('spreads ids across every accent rather than favouring one', () => {
		const seen = new Set<SporeAccent>();
		for (let i = 0; i < 200; i += 1) seen.add(coverAccent(spore({ id: `id-${i}` })));
		expect(seen.size).toBe(SPORE_ACCENTS.length);
	});

	it('prefers a chosen accent, ignoring one that is not a real name', () => {
		expect(coverAccent(spore({ accent: 'plum' }))).toBe('plum');
		expect(coverAccent(spore({ accent: 'chartreuse' as SporeAccent, id: 'x' }))).toBe(
			coverAccent(spore({ id: 'x' }))
		);
	});

	it('maps every accent name to a colour', () => {
		for (const accent of SPORE_ACCENTS) {
			expect(ACCENT_COLOR[accent]).toMatch(/^#[0-9a-f]{6}$/);
		}
	});

	it('defaults the emblem, and caps a chosen one at two characters', () => {
		expect(coverGlyph(spore())).toBe(DEFAULT_GLYPH);
		expect(coverGlyph(spore({ glyph: '❀' }))).toBe('❀');
		expect(coverGlyph(spore({ glyph: 'abcdef' }))).toBe('ab');
		expect(coverGlyph(spore({ glyph: '   ' }))).toBe(DEFAULT_GLYPH);
	});

	it('excerpts the blurb from the body, reading links as their display text', () => {
		expect(coverBlurb(spore({ body: 'the [[Chlorophyll|pigment]] does the work' }))).toBe(
			'the pigment does the work'
		);
	});

	it('says something kind about an empty seed instead of nothing', () => {
		expect(coverBlurb(spore({ body: '' }))).toContain('seed');
	});

	it('truncates a long body on a word boundary', () => {
		const blurb = coverBlurb(spore({ body: 'word '.repeat(100) }));
		expect(blurb.length).toBeLessThanOrEqual(150);
		expect(blurb.endsWith('…')).toBe(true);
		expect(blurb).not.toMatch(/\s…$/);
	});

	it('prefers a written blurb over the excerpt', () => {
		expect(coverBlurb(spore({ body: 'ignored', blurb: 'chosen' }))).toBe('chosen');
	});
});
