// Vital signs — the world's metabolism, as pure functions.
//
// The world holds three stocks (nutrients, oxygen, moisture). Life produces and
// consumes them; out-of-band stocks stress the life that depends on them, which
// drains its vitality, which in turn lowers what it yields and how fast it can be
// known. Everything here is pure and rune-free so it can be unit-tested directly —
// the Book (book.svelte.ts) holds the $state and calls into this.

import {
	STOCK_START,
	STOCK_NEUTRAL,
	STOCK_DRIFT_PER_SEC,
	BAND_FALLOFF,
	VITALITY_DRAIN_PER_SEC,
	VITALITY_RECOVER_PER_SEC,
	VITALITY_FLOOR,
	STABILITY_ECOSYSTEM_BONUS
} from './tuning';

export type StockId = 'nutrients' | 'oxygen' | 'moisture';
export type Stocks = Record<StockId, number>;
// a sparse per-stock effect (metabolism) — only the stocks a life touches
export type StockVector = Partial<Record<StockId, number>>;
// a healthy band [lo, hi] per stock a life depends on
export type Needs = Partial<Record<StockId, [number, number]>>;

export const STOCK_IDS: readonly StockId[] = ['nutrients', 'oxygen', 'moisture'];

// The bands that define a *balanced* world, used by the stability readout. These
// are distinct from per-life needs: needs say what one creature tolerates; these
// say what equilibrium looks like.
export const STOCK_BANDS: Record<StockId, [number, number]> = {
	nutrients: [40, 80],
	oxygen: [45, 85],
	moisture: [35, 75]
};

export function neutralStocks(): Stocks {
	return { nutrients: STOCK_START, oxygen: STOCK_START, moisture: STOCK_START };
}

// 100 inside the band, falling linearly to 0 at BAND_FALLOFF points outside it.
export function bandHealth(value: number, lo: number, hi: number): number {
	if (value >= lo && value <= hi) return 100;
	const dist = value < lo ? lo - value : value - hi;
	return Math.max(0, 100 * (1 - dist / BAND_FALLOFF));
}

// 0 = content, 1 = dire. The worst-off of a life's needs decides its stress.
export function severityFor(needs: Needs | undefined, stocks: Stocks): number {
	if (!needs) return 0;
	let worst = 0;
	for (const id of STOCK_IDS) {
		const band = needs[id];
		if (!band) continue;
		worst = Math.max(worst, 1 - bandHealth(stocks[id], band[0], band[1]) / 100);
	}
	return worst;
}

// Vitality eases toward 0 under stress and toward 1 when met. Exponential
// approach stays stable for any dt — including the coarse steps of offline credit.
export function nextVitality(current: number, severity: number, dt: number): number {
	const stressed = severity > 0;
	const target = stressed ? 0 : 1;
	const k = stressed ? VITALITY_DRAIN_PER_SEC * severity : VITALITY_RECOVER_PER_SEC;
	const next = current + (target - current) * (1 - Math.exp(-k * dt));
	return Math.min(1, Math.max(VITALITY_FLOOR, next));
}

// One life's net per-second effect on the stocks, scaled by how present it is
// (stage activity) and how well it's faring (vitality). A wilting life metabolises
// less, so a stressed world eases its own pressure — the equilibrium loop.
export function lifeStockRate(
	metabolism: StockVector | undefined,
	activity: number,
	vitality: number
): StockVector {
	const out: StockVector = {};
	if (!metabolism) return out;
	for (const id of STOCK_IDS) {
		const m = metabolism[id];
		if (m) out[id] = m * activity * vitality;
	}
	return out;
}

// The pull that returns an untouched stock toward its baseline, so an empty or
// unwatched world sits still rather than drifting. The baseline is normally
// neutral, but shaping geology (an intervention) can raise it.
export function driftRate(value: number, baseline: number = STOCK_NEUTRAL): number {
	return STOCK_DRIFT_PER_SEC * (baseline - value);
}

// The stock an intervention should act on for a given life: the stock it most
// depends on, or — for things with no needs — the stock it most affects.
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

// 0..100. Mean band-health of the three stocks, lifted a little for each
// ecosystem she has come to Know (interconnection is resilience).
export function stabilityOf(stocks: Stocks, knownEcosystems: number): number {
	let sum = 0;
	for (const id of STOCK_IDS) {
		const [lo, hi] = STOCK_BANDS[id];
		sum += bandHealth(stocks[id], lo, hi);
	}
	const mean = sum / STOCK_IDS.length;
	return Math.min(100, mean * (1 + STABILITY_ECOSYSTEM_BONUS * knownEcosystems));
}
