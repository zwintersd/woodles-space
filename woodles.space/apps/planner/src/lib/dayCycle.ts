type PaletteStop = {
	hour: number; // decimal, 0–24
	bg: string;
	surface: string;
	text: string;
	muted: string;
	accent: string;
	accentSoft: string;
	border: string;
	highlight: string;
};

// Named anchor modes and their approximate hour
export type PaletteModeName = 'early-light' | 'full-day' | 'late-afternoon' | 'evening' | 'dusk' | 'night';

const STOPS: PaletteStop[] = [
	// 00:00 — night (same as 22:00)
	{ hour: 0,    bg: '#1c1926', surface: '#241f34', text: '#d2ccca', muted: '#8a8398', accent: '#9e8fa8', accentSoft: 'rgba(158,143,168,0.20)', border: 'rgba(210,204,202,0.11)', highlight: '#c8a880' },
	// 06:30 — early light: pale gold, cool greens, hint of periwinkle
	{ hour: 6.5,  bg: '#f3eedf', surface: '#faf6ec', text: '#3a3325', muted: '#8a8068', accent: '#b09e72', accentSoft: 'rgba(176,158,114,0.18)', border: 'rgba(58,51,37,0.11)', highlight: '#cdb068' },
	// 09:00 — full day: warm cream, fresh greens, clear
	{ hour: 9,    bg: '#f6f0e2', surface: '#fffcf2', text: '#2c2519', muted: '#7a7060', accent: '#6e9e6a', accentSoft: 'rgba(110,158,106,0.17)', border: 'rgba(44,37,25,0.11)', highlight: '#5a8a8c' },
	// 15:00 — late afternoon: canonical anchor, goldenrod, amber, sage
	{ hour: 15,   bg: '#f0e6c0', surface: '#faf3d8', text: '#28200f', muted: '#766850', accent: '#c48c08', accentSoft: 'rgba(196,140,8,0.17)', border: 'rgba(40,32,15,0.13)', highlight: '#9e7050' },
	// 18:00 — evening: peach, lavender creeping in, sage softening
	{ hour: 18,   bg: '#e8d4b4', surface: '#f3e6cc', text: '#261e14', muted: '#786558', accent: '#ae7250', accentSoft: 'rgba(174,114,80,0.17)', border: 'rgba(38,30,20,0.13)', highlight: '#987090' },
	// 20:30 — dusk: deeper lavender, slate-blue, warm navy
	{ hour: 20.5, bg: '#28203e', surface: '#32284c', text: '#ccc0d6', muted: '#807898', accent: '#8878a8', accentSoft: 'rgba(136,120,168,0.22)', border: 'rgba(204,192,214,0.13)', highlight: '#c49870' },
	// 22:00 — night: deep ink, warm undertones, soft not stark
	{ hour: 22,   bg: '#1c1926', surface: '#241f34', text: '#d2ccca', muted: '#8a8398', accent: '#9e8fa8', accentSoft: 'rgba(158,143,168,0.20)', border: 'rgba(210,204,202,0.11)', highlight: '#c8a880' },
	// 24:00 — same as night
	{ hour: 24,   bg: '#1c1926', surface: '#241f34', text: '#d2ccca', muted: '#8a8398', accent: '#9e8fa8', accentSoft: 'rgba(158,143,168,0.20)', border: 'rgba(210,204,202,0.11)', highlight: '#c8a880' }
];

function parseHexToRgb(hex: string): [number, number, number] | null {
	const clean = hex.replace('#', '');
	if (clean.length !== 6) return null;
	return [
		parseInt(clean.slice(0, 2), 16),
		parseInt(clean.slice(2, 4), 16),
		parseInt(clean.slice(4, 6), 16)
	];
}

function lerpColor(a: string, b: string, t: number): string {
	if (!a.startsWith('#') || !b.startsWith('#')) return a;
	const ra = parseHexToRgb(a);
	const rb = parseHexToRgb(b);
	if (!ra || !rb) return a;
	const r = Math.round(ra[0] + (rb[0] - ra[0]) * t);
	const g = Math.round(ra[1] + (rb[1] - ra[1]) * t);
	const bl = Math.round(ra[2] + (rb[2] - ra[2]) * t);
	return `rgb(${r},${g},${bl})`;
}

export function getPaletteForTime(date: Date): Record<string, string> {
	const hour = date.getHours() + date.getMinutes() / 60;

	let i = STOPS.length - 2;
	for (let j = 0; j < STOPS.length - 1; j++) {
		if (hour >= STOPS[j].hour && hour < STOPS[j + 1].hour) {
			i = j;
			break;
		}
	}

	const a = STOPS[i];
	const b = STOPS[i + 1];
	const range = b.hour - a.hour;
	const t = range === 0 ? 0 : (hour - a.hour) / range;

	return {
		'--p-bg': lerpColor(a.bg, b.bg, t),
		'--p-surface': lerpColor(a.surface, b.surface, t),
		'--p-text': lerpColor(a.text, b.text, t),
		'--p-muted': lerpColor(a.muted, b.muted, t),
		'--p-accent': lerpColor(a.accent, b.accent, t),
		'--p-accent-soft': t < 0.5 ? a.accentSoft : b.accentSoft,
		'--p-border': t < 0.5 ? a.border : b.border,
		'--p-highlight': lerpColor(a.highlight, b.highlight, t)
	};
}

export function getNamedPalette(mode: PaletteModeName): Record<string, string> {
	const hours: Record<PaletteModeName, number> = {
		'early-light': 6.5,
		'full-day': 9,
		'late-afternoon': 15,
		'evening': 18,
		'dusk': 20.5,
		'night': 22
	};
	const d = new Date();
	d.setHours(Math.floor(hours[mode]), Math.round((hours[mode] % 1) * 60), 0, 0);
	return getPaletteForTime(d);
}

// Returns which named mode label best describes the current hour
export function currentModeLabel(date: Date): PaletteModeName {
	const h = date.getHours() + date.getMinutes() / 60;
	if (h < 8) return 'early-light';
	if (h < 12) return 'full-day';
	if (h < 17) return 'late-afternoon';
	if (h < 20) return 'evening';
	if (h < 22) return 'dusk';
	return 'night';
}
