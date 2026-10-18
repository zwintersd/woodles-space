import type { ClosureReflection, FiveContactsRound, IntervalObservation, LoopEvent, LoopEventType, MomentNoticing, OpenLoop } from './types';
import { INTERVAL_KIND_OPTIONS } from './instrument';
import { activeContacts } from './openLoops';
import { cycleGapsDays, median } from './loopInference';

/**
 * Descriptive counts over the person's own records. Nothing here explains
 * anything: things that sit next to each other in time are reported as
 * neighbours, and small numbers are labelled as small. No score, rank, or
 * streak is computed.
 */

const DAY = 24 * 60 * 60 * 1000;
export const CHANNELS: MomentNoticing['channel'][] = ['body', 'attention', 'behavior'];

export function momentTime(observation: IntervalObservation): Date {
	const [year, month, day] = observation.date.split('-').map(Number);
	const [hours, minutes] = observation.intervalStart.split(':').map(Number);
	return new Date(year, month - 1, day, hours, minutes);
}

export function momentLabel(observation: IntervalObservation): string {
	if (observation.sampleTag === null) return 'No label';
	return observation.sampleTag?.name ?? INTERVAL_KIND_OPTIONS.find(option => option.kind === observation.kind)?.label ?? 'No label';
}

export type LoopHistory = {
	loopId: string;
	title: string;
	status: OpenLoop['status'];
	resolution?: OpenLoop['resolution'];
	recurring: boolean;
	counts: Partial<Record<LoopEventType, number>>;
	firstEventAt?: string;
	lastEventAt?: string;
	/** Days from the first event to resolution, for a resolved one-off loop. */
	daysToResolution?: number;
	linkedMoments: number;
	linkedNoticings: number;
	contacts: number;
};

export type RhythmSummary = {
	loopId: string;
	title: string;
	closures: number;
	typicalGapDays?: number;
	lastGapDays?: number;
	rhythmDays?: number;
	lastClosedAt?: string;
};

export type LabelComparison = { name: string; after: number; other: number };

export type PatternSummary = {
	from: Date | null;
	to: Date;
	windowMinutes: number;
	resolutions: { closed: number; released: number };
	/** At least three resolutions in range; below that, comparisons are withheld. */
	enough: boolean;
	descriptors: { descriptor: string; closed: number; released: number }[];
	nextFeelsPossible: { something: number; rest: number; nothing: number; unanswered: number };
	momentsAfter: number;
	momentsOther: number;
	labels: LabelComparison[];
	noticingsAfter: Record<MomentNoticing['channel'], number>;
	noticingsOther: Record<MomentNoticing['channel'], number>;
	roundsAfter: number;
	roundsTotal: number;
	attribution: { channel: MomentNoticing['channel']; linked: number; unlinked: number }[];
	unattributedEvents: number;
	loops: LoopHistory[];
	rhythms: RhythmSummary[];
};

function emptyChannels(): Record<MomentNoticing['channel'], number> {
	return { body: 0, attention: 0, behavior: 0 };
}

