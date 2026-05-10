// Previous-reader personalities for the Dispute rhythm mechanic.
// v1.5 shipped one reader (the unknown hand). v3.0 adds three more, each
// with a distinct rhythmic signature: a methodist who marks every fifth beat
// with iron regularity; a marginal heretic who clusters dense bursts and then
// goes silent for minutes; and an unlearned hand whose timing is broken but
// whose accents, when they land, are surprisingly true.

export type ReaderPattern =
	| { kind: 'steady'; intervalMs: number; jitterMs: number }
	| {
			kind: 'burst';
			burstSize: number;        // beats per burst before a long silence
			burstIntervalMs: number;  // gap between beats within a burst
			burstJitterMs: number;
			silenceMs: number;        // gap between bursts
			silenceJitterMs: number;
	  }
	| { kind: 'arrhythmic'; minMs: number; maxMs: number };

export interface Reader {
	id: string;
	name: string;
	tagline: string;            // one-line voice-over for the selector
	pattern: ReaderPattern;
	phrases: string[];          // small marks on baseline beats
	accentEvery: number;        // accent beat every N beats
	accentPhrases: string[];    // longer marks on accent beats
}

export const readers: Reader[] = [
	{
		id: 'unknown_hand',
		name: 'the hand of an unknown reader',
		tagline: 'a steady, unhurried hand. assumes you have time.',
		pattern: { kind: 'steady', intervalMs: 1100, jitterMs: 70 },
		phrases: ['see also', 'cf.', '—', 'vid.', 'nota', 'q.v.', 'ibid.', '∗', '·', 'comp.'],
		accentEvery: 5,
		accentPhrases: [
			'the text wants to mean something else',
			'compare',
			'see above',
			'¶',
			'☞'
		]
	},
	{
		id: 'methodist',
		name: 'the methodist',
		tagline: 'every fifth beat. every time. clockwork in the margin.',
		pattern: { kind: 'steady', intervalMs: 950, jitterMs: 30 },
		phrases: ['vid.', 'cf.', 'n.b.', 'sec.', 'cap.', 'ibid.', 'op. cit.', 'loc. cit.', 'sub voce', 'i.e.'],
		accentEvery: 5,
		accentPhrases: [
			'see above, capitulum 4',
			'see below, capitulum 9',
			'see the third witness',
			'collated with the sisene codex',
			'collated with the boethius',
			'collated with the gloss of laon'
		]
	},
	{
		id: 'marginal_heretic',
		name: 'the marginal heretic',
		tagline: 'storms of disagreement, then long silences. impatient with everything.',
		pattern: {
			kind: 'burst',
			burstSize: 5,
			burstIntervalMs: 280,
			burstJitterMs: 60,
			silenceMs: 4500,
			silenceJitterMs: 800
		},
		phrases: ['no.', 'wrong.', 'absurd.', 'falsum', 'non!', '!', '¬', '⸫', 'errare', 'pace'],
		// every beat is fierce — accents fire on every burst start
		accentEvery: 5,
		accentPhrases: [
			'this is not so. it has never been so.',
			'the master errs in this passage.',
			'to be excised from the canon.',
			'ego dissentio.',
			'haereticum est.',
			'in tempore non scriptum.'
		]
	},
	{
		id: 'unlearned_hand',
		name: 'the unlearned hand',
		tagline: 'slow, irregular, often wrong. occasionally landing a gloss of stunning rightness.',
		pattern: { kind: 'arrhythmic', minMs: 1400, maxMs: 3200 },
		phrases: ['—', '?', '·', 'hm.', 'maybe', 'i think', 'or not', 'unsure', 'no?', 'so?'],
		accentEvery: 7,
		accentPhrases: [
			'and yet, it is true.',
			'the master sees what is hidden here.',
			'this passage is the whole.',
			'i did not understand at first. now i do.',
			'this is what reading is.'
		]
	}
];

export function readerById(id: string): Reader {
	return readers.find((r) => r.id === id) ?? readers[0];
}

// Compute the next beat's peak time for a given reader. `beatIndex` is the
// 0-based index of the beat being placed (so `beatIndex === 0` is the first
// beat after the lead-in). For burst patterns this lets us decide when a
// silence falls without holding state outside the function.
export function nextBeatTime(reader: Reader, lastPeakTime: number, beatIndex: number): number {
	const p = reader.pattern;
	switch (p.kind) {
		case 'steady': {
			const delta = p.intervalMs + (Math.random() * 2 - 1) * p.jitterMs;
			return lastPeakTime + delta;
		}
		case 'burst': {
			// One full cycle is `burstSize` close beats followed by one long gap
			// before the next burst opens. Beat 0 of each cycle is the silence
			// boundary (we wait, then drop the first beat of the next burst).
			const cycle = p.burstSize + 1;
			const isAfterSilence = beatIndex > 0 && beatIndex % cycle === 0;
			const delta = isAfterSilence
				? p.silenceMs + (Math.random() * 2 - 1) * p.silenceJitterMs
				: p.burstIntervalMs + (Math.random() * 2 - 1) * p.burstJitterMs;
			return lastPeakTime + delta;
		}
		case 'arrhythmic': {
			const delta = p.minMs + Math.random() * (p.maxMs - p.minMs);
			return lastPeakTime + delta;
		}
	}
}

// Pick the phrase for a beat at `beatIndex`.
export function phraseForBeat(reader: Reader, beatIndex: number): string {
	if (beatIndex % reader.accentEvery === 0) {
		const i = Math.floor(beatIndex / reader.accentEvery) % reader.accentPhrases.length;
		return reader.accentPhrases[i];
	}
	return reader.phrases[beatIndex % reader.phrases.length];
}
