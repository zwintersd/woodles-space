// Reading pass corpus — lines that drift across the field for annotation.
// Style: quiet, scholastic, meditative. Each line is a fragment of a reading act.

export const CORPUS: readonly string[] = [
	'the margin was emptier than the text',
	'a hand other than mine has glossed this passage',
	'the word they underlined is not the word I would have chosen',
	'this sentence has been read before, and differently',
	'a note in the outer column: perhaps, or perhaps not',
	'the text wants to mean something else here',
	'see also the absence of a gloss',
	'the gap between words is where reading happens',
	'compare this to something you have not yet read',
	'in the upper margin a correction without a source',
	'the hand changes here, and so does the argument',
	'a word is circled and the circle is all the gloss',
	'erasure is a kind of annotation',
	'the footnote is longer than the text it annotates',
	'between the lines a different century wrote itself in',
	'reading is a form of remembering you have not yet done',
	'the blank page at the end is part of the work',
	'something was here and was removed carefully',
	'the margin knows more than the text it borders',
	'a previous reader has marked this line twice',
	'a bracket opens on one page and closes somewhere else',
	'the tradition preserves the error, faithfully',
	'no gloss survives its first reader intact',
	'the blank space is not silence — it is instruction',
	'whoever left this note did not sign it',
	'a correction, then a correction of the correction',
	'the text continues past the point where it should stop',
	'a reading practice learned from someone else\'s margin',
	'the word "perhaps" appears more often than "is"',
	'the apparatus is longer than the canon it defends',
	'a name in the gutter that no scholar has placed',
	'the scribe copied the error and the error became the text',
	'a gloss so compressed it has become a word itself',
	'between one hand and another, the meaning shifted',
	'the reader before you has already made peace with this',
	'an annotation that outlasted the one who wrote it',
	'the margin is the only honest part of the page',
	'a cross-reference that leads, eventually, back here',
	'the absence of a gloss here is itself a reading',
	'a word underlined so many times it now underlines itself',
];

// Charged tokens — shown faintly in periwinkle as they approach the seam.
// These are words that carry codicological weight, or that recur meaningfully.
export const CHARGED_TOKENS = new Set([
	// core game vocabulary
	'margin', 'text', 'word', 'hand', 'gloss', 'reading',
	'note', 'column', 'page', 'canon', 'tradition', 'correction',
	'erasure', 'footnote', 'bracket', 'annotation', 'apparatus',
	'passage', 'century', 'scribe',
	// semantically charged in context
	'emptier', 'blank', 'circled', 'silence', 'absent', 'absence',
	'error', 'remember', 'remembering', 'perhaps', 'elsewhere',
	'marked', 'removed', 'preserved', 'faithfully', 'carefully',
	'reader', 'different', 'differently', 'shifted', 'outlasted',
	'compresses', 'compressed', 'honest', 'gutter', 'intact',
	'longer', 'something', 'someone', 'themselves', 'itself',
]);
