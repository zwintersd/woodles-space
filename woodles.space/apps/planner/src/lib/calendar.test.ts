import { describe, expect, it } from 'vitest';
import {
	getWeekStart,
	getWeekDays,
	getMonthCalendar,
	isSameDay,
	isBeforeDay,
	weekRangeLabel
} from './calendar';

describe('getWeekStart', () => {
	it('returns the Monday for any weekday', () => {
		// 2024-06-12 is a Wednesday → Monday is 2024-06-10
		const wed = new Date(2024, 5, 12, 15, 30);
		const mon = getWeekStart(wed);
		expect(mon.getFullYear()).toBe(2024);
		expect(mon.getMonth()).toBe(5);
		expect(mon.getDate()).toBe(10);
		expect(mon.getHours()).toBe(0);
		expect(mon.getMinutes()).toBe(0);
	});
	it('treats Sunday as the end of the previous week', () => {
		// 2024-06-16 is a Sunday → its ISO Monday is 2024-06-10
		const sun = new Date(2024, 5, 16);
		const mon = getWeekStart(sun);
		expect(mon.getDate()).toBe(10);
	});
	it('returns the same date when called on a Monday', () => {
		const mon = new Date(2024, 5, 10);
		const out = getWeekStart(mon);
		expect(out.getDate()).toBe(10);
	});
	it('does not mutate the input', () => {
		const wed = new Date(2024, 5, 12);
		const before = wed.getTime();
		getWeekStart(wed);
		expect(wed.getTime()).toBe(before);
	});
});

describe('getWeekDays', () => {
	it('returns 7 consecutive days starting Monday', () => {
		const days = getWeekDays(new Date(2024, 5, 12));
		expect(days).toHaveLength(7);
		expect(days[0].getDate()).toBe(10);
		expect(days[6].getDate()).toBe(16);
	});
});

describe('getMonthCalendar', () => {
	it('produces 7-wide weeks padded with nulls', () => {
		// June 2024: starts on Saturday (offset 5), ends on Sunday (no trailing pad)
		const cal = getMonthCalendar(2024, 5);
		expect(cal.year).toBe(2024);
		expect(cal.month).toBe(5);
		cal.weeks.forEach((w) => expect(w).toHaveLength(7));
		// First non-null cell is the 1st
		const firstCell = cal.weeks[0].find((c) => c !== null);
		expect(firstCell?.getDate()).toBe(1);
	});

	it('handles a month starting on Monday with no leading nulls', () => {
		// April 2024 starts on a Monday.
		const cal = getMonthCalendar(2024, 3);
		expect(cal.weeks[0][0]?.getDate()).toBe(1);
	});

	it('includes every day of the month exactly once', () => {
		const cal = getMonthCalendar(2024, 1); // February 2024 (leap year, 29 days)
		const dates = cal.weeks.flat().filter((d): d is Date => d !== null).map((d) => d.getDate());
		expect(dates).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
	});
});

describe('isSameDay', () => {
	it('ignores time-of-day', () => {
		const a = new Date(2024, 5, 12, 0, 0);
		const b = new Date(2024, 5, 12, 23, 59);
		expect(isSameDay(a, b)).toBe(true);
	});
	it('rejects different days', () => {
		expect(isSameDay(new Date(2024, 5, 12), new Date(2024, 5, 13))).toBe(false);
	});
});

describe('isBeforeDay', () => {
	it('returns true when a precedes b', () => {
		expect(isBeforeDay(new Date(2024, 5, 12), new Date(2024, 5, 13))).toBe(true);
		expect(isBeforeDay(new Date(2024, 4, 30), new Date(2024, 5, 1))).toBe(true);
		expect(isBeforeDay(new Date(2023, 11, 31), new Date(2024, 0, 1))).toBe(true);
	});
	it('returns false for the same day or later', () => {
		expect(isBeforeDay(new Date(2024, 5, 12), new Date(2024, 5, 12))).toBe(false);
		expect(isBeforeDay(new Date(2024, 5, 13), new Date(2024, 5, 12))).toBe(false);
	});
});

describe('weekRangeLabel', () => {
	it('formats a single-month range', () => {
		const days = getWeekDays(new Date(2024, 4, 22)); // May 20–26
		expect(weekRangeLabel(days)).toBe('May 20–26, 2024');
	});
	it('formats a cross-month range', () => {
		const days = getWeekDays(new Date(2024, 4, 29)); // May 27 – Jun 2
		expect(weekRangeLabel(days)).toBe('May 27 – Jun 2, 2024');
	});
});
