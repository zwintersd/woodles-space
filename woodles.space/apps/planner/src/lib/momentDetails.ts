import type { IntervalObservation, MomentDetails } from './types';
import { timeToMinutes } from './utils';

export type DetailKey = keyof MomentDetails;
export const DETAIL_FIELDS: { key: DetailKey; title: string; question: string; scale?: string[]; placeholder?: string }[] = [
	{ key: 'mood', title: 'Mood', question: 'How does this moment feel?', scale: ['Very low', 'Low', 'In between', 'Good', 'Very good'] },
	{ key: 'energy', title: 'Energy', question: 'How much energy do you have?', scale: ['Depleted', 'Low', 'Some', 'Plenty', 'High'] },
	{ key: 'coping', title: 'Coping', question: 'How manageable does this feel?', scale: ['Overwhelming', 'Hard', 'Mixed', 'Manageable', 'Very manageable'] },
	{ key: 'helped', title: 'What helped', question: 'What helped in this moment?', placeholder: 'A break, a walk, a conversation…' },
	{ key: 'friction', title: 'What made it harder', question: 'What made this moment harder?', placeholder: 'An interruption, pressure, uncertainty…' },
	{ key: 'body', title: 'Body', question: 'What do you notice in your body?', placeholder: 'Tense shoulders, comfortable, tired…' },
	{ key: 'company', title: 'People & surroundings', question: 'Who or what was around you?', placeholder: 'Alone at home, with a friend, somewhere noisy…' }
];

export function hasDetail(details: MomentDetails, key: DetailKey): boolean {
	const value = details[key];
	return typeof value === 'number' || (typeof value === 'string' && value.trim().length > 0);
}

export function cleanDetails(details: MomentDetails): MomentDetails {
	return Object.fromEntries(DETAIL_FIELDS.flatMap<[DetailKey, number | string]>(field => {
		const value = details[field.key];
		if (field.scale) return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5 ? [[field.key, value]] : [];
		return typeof value === 'string' && value.trim() ? [[field.key, value.trim()]] : [];
	}));
}

export function detailSummary(details: MomentDetails = {}): string {
	return DETAIL_FIELDS.filter(field => hasDetail(details, field.key)).map(field => field.scale ? `${field.title}: ${field.scale[Number(details[field.key]) - 1]}` : field.title).join(' · ');
}

/** Offers are questions, never inferred answers. Only strictly earlier marks from this day count. */
export function suggestMomentDetails(input: {
	text: string; tagName?: string; details: MomentDetails; date: string; start: string;
	previous: IntervalObservation[]; dismissed?: DetailKey[];
}): { key: DetailKey; reason: string }[] {
	if (!input.text.trim()) return [];
	const prior = input.previous.filter(o => o.date === input.date && o.intervalStart < input.start).sort((a, b) => b.intervalStart.localeCompare(a.intervalStart));
	const offers: { key: DetailKey; reason: string }[] = [];
	const offer = (key: DetailKey, reason: string, explicit = false) => {
		if (hasDetail(input.details, key) || input.dismissed?.includes(key) || offers.some(o => o.key === key)) return;
		const recent = prior.find(o => o.details && hasDetail(o.details, key));
		// Don't repeatedly ask for the same rating every bell without a new cue.
		if (!explicit && recent && timeToMinutes(input.start) - timeToMinutes(recent.intervalStart) < 60) return;
		offers.push({ key, reason });
	};
	if ((input.details.mood ?? 5) <= 2 || (input.details.coping ?? 5) <= 2) offer('helped', 'You marked this as a difficult moment. Anything that helped?', true);
	if ((input.details.energy ?? 5) <= 2) offer('body', 'You marked low energy. Anything physical worth noting?', true);
	if (/\b(stress(?:ed|ful)?|overwhelm(?:ed|ing)?|pressure|struggling|anxious)\b/i.test(input.text)) offer('coping', 'Your entry mentions strain. Want to record how manageable it felt?', true);
	if (/\b(tired|exhausted|sleepy|rest(?:ing)?|walk(?:ing)?|run(?:ning)?|exercise|workout)\b/i.test(input.text)) offer('energy', 'Your entry mentions rest, tiredness, or movement.', true);
	if (/\b(happy|sad|calm|upset|joy|angry|relieved|lonely)\b/i.test(input.text)) offer('mood', 'Your entry mentions a feeling.', true);
	if (/\b(pain|ache|tense|headache|sore)\b/i.test(input.text)) offer('body', 'Your entry mentions a physical sensation.', true);
	if (/\b(friend|family|colleague|partner|alone|crowd|noisy)\b/i.test(input.text)) offer('company', 'Your entry mentions people or surroundings.', true);
	if (/\b(helped|better|break|relax(?:ed|ing)?|meditat(?:e|ing|ion))\b/i.test(input.text)) offer('helped', 'Your entry mentions a break or something helpful.', true);
	if (/\b(interrupt(?:ed|ion|ions)?|deadline|argument|distract(?:ed|ion|ions)?)\b/i.test(input.text)) offer('friction', 'Your entry mentions something that may have made it harder.', true);
	if (/\b(rest|moving|movement|exercise)\b/i.test(input.tagName ?? '')) offer('energy', 'Related to the color label you selected.');
	const lowEnergy = prior.find(o => (o.details?.energy ?? 5) <= 2);
	const latestEnergy = prior.find(o => o.details?.energy !== undefined);
	if (lowEnergy && lowEnergy.id === latestEnergy?.id) offer('energy', `You recorded low energy at ${lowEnergy.intervalStart}. Has it changed?`);
	const latestCoping = prior.find(o => o.details?.coping !== undefined);
	if (latestCoping && (latestCoping.details?.coping ?? 5) <= 2) offer('coping', `Things felt hard at ${latestCoping.intervalStart}. How about this moment?`);
	if (prior.length === 0) offer('mood', 'Your first sample today; add a mood rating if useful.');
	return offers.slice(0, 2);
}
