// Two tiny, content-free utilities `World`'s tick reaches for when it turns
// a def's flavor-text options into an event. Neither knows what a "field
// note" is — that's `MarginaliaDef.fieldNotes`' job.

/** Deterministic-friendly picker — pass a seeded Rng's draw at the call site, or a fixed value in tests. */
export function pickLine(options: readonly string[], r: number): string | null {
	if (options.length === 0) return null;
	const idx = Math.min(options.length - 1, Math.floor(r * options.length));
	return options[idx];
}

export function fillTemplate(template: string, name: string): string {
	return template.replace('{name}', name);
}
