import { afterEach, describe, expect, it, vi } from 'vitest';
import { motionDuration, prefersReducedMotion } from './motion';

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
