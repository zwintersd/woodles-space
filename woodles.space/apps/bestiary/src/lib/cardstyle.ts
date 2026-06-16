// The card's *look* — everything about the frame that isn't its content. A
// CardStyle resolves to a handful of CSS custom properties + classes that
// CreatureCard reads, so the same card renders its chosen look on the shelf and
// in the editor preview alike. Defaults reproduce the original frame exactly, so
// a card with no style (or a pre-style record) looks unchanged.
//
// Pure + side-effect-free: the resolver (cardCssVars) and the normaliser are
// plain string/value functions, unit-tested without a DOM.

export type FrameStyle = 'classic' | 'fullart' | 'borderless' | 'minimal' | 'cinema';
export type Finish = 'matte' | 'gloss' | 'foil' | 'rainbow' | 'glow';
export type TextBox = 'parchment' | 'ghost' | 'ink' | 'none';
export type CardFont = 'codex' | 'display' | 'body' | 'mono' | 'pixel';
export type Texture = 'none' | 'paper' | 'linen' | 'grain' | 'noise';
export type SourceMode = 'domain' | 'custom';
export type TitleAlign = 'left' | 'center';

export type CardStyle = {
	frame: FrameStyle;
	// accent — the card's main colour. 'domain' follows the creature's domain
	// (the original behaviour); 'custom' uses `accent`.
	accentMode: SourceMode;
	accent: string;
	// the plate behind everything — a domain-tinted gradient or a custom one
	bgMode: SourceMode;
	bg1: string;
	bg2: string;
	tint: number; // 0..1, how much accent tints the domain plate
	// outer edge
	borderMode: 'auto' | 'custom';
	borderColor: string;
	borderWidth: number; // px
	radius: number; // px
	// finish over the whole card (on top of the rarity sheen)
	finish: Finish;
	finishIntensity: number; // 0..1
	// title
	titleFont: CardFont;
	titleColorMode: SourceMode | 'auto';
	titleColor: string;
	titleAlign: TitleAlign;
	// the rules/flavour box
	textBox: TextBox;
	// a texture laid over the card
	texture: Texture;
	textureOpacity: number; // 0..1
	// element visibility
	showStats: boolean;
	showTypeLine: boolean;
	showFoundIn: boolean;
};

export const BORDER_MAX = 6;
export const RADIUS_MAX = 28;

export const FRAME_STYLES: { id: FrameStyle; name: string }[] = [
	{ id: 'classic', name: 'classic' },
	{ id: 'fullart', name: 'full art' },
	{ id: 'borderless', name: 'borderless' },
	{ id: 'minimal', name: 'minimal' },
	{ id: 'cinema', name: 'cinema' }
];

export const FINISHES: { id: Finish; name: string }[] = [
	{ id: 'matte', name: 'matte' },
	{ id: 'gloss', name: 'gloss' },
	{ id: 'foil', name: 'foil' },
	{ id: 'rainbow', name: 'rainbow' },
	{ id: 'glow', name: 'glow' }
];

export const TEXT_BOXES: { id: TextBox; name: string }[] = [
	{ id: 'parchment', name: 'parchment' },
	{ id: 'ghost', name: 'ghost' },
	{ id: 'ink', name: 'ink' },
	{ id: 'none', name: 'none' }
];

export const CARD_FONTS: { id: CardFont; name: string }[] = [
	{ id: 'codex', name: 'codex' },
	{ id: 'display', name: 'display' },
	{ id: 'body', name: 'serif' },
	{ id: 'mono', name: 'mono' },
	{ id: 'pixel', name: 'pixel' }
];

export const TEXTURES: { id: Texture; name: string }[] = [
	{ id: 'none', name: 'none' },
	{ id: 'paper', name: 'paper' },
	{ id: 'linen', name: 'linen' },
	{ id: 'grain', name: 'grain' },
	{ id: 'noise', name: 'noise' }
];

// The original frame, expressed as a style. A creature with this (or with no
// style at all) renders exactly as the card always has.
export function defaultCardStyle(): CardStyle {
	return {
		frame: 'classic',
		accentMode: 'domain',
		accent: '#ef7aae',
		bgMode: 'domain',
		bg1: '#ffffff',
		bg2: '#eceefb',
		tint: 0.22,
		borderMode: 'auto',
		borderColor: '#ef7aae',
		borderWidth: 1,
		radius: 18,
		finish: 'matte',
		finishIntensity: 0.6,
		titleFont: 'codex',
		titleColorMode: 'auto',
		titleColor: '#6a4763',
		titleAlign: 'left',
		textBox: 'parchment',
		texture: 'none',
		textureOpacity: 0.5,
		showStats: true,
		showTypeLine: true,
		showFoundIn: true
	};
}

