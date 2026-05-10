// Contested passages — five-or-six-line fragments, "famously disputed."
// Drawn from the registers the pitch named: church fathers, gnostic gospels,
// decree drafts, glossed law. Made-up but composed in their key.

export interface Passage {
	id: string;
	lines: string[];
	source: string;
	register: 'patristic' | 'gnostic' | 'decretal' | 'glossed-law' | 'apocryphal';
}

export const passages: Passage[] = [
	{
		id: 'antiochene_fragment',
		register: 'patristic',
		source: 'fragment, attributed (uncertainly) to a homily of antioch',
		lines: [
			'concerning the saying of the master, that the wheat must die,',
			'some have read it as a counsel of patience, others as a hidden command.',
			'we judge that both readings are insufficient.',
			'the seed does not die for the sake of the harvest;',
			'the seed dies because that is what seeds do,',
			'and the harvest is the speech we make about it afterward.'
		]
	},
	{
		id: 'gospel_of_the_doubter',
		register: 'gnostic',
		source: 'gospel of the doubter, fragment 14',
		lines: [
			'the disciple thomas asked: how shall we know the kingdom?',
			'the master answered: it is not in the sky, nor under the earth,',
			'nor in any place where you are not already standing.',
			'thomas said: then it is here. the master said: do not be hasty.',
			'it is also not here. it is in the gap between the question and its answer.'
		]
	},
	{
		id: 'decree_of_the_third_synod',
		register: 'decretal',
		source: 'draft, third synod, never promulgated',
		lines: [
			'whereas a reading is held to be canonical only when received,',
			'and whereas reception cannot be commanded but only observed,',
			'this synod declines to issue a canon at this time.',
			'in place of a canon we offer the following observation:',
			'a tradition that requires defending has already been lost.',
			'we will continue to defend it, as is our office.'
		]
	},
	{
		id: 'gloss_on_the_law_of_witnesses',
		register: 'glossed-law',
		source: 'glossed copy of the law of witnesses, marginal hand C',
		lines: [
			'the law requires two witnesses for any saying to stand.',
			'the gloss adds: a witness who is certain is not a witness.',
			'a second gloss, in another hand: a witness who is uncertain is not one either.',
			'a third gloss, scratched out: then the law cannot be kept.',
			'a fourth: that is correct. that is what the law is for.'
		]
	},
	{
		id: 'apocryphon_of_the_margin',
		register: 'apocryphal',
		source: 'apocryphon of the margin, opening',
		lines: [
			'and they came to the book, and the book was closed.',
			'and they opened the book, and the book was empty.',
			'and they wrote in the book, and what they wrote was not theirs.',
			'and the book was closed again, and given to another reader.',
			'and the next reader read what was written, and corrected it,',
			'and in this manner the book was composed, slowly, by many hands.'
		]
	},
	{
		id: 'epistle_concerning_doubt',
		register: 'patristic',
		source: 'epistle concerning doubt, fragment',
		lines: [
			'you write that you have begun to doubt the older readings.',
			'this is correct. one should begin to doubt them.',
			'but one should also doubt the doubt; it too is a reading.',
			'the master, when pressed, refused to give us a method.',
			'he said only: stay long enough at the passage to be changed by it.',
			'i have stayed at this passage for forty years, and i am not yet finished.'
		]
	},
	{
		id: 'rescript_on_the_unwritten',
		register: 'decretal',
		source: 'rescript on the unwritten law, year unknown',
		lines: [
			'concerning that part of the law which was never set down,',
			'the question has arisen whether it binds those who do not know it.',
			'this office holds, with the third witness, that it does.',
			'the unwritten law is not less because it was not written.',
			'it is more, because no copyist has had occasion to err over it,',
			'and no reader has had occasion to read it wrongly into the margin.',
			'the unwritten law is the only law that remains intact.'
		]
	}
];

export function passageFor(seed: number): Passage {
	return passages[seed % passages.length];
}

// Pull a tiny self-quote we can use as a "canonical citation" in feeds and
// future glosses after a passage has been read intact.
export function citationFromPassage(p: Passage): string {
	const line = p.lines[(Math.random() * p.lines.length) | 0];
	return `"${line}" — ${p.source}`;
}
