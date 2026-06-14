// Pure geometry for the stat portrait — a hexagonal radar of the six cores.
// Kept rune-free and side-effect-free so the editor can draw it and tests can
// check the math directly. Angles are radians; spoke 0 sits at the top
// (12 o'clock) and the rest proceed clockwise.

import type { Stats } from './types';
import { coreStats } from './content/stats';
import { effectiveSubstat } from './collection';

export type ChartPoint = { x: number; y: number };

// The angle of spoke `index` of `count`, starting at the top, going clockwise.
export function spokeAngle(index: number, count: number): number {
	return -Math.PI / 2 + (index * 2 * Math.PI) / count;
}

// Map a 0..max stat value onto its spoke, as a point relative to (cx, cy).
export function radarPoint(
	value: number,
	index: number,
	count: number,
	radius: number,
	cx = 0,
	cy = 0,
	max = 10
): ChartPoint {
	const clamped = Math.max(0, Math.min(max, value));
	const r = (clamped / max) * radius;
	const a = spokeAngle(index, count);
	return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// The six core values in canonical order: body, mind, grace, heart, will, spark.
export function coreValues(stats: Stats): number[] {
	return coreStats.map((c) => stats[c.id]);
}

// For each core, the mean of its effective substats — or the core's own value
// when it has none (Will, Spark). Equal to coreValues() until a substat is
// overridden, at which point it diverges: the lived detail under the headline.
export function coreDetailValues(stats: Stats): number[] {
	return coreStats.map((c) => {
		if (c.substats.length === 0) return stats[c.id];
		const sum = c.substats.reduce((acc, s) => acc + effectiveSubstat(stats, s.id), 0);
		return sum / c.substats.length;
	});
}

// Whether the substat detail pulls any capacity away from its core — i.e.
// whether there's a second shape worth drawing. False for a creature whose
// substats all rest at their defaults.
export function hasDepth(stats: Stats): boolean {
	const core = coreValues(stats);
	const detail = coreDetailValues(stats);
	return core.some((v, i) => Math.abs(v - detail[i]) > 1e-9);
}

// A closed polygon string for an SVG <polygon points="…">, one vertex per value.
export function radarPolygon(
	values: number[],
	radius: number,
	cx = 0,
	cy = 0,
	max = 10
): string {
	return values
		.map((v, i) => {
			const p = radarPoint(v, i, values.length, radius, cx, cy, max);
			return `${round(p.x)},${round(p.y)}`;
		})
		.join(' ');
}

function round(n: number): number {
	return Math.round(n * 100) / 100;
}
