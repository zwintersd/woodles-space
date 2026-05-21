export function padTwo(n: number): string {
	return n.toString().padStart(2, '0');
}

export function formatTime(date: Date): string {
	return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

export function parseTime(t: string): { hours: number; minutes: number } {
	const [h, m] = t.split(':').map(Number);
	return { hours: h ?? 0, minutes: m ?? 0 };
}

export function timeToMinutes(t: string): number {
	const { hours, minutes } = parseTime(t);
	return hours * 60 + minutes;
}

export function minutesToDisplay(minutes: number): string {
	if (minutes <= 0) return '0m';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m}m`;
	if (m === 0) return `${h}h`;
	return `${h}h ${m}m`;
}

export function dateKey(date: Date): string {
	return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

export function nowMinutes(date: Date): number {
	return date.getHours() * 60 + date.getMinutes();
}

export function uid(): string {
	return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function dayOfWeekLabel(date: Date): string {
	return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()];
}

export function shortDateLabel(date: Date): string {
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	return `${months[date.getMonth()]} ${date.getDate()}`;
}

export function formatHHMM(totalMinutes: number): string {
	const h = Math.floor(totalMinutes / 60) % 24;
	const m = totalMinutes % 60;
	return `${padTwo(h)}:${padTwo(m)}`;
}
