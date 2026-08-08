// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import { Arrival, ARRIVAL_PARAM, thinkingAboutEntryHref } from './arrival.svelte';
import { PlannerStore } from './store.svelte';

describe('Arrival.parse', () => {
	it('reads the reference Thinking About handed over', () => {
		expect(Arrival.parse('/planner?thinking-about-entry=e1')).toBe('e1');
	});

	it('decodes an id that needed encoding', () => {
		expect(Arrival.parse('/planner?thinking-about-entry=a%20b%26c')).toBe('a b&c');
	});

	it('reads nothing from an ordinary visit', () => {
		expect(Arrival.parse('/planner')).toBeNull();
		expect(Arrival.parse('/planner?compose=1')).toBeNull();
	});

	it('treats a blank id as no arrival', () => {
		expect(Arrival.parse('/planner?thinking-about-entry=')).toBeNull();
		expect(Arrival.parse('/planner?thinking-about-entry=%20')).toBeNull();
	});

	it('survives a malformed URL rather than throwing on load', () => {
		expect(Arrival.parse('%%%not a url')).toBeNull();
	});
});

describe('clearing the address bar', () => {
	it('drops the reference but keeps everything else in the URL', () => {
		history.replaceState(null, '', `/planner?${ARRIVAL_PARAM}=e1&keep=yes#today`);
		Arrival.clearFromAddressBar();

		expect(location.search).toBe('?keep=yes');
		expect(location.hash).toBe('#today');
	});

	it('leaves an ordinary URL alone', () => {
		history.replaceState(null, '', '/planner?keep=yes');
		Arrival.clearFromAddressBar();
		expect(location.search).toBe('?keep=yes');
	});
});

describe('thinkingAboutEntryHref', () => {
	it('resolves through the manifest rather than a hardcoded path', () => {
		expect(thinkingAboutEntryHref('e1')).toBe('/thinking-about?entry=e1');
	});
});

describe('what is already scheduled', () => {
	let store: PlannerStore;

	beforeEach(() => {
		localStorage.clear();
		store = new PlannerStore();
	});

	it('finds every task about one entry, and nothing about another', () => {
		store.addTask({ title: 'read a chapter', thinkingAboutEntryId: 'piranesi' });
		store.addTask({ title: 'read another', thinkingAboutEntryId: 'piranesi' });
		store.addTask({ title: 'unrelated errand' });
		store.addTask({ title: 'other book', thinkingAboutEntryId: 'solaris' });

		expect(store.getTasksForThinkingAboutEntry('piranesi').map((t) => t.title)).toEqual([
			'read a chapter',
			'read another'
		]);
	});

	it('keeps a finished one — "you already did this on Tuesday" is the answer', () => {
		const done = store.addTask({ title: 'read a chapter', thinkingAboutEntryId: 'piranesi' });
		store.completeTask(done.id);

		const found = store.getTasksForThinkingAboutEntry('piranesi');
		expect(found).toHaveLength(1);
		expect(found[0].status).toBe('done');
	});

	it('drops a dropped one — that is what dropping meant', () => {
		const dropped = store.addTask({ title: 'read a chapter', thinkingAboutEntryId: 'piranesi' });
		store.dropTask(dropped.id);

		expect(store.getTasksForThinkingAboutEntry('piranesi')).toEqual([]);
	});

	it('puts the soonest first and the unscheduled last', () => {
		store.addTask({ title: 'someday', thinkingAboutEntryId: 'p' });
		store.addTask({ title: 'thursday', thinkingAboutEntryId: 'p', targetDate: '2026-08-13' });
		store.addTask({ title: 'tomorrow', thinkingAboutEntryId: 'p', targetDate: '2026-08-10' });

		expect(store.getTasksForThinkingAboutEntry('p').map((t) => t.title)).toEqual([
			'tomorrow',
			'thursday',
			'someday'
		]);
	});

	it('has nothing to show for an entry never scheduled', () => {
		expect(store.getTasksForThinkingAboutEntry('never-seen')).toEqual([]);
	});
});
