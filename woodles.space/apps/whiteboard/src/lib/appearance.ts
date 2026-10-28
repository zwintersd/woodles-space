import type { WhiteboardItem } from './model';

/** Board-local overrides. Missing fields keep each object's original treatment. */
export type ItemAppearance = {
	fill?: string;
	ink?: string;
	outline?: string;
	outlineWidth?: number;
	outlineStyle?: 'solid' | 'dashed' | 'dotted';
	opacity?: number;
	corners?: 'square' | 'soft' | 'round';
	shadow?: 'none' | 'soft' | 'lifted';
	font?: 'book' | 'plain' | 'hand' | 'typewriter';
	fontSize?: number;
	align?: 'left' | 'center' | 'right';
	bold?: boolean;
	italic?: boolean;
	lineHeight?: number;
	highlight?: string;
	backing?: 'none' | 'label' | 'banner' | 'strip';
	material?: 'paper' | 'index' | 'sticky' | 'torn' | 'vellum';
};
export const FONTS = { book: 'Georgia, serif', plain: '"Trebuchet MS", system-ui, sans-serif', hand: '"Segoe Print", "Comic Sans MS", cursive', typewriter: 'Consolas, "Courier New", monospace' };
export const TYPE_KEYS = ['font', 'fontSize', 'align', 'bold', 'italic', 'lineHeight', 'highlight', 'backing'] as const;
export type AppearancePatch = { [K in keyof ItemAppearance]?: ItemAppearance[K] | null };
export const APPEARANCE_KEYS = ['fill', 'ink', 'outline', 'outlineWidth', 'outlineStyle', 'opacity', 'corners', 'shadow', ...TYPE_KEYS, 'material'] as const;
export const RESET_APPEARANCE: AppearancePatch = Object.fromEntries(APPEARANCE_KEYS.map((key) => [key, null]));
export const PALETTE = ['#fffdf8', '#f7dfbb', '#edc9cf', '#dbd2ed', '#cbdfe3', '#d6e2c9', '#604c46', '#a66670'];
export const MAX_SWATCHES = 12;

export function isAppearanceColor(value: unknown): value is string {
	return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
}

export function validAppearance(value: unknown): value is ItemAppearance {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	return Object.entries(value).every(([key, v]) => {
		switch (key) {
			case 'fill': case 'ink': case 'outline': return isAppearanceColor(v);
			case 'outlineWidth': return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 8;
			case 'opacity': return typeof v === 'number' && Number.isFinite(v) && v >= 0.2 && v <= 1;
			case 'outlineStyle': return ['solid', 'dashed', 'dotted'].includes(v as string);
			case 'corners': return ['square', 'soft', 'round'].includes(v as string);
			case 'shadow': return ['none', 'soft', 'lifted'].includes(v as string);
			case 'font': return typeof v === 'string' && Object.hasOwn(FONTS, v);
			case 'fontSize': return typeof v === 'number' && Number.isFinite(v) && v >= 12 && v <= 120;
			case 'lineHeight': return typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 2;
			case 'align': return ['left', 'center', 'right'].includes(v as string);
			case 'bold': case 'italic': return typeof v === 'boolean';
			case 'highlight': return isAppearanceColor(v);
			case 'backing': return ['none', 'label', 'banner', 'strip'].includes(v as string);
			case 'material': return ['paper', 'index', 'sticky', 'torn', 'vellum'].includes(v as string);
			default: return false;
		}
	});
}

export function validSwatches(value: unknown): value is string[] {
	return Array.isArray(value) && value.length <= MAX_SWATCHES && value.every(isAppearanceColor);
}

/** Copy only supported fields; photos have no lettering and connectors have their own tools. */
export function patchAppearance(item: WhiteboardItem, patch: AppearancePatch): ItemAppearance | undefined {
	if (item.type === 'connector') return item.appearance ? { ...item.appearance } : undefined;
	const result: Record<string, unknown> = { ...item.appearance };
	for (const key of APPEARANCE_KEYS) {
		if (item.type === 'image' && key === 'ink') continue;
		if ((TYPE_KEYS as readonly string[]).includes(key) && item.type !== 'lettering' && item.type !== 'slip' && item.type !== 'card') continue;
		if (key === 'material' && item.type !== 'card' && item.type !== 'slip') continue;
		if (patch[key] === null) delete result[key];
		else if (patch[key] !== undefined) result[key] = patch[key];
	}
	return Object.keys(result).length && validAppearance(result) ? result : undefined;
}

/** Visual overrides only; rotation and composition live in item geometry. */
export function appearanceCss(appearance?: ItemAppearance, kind?: WhiteboardItem['type']): string {
	if (!appearance || !validAppearance(appearance)) return '';
	const a = appearance;
	const image = kind === 'image';
	return [
		a.fill !== undefined ? `background-color:${a.fill};--object-fill:${a.fill}` : '',
		image && a.fill !== undefined ? `border-color:${a.fill}` : '',
		a.ink !== undefined ? `--object-ink:${a.ink}` : '',
		!image && a.outline !== undefined ? `border-color:${a.outline}` : '',
		!image && a.outlineWidth !== undefined ? `border-width:${a.outlineWidth}px` : '',
		!image && a.outlineStyle !== undefined ? `border-style:${a.outlineStyle}` : '',
		image && (a.outline !== undefined || a.outlineWidth !== undefined || a.outlineStyle !== undefined) ? `outline:${a.outlineWidth ?? 1}px ${a.outlineStyle ?? 'solid'} ${a.outline ?? '#604c46'}` : '',
		a.opacity !== undefined ? `opacity:${a.opacity}` : '',
		a.font !== undefined ? `--type-family:${FONTS[a.font]}` : '',
		a.fontSize !== undefined ? `--type-size:${a.fontSize}px` : '',
		a.align !== undefined ? `--type-align:${a.align}` : '',
		a.bold !== undefined ? `--type-weight:${a.bold ? 700 : 400}` : '',
		a.italic !== undefined ? `--type-style:${a.italic ? 'italic' : 'normal'}` : '',
		a.lineHeight !== undefined ? `--type-leading:${a.lineHeight}` : '',
		a.highlight !== undefined ? `--type-highlight:${a.highlight}` : '',
		a.corners !== undefined ? `border-radius:${{ square: 0, soft: 10, round: 24 }[a.corners]}px` : '',
		image && a.corners !== undefined ? `--photo-corners:${{ square: 0, soft: 6, round: 20 }[a.corners]}px` : '',
		a.shadow !== undefined ? `box-shadow:${{ none: 'none', soft: '0 4px 11px #49362e1a', lifted: '0 12px 24px #49362e33,0 2px 4px #49362e14' }[a.shadow]}` : ''
	].filter(Boolean).join(';') + ';';
}
