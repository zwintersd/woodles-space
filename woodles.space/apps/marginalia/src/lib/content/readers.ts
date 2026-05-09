// Previous reader personalities for the Dispute mechanic.
// Each reader has a distinct rhythm (interval sequence), phrase vocabulary,
// and visual identity. The interval sequence cycles deterministically so the
// pattern is learnable across repeated encounters.

export type ReaderColor = 'periwinkle' | 'muted' | 'cyan';

export interface Reader {
	id: string;
	name: string;   // shown above the upper track
	hand: string;   // attribution line (flavour)
	color: ReaderColor;
	phrases: readonly string[];      // cycling vocabulary of annotation marks
	intervalSeq: readonly number[];  // cycling beat intervals in ms
}

// ── the hand of an unknown reader ────────────────────────────────────────────
// Arrhythmic, poetic, recognisable. Arrives with the unknown_hand generator.
// Long pauses followed by dense bursts; a character without a name.

export const unknownReader: Reader = {
	id: 'unknown_hand',
	name: 'the hand of an unknown reader',
	hand: 'a different hand. a different century, possibly.',
	color: 'periwinkle',
	phrases: [
		'—',
		'?',
		'perhaps',
		'and yet',
		'see',
		'the text wants',
		'elsewhere',
		'but',
		'compare',
		'note',
		'✓',
		'or',
		'read with',
		'see also',
		'—',
		'the text wants',
		'?',
		'and yet',
	],
	// Intentionally irregular. Has a long pause (3000) and a short burst (800, 900)
	// that repeat; once learned, it is anticipate-able.
	intervalSeq: [
		1200, 1800, 1000, 2400, 1300, 1700, 900, 3000,
		1400, 1100, 2000, 1300, 800, 1600, 2200, 1000,
	],
};

// ── the methodist ─────────────────────────────────────────────────────────────
// Reserved for v3.0. Regular, predictable, marks every 1400ms exactly.
// Easy to agree with; harder to counterpoint.

export const methodistReader: Reader = {
	id: 'methodist',
	name: 'the methodist',
	hand: 'marks every fifth beat. waits patiently for the others.',
	color: 'muted',
	phrases: ['✓', 'cf.', 'compare', 'note', 'see also', 'ibid.', 'N.B.'],
	intervalSeq: [1400, 1400, 1400, 1400, 1400, 1400, 1400, 1400],
};

// ── the marginal heretic ───────────────────────────────────────────────────────
// Reserved for v3.0. Dense bursts then long silences; easy to dispute,
// nearly impossible to counterpoint during the silences.

export const marginalHeretic: Reader = {
	id: 'marginal_heretic',
	name: 'the marginal heretic',
	hand: 'writes in clusters. then nothing for minutes.',
	color: 'cyan',
	phrases: ['!', 'no', 'but read', '—no—', 'contra', 'compare', 'the opposite', '?!'],
	intervalSeq: [
		600, 700, 500, 800, 600, 4000, 4500, 3800,
		550, 650, 700, 500, 5000, 4200, 3600, 4800,
	],
};

export const allReaders: readonly Reader[] = [unknownReader, methodistReader, marginalHeretic];

export function readerById(id: string): Reader | undefined {
	return allReaders.find((r) => r.id === id);
}
