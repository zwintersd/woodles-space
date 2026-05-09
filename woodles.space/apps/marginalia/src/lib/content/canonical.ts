// canonical opening texts — five lines each, one per prestige run.
// the very first run uses index 0; each prestige rotates to the next.

export interface Canonical {
	lines: string[];
	attribution: string;
}

export const canonical: Canonical[] = [
	{
		lines: [
			'in the year that has not been numbered',
			'a reader sat down to a book they did not own',
			'and finding the margin emptier than the text',
			'began, with a thin and uncertain pen,',
			'to take from the margin what the margin could spare.'
		],
		attribution: 'opening, first hand'
	},
	{
		lines: [
			'all books, in the end, are read by the wrong reader.',
			'the wrong reader does not know they are wrong.',
			'they take the book in good faith.',
			'they leave their hand in the margin.',
			'the margin keeps it, and goes on.'
		],
		attribution: 'opening, second hand'
	},
	{
		lines: [
			'between the page and its reader stands a third party,',
			'older than the text, younger than the binding,',
			'who reads neither for sense nor for pleasure',
			'but for the small and patient labor',
			'of holding two readings at once, and choosing neither.'
		],
		attribution: 'opening, of an unknown hand'
	},
	{
		lines: [
			'this passage, in its earliest witness, says one thing.',
			'in its later witnesses it has been corrected.',
			'in the latest, it has been corrected back.',
			'no one alive remembers what was originally meant.',
			'the apparatus, however, remembers everything that has been guessed.'
		],
		attribution: 'opening, recensional'
	},
	{
		lines: [
			'the book i am reading has been read before.',
			'i can tell because someone has already disagreed in the margin.',
			'i agree with the disagreement, in pencil, lightly.',
			'someone, eventually, will disagree with me.',
			'this is, i think, what the book is for.'
		],
		attribution: 'opening, late hand'
	},
	{
		lines: [
			'a book without margins is a book that has not been read.',
			'a book that has been read carries its readings forward.',
			'a book read enough times becomes its readings.',
			'the original survives only as a citation in the apparatus.',
			'this is not a loss. this is the form of the book.'
		],
		attribution: 'opening, terminal'
	}
];

export function canonicalFor(prestigeIndex: number): Canonical {
	return canonical[prestigeIndex % canonical.length];
}
