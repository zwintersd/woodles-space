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

// ── Enchanted hours palette ───────────────────────────────────────
// Each stop is a small story painted with two or three pastel hues plus
// one bright accent. Text + muted tokens are always tuned for ≥4.5:1
// contrast against the bg so the planner stays readable at every hour.
// No orange — substitutes use clear yellow, rose-pink, sky-blue,
// silver-lilac, and pearl in place of the previous warm-gold family.

const STOPS: PaletteStop[] = [
	// 00:00 — same as night (deep midnight + glow lilac, silver-lilac highlight)
	{ hour: 0,    bg: '#1a1638', surface: '#241f4a', text: '#ece5ff', muted: '#a896d8', accent: '#a78dff', accentSoft: 'rgba(167,141,255,0.25)', border: 'rgba(236,229,255,0.13)', highlight: '#e0d0ff' },
	// 06:30 — first light: pale rose-cream + ivory + sky-blue accent
	{ hour: 6.5,  bg: '#fbeef0', surface: '#fff7f8', text: '#2b1f30', muted: '#7c5e7c', accent: '#5fa3d4', accentSoft: 'rgba(95,163,212,0.18)',  border: 'rgba(43,31,48,0.12)',     highlight: '#c98ac8' },
	// 09:00 — bright morning: butter + fresh mint + lilac
	{ hour: 9,    bg: '#fdf6dc', surface: '#fffceb', text: '#1f2a1d', muted: '#5e6a52', accent: '#5cb966', accentSoft: 'rgba(92,185,102,0.18)',  border: 'rgba(31,42,29,0.12)',     highlight: '#9b8be0' },
	// 12:00 — noon garden: pearl-sky + sky-blue accent + rose highlight
	{ hour: 12,   bg: '#eaf2f5', surface: '#f5fafd', text: '#1f2a32', muted: '#506574', accent: '#4f9bd0', accentSoft: 'rgba(79,155,208,0.18)',  border: 'rgba(31,42,50,0.12)',     highlight: '#e08aa8' },
	// 15:00 — late afternoon ("gold afternoon"): cream + sage + clear sun-yellow + dusty rose
	{ hour: 15,   bg: '#f6efd2', surface: '#fdf7dc', text: '#2a2515', muted: '#6a5e3a', accent: '#d4b820', accentSoft: 'rgba(212,184,32,0.20)',  border: 'rgba(42,37,21,0.12)',     highlight: '#c870a0' },
	// 18:00 — rosy evening: cool pink + rose-pink + soft violet (no apricot/peach)
	{ hour: 18,   bg: '#f5d8e0', surface: '#fae3e8', text: '#2a1828', muted: '#6b4f63', accent: '#c66a98', accentSoft: 'rgba(198,106,152,0.20)', border: 'rgba(42,24,40,0.13)',     highlight: '#9070d4' },
	// 20:30 — twilight magic: deep periwinkle + luminous lilac + starlight silver-lilac
	{ hour: 20.5, bg: '#3e3568', surface: '#4a4080', text: '#f0e8ff', muted: '#b8aadc', accent: '#c5a0ff', accentSoft: 'rgba(197,160,255,0.25)', border: 'rgba(240,232,255,0.15)', highlight: '#d8c0f0' },
	// 22:00 — deep magic: midnight blue + glow lilac + silver-lilac
	{ hour: 22,   bg: '#1a1638', surface: '#241f4a', text: '#ece5ff', muted: '#a896d8', accent: '#a78dff', accentSoft: 'rgba(167,141,255,0.25)', border: 'rgba(236,229,255,0.13)', highlight: '#e0d0ff' },
	// 24:00 — same as night
	{ hour: 24,   bg: '#1a1638', surface: '#241f4a', text: '#ece5ff', muted: '#a896d8', accent: '#a78dff', accentSoft: 'rgba(167,141,255,0.25)', border: 'rgba(236,229,255,0.13)', highlight: '#e0d0ff' }
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
