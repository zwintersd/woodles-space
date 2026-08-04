import { num, type Currency, type GameDef } from '@woodles/incremental-core';

/** Every number the player sees goes through the currency's own formatting. */
export function formatAmount(value: number, currency: Currency | undefined): string {
	if (!currency) return String(Math.round(value));
	return num.format(value, currency.format);
}

export function currencyById(def: GameDef | null, id: string | undefined): Currency | undefined {
	return def?.currencies.find((currency) => currency.id === id);
}

export function signedRate(value: number, currency: Currency | undefined): string {
	return `${value > 0 ? '+' : ''}${formatAmount(value, currency)}/s`;
}

/**
 * How long until you can afford something, at the current rate. The single
 * most useful number an incremental can show a player, and the one they
 * otherwise compute in their head every few seconds.
 */
export function timeUntil(cost: number, held: number, rate: number): string | null {
	if (held >= cost) return null;
	if (rate <= 0) return 'never at this rate';
	const seconds = (cost - held) / rate;
	if (seconds < 1) return 'a moment';
	if (seconds < 60) return `${Math.ceil(seconds)}s`;
	if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
	if (seconds < 86_400) return `${Math.ceil(seconds / 3600)}h`;
	return `${Math.ceil(seconds / 86_400)}d`;
}
