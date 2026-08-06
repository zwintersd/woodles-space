import { beforeEach, describe, expect, it } from 'vitest';
import {
	DEFAULT_VIEW_PREFS,
	assignLayer,
	coerceViewPrefs,
	isLayerVisible,
	loadViewPrefs,
	pageOrder,
	saveViewPrefs,
	sideOf,
	visibleLayers,
	type ViewPrefs
} from './spread';

const KEY = 'woodles_write_view';

beforeEach(() => {
	localStorage.clear();
});

describe('coerceViewPrefs', () => {
	it('passes a well-formed set through unchanged', () => {
		const prefs: ViewPrefs = { mode: 'page', ruled: false, verso: 'background', recto: 'foreground' };
		expect(coerceViewPrefs(prefs)).toEqual(prefs);
	});

	it('falls back wholesale on a non-object', () => {
		expect(coerceViewPrefs(null)).toEqual(DEFAULT_VIEW_PREFS);
		expect(coerceViewPrefs('spread')).toEqual(DEFAULT_VIEW_PREFS);
		expect(coerceViewPrefs([])).toEqual(DEFAULT_VIEW_PREFS);
	});

	it('repairs field by field — a bad mode does not cost you ruled paper', () => {
		const out = coerceViewPrefs({ mode: 'scroll', ruled: false, verso: 'background', recto: 'foreground' });
		expect(out.mode).toBe(DEFAULT_VIEW_PREFS.mode);
		expect(out.ruled).toBe(false);
		expect(out.verso).toBe('background');
	});

	it('never lets both pages show the same layer', () => {
		// One element cannot be in two places; a collision would blank a page.
		const out = coerceViewPrefs({ mode: 'spread', ruled: true, verso: 'foreground', recto: 'foreground' });
		expect(out.verso).toBe('foreground');
		expect(out.recto).not.toBe('foreground');
	});

	it('replaces an unknown layer with the default for that side', () => {
		const out = coerceViewPrefs({ mode: 'spread', ruled: true, verso: 'margin', recto: 'nope' });
		expect(out.verso).toBe(DEFAULT_VIEW_PREFS.verso);
		expect(out.recto).toBe(DEFAULT_VIEW_PREFS.recto);
	});
});

describe('assignLayer', () => {
	const base: ViewPrefs = { mode: 'spread', ruled: true, verso: 'midground', recto: 'foreground' };

	it('sets a layer that is not already open', () => {
		expect(assignLayer(base, 'verso', 'background')).toEqual({ ...base, verso: 'background' });
	});

	it('returns the same object when nothing would change', () => {
		expect(assignLayer(base, 'recto', 'foreground')).toBe(base);
	});

	it('swaps the pages when asked for the layer the other one holds', () => {
		expect(assignLayer(base, 'verso', 'foreground')).toEqual({
			...base,
			verso: 'foreground',
			recto: 'midground'
		});
	});

	it('keeps verso ≠ recto true however it is driven', () => {
		let prefs = base;
		for (const layer of ['foreground', 'midground', 'background', 'foreground'] as const) {
			for (const side of ['verso', 'recto'] as const) {
				prefs = assignLayer(prefs, side, layer);
				expect(prefs.verso).not.toBe(prefs.recto);
			}
		}
	});

	it('does not mutate the prefs it was given', () => {
		assignLayer(base, 'verso', 'foreground');
		expect(base).toEqual({ mode: 'spread', ruled: true, verso: 'midground', recto: 'foreground' });
	});
});

describe('what is on screen', () => {
	const spread: ViewPrefs = { mode: 'spread', ruled: true, verso: 'midground', recto: 'foreground' };
	const page: ViewPrefs = { ...spread, mode: 'page' };

	it('shows two layers in a spread and one in page view', () => {
		expect(visibleLayers(spread, 'foreground')).toEqual(['midground', 'foreground']);
		expect(visibleLayers(page, 'background')).toEqual(['background']);
	});

	it('reports a layer visible on the far page even when focus is elsewhere', () => {
		// This is what lets margin notes stay up while you type in the midground.
		expect(isLayerVisible(spread, 'midground', 'foreground')).toBe(true);
		expect(isLayerVisible(spread, 'foreground', 'background')).toBe(false);
	});

	it('orders verso before recto, with room for the spine between', () => {
		expect(pageOrder(spread, 'midground')).toBeLessThan(pageOrder(spread, 'foreground'));
		expect(pageOrder(page, 'foreground')).toBe(2);
	});

	it('names the side a layer sits on, or nothing in page view', () => {
		expect(sideOf(spread, 'midground')).toBe('verso');
		expect(sideOf(spread, 'foreground')).toBe('recto');
		expect(sideOf(spread, 'background')).toBeNull();
		expect(sideOf(page, 'foreground')).toBeNull();
	});
});

describe('persistence', () => {
	it('round trips through localStorage', () => {
		const prefs: ViewPrefs = { mode: 'page', ruled: false, verso: 'background', recto: 'midground' };
		saveViewPrefs(prefs);
		expect(loadViewPrefs()).toEqual(prefs);
	});

	it('defaults to the open notebook on a browser that has never chosen', () => {
		expect(loadViewPrefs()).toEqual(DEFAULT_VIEW_PREFS);
		expect(DEFAULT_VIEW_PREFS.mode).toBe('spread');
	});

	it('falls back rather than throwing on corrupt stored prefs', () => {
		localStorage.setItem(KEY, '{not json');
		expect(loadViewPrefs()).toEqual(DEFAULT_VIEW_PREFS);
	});

	it('repairs a stored set that lost its invariant', () => {
		localStorage.setItem(KEY, JSON.stringify({ mode: 'spread', ruled: true, verso: 'foreground', recto: 'foreground' }));
		const out = loadViewPrefs();
		expect(out.verso).not.toBe(out.recto);
	});
});
