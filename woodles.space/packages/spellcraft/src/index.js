// @ts-check

/**
 * The authoring brief.
 *
 * Nothing here calls a model. The human carries the prompt out and the answer
 * back, which is what keeps every app in this workspace backend-free.
 *
 * The brief itself is Z's, and it is the part that must not drift: voice,
 * structure, etymology-as-semantic-drift, the metaphor sources, the standing
 * lenses, the conversions, the reading-list rule.
 *
 * This package used to carry two output contracts — a complete standalone
 * page for Ologypedia's studio, a body fragment with `[[links]]` for Spores'
 * Garden. Both apps retired into Write (see CONVERGENCE.md), which took the
 * brief with them rather than let it go down with either app: `fragment` is
 * now Write's own "draft it with a prompt" gesture, asking for plain prose
 * rather than a document, because that's what a draft already is. `page`
 * had exactly one consumer and that consumer is gone, so it isn't ported —
 * a caller that needs a full document again can add the contract back.
 *
 * Browser-ready `.js` with a `.d.ts` sidecar, same shape as
 * `@woodles/app-manifest` and `@woodles/text`, so a static page could still
 * import it directly if one ever needs to.
 */

/** The voice and substance rules. Order matters — this reads as one brief. */
const BRIEF = [
	`Voice: conversational but rigorous, standard intro-course background assumed.
Slightly more playful than neutral — except where the topic is genuinely
heavy, where the register shifts to hope/awe/significance rather than
forced levity or flat solemnity. The narrator is an implied presence —
never says "I" — but has clear judgment and speaks directly to "you,"
steering attention rather than narrating past it. External, curious,
helpful, a little magical — not an oracle, not a casual friend.`,

	`Structure: headers, generously used. No length ceiling. No closing
synthesis/wrap-up paragraph — end on the last substantive section. Include
a figure or diagram whenever a mechanism, process, or structure would
genuinely be clearer shown than described.`,

	`Etymology: track key terms as semantic drift — how the meaning moved and
why — at first use, not just the root. Foreign/loan terms get a quick
pronunciation gloss on first appearance.`,

	`Bridges: metaphors only from educational psychology, game/systems design,
sociology & media studies, or neuroscience/cognitive science. Never sports.`,

	`Worked example(s): grounded in real, checkable material only — a
mechanism, a real historical artifact/event, real data. Never an
interpretive reading of the topic's own fictional content.`,

	`Standing lenses — check for a genuine connection to: (1) autism/
neurodivergence, including special-interest culture, not just clinical
application; (2) ABA & behavior-analytic clinical practice; (3)
anti-essentialism, queerness, or systems-thinking approaches. Skip
silently if there's no real connection — no mention of absence. When
there is one, weave it into the prose without ever naming the lens.
Length scales to how much it adds.`,

	`Conversions, every time relevant: distance in mi + km, temperature in
°F + °C, weight in lb + kg, volume in gal/cups + L/mL, historical dollar
figures with a current-year inflation-adjusted equivalent, historical
dates with "X years ago," chemical formula alongside common name where
relevant, population/count figures alongside their share of the relevant
total. Do not anchor big numbers to a forced concrete-object comparison.`,

	`Reading list: primary/seminal sources preferred; one accessible on-ramp
only if the primary source is a genuinely rough entry point.`
];

/** Extra sections a diagnosis or health condition needs. */
const DIAGNOSIS_ADDENDUM = `This topic is a diagnosis or health condition — also add: supporting a
loved one who has it, personal risk-assessment (what to know if
diagnosed, or whether to get assessed), professional/clinical
application (relevant to ABA/behavior-analytic work), and a
prerequisite-study map (what to learn first for real depth).`;

/**
 * What shape the answer should come back in. The brief above is identical
 * regardless; this is the one contract left standing (see the header above).
 */
export const OUTPUT_CONTRACTS = Object.freeze({
	/**
	 * A draft, not a document. Plain prose, ready to drop straight into
	 * Write's foreground layer via `textToHtml`.
	 */
	fragment: `OUTPUT — return only the body of the piece. No title, no masthead, no CSS,
no HTML document, no code fences, no explanation before or after.

Write it as plain prose. Use blank lines between paragraphs and "— " at the
start of a list item. Do not use markdown headers, bold, or italics.`
});

/** @typedef {'fragment'} OutputContract */

/**
 * @typedef {object} BriefOptions
 * @property {string} topic
 * @property {OutputContract} [output] Defaults to `fragment`.
 * @property {string} [subject] Domain / subdomain, for context.
 * @property {string} [context] Your own relationship to the topic, if any.
 * @property {boolean} [diagnosis] Adds the health-condition sections.
 * @property {string} [appendix] Caller-specific trailer appended after a rule.
 */

/**
 * Assemble the prompt a person copies out to any model.
 *
 * @param {BriefOptions} options
 * @returns {string}
 */
export function buildBrief(options) {
	const topic = (options.topic ?? '').trim() || '[TOPIC]';
	const output = options.output ?? 'fragment';
	const parts = [`Write this as a piece on: ${topic}`];

	const subject = (options.subject ?? '').trim();
	if (subject) parts.push(`Domain / subdomain: ${subject}`);

	const context = (options.context ?? '').trim();
	if (context) parts.push(`Optional context: ${context}`);

	parts.push(...BRIEF);
	if (options.diagnosis) parts.push(DIAGNOSIS_ADDENDUM);

	const contract = OUTPUT_CONTRACTS[output] ?? '';
	if (contract) parts.push(contract);

	const appendix = (options.appendix ?? '').trim();
	if (appendix) parts.push('---', appendix);

	return parts.join('\n\n');
}

/**
 * Models wrap answers in fences however often you ask them not to. Strip them
 * rather than making the person tidy up before pasting.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripCodeFences(text) {
	let out = String(text ?? '').trim();
	const fenced = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(out);
	if (fenced) out = fenced[1];
	return out.trim();
}

/**
 * Answers arrive as prose, or as HTML, or as markdown, depending on the model
 * and the day. Reduce any of them to the plain text with `[[links]]` that a
 * body actually stores.
 *
 * @param {string} text
 * @param {(html: string) => string} htmlToText Injected so this package stays
 *   free of a DOM dependency; pass `@woodles/text`'s.
 * @returns {string}
 */
export function ingestDraft(text, htmlToText) {
	let out = stripCodeFences(text);
	if (/<(?:p|div|h[1-6]|ul|ol|li|blockquote|br)\b/i.test(out)) out = htmlToText(out);

	return out
		// Markdown headers become plain lines — a body has no heading level.
		// `[ \t]` rather than `\s`: with the m flag, `\s` crosses newlines and
		// would swallow the blank line separating a heading from what follows.
		.replace(/^#{1,6}[ \t]+/gm, '')
		// Bullets become the same "— " the Textbook import produces.
		.replace(/^[ \t]*[-*+][ \t]+/gm, '— ')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
