import type { IntervalObservation, LoopEvent, OpenLoop } from './types';
import { recordedOrder } from './openLoops';
import { dateKey } from './utils';

/**
 * Offers, never answers. Everything here reads the person's own words and
 * records and proposes something they can accept or wave away. Nothing in
 * this module writes a link, a loop, or a setting — the caller only acts on a
 * click.
 */

const STOPWORDS = new Set(`
a about above after again against all almost also am an and any are around as at away back be because been before being
below between both but by can could did do does doing done down during each else even ever every few for from further get
gets getting go goes going gone got had has have having he her here hers him his how i if in into is it its itself just
keep kind know last least less let like little lot made make makes making many maybe me more most much my myself need needs
never new next no nor not now of off ok okay on once one only or other our out over own really right same she should so
some still such sure than that the their them then there these they thing things think this those though through to too
under until up us very want was way we well went were what when where which while who why will with would yet you your
today tonight tomorrow yesterday morning afternoon evening night week day days time times minute minutes hour hours
feel feeling felt feels bit kinda sort quite pretty bunch stuff something anything nothing everything someone
lot lots started start starting stop stopped trying try tried again already gonna wanna gotta mean meant supposed
`.trim().split(/\s+/));

/** A light stem so "replied", "replying" and "reply" meet; not a linguistic claim. */
export function stem(word: string): string {
	if (word.length > 4 && /ies$|ied$/.test(word)) return `${word.slice(0, -3)}y`;
	if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
	if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
	if (word.length > 4 && /(?:sh|ch|x|ss|z)es$/.test(word)) return word.slice(0, -2);
	if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
	return word;
}

