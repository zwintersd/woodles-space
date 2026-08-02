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

const MODE_HOURS: Record<PaletteModeName, number> = {
	'early-light': 6.5,
	'full-day': 9,
	'late-afternoon': 15,
	'evening': 18,
	'dusk': 20.5,
	'night': 22
};

function dateForMode(mode: PaletteModeName): Date {
	const hour = MODE_HOURS[mode];
	const d = new Date();
	d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
	return d;
}

export function getNamedPalette(mode: PaletteModeName): Record<string, string> {
	return getPaletteForTime(dateForMode(mode));
}

// ── Carillon chrome cycle ─────────────────────────────────────────
// The --p-* palette above dresses the planner's inner surfaces. The
// --car-* tokens dress the instrument itself: the ground the app sits
// on, the text and hairlines drawn straight onto it, the graph-paper
// rule, the corner washes. Those used to be a fixed night skin, so
// Carillon opened at 9am looking like 11pm. They now ride the same
// clock the palette does.
//
// Two families, not a smooth ramp between opposites: a *paper* day and
// the *night instrument*. Hues move freely *within* a family, but the
// crossing between them is a switch, not a dissolve. Blending paper
// toward night necessarily passes through a mid-tone that reads as mud
// under either text color — the daydream palette above never has to
// solve this because none of its stops are dark. So a flip segment
// snaps at its midpoint (about 06:00 and 21:15) and the CSS transition
// on .planner-root softens the change. An instrument's lamp coming on
// at dusk is a switch anyway.
//
// The paper cards inside the instrument (--car-paper / --car-ink /
// --car-pink-dark) are deliberately NOT in this cycle. A field sheet is
// paper at every hour; only the desk it lies on changes.

type ChromeStop = {
	hour: number;
	// interpolated (hex)
	ground: string; // --car-night   · the ground the instrument sits on
	groundTop: string; // --car-ground-top    · shell gradient, first stop
	groundBottom: string; // --car-ground-bottom · shell gradient, last stop
	panel: string; // --car-panel   · elevated block on the ground
	fg: string; // --car-cream   · primary text on the ground
	muted: string; // --car-mist    · secondary text on the ground
	accent: string; // --car-pink    · accent on the ground
	surge: string; // --car-surge     · the surge accent on the ground
	surgeInk: string; // --car-surge-ink · text on a surge-filled control
	// snapped (alpha-bearing)
	line: string; // --car-line    · hairline on the ground
	wash: string; // --car-wash    · hover/active fill on the ground
	inset: string; // --car-inset  · recessed field (inputs) on the ground
	grid: string; // --car-grid    · graph-paper rule
	shadow: string; // --car-shadow  · what a paper card casts
	glowWarm: string; // --car-glow-warm · pink corner wash
	glowCool: string; // --car-glow-cool · sage corner wash
};

const NIGHT_CHROME = {
	ground: '#17101f',
	groundTop: '#1d1428',
	groundBottom: '#140d1d',
	panel: '#24182f',
	fg: '#fff6da',
	muted: '#b9adc0',
	accent: '#f09ab8',
	surge: '#ff895a',
	surgeInk: '#20111c',
	line: 'rgba(255,246,218,0.14)',
	wash: 'rgba(255,246,218,0.065)',
	inset: 'rgba(8,4,14,0.22)',
	grid: 'rgba(255,246,218,0.025)',
	shadow: 'rgba(17,7,27,0.24)',
	glowWarm: 'rgba(240,154,184,0.13)',
	glowCool: 'rgba(113,207,184,0.08)'
} as const;

// Shared by every daylight stop: plum ink on paper, deepened Carillon
// pink. Only the ground's hue moves across the day, echoing the --p-*
// anchors (blush dawn, mint morning, sky noon, aqua afternoon,
// lavender evening) so both systems agree about what hour it is.
const DAY_INK = {
	panel: '#fffaf4',
	fg: '#33253c',
	muted: '#6b6274',
	accent: '#b8446e',
	surge: '#b4471c',
	surgeInk: '#fff6ea',
	line: 'rgba(51,37,60,0.14)',
	wash: 'rgba(51,37,60,0.055)',
	inset: 'rgba(255,255,255,0.55)',
	grid: 'rgba(51,37,60,0.045)',
	shadow: 'rgba(70,48,74,0.16)',
	glowWarm: 'rgba(240,154,184,0.18)',
	glowCool: 'rgba(113,207,184,0.10)'
} as const;

