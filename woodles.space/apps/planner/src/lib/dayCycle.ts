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

// ── Daydream hours palette ────────────────────────────────────────
// Bright pastel anchors inspired by soft rainbow skies: cotton-candy
// dawn, mint-blue morning, pearl-sky noon, prismatic afternoon, and
// lavender evening. Night does not go dark; it quiets into a neutral
// moonlit pearl so the planner feels calmer rather than heavier.

const STOPS: PaletteStop[] = [
	// 00:00 — neutral night: moonlit pearl + quiet blue-grey + soft lavender
	{ hour: 0,    bg: '#eef0f5', surface: '#f8f8fb', text: '#2d2d42', muted: '#676b7c', accent: '#8f9ab4', accentSoft: 'rgba(143,154,180,0.18)', border: 'rgba(45,45,66,0.11)', highlight: '#b8a8d8' },
	// 06:30 — cotton-candy dawn: pink cloud + sky-blue accent
	{ hour: 6.5,  bg: '#ffeaf4', surface: '#fff6fb', text: '#30243e', muted: '#725c82', accent: '#56bfe4', accentSoft: 'rgba(86,191,228,0.20)',  border: 'rgba(48,36,62,0.12)', highlight: '#ff8fc7' },
	// 09:00 — bright morning: mint milk + bluebell + bubblegum highlight
	{ hour: 9,    bg: '#e9fbe9', surface: '#f6fff7', text: '#20343a', muted: '#536f73', accent: '#5bbfe8', accentSoft: 'rgba(91,191,232,0.20)',  border: 'rgba(32,52,58,0.12)', highlight: '#f29bd2' },
	// 12:00 — rainbow noon: pearl sky + saturated cornflower
	{ hour: 12,   bg: '#e9f6ff', surface: '#f7fcff', text: '#223047', muted: '#557086', accent: '#6b8cff', accentSoft: 'rgba(107,140,255,0.20)', border: 'rgba(34,48,71,0.12)', highlight: '#ff9fc9' },
	// 15:00 — prismatic afternoon: aqua sky + cloud-white + sunny yellow
	{ hour: 15,   bg: '#e8fbff', surface: '#fbffff', text: '#25354a', muted: '#5f7387', accent: '#31c7e8', accentSoft: 'rgba(49,199,232,0.20)',  border: 'rgba(37,53,74,0.12)', highlight: '#ffd84f' },
	// 18:00 — pastel evening: blue-lavender, not mauve
	{ hour: 18,   bg: '#f0eaff', surface: '#fbf8ff', text: '#332946', muted: '#6a6380', accent: '#bd8cff', accentSoft: 'rgba(189,140,255,0.20)', border: 'rgba(51,41,70,0.12)', highlight: '#7edfff' },
	// 20:30 — quiet twilight: cooler lilac, still light
	{ hour: 20.5, bg: '#edf0ff', surface: '#f7f8ff', text: '#2d3149', muted: '#666d86', accent: '#9b8df2', accentSoft: 'rgba(155,141,242,0.18)', border: 'rgba(45,49,73,0.11)', highlight: '#90cce8' },
	// 22:00 — neutral night returns: less engaging, not darker
	{ hour: 22,   bg: '#eef0f5', surface: '#f8f8fb', text: '#2d2d42', muted: '#676b7c', accent: '#8f9ab4', accentSoft: 'rgba(143,154,180,0.18)', border: 'rgba(45,45,66,0.11)', highlight: '#b8a8d8' },
	// 24:00 — same as night
	{ hour: 24,   bg: '#eef0f5', surface: '#f8f8fb', text: '#2d2d42', muted: '#676b7c', accent: '#8f9ab4', accentSoft: 'rgba(143,154,180,0.18)', border: 'rgba(45,45,66,0.11)', highlight: '#b8a8d8' }
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

// ── Contrast helpers ──────────────────────────────────────────────
// Used to solve the light↔dark mode-flip transitions: when one stop
// expects dark text and the next expects light text, linear interp
// of text color crosses through mid-gray exactly when the bg crosses
// through mid-tone — guaranteed unreadable. We instead snap text to
// whichever endpoint reads better against the live bg.

function relativeLuminance(r: number, g: number, b: number): number {
	const lin = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(l1: number, l2: number): number {
	const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
	return (hi + 0.05) / (lo + 0.05);
}

function lumOfHex(hex: string): number {
	const rgb = parseHexToRgb(hex);
	if (!rgb) return 0.5;
	return relativeLuminance(rgb[0], rgb[1], rgb[2]);
}

function isDarkStop(s: PaletteStop): boolean {
	return lumOfHex(s.bg) < 0.3;
}

// Quintic ease — used on the bg curve during mode-flip transitions
// so the bg lingers in "still light" longer, rushes through the
// unreadable mid-tone in a few minutes, then settles into "fully
// dark". Matches how blue hour actually feels — sudden.
function easeInOutQuintic(t: number): number {
	return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
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

	const aDark = isDarkStop(a);
	const bDark = isDarkStop(b);
	const modeFlip = aDark !== bDark;
	// Ease bg interpolation through the dead-zone on mode flips
	const eased = modeFlip ? easeInOutQuintic(t) : t;

	// Compute interpolated bg as an RGB tuple so we can measure its
	// luminance for the contrast-aware text pick below.
	const aBg = parseHexToRgb(a.bg);
	const bBg = parseHexToRgb(b.bg);
	let bgStr: string;
	let bgLum: number;
	if (aBg && bBg) {
		const bgR = Math.round(aBg[0] + (bBg[0] - aBg[0]) * eased);
		const bgG = Math.round(aBg[1] + (bBg[1] - aBg[1]) * eased);
		const bgB = Math.round(aBg[2] + (bBg[2] - aBg[2]) * eased);
		bgStr = `rgb(${bgR},${bgG},${bgB})`;
		bgLum = relativeLuminance(bgR, bgG, bgB);
	} else {
		bgStr = a.bg;
		bgLum = lumOfHex(a.bg);
	}

	let textColor: string;
	let mutedColor: string;
	let accentSoftColor: string;
	let borderColor: string;

	if (modeFlip) {
		// Pick whichever stop's text family gives higher contrast
		// against the live bg. The picker flips at the exact moment
		// the "wrong" text starts losing readability, so we never
		// drift through unreadable mid-gray.
		const aContrast = contrastRatio(lumOfHex(a.text), bgLum);
		const bContrast = contrastRatio(lumOfHex(b.text), bgLum);
		const winner = aContrast >= bContrast ? a : b;
		textColor = winner.text;
		mutedColor = winner.muted;
		accentSoftColor = winner.accentSoft;
		borderColor = winner.border;
	} else {
		textColor = lerpColor(a.text, b.text, t);
		mutedColor = lerpColor(a.muted, b.muted, t);
		accentSoftColor = t < 0.5 ? a.accentSoft : b.accentSoft;
		borderColor = t < 0.5 ? a.border : b.border;
	}

	return {
		'--p-bg': bgStr,
		'--p-surface': lerpColor(a.surface, b.surface, eased),
		'--p-text': textColor,
		'--p-muted': mutedColor,
		'--p-accent': lerpColor(a.accent, b.accent, eased),
		'--p-accent-soft': accentSoftColor,
		'--p-border': borderColor,
		'--p-highlight': lerpColor(a.highlight, b.highlight, eased)
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
