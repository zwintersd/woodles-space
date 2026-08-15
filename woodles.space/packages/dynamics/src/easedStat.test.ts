import { describe, expect, it } from 'vitest';
import { ease } from './easedStat.js';

describe('ease', () => {
	it('approaches the target and never overshoots it', () => {
		const next = ease(0, 100, 1, { up: 1 });
		expect(next).toBeGreaterThan(0);
		expect(next).toBeLessThan(100);
	});

	it('is stable at a huge dt — an offline jump lands at the target, not past it', () => {
		expect(ease(0, 100, 8 * 60 * 60, { up: 0.5 })).toBeCloseTo(100, 6);
	});

	it('does nothing once already at the target', () => {
		expect(ease(50, 50, 10, { up: 1 })).toBe(50);
	});

	it('uses the down rate only when approaching from above', () => {
		const fromAbove = ease(1, 0, 1, { up: 0.03, down: 0.05 });
		const viaUpOnly = ease(1, 0, 1, { up: 0.05 });
		expect(fromAbove).toBeCloseTo(viaUpOnly, 10);
	});

	it('clamps to floor and ceiling', () => {
		expect(ease(0.1, 0, 100, { up: 1, floor: 0.05 })).toBe(0.05);
		expect(ease(90, 100, 100, { up: 1, ceiling: 95 })).toBe(95);
	});
});