const CHROME_STOPS: ChromeStop[] = [
	{ hour: 0, ...NIGHT_CHROME },
	// 05:30 — still the night instrument
	{ hour: 5.5, ...NIGHT_CHROME },
	// 06:30 — sunrise: blush paper
	{ hour: 6.5, ground: '#efdfe6', groundTop: '#f8e9ec', groundBottom: '#e7d8e2', ...DAY_INK },
	// 09:00 — bright morning: mint-tinted paper
	{ hour: 9, ground: '#e3e9e3', groundTop: '#eef3ec', groundBottom: '#dce4de', ...DAY_INK },
	// 12:00 — noon: pale sky
	{ hour: 12, ground: '#e1e8ee', groundTop: '#eef4f8', groundBottom: '#dae3ea', ...DAY_INK },
	// 15:00 — afternoon: pale aqua
	{ hour: 15, ground: '#e0eaec', groundTop: '#edf6f7', groundBottom: '#d9e5e8', ...DAY_INK },
	// 18:00 — evening: pale lavender
	{ hour: 18, ground: '#e6e1ef', groundTop: '#f2eef9', groundBottom: '#ded8ea', ...DAY_INK },
	// 20:30 — dusk: deeper lilac, still light
	{ hour: 20.5, ground: '#d6cfe1', groundTop: '#e2dbeb', groundBottom: '#cec6dc', ...DAY_INK },
	// 22:00 — the instrument returns
	{ hour: 22, ...NIGHT_CHROME },
	{ hour: 24, ...NIGHT_CHROME }
];

function isDarkChrome(stop: ChromeStop): boolean {
	return lumOfHex(stop.ground) < 0.3;
}

export function getChromeForTime(date: Date): Record<string, string> {
	const hour = date.getHours() + date.getMinutes() / 60;

	let i = CHROME_STOPS.length - 2;
	for (let j = 0; j < CHROME_STOPS.length - 1; j++) {
		if (hour >= CHROME_STOPS[j].hour && hour < CHROME_STOPS[j + 1].hour) {
			i = j;
			break;
		}
	}

	const a = CHROME_STOPS[i];
	const b = CHROME_STOPS[i + 1];
	const range = b.hour - a.hour;
	const t = range === 0 ? 0 : (hour - a.hour) / range;

	// Which family this minute belongs to. Everything that can't be
	// interpolated — the alpha-bearing tokens, the text colors that have
	// to stay readable — comes from it wholesale.
	const owner = t < 0.5 ? a : b;
	// Across a flip the ground comes from the owner too, so it is always
	// either paper or night and never the mid-tone in between.
	const flip = isDarkChrome(a) !== isDarkChrome(b);

	return {
		'--car-night': flip ? owner.ground : lerpColor(a.ground, b.ground, t),
		'--car-ground-top': flip ? owner.groundTop : lerpColor(a.groundTop, b.groundTop, t),
		'--car-ground-bottom': flip
			? owner.groundBottom
			: lerpColor(a.groundBottom, b.groundBottom, t),
		'--car-panel': owner.panel,
		'--car-cream': owner.fg,
		'--car-mist': owner.muted,
		'--car-pink': owner.accent,
		'--car-surge': owner.surge,
		'--car-surge-ink': owner.surgeInk,
		'--car-line': owner.line,
		'--car-wash': owner.wash,
		'--car-inset': owner.inset,
		'--car-grid': owner.grid,
		'--car-shadow': owner.shadow,
		'--car-glow-warm': owner.glowWarm,
		'--car-glow-cool': owner.glowCool
	};
}

export function getNamedChrome(mode: PaletteModeName): Record<string, string> {
	return getChromeForTime(dateForMode(mode));
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
