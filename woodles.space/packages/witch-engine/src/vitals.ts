// Vital signs — the world's metabolism, as pure functions, fully
// def-parameterized: every rate a caller might want to tune is an argument,
// never an import. `World` (world.ts) is the only real caller; a balance
// tool wiring these up directly for a chart or a what-if reads them the
// same way.
//
// The stocks are @woodles/dynamics's Banded Stock (shape C) and vitality is
// its Eased Stat (shape B) — see packages/dynamics/README.md for the general
// shapes this file instantiates. `severityFor`, `lifeStockRate`, `focusStock`
// and `stabilityOf` stay here rather than in that package: they're domain
// logic (what a *life* asks of a stock), not the stock's own dynamics.

import { bandHealth as bandedStockHealth, driftRate as bandedDriftRate, ease, leakRate } from '@woodles/dynamics';
import type { Needs, StockId, Stocks, StockVector } from './types.js';

export const STOCK_IDS: readonly StockId[] = ['nutrients', 'oxygen', 'moisture'];

export function neutralStocks(start: number): Stocks {
	return { nutrients: start, oxygen: start, moisture: start };
}

// The world's own passive losses — a stock's leak, on whatever sits above the
// band floor. Never below it, so an unattended world settles at that floor
// rather than draining to nothing. Re-exported directly: its signature
// (value, floor, rate) already matches @woodles/dynamics's shape C helper of
// the same name exactly.
export { leakRate };

/** 100 inside [lo,hi], falling linearly to 0 at `falloff` points outside it. */
export function bandHealth(value: number, lo: number, hi: number, falloff: number): number {
	return bandedStockHealth(value, { lo, hi }, falloff);
}

/** 0 = content, 1 = dire. The worst-off of a life's needs decides its stress. */
export function severityFor(needs: Needs | undefined, stocks: Stocks, bandFalloff: number): number {
	if (!needs) return 0;
	let worst = 0;
	for (const id of STOCK_IDS) {
		const band = needs[id];
		if (!band) continue;
		worst = Math.max(worst, 1 - bandHealth(stocks[id], band[0], band[1], bandFalloff) / 100);
	}
	return worst;
}

export interface VitalityRates {
	drainPerSec: number;
	recoverPerSec: number;
	floor: number;
}

/** Vitality eases toward 0 under stress and toward 1 when met. Exponential approach, stable for any dt. */
export function nextVitality(current: number, severity: number, dt: number, rates: VitalityRates): number {
	const stressed = severity > 0;
	const target = stressed ? 0 : 1;
	return ease(current, target, dt, {
		up: rates.recoverPerSec,
		down: rates.drainPerSec * severity,
		floor: rates.floor,
		ceiling: 1
	});
}

/** One life's net per-second effect on the stocks, scaled by how present it is (stage activity) and how well it's faring (vitality). */
export function lifeStockRate(metabolism: StockVector | undefined, activity: number, vitality: number): StockVector {
	const out: StockVector = {};
	if (!metabolism) return out;
	for (const id of STOCK_IDS) {
		const m = metabolism[id];
		if (m) out[id] = m * activity * vitality;
	}
	return out;
}

/**
 * The pull that keeps a stock from running away. Acts on distance *out of
 * band*, not distance from neutral — inside the band there is no restoring
 * force at all. `baseline` shifts the whole band rather than naming a point
 * to return to, so a caller moving where the world is comfortable still
 * raises the floor and the ceiling together.
 */
export function driftRate(
	value: number,
	baseline: number,
	band: readonly [number, number],
	neutral: number,
	rate: number
): number {
	const shift = baseline - neutral;
	return bandedDriftRate(value, { lo: band[0] + shift, hi: band[1] + shift }, rate);
}

/** The stock an intervention should act on for a given life: the stock it most depends on, or the one it most affects. */
export function focusStock(metabolism?: StockVector, needs?: Needs): StockId {
	if (needs) {
		for (const id of STOCK_IDS) if (needs[id]) return id;
	}
	let best: StockId = 'nutrients';
	let mag = -1;
	if (metabolism) {
		for (const id of STOCK_IDS) {
			const m = Math.abs(metabolism[id] ?? 0);
			if (m > mag) {
				mag = m;
				best = id;
			}
		}
	}
	return best;
}

/** 0..100. Mean band-health of the three stocks, lifted a little for each ecosystem known. */
export function stabilityOf(
	stocks: Stocks,
	knownEcosystems: number,
	bands: Record<StockId, [number, number]>,
	bandFalloff: number,
	ecosystemBonus: number
): number {
	let sum = 0;
	for (const id of STOCK_IDS) {
		const [lo, hi] = bands[id];
		sum += bandHealth(stocks[id], lo, hi, bandFalloff);
	}
	const mean = sum / STOCK_IDS.length;
	return Math.min(100, mean * (1 + ecosystemBonus * knownEcosystems));
}
