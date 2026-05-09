// Previous-reader personalities for the Dispute rhythm mechanic.
// Each reader produces a rhythmic beat pattern with characteristic
// timing and annotation phrases.

export interface Reader {
	id: string;
	name: string;
	interval: number;   // ms between beats (base)
	jitter: number;     // ±ms timing variation per beat
	phrases: string[];  // annotation marks that drift past on their track
	accentEvery: number;        // accent beat every N beats
	accentPhrases: string[];    // phrases used on accented beats
}

export const readers: Reader[] = [
	{
		id: 'unknown_hand',
		name: 'the hand of an unknown reader',
		interval: 1100,
		jitter: 70,
		phrases: ['see also', 'cf.', '—', 'vid.', 'nota', 'q.v.', 'ibid.', '∗', '·', 'comp.'],
		accentEvery: 5,
		accentPhrases: [
			'the text wants to mean something else',
			'compare',
			'see above',
			'¶',
			'☞',
		],
	},
];

// Generate the peak time for the next beat.
export function nextBeatTime(reader: Reader, lastPeakTime: number): number {
	const delta = reader.interval + (Math.random() * 2 - 1) * reader.jitter;
	return lastPeakTime + delta;
}

// Pick the phrase for a beat at beatIndex.
export function phraseForBeat(reader: Reader, beatIndex: number): string {
	if (beatIndex % reader.accentEvery === 0) {
		const i = Math.floor(beatIndex / reader.accentEvery) % reader.accentPhrases.length;
		return reader.accentPhrases[i];
	}
	return reader.phrases[beatIndex % reader.phrases.length];
}
