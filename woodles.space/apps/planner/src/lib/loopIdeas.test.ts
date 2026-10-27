import { describe, expect, it } from 'vitest';
import { loopIdeas } from './loopIdeas';
import type { ClosureReflection, LoopEvent, OpenLoop } from './types';

const now = new Date('2026-10-18T15:00:00.000Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
const loop = (id: string, title: string, extra: Partial<OpenLoop> = {}): OpenLoop => ({
	id, title, status: 'open', createdAt: daysAgo(30), updatedAt: daysAgo(30), ...extra
});
const event = (id: string, loopId: string, type: LoopEvent['type'], occurredAt: string): LoopEvent => ({ id, loopId, type, occurredAt, recordedAt: occurredAt });
const reflection = (id: string, next: ClosureReflection['nextFeelsPossible']): ClosureReflection => ({ id, loopEventId: id, descriptors: [], nextFeelsPossible: next, recordedAt: daysAgo(3) });

describe('ideas, only from the person’s own records', () => {
	it('has nothing to say about an empty notebook or a single closure', () => {
		expect(loopIdeas({ loops: [], events: [], reflections: [], now })).toEqual([]);
		const closed = [loop('a', 'Reply to Mom', { status: 'resolved', resolution: 'completed' })];
		expect(loopIdeas({ loops: closed, events: [event('c', 'a', 'closed', daysAgo(0.01))], reflections: [reflection('c', 'something')], now })).toEqual([]);
	});

	it('mentions a recurring need once its chosen rhythm has passed, without urgency', () => {
		const shower = loop('s', 'Shower', { recurring: true, rhythmDays: 2, status: 'resolved', resolution: 'completed' });
		const ideas = loopIdeas({ loops: [shower], events: [event('c', 's', 'closed', daysAgo(2.5))], reflections: [], now });
		expect(ideas).toHaveLength(1);
		expect(ideas[0].text).toContain('or leave it for now');
		expect(ideas[0].text).not.toMatch(/overdue|behind|should|must/i);
		expect(loopIdeas({ loops: [shower], events: [event('c', 's', 'closed', daysAgo(1))], reflections: [], now })).toEqual([]);
	});

	it('offers a small contact or letting go for something that keeps coming to mind untouched', () => {
		const events = ['n1', 'n2', 'n3'].map((id, index) => event(id, 'mom', 'noticed', daysAgo(index + 1)));
		const [idea] = loopIdeas({ loops: [loop('mom', 'Reply to Mom')], events, reflections: [], now });
		expect(idea.text).toContain('three times');
		expect(idea.text).toContain('Letting it go is also a resolution');
		const touched = [...events, event('a', 'mom', 'approached', daysAgo(2))];
		expect(loopIdeas({ loops: [loop('mom', 'Reply to Mom')], events: touched, reflections: [], now })).toEqual([]);
	});

	it('reflects the momentum pattern only when the person reported it, and includes rest', () => {
		const loops = [loop('room', 'Clean room'), loop('call', 'Call the bank')];
		const events = [event('a', 'room', 'approached', daysAgo(1))];
		const reflections = [reflection('r1', 'something'), reflection('r2', 'something'), reflection('r3', 'rest')];
		const [idea] = loopIdeas({ loops, events, reflections, now });
		expect(idea.text).toContain('two of three closures');
		expect(idea.text).toContain('“Clean room”');
		expect(idea.text).not.toContain('Call the bank');
		expect(idea.text).toContain('Rest is another');
		expect(loopIdeas({ loops, events, reflections: [reflection('r1', 'something'), reflection('r2', 'nothing'), reflection('r3', 'rest')], now })).toEqual([]);
	});

	it('lets a long pause stay a pause, notes many open loops, and stays within three', () => {
		const paused = loop('p', 'Woodles feature', { status: 'paused' });
		const many = Array.from({ length: 8 }, (_, index) => loop(`l${index}`, `Loop ${index}`));
		const ideas = loopIdeas({ loops: [paused, ...many], events: [event('pause', 'p', 'paused', daysAgo(20))], reflections: [], now });
		expect(ideas.map(idea => idea.key)).toEqual(['idea:paused:pause', 'idea:many:9']);
		expect(ideas[0].text).toContain('It can stay paused');
		expect(loopIdeas({ loops: [paused, ...many], events: [event('pause', 'p', 'paused', daysAgo(20))], reflections: [], now, dismissed: ['idea:paused:pause'] }).map(idea => idea.key)).toEqual(['idea:many:9']);
	});
});
