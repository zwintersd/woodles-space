// @ts-check

/**
 * The authoring brief — one spec, several output contracts.
 *
 * Nothing here calls a model. The human carries the prompt out and the answer
 * back, which is what keeps every app in this workspace backend-free.
 *
 * The brief itself is Z's, and it is the part that must not drift: voice,
 * structure, etymology-as-semantic-drift, the metaphor sources, the standing
 * lenses, the conversions, the reading-list rule. What changes between callers
 * is only **what shape the answer should come back in** — a complete page for
 * Ologypedia's studio, a body fragment with `[[links]]` for the Garden.
 *
 * Browser-ready `.js` with a `.d.ts` sidecar, because `add-page.html` is a
 * static page with no build step (same shape as `@woodles/app-manifest` and
 * `@woodles/text`).
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
 * across these; only the contract differs.
 */
export const OUTPUT_CONTRACTS = Object.freeze({
	/** Ologypedia's studio: one complete standalone file, ready to publish. */
	page: '',

	/**
	 * The Garden: an editable body, not a document. Plain prose with
	 * `[[wikilinks]]`, which is exactly what a spore body already stores —
	 * so the authoring format and the storage format are the same thing.
	 */
	fragment: `OUTPUT — return only the body of the entry. No title, no masthead, no CSS,
no HTML document, no code fences, no explanation before or after.

Write it as plain prose. Use blank lines between paragraphs and "— " at the
start of a list item. Do not use markdown headers, bold, or italics.

Wrap 3–8 key concepts in [[double brackets]] — the terms this entry would
want its own linked entries for. Use [[Concept|the words in your sentence]]
when the phrase in the prose differs from the entry title. Link a concept on
first mention only.`
});

/** @typedef {'page' | 'fragment'} OutputContract */

/**
 * @typedef {object} BriefOptions
 * @property {string} topic
 * @property {OutputContract} [output] Defaults to `fragment`.
 * @property {string} [subject] Domain / subdomain, for the masthead kicker.
 * @property {string} [context] Your own relationship to the topic, if any.
 * @property {boolean} [diagnosis] Adds the health-condition sections.
 * @property {string} [appendix] Caller-specific trailer, e.g. a visual system.
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
	const parts = [`Write this as a personal-textbook-style page or chapter on: ${topic}`];

	const subject = (options.subject ?? '').trim();
	if (subject) parts.push(`Domain / subdomain for the masthead kicker: ${subject}`);

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
