import { describe, expect, it } from 'vitest';
import { holoVars, HOLO_MAX_TILT } from './holo';

describe('holoVars', () => {
	it('is flat and centred at rest (active 0)', () => {
		const v = holoVars(0.5, 0.5, 0);
		expect(v['--holo-active']).toBe('0.0000');
		expect(v['--holo-rx']).toBe('0.000deg');
		expect(v['--holo-ry']).toBe('0.000deg');
	});

	it('tilts toward the pointer, scaled by how live it is', () => {
		// top-left, fully live: rx tips up (+), ry tips left (−)
		const v = holoVars(0, 0, 1);
		expect(parseFloat(v['--holo-rx'])).toBeCloseTo(HOLO_MAX_TILT);
		expect(parseFloat(v['--holo-ry'])).toBeCloseTo(-HOLO_MAX_TILT);
		// the opposite corner mirrors it
		const w = holoVars(1, 1, 1);
		expect(parseFloat(w['--holo-rx'])).toBeCloseTo(-HOLO_MAX_TILT);
		expect(parseFloat(w['--holo-ry'])).toBeCloseTo(HOLO_MAX_TILT);
	});

	it('scales the tilt down with partial activity', () => {
		const v = holoVars(1, 0.5, 0.5);
		expect(parseFloat(v['--holo-ry'])).toBeCloseTo(HOLO_MAX_TILT * 0.5);
	});

	it('drops the tilt entirely under reduced motion, keeping the sheen position', () => {
		const v = holoVars(0, 0, 1, true);
		expect(v['--holo-rx']).toBe('0.000deg');
		expect(v['--holo-ry']).toBe('0.000deg');
		expect(v['--holo-px']).toBe('0.0000');
		expect(v['--holo-active']).toBe('1.0000');
	});

	it('clamps out-of-range input', () => {
		const v = holoVars(2, -1, 5);
		expect(v['--holo-px']).toBe('1.0000');
		expect(v['--holo-py']).toBe('0.0000');
		expect(v['--holo-active']).toBe('1.0000');
	});
});
