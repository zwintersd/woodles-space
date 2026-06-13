// Pure helpers for the tag system — no Svelte runes, so they can be unit-tested
// directly and shared by the store and components.
//
// Tags are stored with their display casing but treated case-insensitively
// everywhere (so "Sci-Fi" and "sci-fi" are the same tag, never duplicated).

export type TagCount = { tag: string; count: number };

const MAX_TAG_LEN = 50;

export function normalizeTag(raw: string): string {
	return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LEN).trim();
}

export function sameTag(a: string, b: string): boolean {
	return a.toLowerCase() === b.toLowerCase();
}

export function hasTag(tags: string[], tag: string): boolean {
	return tags.some((t) => sameTag(t, tag));
}

export function addTag(tags: string[], raw: string): string[] {
	const t = normalizeTag(raw);
	if (!t || hasTag(tags, t)) return tags;
	return [...tags, t];
}

export function removeTag(tags: string[], tag: string): string[] {
	return tags.filter((t) => !sameTag(t, tag));
}

// Normalize + dedupe an arbitrary list (e.g. from import or sync).
export function cleanTags(tags: string[]): string[] {
	let out: string[] = [];
	for (const t of tags) out = addTag(out, t);
	return out;
}

// Split a free-text entry like "sci-fi, 90s,  rewatch" into clean, unique tags.
export function parseTags(input: string): string[] {
	let out: string[] = [];
	for (const piece of input.split(',')) out = addTag(out, piece);
	return out;
}

// Aggregate tags across spores, case-insensitively, keeping the most common
// casing for display. Sorted by count (desc) then alphabetically.
export function tagCounts(spores: Array<{ tags?: string[] }>): TagCount[] {
	const groups = new Map<string, { display: Map<string, number>; count: number }>();
	for (const s of spores) {
		for (const raw of s.tags ?? []) {
			const t = normalizeTag(raw);
			if (!t) continue;
			const key = t.toLowerCase();
			let g = groups.get(key);
			if (!g) {
				g = { display: new Map(), count: 0 };
				groups.set(key, g);
			}
			g.count++;
			g.display.set(t, (g.display.get(t) ?? 0) + 1);
		}
	}
	const result: TagCount[] = [];
	for (const g of groups.values()) {
		let best = '';
		let bestN = -1;
		for (const [disp, n] of g.display) {
			if (n > bestN) {
				best = disp;
				bestN = n;
			}
		}
		result.push({ tag: best, count: g.count });
	}
	return result.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
