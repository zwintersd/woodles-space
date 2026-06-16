export function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function now(): string {
	return new Date().toISOString();
}

export function formatDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateShort(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Clamp a number into [min, max], rounding to an integer. NaN (e.g. an empty
// number input) coerces to min; ±Infinity clamp to the nearer bound. Used for
// the cost and power/toughness steppers.
export function clampInt(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) return min;
	return Math.max(min, Math.min(max, Math.round(value)));
}

// Clamp a status intensity into [0, 10], kept to one decimal so a slider can
// glide (cold 6.4) without spraying float dust into storage. NaN → 0, i.e. off.
export function clampStatus(value: number): number {
	if (Number.isNaN(value)) return 0;
	const clamped = Math.max(0, Math.min(10, value));
	return Math.round(clamped * 10) / 10;
}
