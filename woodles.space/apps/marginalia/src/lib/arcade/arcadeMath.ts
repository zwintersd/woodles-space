export interface Dot {
	x: number;
	y: number;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function distance(a: Dot, b: Dot): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(x: number, y: number): Dot {
	const len = Math.hypot(x, y) || 1;
	return { x: x / len, y: y / len };
}

export function cappedReward(raw: number, max: number): number {
	return Math.max(0, Math.min(max, raw));
}