export function contentWords(text: string): string[] {
	return (text.toLowerCase().match(/[a-z][a-z'’-]*[a-z]|[a-z]/g) ?? [])
		.map(word => word.replace(/[’']s$/, '').replace(/[’']/g, ''))
		.filter(word => word.length >= 3 && !STOPWORDS.has(word))
		.map(stem);
}

/** Share of the loop title's words that appear in the text. */
function overlap(titleWords: string[], textWords: Set<string>): number {
	const unique = [...new Set(titleWords)];
	if (!unique.length) return 0;
	return unique.filter(word => textWords.has(word)).length / unique.length;
}

/**
 * Loops whose names share words with what was written. Only unresolved loops
 * (and recurring ones between cycles) are offered, at most two.
 */
export function suggestLoopLinks(text: string, loops: OpenLoop[], exclude: string[] = []): OpenLoop[] {
	const words = new Set(contentWords(text));
	if (!words.size) return [];
	return loops
		.filter(loop => !exclude.includes(loop.id) && (loop.status !== 'resolved' || loop.recurring))
		.map(loop => ({ loop, score: overlap(contentWords(loop.title), words) }))
		.filter(item => item.score >= 0.5)
		.sort((a, b) => b.score - a.score || a.loop.title.localeCompare(b.loop.title))
		.slice(0, 2)
		.map(item => item.loop);
}

const INTENTION = /\b(?:i\s+)?(?:still\s+)?(?:need(?:s)? to|have to|has to|got to|gotta|should(?:\s+really)?|must|meant to|mean to|want to|wanna|forgot to|remember to|supposed to|ought to|haven['’]?t|have not)\s+(?!(?:be|been|feel|know|think|wait|say)\b)([^.,;!?\n]{3,60})/i;

/**
 * An unfinished intention named in the moment's own words, as a suggested
 * loop title. Plain description ("watching a video") never matches, so a
 * thought is not turned into an obligation unless it was phrased as one.
 */
export function loopCandidate(text: string, loops: OpenLoop[]): string | null {
	const match = text.match(INTENTION);
	if (!match) return null;
	const clause = match[1].trim().replace(/\s+(?:but|and then|because|though|so)\b.*$/i, '').replace(/\s+/g, ' ');
	const words = contentWords(clause);
	if (!words.length) return null;
	const wordSet = new Set(words);
	if (loops.some(loop => overlap(contentWords(loop.title), wordSet) >= 0.6)) return null;
	return clause.charAt(0).toUpperCase() + clause.slice(1);
}

export type ThemeOffer = { key: string; word: string; notes: number; days: number };

/**
 * Words that keep turning up in notes not yet connected to any loop. An offer
 * to name a loop, never a loop — the threshold (three notes across at least
 * two days) keeps one busy afternoon from producing a suggestion.
 */
export function repeatedThemes(input: {
	observations: IntervalObservation[]; events: LoopEvent[]; loops: OpenLoop[]; now: Date; days?: number; dismissed?: string[];
}): ThemeOffer[] {
	const since = new Date(input.now.getTime() - (input.days ?? 30) * 24 * 60 * 60 * 1000);
	const sinceKey = dateKey(since);
	const titled = new Set(input.loops.flatMap(loop => contentWords(loop.title)));
	const docs: { day: string; words: Set<string> }[] = [];
	for (const observation of input.observations) {
		if (observation.date < sinceKey || observation.linkedLoopIds?.length) continue;
		const texts = [observation.label, observation.note ?? '', ...(observation.noticings ?? []).filter(n => !n.linkedLoopIds?.length).map(n => n.note)];
		docs.push({ day: observation.date, words: new Set(contentWords(texts.join(' '))) });
	}
	for (const event of input.events) {
		if (event.loopId || !event.note || new Date(event.occurredAt) < since) continue;
		docs.push({ day: dateKey(new Date(event.occurredAt)), words: new Set(contentWords(event.note)) });
	}
	const seen = new Map<string, { notes: number; days: Set<string> }>();
	for (const doc of docs) for (const word of doc.words) {
		if (titled.has(word)) continue;
		const entry = seen.get(word) ?? { notes: 0, days: new Set<string>() };
		entry.notes += 1; entry.days.add(doc.day);
		seen.set(word, entry);
	}
	return [...seen.entries()]
		.filter(([, entry]) => entry.notes >= 3 && entry.days.size >= 2)
		.map(([word, entry]) => ({ key: `theme:${word}`, word, notes: entry.notes, days: entry.days.size }))
		.filter(offer => !input.dismissed?.includes(offer.key))
		.sort((a, b) => b.notes - a.notes || b.days - a.days || a.word.localeCompare(b.word))
		.slice(0, 3);
}

function closures(loopId: string, events: LoopEvent[]): LoopEvent[] {
	return events.filter(event => event.loopId === loopId && event.type === 'closed').sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || recordedOrder(a, b));
}

export type RecurringOffer = { key: string; loopId: string; closures: number };

/** A loop closed, reopened and closed again may be a recurring need. */
export function recurringOffers(loops: OpenLoop[], events: LoopEvent[], dismissed: string[] = []): RecurringOffer[] {
	return loops.filter(loop => !loop.recurring)
		.map(loop => ({ key: `recurring:${loop.id}`, loopId: loop.id, closures: closures(loop.id, events).length }))
		.filter(offer => offer.closures >= 2 && !dismissed.includes(offer.key));
}

export function cycleGapsDays(loopId: string, events: LoopEvent[]): number[] {
	const times = closures(loopId, events).map(event => new Date(event.occurredAt).getTime());
	return times.slice(1).map((time, index) => (time - times[index]) / (24 * 60 * 60 * 1000)).filter(gap => gap > 0);
}

export function median(values: number[]): number | undefined {
	if (!values.length) return undefined;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export type RhythmOffer = { key: string; loopId: string; days: number; cycles: number };

/**
 * After a few cycles, the observed rhythm as a suggestion. Offered only when
 * it differs from what the person already chose.
 */
export function rhythmOffers(loops: OpenLoop[], events: LoopEvent[], dismissed: string[] = []): RhythmOffer[] {
	return loops.filter(loop => loop.recurring).flatMap(loop => {
		const gaps = cycleGapsDays(loop.id, events);
		const typical = median(gaps);
		if (gaps.length < 2 || typical === undefined) return [];
		const days = Math.max(0.5, Math.round(typical * 2) / 2);
		const key = `rhythm:${loop.id}:${days}`;
		if (loop.rhythmDays === days || dismissed.includes(key)) return [];
		return [{ key, loopId: loop.id, days, cycles: gaps.length + 1 }];
	});
}
