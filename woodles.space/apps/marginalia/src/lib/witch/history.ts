// Rolling sample history for the vital-sign sparklines — a naturalist's
// instrument log. Pure and rune-free so it can be unit-tested directly, same
// as vitals.ts; the Book (book.svelte.ts) holds the $state and calls into
// this every few sim-seconds.

import { STOCK_HISTORY_LENGTH } from './tuning';

// Appends a sample, keeping at most STOCK_HISTORY_LENGTH — the oldest drops
// off the front. Returns a new array (state stays immutable-friendly).
export function pushSample(samples: readonly number[], value: number): number[] {
	const next = [...samples, value];
	return next.length > STOCK_HISTORY_LENGTH ? next.slice(next.length - STOCK_HISTORY_LENGTH) : next;
}

// -1 falling / 0 flat / 1 rising, read from the tail of the history against
// a point earlier in it (default: the start of the buffer). A short buffer
// (fewer than two samples) reads as flat — nothing to compare yet.
export function trend(samples: readonly number[], lookback = STOCK_HISTORY_LENGTH): -1 | 0 | 1 {
	if (samples.length < 2) return 0;
	const from = Math.max(0, samples.length - 1 - lookback);
	const delta = samples[samples.length - 1] - samples[from];
	const FLAT_EPSILON = 1.5; // points of stock value — below this reads as holding steady
	if (Math.abs(delta) < FLAT_EPSILON) return 0;
	return delta > 0 ? 1 : -1;
}

// Maps a sample series onto an SVG polyline `points` string within a
// w×h viewbox, so <Sparkline> can stay a thin, presentational component.
// Flat/empty series draw a flat line down the middle rather than nothing.
export function sparklinePoints(samples: readonly number[], w: number, h: number): string {
	if (samples.length === 0) return `0,${h / 2} ${w},${h / 2}`;
	if (samples.length === 1) return `0,${h / 2} ${w},${h / 2}`;
	const lo = Math.min(...samples);
	const hi = Math.max(...samples);
	const span = hi - lo || 1; // avoid /0 on a perfectly flat series
	const step = w / (samples.length - 1);
	return samples
		.map((v, i) => {
			const x = i * step;
			const y = h - ((v - lo) / span) * h;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(' ');
}
