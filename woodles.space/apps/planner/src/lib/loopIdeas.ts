import type { ClosureReflection, LoopEvent, OpenLoop } from './types';
import { latestLifecycleEvent } from './openLoops';
import { daysLabel } from './loopAnalysis';

/**
 * Ideas drawn from the person's own records, shown only when asked for.
 *
 * Every idea names its evidence, offers more than one direction (letting go
 * and resting count), and never asks for more after a closure. There is no
 * ranking of the person, no score, and nothing is started on their behalf.
 */

export type LoopIdea = { key: string; text: string };

const DAY = 24 * 60 * 60 * 1000;
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function countWord(count: number): string {
	return NUMBER_WORDS[count] ?? String(count);
}

function engaged(event: LoopEvent): boolean {
	return event.type === 'approached' || event.type === 'related_action' || event.type === 'progress';
}

export function loopIdeas(input: {
	loops: OpenLoop[];
	events: LoopEvent[];
	reflections: ClosureReflection[];
	now: Date;
	dismissed?: string[];
}): LoopIdea[] {
	const now = input.now.getTime();
	const ideas: LoopIdea[] = [];
	const since = (days: number) => (event: LoopEvent) => now - new Date(event.occurredAt).getTime() <= days * DAY;

	// A recurring need whose chosen rhythm has passed: a fact, not a debt.
	for (const loop of input.loops.filter(item => item.recurring && item.status === 'resolved' && item.rhythmDays && item.resolution === 'completed')) {
		const closure = latestLifecycleEvent(loop.id, input.events);
		if (!closure || closure.type !== 'closed') continue;
		const elapsed = (now - new Date(closure.occurredAt).getTime()) / DAY;
		if (elapsed < loop.rhythmDays!) continue;
		ideas.push({ key: `idea:rhythm:${closure.id}`, text: `${loop.title}: the last cycle closed ${daysLabel(elapsed)} ago, and the rhythm you chose is about ${daysLabel(loop.rhythmDays)}. If the need is back, you can start the next cycle — or leave it for now.` });
	}

	// Something that keeps coming to mind without being touched.
	for (const loop of input.loops.filter(item => item.status === 'open')) {
		const own = input.events.filter(event => event.loopId === loop.id);
		const notices = own.filter(event => event.type === 'noticed' && since(14)(event)).length;
		if (notices < 3 || own.some(event => engaged(event) && since(7)(event))) continue;
		ideas.push({ key: `idea:noticed:${loop.id}:${notices}`, text: `“${loop.title}” has come to mind ${countWord(notices)} times in two weeks. One option is a single small contact with it. Letting it go is also a resolution.` });
	}

	// The momentum observation, only from the person's own reflections.
	const answered = input.reflections.filter(reflection => reflection.nextFeelsPossible);
	const approachable = answered.filter(reflection => reflection.nextFeelsPossible === 'something').length;
	if (approachable >= 2 && approachable * 2 >= answered.length) {
		const candidates = input.loops.filter(loop => loop.status === 'open' && !loop.recurring && input.events.some(event => event.loopId === loop.id && engaged(event)))
			.sort((a, b) => (latestEvent(b.id, input.events) ?? '').localeCompare(latestEvent(a.id, input.events) ?? '')).slice(0, 2);
		if (candidates.length) ideas.push({
			key: `idea:momentum:${approachable}:${answered.length}`,
			text: `After ${countWord(approachable)} of ${countWord(answered.length)} closures you noted that something else felt approachable. If you'd like that kind of shift, a loop you've already approached — ${candidates.map(loop => `“${loop.title}”`).join(' or ')} — is one possibility. Rest is another.`
		});
	}

	// A long pause can stay a pause.
	for (const loop of input.loops.filter(item => item.status === 'paused')) {
		const pause = latestLifecycleEvent(loop.id, input.events);
		if (!pause || pause.type !== 'paused' || now - new Date(pause.occurredAt).getTime() < 14 * DAY) continue;
		ideas.push({ key: `idea:paused:${pause.id}`, text: `“${loop.title}” has been paused for ${daysLabel((now - new Date(pause.occurredAt).getTime()) / DAY)}. It can stay paused, or you could let it go.` });
	}

	const unresolved = input.loops.filter(loop => loop.status !== 'resolved').length;
	if (unresolved >= 8) ideas.push({ key: `idea:many:${unresolved}`, text: `${unresolved} loops are open or paused. Letting one go counts as a resolution, the same as closing it.` });

	return ideas.filter(idea => !input.dismissed?.includes(idea.key)).slice(0, 3);
}

function latestEvent(loopId: string, events: LoopEvent[]): string | undefined {
	return events.filter(event => event.loopId === loopId).map(event => event.occurredAt).sort().at(-1);
}
