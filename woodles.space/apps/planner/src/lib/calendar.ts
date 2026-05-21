export type CalendarWeek = (Date | null)[];

export type CalendarMonth = {
	year: number;
	month: number; // 0–11
	weeks: CalendarWeek[];
};

// Returns the Monday that starts the ISO week containing `date`
export function getWeekStart(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	const dow = d.getDay();
	const diff = dow === 0 ? -6 : 1 - dow;
	d.setDate(d.getDate() + diff);
	return d;
}

// Returns the 7 dates (Mon–Sun) of the week containing `date`
export function getWeekDays(date: Date): Date[] {
	const start = getWeekStart(date);
	return Array.from({ length: 7 }, (_, i) => {
		const d = new Date(start);
		d.setDate(d.getDate() + i);
		return d;
	});
}

// Returns the calendar grid (Monday-first) for a given year+month
export function getMonthCalendar(year: number, month: number): CalendarMonth {
	const firstDay = new Date(year, month, 1);
	const lastDate = new Date(year, month + 1, 0).getDate();
	const startDOW = firstDay.getDay();
	const startOffset = startDOW === 0 ? 6 : startDOW - 1;

	const cells: (Date | null)[] = [];
	for (let i = 0; i < startOffset; i++) cells.push(null);
	for (let d = 1; d <= lastDate; d++) cells.push(new Date(year, month, d));
	while (cells.length % 7 !== 0) cells.push(null);

	const weeks: CalendarWeek[] = [];
	for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
	return { year, month, weeks };
}

// Returns all 12 CalendarMonths for `year`
export function getYearCalendar(year: number): CalendarMonth[] {
	return Array.from({ length: 12 }, (_, m) => getMonthCalendar(year, m));
}

export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

export function isBeforeDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() < b.getFullYear() ||
		(a.getFullYear() === b.getFullYear() && a.getMonth() < b.getMonth()) ||
		(a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() < b.getDate())
	);
}

export const DOW_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const DOW_LABELS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_NAMES_SHORT = [
	'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
	'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// Format a week range as "May 19–25" or "May 26 – Jun 1"
export function weekRangeLabel(days: Date[]): string {
	const start = days[0];
	const end = days[6];
	const sm = MONTH_NAMES_SHORT[start.getMonth()];
	const em = MONTH_NAMES_SHORT[end.getMonth()];
	if (start.getMonth() === end.getMonth()) {
		return `${sm} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
	}
	return `${sm} ${start.getDate()} – ${em} ${end.getDate()}, ${end.getFullYear()}`;
}
