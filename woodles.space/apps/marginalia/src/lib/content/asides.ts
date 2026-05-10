// Asides — stray marginal phrases that drift through the reading area.
// Click to capture; longer phrases pay a touch more. They are flavor text
// in the same key as the rest of the game, recognisably borrowed from
// glossators who are not you.

export const asides: string[] = [
	'see also',
	'cf.',
	'q.v.',
	'compare',
	'see above',
	'see below',
	'an earlier hand',
	'in another reading',
	'the original is missing',
	'this passage cannot be original',
	'corrupted in transmission',
	'restored from a parallel',
	'[crossed out]',
	'[obscured]',
	'sic',
	'nota bene',
	'note',
	'a marginal hand has written',
	'the master is silent here',
	'the second witness disagrees',
	'a later hand corrects',
	'compare with the apocryphon',
	'this is not in the earliest copy',
	'a gloss in pencil',
	'a gloss in ink',
	'in the margin a finger',
	'an asterisk has been added',
	'an obelos was once here',
	'the cancel-mark is gone',
	'no one has read this for a long time',
	'a fingerprint',
	'a watermark almost visible',
	'a previous reader has folded the corner',
	'someone is reading along behind you',
	'a passage that is not yet written'
];

export function pickAside(): string {
	return asides[(Math.random() * asides.length) | 0];
}

// Glosses paid for catching an aside, scaled lightly with text length so longer
// phrases feel more rewarding without dwarfing click income.
export function asideReward(text: string): number {
	return 2 + Math.floor(text.length / 8);
}