export function summarizeLoopPatterns(input: {
	loops: OpenLoop[];
	events: LoopEvent[];
	reflections: ClosureReflection[];
	observations: IntervalObservation[];
	rounds: FiveContactsRound[];
	now: Date;
	/** 0 means all records. */
	rangeDays?: number;
	windowMinutes?: number;
}): PatternSummary {
	const windowMinutes = input.windowMinutes ?? 120;
	const windowMs = windowMinutes * 60 * 1000;
	const from = input.rangeDays ? new Date(input.now.getTime() - input.rangeDays * DAY) : null;
	const inRange = (time: Date) => (!from || time >= from) && time <= input.now;

	const events = input.events.filter(event => inRange(new Date(event.occurredAt)));
	const resolutions = events.filter(event => event.type === 'closed' || event.type === 'released');
	const resolutionTimes = resolutions.map(event => new Date(event.occurredAt).getTime());
	const followsResolution = (time: Date) => resolutionTimes.some(start => time.getTime() >= start && time.getTime() <= start + windowMs);

	const reflectionByEvent = new Map(input.reflections.map(reflection => [reflection.loopEventId, reflection]));
	const descriptorCounts = new Map<string, { closed: number; released: number }>();
	const nextFeelsPossible = { something: 0, rest: 0, nothing: 0, unanswered: 0 };
	for (const event of resolutions) {
		const reflection = reflectionByEvent.get(event.id);
		if (!reflection?.nextFeelsPossible) nextFeelsPossible.unanswered += 1;
		else nextFeelsPossible[reflection.nextFeelsPossible] += 1;
		for (const descriptor of reflection?.descriptors ?? []) {
			const entry = descriptorCounts.get(descriptor) ?? { closed: 0, released: 0 };
			entry[event.type === 'released' ? 'released' : 'closed'] += 1;
			descriptorCounts.set(descriptor, entry);
		}
	}

	const moments = input.observations.filter(observation => inRange(momentTime(observation)));
	const labelCounts = new Map<string, LabelComparison>();
	const noticingsAfter = emptyChannels();
	const noticingsOther = emptyChannels();
	let momentsAfter = 0;
	for (const moment of moments) {
		const after = followsResolution(momentTime(moment));
		if (after) momentsAfter += 1;
		const name = momentLabel(moment);
		const entry = labelCounts.get(name) ?? { name, after: 0, other: 0 };
		entry[after ? 'after' : 'other'] += 1;
		labelCounts.set(name, entry);
		for (const noticing of moment.noticings ?? []) (after ? noticingsAfter : noticingsOther)[noticing.channel] += 1;
	}

	const rounds = input.rounds.filter(round => inRange(new Date(round.startedAt)));
	const attribution = CHANNELS.map(channel => {
		const noticings = moments.flatMap(moment => (moment.noticings ?? []).filter(noticing => noticing.channel === channel).map(noticing => ({ noticing, moment })));
		const linked = noticings.filter(({ noticing, moment }) => noticing.linkedLoopIds?.length || moment.linkedLoopIds?.length).length;
		return { channel, linked, unlinked: noticings.length - linked };
	});

	const loops: LoopHistory[] = input.loops.flatMap(loop => {
		const own = events.filter(event => event.loopId === loop.id).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
		if (!own.length) return [];
		const counts: LoopHistory['counts'] = {};
		for (const event of own) counts[event.type] = (counts[event.type] ?? 0) + 1;
		const first = own[0].occurredAt;
		const daysToResolution = loop.status === 'resolved' && !loop.recurring && loop.resolvedAt
			? Math.max(0, (new Date(loop.resolvedAt).getTime() - new Date(first).getTime()) / DAY) : undefined;
		return [{
			loopId: loop.id, title: loop.title, status: loop.status, resolution: loop.resolution, recurring: Boolean(loop.recurring),
			counts, firstEventAt: first, lastEventAt: own.at(-1)!.occurredAt, daysToResolution,
			linkedMoments: moments.filter(moment => moment.linkedLoopIds?.includes(loop.id)).length,
			linkedNoticings: moments.reduce((sum, moment) => sum + (moment.noticings ?? []).filter(noticing => noticing.linkedLoopIds?.includes(loop.id)).length, 0),
			contacts: rounds.reduce((sum, round) => sum + activeContacts(round).filter(contact => contact.linkedLoopId === loop.id).length, 0)
		}];
	}).sort((a, b) => (b.lastEventAt ?? '').localeCompare(a.lastEventAt ?? '') || a.title.localeCompare(b.title));

	const rhythms: RhythmSummary[] = input.loops.filter(loop => loop.recurring).map(loop => {
		const closed = input.events.filter(event => event.loopId === loop.id && event.type === 'closed').sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
		const gaps = cycleGapsDays(loop.id, input.events);
		return {
			loopId: loop.id, title: loop.title, closures: closed.length,
			typicalGapDays: gaps.length >= 2 ? median(gaps) : undefined,
			lastGapDays: gaps.at(-1), rhythmDays: loop.rhythmDays, lastClosedAt: closed.at(-1)?.occurredAt
		};
	});

	return {
		from, to: input.now, windowMinutes,
		resolutions: { closed: resolutions.filter(event => event.type === 'closed').length, released: resolutions.filter(event => event.type === 'released').length },
		enough: resolutions.length >= 3,
		descriptors: [...descriptorCounts.entries()].map(([descriptor, counts]) => ({ descriptor, ...counts })).sort((a, b) => b.closed + b.released - a.closed - a.released || a.descriptor.localeCompare(b.descriptor)),
		nextFeelsPossible,
		momentsAfter, momentsOther: moments.length - momentsAfter,
		labels: [...labelCounts.values()].sort((a, b) => b.after + b.other - a.after - a.other || a.name.localeCompare(b.name)),
		noticingsAfter, noticingsOther,
		roundsAfter: rounds.filter(round => followsResolution(new Date(round.startedAt))).length,
		roundsTotal: rounds.length,
		attribution,
		unattributedEvents: events.filter(event => !event.loopId).length,
		loops,
		rhythms
	};
}

/** "3 of 7 (43%)" — a share is always shown with its count. */
export function share(part: number, whole: number): string {
	if (!whole) return '—';
	return `${part} of ${whole} (${Math.round((part / whole) * 100)}%)`;
}

export function daysLabel(days: number | undefined): string {
	if (days === undefined) return '—';
	if (days < 1) {
		const hours = Math.max(1, Math.round(days * 24));
		return `${hours} hour${hours === 1 ? '' : 's'}`;
	}
	const rounded = Math.round(days * 10) / 10;
	return `${rounded} day${rounded === 1 ? '' : 's'}`;
}
