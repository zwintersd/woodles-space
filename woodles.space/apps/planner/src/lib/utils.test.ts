import { describe, expect, it } from 'vitest';
import {
	padTwo,
	parseTime,
	timeToMinutes,
	minutesToDisplay,
	dateKey,
	nowMinutes,
	dayOfWeekLabel,
	shortDateLabel,
	formatHHMM
} from './utils';

describe('padTwo', () => {
	it('pads single digits', () => {
		expect(padTwo(0)).toBe('00');
		expect(padTwo(7)).toBe('07');
	});
	it('passes through two-digit numbers', () => {
		expect(padTwo(10)).toBe('10');
		expect(padTwo(59)).toBe('59');
	});
});

describe('parseTime', () => {
	it('parses HH:MM', () => {
		expect(parseTime('09:30')).toEqual({ hours: 9, minutes: 30 });
		expect(parseTime('00:00')).toEqual({ hours: 0, minutes: 0 });
		expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
	});
	it('defaults missing parts to 0', () => {
		expect(parseTime('')).toEqual({ hours: 0, minutes: 0 });
		expect(parseTime('12')).toEqual({ hours: 12, minutes: 0 });
	});
});

describe('timeToMinutes', () => {
	it('converts HH:MM to total minutes', () => {
		expect(timeToMinutes('00:00')).toBe(0);
		expect(timeToMinutes('01:30')).toBe(90);
		expect(timeToMinutes('23:59')).toBe(23 * 60 + 59);
	});
});

describe('minutesToDisplay', () => {
	it('clamps zero/negative to "0m"', () => {
		expect(minutesToDisplay(0)).toBe('0m');
		expect(minutesToDisplay(-5)).toBe('0m');
	});
	it('formats sub-hour as Nm', () => {
		expect(minutesToDisplay(45)).toBe('45m');
	});
	it('formats whole hours as Nh', () => {
		expect(minutesToDisplay(60)).toBe('1h');
		expect(minutesToDisplay(120)).toBe('2h');
	});
	it('formats mixed as Nh Mm', () => {
		expect(minutesToDisplay(90)).toBe('1h 30m');
		expect(minutesToDisplay(125)).toBe('2h 5m');
	});
});

describe('dateKey', () => {
	it('emits YYYY-MM-DD with zero-padding', () => {
		expect(dateKey(new Date(2024, 0, 3))).toBe('2024-01-03');
		expect(dateKey(new Date(2024, 11, 31))).toBe('2024-12-31');
	});
});

describe('nowMinutes', () => {
	it('returns minutes since midnight', () => {
		const d = new Date(2024, 5, 15, 9, 30);
		expect(nowMinutes(d)).toBe(9 * 60 + 30);
	});
});

describe('dayOfWeekLabel', () => {
	it('returns SUN through SAT', () => {
		// 2024-06-09 was a Sunday
		expect(dayOfWeekLabel(new Date(2024, 5, 9))).toBe('SUN');
		expect(dayOfWeekLabel(new Date(2024, 5, 10))).toBe('MON');
		expect(dayOfWeekLabel(new Date(2024, 5, 15))).toBe('SAT');
	});
});

describe('shortDateLabel', () => {
	it('emits Mon D', () => {
		expect(shortDateLabel(new Date(2024, 0, 1))).toBe('Jan 1');
		expect(shortDateLabel(new Date(2024, 11, 25))).toBe('Dec 25');
	});
});

describe('formatHHMM', () => {
	it('formats total minutes as HH:MM', () => {
		expect(formatHHMM(0)).toBe('00:00');
		expect(formatHHMM(90)).toBe('01:30');
		expect(formatHHMM(23 * 60 + 59)).toBe('23:59');
	});
	it('wraps past 24h', () => {
		expect(formatHHMM(25 * 60)).toBe('01:00');
	});
});