// ── presets ───────────────────────────────────────────────────────────
// One-tap looks. Each is the default overlaid with a few overrides, so adding
// a field later can't leave a preset half-defined.

export type CardPreset = { id: string; name: string; note: string; style: CardStyle };

function preset(id: string, name: string, note: string, over: Partial<CardStyle>): CardPreset {
	return { id, name, note, style: { ...defaultCardStyle(), ...over } };
}

export const cardPresets: CardPreset[] = [
	preset('vellum', 'vellum', 'the house style', {}),
	preset('fullbleed', 'full bleed', 'art to the edges, text afloat', {
		frame: 'fullart',
		textBox: 'ghost',
		showStats: false
	}),
	preset('midnight', 'midnight foil', 'dark plate, holographic', {
		bgMode: 'custom',
		bg1: '#241a39',
		bg2: '#0f0b1c',
		finish: 'rainbow',
		finishIntensity: 0.75,
		titleColorMode: 'custom',
		titleColor: '#f4ecff',
		textBox: 'ink',
		borderMode: 'custom',
		borderColor: '#6a5b9a'
	}),
	preset('parchment', 'old codex', 'warm paper, set in serif', {
		bgMode: 'custom',
		bg1: '#fbf0d8',
		bg2: '#ecd9b0',
		texture: 'paper',
		textureOpacity: 0.7,
		titleFont: 'display',
		titleColorMode: 'custom',
		titleColor: '#6a4a2a',
		borderMode: 'custom',
		borderColor: '#caa46a'
	}),
	preset('neon', 'neon', 'glowing edge on near-black', {
		bgMode: 'custom',
		bg1: '#10131f',
		bg2: '#05060c',
		accentMode: 'custom',
		accent: '#4ff0d0',
		finish: 'glow',
		finishIntensity: 0.85,
		titleFont: 'mono',
		titleColorMode: 'custom',
		titleColor: '#d7fff5',
		textBox: 'ink',
		borderMode: 'custom',
		borderColor: '#4ff0d0'
	}),
	preset('cinema', 'cinema', 'letterboxed, centred', {
		frame: 'cinema',
		titleAlign: 'center',
		titleColorMode: 'custom',
		titleColor: '#f4ecff',
		textBox: 'ghost'
	}),
	preset('minimal', 'minimal ink', 'quiet, borderless, no strip', {
		frame: 'minimal',
		borderWidth: 0,
		textBox: 'ghost',
		showStats: false,
		showFoundIn: false,
		radius: 22
	}),
	preset('arcade', 'arcade', 'pixel type, scanline grain', {
		titleFont: 'pixel',
		texture: 'noise',
		textureOpacity: 0.4,
		finish: 'gloss',
		bgMode: 'custom',
		bg1: '#1b2440',
		bg2: '#0c1326',
		titleColorMode: 'custom',
		titleColor: '#bfe4ff',
		borderMode: 'custom',
		borderColor: '#3a4f86',
		textBox: 'ink'
	})
];

// ── clamps & guards ───────────────────────────────────────────────────

function clamp01(n: number): number {
	if (Number.isNaN(n)) return 0;
	return Math.max(0, Math.min(1, n));
}

function clampRange(n: number, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(n)) return fallback;
	return Math.max(min, Math.min(max, n));
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
	return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

const FRAME_IDS = FRAME_STYLES.map((f) => f.id);
const FINISH_IDS = FINISHES.map((f) => f.id);
const TEXTBOX_IDS = TEXT_BOXES.map((t) => t.id);
const FONT_IDS = CARD_FONTS.map((f) => f.id);
const TEXTURE_IDS = TEXTURES.map((t) => t.id);

// ── resolver: CardStyle → CSS custom properties ───────────────────────
// `domainVar` is the creature's domain colour token (e.g. '--b-temporal'); the
// accent follows it unless a custom colour is set. Returns a plain map so the
// component can spread it into an inline style and tests can assert on it.

