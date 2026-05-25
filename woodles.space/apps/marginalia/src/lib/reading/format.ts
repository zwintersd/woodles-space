export function formatHms(ms: number): string {
	const s = Math.floor(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const mm = String(m).padStart(2, '0');
	const ss = String(sec).padStart(2, '0');
	if (h > 0) return `${h}:${mm}:${ss}`;
	return `${mm}:${ss}`;
}

export function formatMin(min: number): string {
	if (min < 1) return '< 1 min';
	const m = Math.round(min);
	if (m < 60) return `${m} min`;
	const h = Math.floor(m / 60);
	const r = m % 60;
	return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
}
