// Marginal glyphs — the rain that descends on a contested passage.
// Helpful glyphs annotate; corrupting glyphs deface. The corrupting set are
// real codicological marks for excision and doubt: the obelos (†), the
// obelisk-asterisk (※), the censorious bar (⸿). You are dodging the
// censor's pen.

export type GlyphValence = 'helpful' | 'corrupting';

export interface GlyphKind {
	char: string;
	valence: GlyphValence;
	name: string;
	weight: number; // spawn weight
}

export const glyphs: GlyphKind[] = [
	// helpful — annotation marks
	{ char: '☞', valence: 'helpful', name: 'manicule', weight: 3 },
	{ char: '¶', valence: 'helpful', name: 'pilcrow', weight: 4 },
	{ char: '*', valence: 'helpful', name: 'asterisk', weight: 4 },
	{ char: '⁋', valence: 'helpful', name: 'reverse pilcrow', weight: 2 },
	{ char: '✦', valence: 'helpful', name: 'four-point star', weight: 2 },

	// corrupting — marks of excision, doubt, censorship
	{ char: '†', valence: 'corrupting', name: 'obelus', weight: 4 },
	{ char: '‡', valence: 'corrupting', name: 'double dagger', weight: 3 },
	{ char: '⸿', valence: 'corrupting', name: 'capitulum / censorious bar', weight: 2 },
	{ char: '⁂', valence: 'corrupting', name: 'asterism (excision)', weight: 2 }
];

const TOTAL_WEIGHT = glyphs.reduce((s, g) => s + g.weight, 0);

export function pickGlyph(): GlyphKind {
	let r = Math.random() * TOTAL_WEIGHT;
	for (const g of glyphs) {
		r -= g.weight;
		if (r <= 0) return g;
	}
	return glyphs[0];
}

// A character used to mark a corrupted letter inside a word. Picked at random
// per corruption so the defacement looks varied, not uniform.
const CORRUPTION_CHARS = ['█', '▒', '░', '▚', '▞', '▓'];

export function corruptionChar(): string {
	return CORRUPTION_CHARS[(Math.random() * CORRUPTION_CHARS.length) | 0];
}
