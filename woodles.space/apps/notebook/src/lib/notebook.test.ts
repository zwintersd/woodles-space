import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHandoffQueue, sendHandoff } from '@woodles/handoff';
import { NotebookStore, toCaptures } from './notebook.svelte';

const FIXED_NOW = new Date('2026-07-21T16:00:00.000Z');
const WORKSPACE_KEY = 'notebook.workspace.v3';
const V2_KEY = 'notebook.workspace.v2';

function savedDocument() {
	return JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? '{}').data;
}

function v2(notes: unknown[], ideas: unknown[], tasks: unknown[] = []) {
	return JSON.stringify({
		woodles: 'workspace',
		schemaVersion: 2,
		savedAt: '2026-01-01T00:00:00.000Z',
		data: { selectedNoteId: null, notes, tasks, ideas }
	});
}

beforeEach(() => {
	localStorage.clear();
	vi.useFakeTimers();
	vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('capturing', () => {
	it('starts with one capture so the page is never empty', () => {
		const store = new NotebookStore();
		expect(store.captures).toHaveLength(1);
		expect(store.selected?.title).toBe('Home');
	});

	it('accepts a capture with nothing in it — the front door never asks first', () => {
		const store = new NotebookStore();
		const capture = store.add();

		expect(capture.title).toBe('');
		expect(capture.body).toBe('');
		expect(capture.lane).toBe('spark');
		expect(store.selectedId).toBe(capture.id);
		expect(savedDocument().captures).toHaveLength(2);
	});

	it('puts the newest first, so what you just wrote is where you look', () => {
		const store = new NotebookStore();
		store.add({ title: 'first' });
		store.add({ title: 'second' });

		expect(store.captures.slice(0, 2).map((c) => c.title)).toEqual(['second', 'first']);
	});

	it('updates and persists', () => {
		const store = new NotebookStore();
		const capture = store.add();
		store.update(capture.id, { title: 'named later', tags: ['x'] });

		expect(savedDocument().captures[0]).toMatchObject({ title: 'named later', tags: ['x'] });
	});

	it('refuses to delete the last one, so there is always somewhere to type', () => {
		const store = new NotebookStore();
		store.remove(store.captures[0].id);
		expect(store.captures).toHaveLength(1);
	});

	it('selects a neighbour when the selected one is deleted', () => {
		const store = new NotebookStore();
		const capture = store.add({ title: 'doomed' });
		store.remove(capture.id);

		expect(store.selectedId).toBe(store.captures[0].id);
		expect(store.captures.some((c) => c.title === 'doomed')).toBe(false);
	});
});

describe('lanes are triage, not status', () => {
	it('moves a capture between lanes', () => {
		const store = new NotebookStore();
		const capture = store.add();
		store.move(capture.id, 'later');

		expect(store.captures[0].lane).toBe('later');
		expect(savedDocument().captures[0].lane).toBe('later');
	});

	it('filters to one lane and counts each', () => {
		const store = new NotebookStore();
		store.add({ title: 'a', lane: 'later' });
		store.add({ title: 'b', lane: 'later' });

		store.setLaneFilter('later');
		expect(store.filtered.map((c) => c.title)).toEqual(['b', 'a']);
		expect(store.laneCount('later')).toBe(2);
	});

	it('shows everything by default, because filtering is a choice', () => {
		const store = new NotebookStore();
		store.add({ title: 'a', lane: 'later' });

		expect(store.laneFilter).toBeNull();
		expect(store.filtered).toHaveLength(2);
	});

	it('clears the filter when the same lane is picked again', () => {
		const store = new NotebookStore();
		store.setLaneFilter('shape');
		store.setLaneFilter('shape');
		expect(store.laneFilter).toBeNull();
	});
});

describe('searching', () => {
	it('matches title, body, and tags at once', () => {
		const store = new NotebookStore();
		store.add({ title: 'moss', body: 'green' });
		store.add({ title: 'fern', tags: ['damp'] });

		store.query = 'green';
		expect(store.filtered.map((c) => c.title)).toEqual(['moss']);
		store.query = 'damp';
		expect(store.filtered.map((c) => c.title)).toEqual(['fern']);
	});

	it('combines with the lane filter rather than replacing it', () => {
		const store = new NotebookStore();
		store.add({ title: 'moss', lane: 'later' });
		store.add({ title: 'moss', lane: 'spark' });

		store.query = 'moss';
		store.setLaneFilter('later');
		expect(store.filtered).toHaveLength(1);
	});
});

describe('carrying the old notebook forward', () => {
	it('turns notes and ideas into captures, and reads past tasks', () => {
		const captures = toCaptures(
			[{ id: 'n1', title: 'a note', body: 'words', tags: ['t'], createdAt: 'x', updatedAt: '2026-01-02' }],
			[{ id: 'i1', text: 'an idea', lane: 'later', createdAt: '2026-01-01' }]
		);

		expect(captures.map((c) => c.title)).toEqual(['a note', '']);
		expect(captures[0].lane).toBe('shape');
		expect(captures[1]).toMatchObject({ body: 'an idea', lane: 'later' });
	});

	it('leaves an idea untitled rather than inventing one from its own body', () => {
		const [capture] = toCaptures([], [{ id: 'i1', text: 'a small thought', lane: 'spark' }]);
		expect(capture.title).toBe('');
		expect(capture.body).toBe('a small thought');
	});

	it('defaults an unknown lane instead of dropping the idea', () => {
		const [capture] = toCaptures([], [{ id: 'i1', text: 'x', lane: 'nonsense' }]);
		expect(capture.lane).toBe('spark');
	});

	it('upgrades a stored v2 notebook on first load', () => {
		localStorage.setItem(
			V2_KEY,
			v2(
				[{ id: 'n1', title: 'kept', body: '', tags: [], createdAt: 'x', updatedAt: 'x' }],
				[{ id: 'i1', text: 'also kept', lane: 'spark', createdAt: 'x' }],
				[{ id: 't1', title: 'a task', status: 'open', priority: 'high', createdAt: 'x' }]
			)
		);

		const store = new NotebookStore();
		expect(store.captures.map((c) => c.title)).toEqual(['kept', '']);
		expect(store.captures.some((c) => c.body === 'a task')).toBe(false);
	});

	it('leaves v2 in place, because carillon still needs the tasks', () => {
		// The two migrations are order-independent by design — notebook must not
		// read the tasks out from under Carillon.
		const raw = v2([], [], [{ id: 't1', title: 'a task', status: 'open', createdAt: 'x' }]);
		localStorage.setItem(V2_KEY, raw);

		new NotebookStore();
		expect(localStorage.getItem(V2_KEY)).toBe(raw);
	});

	it('keeps the starter capture when v2 held only tasks', () => {
		localStorage.setItem(V2_KEY, v2([], [], [{ id: 't1', title: 'a task', status: 'open' }]));

		const store = new NotebookStore();
		expect(store.captures).toHaveLength(1);
		expect(store.selected?.title).toBe('Home');
	});

	it('reports rather than swallows unreadable earlier data', () => {
		localStorage.setItem(V2_KEY, '{ not json');
		expect(new NotebookStore().persistenceHealth.status).toBe('error');
	});
});

describe('handoffs', () => {
	it('turns everything waiting into captures and selects the newest', () => {
		sendHandoff('notebook', { title: 'from spores', body: 'a body', source: { app: 'spores' } });
		sendHandoff('notebook', { title: 'second', source: { app: 'write' } });

		const store = new NotebookStore();
		expect(store.ingestHandoffs()).toBe(2);
		expect(store.captures.slice(0, 2).map((c) => c.title)).toEqual(['from spores', 'second']);
		expect(store.selected?.title).toBe('from spores');
	});

	it('tags each arrival with where it came from', () => {
		sendHandoff('notebook', { title: 'x', tags: ['garden'], source: { app: 'spores' } });

		const store = new NotebookStore();
		store.ingestHandoffs();
		expect(store.captures[0].tags).toEqual(['garden', 'from:spores']);
	});

	it('lands arrivals in sparks — they have not been triaged yet', () => {
		sendHandoff('notebook', { title: 'x', source: { app: 'write' } });

		const store = new NotebookStore();
		store.ingestHandoffs();
		expect(store.captures[0].lane).toBe('spark');
	});

	it('empties the inbox, so re-opening does not re-add', () => {
		sendHandoff('notebook', { title: 'once', source: { app: 'write' } });

		const store = new NotebookStore();
		expect(store.ingestHandoffs()).toBe(1);
		expect(store.pendingHandoffs()).toBe(0);
		expect(store.ingestHandoffs()).toBe(0);
	});

	it('flattens an html body into something the textarea can edit', () => {
		sendHandoff('notebook', {
			body: '<p>first line</p><p>second <em>line</em></p>',
			format: 'html',
			source: { app: 'write' }
		});

		const store = new NotebookStore();
		store.ingestHandoffs();
		expect(store.captures[0].body).toBe('first line\n\nsecond line');
		expect(store.captures[0].title).toBe('first line');
	});

	it('hands a capture on with its tags and provenance', () => {
		const store = new NotebookStore();
		const capture = store.add({ title: 'worth keeping', body: 'words', tags: ['seed'] });

		expect(store.promote(capture.id, 'spores')?.ok).toBe(true);
		expect(createHandoffQueue('spores').peek()[0]).toMatchObject({
			title: 'worth keeping',
			body: 'words',
			tags: ['seed'],
			source: { app: 'notebook' }
		});
	});

	it('reports nothing to promote for an id that is gone', () => {
		expect(new NotebookStore().promote('missing', 'spores')).toBeNull();
	});
});

describe('export and import', () => {
	it('round-trips the captures', () => {
		const store = new NotebookStore();
		store.add({ title: 'kept', lane: 'later' });
		const text = store.exportJSON();

		localStorage.clear();
		const fresh = new NotebookStore();
		expect(fresh.importJSON(text).ok).toBe(true);
		expect(fresh.captures.map((c) => c.title)).toContain('kept');
	});

	it('refuses nonsense without losing what is already there', () => {
		const store = new NotebookStore();
		store.add({ title: 'mine' });

		expect(store.importJSON('not json').ok).toBe(false);
		expect(store.captures.some((c) => c.title === 'mine')).toBe(true);
	});
});
