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

// ── Parchment & stained glass ─────────────────────────────────────
// Every stop is vellum: warm, light, inked in oak-gall aubergine. What
// moves through the day is the glass — each hour's accent is a jewel,
// as if the sun had moved on to the next window: rose garnet at dawn,
// emerald in the morning, sapphire at noon, peacock teal in the
// afternoon, amethyst at evening, lapis at dusk. Night does not go
// dark here; it quiets into a moonlit, greyer vellum.

const STOPS: PaletteStop[] = [
	// 00:00 — moonlit vellum + dusky lapis + amethyst
	{ hour: 0,    bg: '#ece4d6', surface: '#f7f1e6', text: '#2a2033', muted: '#665a6c', accent: '#4b4f8f', accentSoft: 'rgba(75,79,143,0.16)',  border: 'rgba(42,32,51,0.14)', highlight: '#a98bc9' },
	// 06:30 — dawn: rose-washed parchment + garnet + amber
	{ hour: 6.5,  bg: '#f6e3d6', surface: '#fdf3ea', text: '#33202f', muted: '#74586a', accent: '#b2365f', accentSoft: 'rgba(178,54,95,0.16)',  border: 'rgba(51,32,47,0.14)', highlight: '#e7a33a' },
	// 09:00 — morning: green-gold parchment + emerald + gilt
	{ hour: 9,    bg: '#efe7cf', surface: '#fbf6e6', text: '#23302a', muted: '#5a6a5e', accent: '#1f7a5a', accentSoft: 'rgba(31,122,90,0.16)',  border: 'rgba(35,48,42,0.14)', highlight: '#d9a521' },
	// 12:00 — noon: bright vellum + sapphire + ruby
	{ hour: 12,   bg: '#ede6d3', surface: '#fbf7ec', text: '#212a44', muted: '#56607a', accent: '#2c56a8', accentSoft: 'rgba(44,86,168,0.16)',  border: 'rgba(33,42,68,0.14)', highlight: '#c9405f' },
	// 15:00 — afternoon: amber parchment + peacock teal + marigold
	{ hour: 15,   bg: '#f2e5c9', surface: '#fcf5e3', text: '#2e2630', muted: '#6c5e60', accent: '#16798a', accentSoft: 'rgba(22,121,138,0.16)', border: 'rgba(46,38,48,0.14)', highlight: '#e58b2e' },
	// 18:00 — evening: mauve vellum + amethyst + ruby
	{ hour: 18,   bg: '#ece0d6', surface: '#faf3ec', text: '#2f2238', muted: '#6a5a72', accent: '#6c3fa3', accentSoft: 'rgba(108,63,163,0.16)', border: 'rgba(47,34,56,0.14)', highlight: '#c9405f' },
	// 20:30 — dusk: lilac-grey vellum + lapis + old gold
	{ hour: 20.5, bg: '#e6dfdc', surface: '#f6f1ee', text: '#2b2440', muted: '#655d79', accent: '#56489e', accentSoft: 'rgba(86,72,158,0.16)',  border: 'rgba(43,36,64,0.14)', highlight: '#c48a3a' },
	// 22:00 — moonlit vellum returns: less engaging, not darker
	{ hour: 22,   bg: '#ece4d6', surface: '#f7f1e6', text: '#2a2033', muted: '#665a6c', accent: '#4b4f8f', accentSoft: 'rgba(75,79,143,0.16)',  border: 'rgba(42,32,51,0.14)', highlight: '#a98bc9' },
	// 24:00 — same as night
	{ hour: 24,   bg: '#ece4d6', surface: '#f7f1e6', text: '#2a2033', muted: '#665a6c', accent: '#4b4f8f', accentSoft: 'rgba(75,79,143,0.16)',  border: 'rgba(42,32,51,0.14)', highlight: '#a98bc9' }
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
// on, the text and hairlines drawn straight onto it, the star scatter,
// the window light. Those used to be a fixed night skin, so
// Carillon opened at 9am looking like 11pm. They now ride the same
// clock the palette does.
//
// Two families, not a smooth ramp between opposites: a *paper* day and
// the *night instrument*. Hues move freely *within* a family, but the
// crossing between them is a switch, not a dissolve. Blending paper
// toward night necessarily passes through a mid-tone that reads as mud
// under either text color — the parchment palette above never has to
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
	grid: string; // --car-grid    · the star-and-moon scatter on the ground
	shadow: string; // --car-shadow  · what a paper card casts
	glowWarm: string; // --car-glow-warm · the hour's warm window light
	glowCool: string; // --car-glow-cool · the hour's cool window light
};

// The night instrument: midnight velvet lit by candle, gilt where the
// day uses garnet, and the windows still faintly coloured from inside.
const NIGHT_CHROME = {
	ground: '#1a1229',
	groundTop: '#22173a',
	groundBottom: '#130d1f',
	panel: '#261b3a',
	fg: '#f8ecd0',
	muted: '#bfb0c6',
	accent: '#e8bf6a',
	surge: '#ff8f5e',
	surgeInk: '#1d1020',
	line: 'rgba(248,236,208,0.15)',
	wash: 'rgba(248,236,208,0.07)',
	inset: 'rgba(6,3,14,0.25)',
	grid: 'rgba(232,191,106,0.12)',
	shadow: 'rgba(8,4,16,0.35)',
	glowWarm: 'rgba(150,60,170,0.20)',
	glowCool: 'rgba(50,80,180,0.18)'
} as const;

