import { describe, expect, it } from 'vitest';
import {
	bandHealth,
	severityFor,
	nextVitality,
	lifeStockRate,
	driftRate,
	focusStock,
	stabilityOf,
	neutralStocks,
	STOCK_IDS,
	STOCK_BANDS,
	type Stocks
} from './vitals';
import { VITALITY_FLOOR } from './tuning';

describe('bandHealth', () => {
	it('is 100 anywhere inside the band, edges included', () => {
		expect(bandHealth(50, 40, 80)).toBe(100);
		expect(bandHealth(40, 40, 80)).toBe(100);
		expect(bandHealth(80, 40, 80)).toBe(100);
	});
	it('falls linearly to 0 across the falloff below the band', () => {
		expect(bandHealth(27.5, 40, 80)).toBeCloseTo(50); // 12.5 below, falloff 25
		expect(bandHealth(15, 40, 80)).toBeCloseTo(0); // 25 below
	});
	it('falls above the band too, and clamps at 0', () => {
		expect(bandHealth(90, 40, 80)).toBeCloseTo(60); // 10 above
		expect(bandHealth(0, 40, 80)).toBe(0);
		expect(bandHealth(200, 40, 80)).toBe(0);
	});
});

describe('severityFor', () => {
	const stocks: Stocks = { nutrients: 60, oxygen: 60, moisture: 60 };
	it('is 0 when a life has no needs', () => {
		expect(severityFor(undefined, stocks)).toBe(0);
		expect(severityFor({}, stocks)).toBe(0);
	});
	it('is 0 when every need is in band', () => {
		expect(severityFor({ oxygen: [45, 100] }, stocks)).toBe(0);
	});
	it('ramps as a needed stock falls below its band', () => {
		expect(severityFor({ oxygen: [45, 100] }, { ...stocks, oxygen: 32.5 })).toBeCloseTo(0.5);
	});
	it('takes the worst-off of several needs', () => {
		const sev = severityFor(
			{ nutrients: [25, 100], moisture: [40, 100] },
			{ nutrients: 90, oxygen: 60, moisture: 15 }
		);
		expect(sev).toBeCloseTo(1);
	});
});

describe('nextVitality', () => {
	it('drains toward 0 under stress', () => {
		const next = nextVitality(1, 0.5, 5);
		expect(next).toBeLessThan(1);
		expect(next).toBeGreaterThanOrEqual(VITALITY_FLOOR);
	});
	it('recovers toward 1 when unstressed', () => {
		expect(nextVitality(0.5, 0, 5)).toBeGreaterThan(0.5);
	});
	it('never drops below the floor, however long the stress', () => {
		expect(nextVitality(0.2, 1, 100000)).toBe(VITALITY_FLOOR);
	});
	it('never climbs above 1', () => {
		expect(nextVitality(1, 0, 100000)).toBe(1);
	});
	it('holds steady at the target', () => {
		expect(nextVitality(1, 0, 5)).toBe(1);
	});
});

describe('lifeStockRate', () => {
	it('is empty for inert life', () => {
		expect(lifeStockRate(undefined, 1, 1)).toEqual({});
	});
	it('passes metabolism through at full activity and vitality', () => {
		expect(lifeStockRate({ oxygen: 0.2, nutrients: -0.06 }, 1, 1)).toEqual({
			oxygen: 0.2,
			nutrients: -0.06
		});
	});
	it('scales by activity and vitality, preserving sign', () => {
		const r = lifeStockRate({ oxygen: 0.2, nutrients: -0.06 }, 0.5, 0.5);
		expect(r.oxygen).toBeCloseTo(0.05);
		expect(r.nutrients).toBeCloseTo(-0.015);
	});
});

describe('driftRate', () => {
	it('pulls up when below neutral and down when above', () => {
		expect(driftRate(40)).toBeGreaterThan(0);
		expect(driftRate(60)).toBeLessThan(0);
	});
	it('is zero at neutral', () => {
		expect(driftRate(50)).toBe(0);
	});
	it('pulls toward a raised baseline when one is given', () => {
		expect(driftRate(50, 65)).toBeGreaterThan(0); // below the new baseline
		expect(driftRate(65, 65)).toBe(0);
	});
});

describe('focusStock', () => {
	it('is the needed stock when a life has needs', () => {
		expect(focusStock({ oxygen: 0.2, nutrients: -0.06 }, { nutrients: [30, 100] })).toBe('nutrients');
	});
	it('falls back to the most-affected stock when there are no needs', () => {
		expect(focusStock({ moisture: 0.06 })).toBe('moisture');
		expect(focusStock({ nutrients: 0.03 })).toBe('nutrients');
	});
});

describe('stabilityOf', () => {
	it('is 100 for a neutral, balanced world', () => {
		expect(stabilityOf(neutralStocks(), 0)).toBe(100);
	});
	it('drops when a stock leaves its band', () => {
		const crashed = { ...neutralStocks(), nutrients: 15 }; // 25 below band [40,80] → health 0
		expect(stabilityOf(crashed, 0)).toBeCloseTo(200 / 3); // (0 + 100 + 100) / 3
	});
	it('is lifted by known ecosystems but clamps at 100', () => {
		expect(stabilityOf(neutralStocks(), 5)).toBe(100);
	});
});

describe('shape sanity', () => {
	it('has three stock ids, each with a band', () => {
		expect(STOCK_IDS).toHaveLength(3);
		for (const id of STOCK_IDS) {
			expect(STOCK_BANDS[id][0]).toBeLessThan(STOCK_BANDS[id][1]);
		}
	});
	it('starts every stock neutral', () => {
		const s = neutralStocks();
		expect(s.nutrients).toBe(s.oxygen);
		expect(s.oxygen).toBe(s.moisture);
	});
});
