import { afterEach, describe, expect, it, vi } from 'vitest';
import { collect, motionDuration, prefersReducedMotion, sparkBurst } from './motion';

function mockMatchMedia(matches: boolean): void {
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {}
	}));
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('prefersReducedMotion', () => {
	it('is false when matchMedia is unavailable (e.g. SSR/test setup)', () => {
		vi.stubGlobal('matchMedia', undefined);
		expect(prefersReducedMotion()).toBe(false);
	});

	it('reflects a false matchMedia result', () => {
		mockMatchMedia(false);
		expect(prefersReducedMotion()).toBe(false);
	});

	it('reflects a true matchMedia result', () => {
		mockMatchMedia(true);
		expect(prefersReducedMotion()).toBe(true);
	});
});

describe('motionDuration', () => {
	it('passes the duration through when motion is not reduced', () => {
		mockMatchMedia(false);
		expect(motionDuration(260)).toBe(260);
	});

	it('collapses to zero when motion is reduced', () => {
		mockMatchMedia(true);
		expect(motionDuration(260)).toBe(0);
	});
});

describe('sparkBurst', () => {
	it('throws the asked-for number of flecks', () => {
		expect(sparkBurst(5)).toHaveLength(5);
		expect(sparkBurst()).toHaveLength(7);
	});

	it('spreads them evenly around the circle', () => {
		const angles = sparkBurst(4).map((s) => s.angle);
		expect(angles).toEqual([-90, 0, 90, 180]);
	});

	it('is deterministic — the same burst twice over', () => {
		expect(sparkBurst(6)).toEqual(sparkBurst(6));
	});

	it('varies distance and delay between neighbours, so a burst is not a ring', () => {
		const burst = sparkBurst(6);
		expect(new Set(burst.map((s) => s.distance)).size).toBeGreaterThan(1);
		expect(new Set(burst.map((s) => s.delay)).size).toBeGreaterThan(1);
	});

	it('gives every fleck its own id', () => {
		const ids = sparkBurst(7).map((s) => s.id);
		expect(new Set(ids).size).toBe(7);
	});

	it('has nothing to throw for a nonsense count', () => {
		expect(sparkBurst(0)).toEqual([]);
		expect(sparkBurst(-3)).toEqual([]);
		expect(sparkBurst(Number.NaN)).toEqual([]);
	});
});

describe('collect', () => {
	// A row of two, the first of which is the one leaving — the arrangement
	// the board is in whenever a section holds more than one entry.
	function row(height = 26, gap = '6px'): { leaving: HTMLElement; staying: HTMLElement } {
		const list = document.createElement('div');
		list.style.rowGap = gap;
		const leaving = document.createElement('div');
		const staying = document.createElement('div');
		Object.defineProperty(leaving, 'offsetHeight', { value: height, configurable: true });
		list.append(leaving, staying);
		document.body.append(list);
		return { leaving, staying };
	}

	function frameAt(node: HTMLElement, t: number): string {
		mockMatchMedia(false);
		const css = collect(node).css;
		return css?.(t, 1 - t) ?? '';
	}

	function numberIn(frame: string, property: string): number {
		const match = frame.match(new RegExp(`${property}:\\s*(-?[\\d.]+)`));
		return match ? Number(match[1]) : Number.NaN;
	}

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('collapses to nothing when motion is reduced', () => {
		mockMatchMedia(true);
		const { leaving } = row();
		expect(collect(leaving).duration).toBe(0);
	});

	it('starts at full height, unflooded', () => {
		const { leaving } = row(26);
		const start = frameAt(leaving, 1);
		expect(numberIn(start, 'height')).toBe(26);
		expect(numberIn(start, '--ta-collect')).toBe(0);
	});

	it('floods before it folds — the row is still full height once the color has landed', () => {
		const { leaving } = row(26);
		// t counts down from 1, so 0.66 is the end of the flood by default.
		const flooded = frameAt(leaving, 0.66);
		expect(numberIn(flooded, '--ta-collect')).toBeCloseTo(1, 5);
		expect(numberIn(flooded, 'height')).toBe(26);
	});

	it('ends folded shut', () => {
		const { leaving } = row(26);
		const end = frameAt(leaving, 0);
		expect(numberIn(end, 'height')).toBe(0);
		expect(numberIn(end, 'opacity')).toBe(0);
	});

	it('hides its own overflow only while it is leaving', () => {
		const { leaving } = row();
		expect(frameAt(leaving, 0.5)).toContain('overflow: hidden');
		// and never as a resting style — the chip throws sparks past its edges
		expect(leaving.style.overflow).toBe('');
	});

	it('takes back the row gap it was holding open below it', () => {
		const { leaving } = row(26, '6px');
		expect(numberIn(frameAt(leaving, 0), 'margin-bottom')).toBe(-6);
	});

	it('takes it back from above instead when it was the last of the list', () => {
		const { staying } = row(26, '6px');
		Object.defineProperty(staying, 'offsetHeight', { value: 26, configurable: true });
		expect(numberIn(frameAt(staying, 0), 'margin-top')).toBe(-6);
	});

	it('leaves the margins alone when there is no gap to reclaim', () => {
		const { leaving } = row(26, '0px');
		const end = frameAt(leaving, 0);
		expect(end).not.toContain('margin-bottom');
		expect(end).not.toContain('margin-top');
	});
});

describe('collect phases', () => {
	function node(height = 26): HTMLElement {
		const el = document.createElement('div');
		Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true });
		document.body.append(el);
		return el;
	}

	function heightAt(el: HTMLElement, t: number, options?: { commitFraction?: number }): number {
		mockMatchMedia(false);
		const frame = collect(el, options).css?.(t, 1 - t) ?? '';
		return Number(frame.match(/height:\s*([\d.]+)/)?.[1] ?? Number.NaN);
	}

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('folds monotonically once the flood is done', () => {
		const el = node(26);
		const heights = [0.6, 0.45, 0.3, 0.15, 0].map((t) => heightAt(el, t));
		for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeLessThan(heights[i - 1]);
	});

	it('takes a longer flood at its word', () => {
		const el = node(26);
		// Still unfolded halfway through, where the default would already be
		// most of the way shut.
		expect(heightAt(el, 0.4, { commitFraction: 0.6 })).toBe(26);
		expect(heightAt(el, 0.4, { commitFraction: 0.34 })).toBeLessThan(26);
	});

	it('falls back to the default flood rather than dividing by a zero-length one', () => {
		const el = node(26);
		expect(heightAt(el, 0.5, { commitFraction: 0 })).toBe(heightAt(el, 0.5));
		expect(heightAt(el, 0.5, { commitFraction: 1 })).toBe(heightAt(el, 0.5));
	});
});
