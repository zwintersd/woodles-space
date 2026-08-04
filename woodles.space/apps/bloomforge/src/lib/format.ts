import { num, type Currency, type GameDef } from '@woodles/incremental-core';

/**
 * Display helpers shared by the canvas, the inspector and the dock. All number
 * formatting goes through the core's `num.format` so a value reads the same
 * everywhere it appears — the node, the readout, and the log.
 */

export function formatAmount(value: number, currency: Currency | undefined): string {
	if (!currency) return String(Math.round(value));
	return num.format(value, currency.format);
}

export function formatRate(value: number, currency: Currency | undefined): string {
	return `${formatAmount(value, currency)} / sec`;
}

export function currencyById(def: GameDef, id: string | undefined): Currency | undefined {
	return def.currencies.find((currency) => currency.id === id);
}

/** A compact form for axis ticks and node stats, where space is tight. */
export function compact(value: number): string {
	if (!Number.isFinite(value)) return '—';
	const magnitude = Math.abs(value);
	if (magnitude < 1000) return magnitude < 10 ? value.toFixed(1).replace(/\.0$/, '') : String(Math.round(value));
	return num.format(value, { decimalPlaces: magnitude < 10_000 ? 1 : 2, notation: 'thousands' });
}

/** `+120 / sec` — the mockup's production label. */
export function signedRate(value: number, currency: Currency | undefined): string {
	const sign = value > 0 ? '+' : '';
	return `${sign}${formatAmount(value, currency)} / sec`;
}