export function cardCssVars(style: CardStyle, domainVar: string): Record<string, string> {
	const accent = style.accentMode === 'custom' ? style.accent : `var(${domainVar})`;
	const tintPct = `${Math.round(clamp01(style.tint) * 100)}%`;
	const plate =
		style.bgMode === 'custom'
			? `linear-gradient(160deg, ${style.bg1}, ${style.bg2})`
			: `linear-gradient(160deg, color-mix(in srgb, ${accent} ${tintPct}, var(--b-surface)) 0%, var(--b-surface) 48%, var(--b-bg-2) 100%)`;
	const border = style.borderMode === 'custom' ? style.borderColor : 'var(--b-border-strong)';
	const titleColor =
		style.titleColorMode === 'custom'
			? style.titleColor
			: style.titleColorMode === 'domain'
				? accent
				: 'var(--b-text)';
	return {
		'--domain': accent,
		// the *uncold* plate. CreatureCard derives the live `--plate` from this,
		// blending it toward ice as `--cold-shift` rises (see its card styles).
		'--plate-base': plate,
		'--card-border-color': border,
		'--card-border-w': `${clampRange(style.borderWidth, 0, BORDER_MAX, 1)}px`,
		'--card-radius': `${clampRange(style.radius, 0, RADIUS_MAX, 18)}px`,
		'--title-font': `var(--b-font-${style.titleFont})`,
		'--title-color': titleColor,
		'--finish-amt': String(clamp01(style.finishIntensity)),
		'--tex-opacity': String(clamp01(style.textureOpacity))
	};
}

// Flatten the resolver's map into an inline `style` string.
export function cardStyleAttr(style: CardStyle, domainVar: string, rarityVar: string): string {
	const vars = cardCssVars(style, domainVar);
	const parts = Object.entries(vars).map(([k, v]) => `${k}: ${v}`);
	parts.push(`--rarity: var(${rarityVar})`);
	return parts.join('; ');
}

// ── (de)serialization ─────────────────────────────────────────────────

export function normalizeCardStyle(raw: unknown): CardStyle {
	const d = defaultCardStyle();
	if (!raw || typeof raw !== 'object') return d;
	const s = raw as Record<string, unknown>;
	const str = (v: unknown, fb: string) => (typeof v === 'string' ? v : fb);
	const bool = (v: unknown, fb: boolean) => (typeof v === 'boolean' ? v : fb);
	const numv = (v: unknown, fb: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fb);
	return {
		frame: oneOf(s.frame, FRAME_IDS, d.frame),
		accentMode: oneOf(s.accentMode, ['domain', 'custom'] as const, d.accentMode),
		accent: str(s.accent, d.accent),
		bgMode: oneOf(s.bgMode, ['domain', 'custom'] as const, d.bgMode),
		bg1: str(s.bg1, d.bg1),
		bg2: str(s.bg2, d.bg2),
		tint: clamp01(numv(s.tint, d.tint)),
		borderMode: oneOf(s.borderMode, ['auto', 'custom'] as const, d.borderMode),
		borderColor: str(s.borderColor, d.borderColor),
		borderWidth: clampRange(numv(s.borderWidth, d.borderWidth), 0, BORDER_MAX, d.borderWidth),
		radius: clampRange(numv(s.radius, d.radius), 0, RADIUS_MAX, d.radius),
		finish: oneOf(s.finish, FINISH_IDS, d.finish),
		finishIntensity: clamp01(numv(s.finishIntensity, d.finishIntensity)),
		titleFont: oneOf(s.titleFont, FONT_IDS, d.titleFont),
		titleColorMode: oneOf(s.titleColorMode, ['auto', 'domain', 'custom'] as const, d.titleColorMode),
		titleColor: str(s.titleColor, d.titleColor),
		titleAlign: oneOf(s.titleAlign, ['left', 'center'] as const, d.titleAlign),
		textBox: oneOf(s.textBox, TEXTBOX_IDS, d.textBox),
		texture: oneOf(s.texture, TEXTURE_IDS, d.texture),
		textureOpacity: clamp01(numv(s.textureOpacity, d.textureOpacity)),
		showStats: bool(s.showStats, d.showStats),
		showTypeLine: bool(s.showTypeLine, d.showTypeLine),
		showFoundIn: bool(s.showFoundIn, d.showFoundIn)
	};
}