// Shared by every daylight stop: oak-gall ink on parchment, garnet for
// the accent, lead for the hairlines. What changes across the day is
// the parchment's tint and the two pools of coloured light thrown onto
// it — the glows are the sun through stained glass, so they carry the
// hour (rose and amber at dawn, gilt and emerald in the morning, ruby
// and sapphire at noon, marigold and teal in the afternoon, rose and
// amethyst at evening, violet and lapis at dusk), echoing the jewel
// each --p-* anchor uses.
const DAY_INK = {
	panel: '#fbf4e2',
	fg: '#2c1b2e',
	muted: '#6a5363',
	accent: '#a3214a',
	surge: '#b04a12',
	surgeInk: '#fff6e4',
	line: 'rgba(44,27,46,0.18)',
	wash: 'rgba(44,27,46,0.05)',
	inset: 'rgba(255,251,240,0.6)',
	grid: 'rgba(168,118,30,0.24)',
	shadow: 'rgba(74,40,40,0.18)'
} as const;

const CHROME_STOPS: ChromeStop[] = [
	{ hour: 0, ...NIGHT_CHROME },
	// 05:30 — still the night instrument
	{ hour: 5.5, ...NIGHT_CHROME },
	// 06:30 — sunrise: rose-washed parchment, rose and amber light
	{ hour: 6.5, ground: '#f3e2d2', groundTop: '#f9ece0', groundBottom: '#ead5c6', ...DAY_INK,
		glowWarm: 'rgba(214,72,120,0.24)', glowCool: 'rgba(232,160,58,0.22)' },
	// 09:00 — bright morning: green-gold parchment, gilt and emerald light
	{ hour: 9, ground: '#efe5c9', groundTop: '#f7efd8', groundBottom: '#e6dabb', ...DAY_INK,
		glowWarm: 'rgba(226,170,40,0.24)', glowCool: 'rgba(31,140,100,0.20)' },
	// 12:00 — noon: bright vellum, ruby and sapphire light
	{ hour: 12, ground: '#f0e6cf', groundTop: '#f8f1df', groundBottom: '#e7dcc2', ...DAY_INK,
		glowWarm: 'rgba(200,50,80,0.18)', glowCool: 'rgba(44,96,200,0.22)' },
	// 15:00 — afternoon: amber parchment, marigold and teal light
	{ hour: 15, ground: '#f1e1bf', groundTop: '#f8ecd2', groundBottom: '#e8d4ae', ...DAY_INK,
		glowWarm: 'rgba(232,140,40,0.24)', glowCool: 'rgba(22,140,160,0.20)' },
	// 18:00 — evening: mauve vellum, rose and amethyst light
	{ hour: 18, ground: '#ede0d3', groundTop: '#f6ebe1', groundBottom: '#e3d3c8', ...DAY_INK,
		glowWarm: 'rgba(200,60,100,0.22)', glowCool: 'rgba(120,70,190,0.24)' },
	// 20:30 — dusk: lilac-grey vellum, still light; violet and lapis light
	{ hour: 20.5, ground: '#e2d6d6', groundTop: '#ebe1e0', groundBottom: '#d8cacd', ...DAY_INK,
		glowWarm: 'rgba(150,70,170,0.24)', glowCool: 'rgba(60,80,170,0.24)' },
	// 22:00 — the instrument returns
	{ hour: 22, ...NIGHT_CHROME },
	{ hour: 24, ...NIGHT_CHROME }
];

function isDarkChrome(stop: ChromeStop): boolean {
	return lumOfHex(stop.ground) < 0.3;
}

// The window light is alpha-bearing, but unlike the hairlines it should
// drift between stops rather than jump — the sun doesn't skip a window.
function parseRgba(css: string): [number, number, number, number] | null {
	const m = css.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
	return m ? [+m[1], +m[2], +m[3], +m[4]] : null;
}

function lerpRgba(a: string, b: string, t: number): string {
	const ra = parseRgba(a);
	const rb = parseRgba(b);
	if (!ra || !rb) return t < 0.5 ? a : b;
	const c = ra.map((v, i) => v + (rb[i] - v) * t);
	return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;
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
		'--car-glow-warm': flip ? owner.glowWarm : lerpRgba(a.glowWarm, b.glowWarm, t),
		'--car-glow-cool': flip ? owner.glowCool : lerpRgba(a.glowCool, b.glowCool, t)
	};
}

// Which family a resolved chrome belongs to — the few things that can't
// be a colour token (the wordmark's font palette, how much parchment
// grain to lay over the ground) switch on this instead.
export function chromeFamily(chrome: Record<string, string>): 'paper' | 'night' {
	const ground = chrome['--car-night'] ?? '';
	const rgb = ground.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
	const lum = rgb ? relativeLuminance(+rgb[1], +rgb[2], +rgb[3]) : lumOfHex(ground);
	return lum < 0.3 ? 'night' : 'paper';
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
