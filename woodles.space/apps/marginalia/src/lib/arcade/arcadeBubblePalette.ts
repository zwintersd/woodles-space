export const MARGIN_BUBBLE_COLORS = ['sun', 'sea', 'leaf', 'violet'] as const;
export type MarginBubbleColor = (typeof MARGIN_BUBBLE_COLORS)[number];

export interface SvgBubbleSwatch {
	label: string;
	className: string;
}

export const MARGIN_BUBBLE_SWATCHES: Record<MarginBubbleColor, SvgBubbleSwatch> = {
	sun: { label: 'sun', className: 'sun' },
	sea: { label: 'sea', className: 'sea' },
	leaf: { label: 'leaf', className: 'leaf' },
	violet: { label: 'violet', className: 'violet' }
};

export const SPINNER_BUBBLE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'] as const;
export type SpinnerBubbleColor = (typeof SPINNER_BUBBLE_COLORS)[number];

export interface CanvasBubbleSwatch {
	name: string;
	fill: string;
	light: string;
	dark: string;
}

const SPINNER_SWATCHES: Record<SpinnerBubbleColor, CanvasBubbleSwatch> = {
	red: { name: 'red', fill: '#dc322f', light: '#ff8a76', dark: '#8f1d22' },
	blue: { name: 'blue', fill: '#268bd2', light: '#91d5ff', dark: '#12507f' },
	green: { name: 'green', fill: '#2aa198', light: '#7ee6d8', dark: '#17645f' },
	yellow: { name: 'yellow', fill: '#b58900', light: '#ffe08a', dark: '#735600' },
	purple: { name: 'purple', fill: '#6c71c4', light: '#b8baf2', dark: '#3e438d' }
};

const SPINNER_SAFE_SWATCHES: Record<SpinnerBubbleColor, CanvasBubbleSwatch> = {
	red: { name: 'vermillion', fill: '#d55e00', light: '#ffbd8c', dark: '#8f3f00' },
	blue: { name: 'blue', fill: '#0072b2', light: '#8ed1ff', dark: '#00466f' },
	green: { name: 'bluish green', fill: '#009e73', light: '#8ee8cb', dark: '#005f45' },
	yellow: { name: 'orange', fill: '#e69f00', light: '#ffe09a', dark: '#9b6900' },
	purple: { name: 'purple', fill: '#cc79a7', light: '#f2bed9', dark: '#88466e' }
};

export function spinnerBubbleSwatch(
	color: SpinnerBubbleColor,
	colorSafe = false
): CanvasBubbleSwatch {
	return (colorSafe ? SPINNER_SAFE_SWATCHES : SPINNER_SWATCHES)[color];
}
