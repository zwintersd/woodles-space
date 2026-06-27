export interface Dot {
	x: number;
	y: number;
}

export interface CubeHex {
	q: number;
	r: number;
	s: number;
}

export const HEX_DIRECTIONS: CubeHex[] = [
	{ q: 1, r: -1, s: 0 },
	{ q: 1, r: 0, s: -1 },
	{ q: 0, r: 1, s: -1 },
	{ q: -1, r: 1, s: 0 },
	{ q: -1, r: 0, s: 1 },
	{ q: 0, r: -1, s: 1 }
];

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

export function rotate(point: Dot, angle: number): Dot {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return {
		x: point.x * cos - point.y * sin,
		y: point.x * sin + point.y * cos
	};
}

export function cappedReward(raw: number, max: number): number {
	return Math.max(0, Math.min(max, raw));
}

export function hexKey(hex: CubeHex): string {
	return `${hex.q}:${hex.r}:${hex.s}`;
}

export function addHex(a: CubeHex, b: CubeHex): CubeHex {
	return {
		q: a.q + b.q,
		r: a.r + b.r,
		s: a.s + b.s
	};
}

export function hexNeighbors(hex: CubeHex): CubeHex[] {
	return HEX_DIRECTIONS.map((direction) => addHex(hex, direction));
}

export function hexDistance(a: CubeHex, b: CubeHex = { q: 0, r: 0, s: 0 }): number {
	return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

export function axialToPoint(hex: CubeHex, size: number): Dot {
	return {
		x: size * Math.sqrt(3) * (hex.q + hex.r / 2),
		y: size * 1.5 * hex.r
	};
}

export function pointToFractionalHex(point: Dot, size: number): CubeHex {
	const q = ((Math.sqrt(3) / 3) * point.x - point.y / 3) / size;
	const r = ((2 / 3) * point.y) / size;
	return { q, r, s: -q - r };
}

export function roundHex(hex: CubeHex): CubeHex {
	let q = Math.round(hex.q);
	let r = Math.round(hex.r);
	let s = Math.round(hex.s);

	const qDiff = Math.abs(q - hex.q);
	const rDiff = Math.abs(r - hex.r);
	const sDiff = Math.abs(s - hex.s);

	if (qDiff > rDiff && qDiff > sDiff) {
		q = -r - s;
	} else if (rDiff > sDiff) {
		r = -q - s;
	} else {
		s = -q - r;
	}

	return { q, r, s };
}

export function pointToHex(point: Dot, size: number): CubeHex {
	return roundHex(pointToFractionalHex(point, size));
}

export function hexesWithinRadius(radius: number): CubeHex[] {
	const hexes: CubeHex[] = [];
	const cleanZero = (value: number) => (Object.is(value, -0) ? 0 : value);
	for (let q = -radius; q <= radius; q += 1) {
		const minR = Math.max(-radius, -q - radius);
		const maxR = Math.min(radius, -q + radius);
		for (let r = minR; r <= maxR; r += 1) {
			hexes.push({ q: cleanZero(q), r: cleanZero(r), s: cleanZero(-q - r) });
		}
	}
	return hexes;
}
