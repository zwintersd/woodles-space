import { describe, expect, it } from 'vitest';
import { formatHms, formatMin } from './format';

describe('formatHms', () => {
	it('formats sub-minute as MM:SS', () => {
		expect(formatHms(0)).toBe('00:00');
		expect(formatHms(7_000)).toBe('00:07');
		expect(formatHms(59_000)).toBe('00:59');
	});
	it('formats minute-scale as MM:SS', () => {
		expect(formatHms(90_000)).toBe('01:30');
		expect(formatHms(59 * 60_000 + 59_000)).toBe('59:59');
	});
	it('formats hour-scale as H:MM:SS', () => {
		expect(formatHms(60 * 60_000)).toBe('1:00:00');
		expect(formatHms(60 * 60_000 + 90_000)).toBe('1:01:30');
		expect(formatHms(2 * 60 * 60_000 + 3 * 60_000 + 7_000)).toBe('2:03:07');
	});
});

describe('formatMin', () => {
	it('floors sub-minute values', () => {
		expect(formatMin(0)).toBe('< 1 min');
		expect(formatMin(0.7)).toBe('< 1 min');
	});
	it('formats sub-hour values', () => {
		expect(formatMin(1)).toBe('1 min');
		expect(formatMin(45)).toBe('45 min');
		expect(formatMin(59.4)).toBe('59 min');
	});
	it('formats whole hours', () => {
		expect(formatMin(60)).toBe('1 hr');
		expect(formatMin(120)).toBe('2 hr');
	});
	it('formats mixed hours + minutes', () => {
		expect(formatMin(90)).toBe('1 hr 30 min');
		expect(formatMin(125)).toBe('2 hr 5 min');
	});
});
