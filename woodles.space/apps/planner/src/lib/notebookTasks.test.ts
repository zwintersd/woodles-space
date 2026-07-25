// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { PlannerStore } from './store.svelte';
import {
	NOTEBOOK_V2_KEY,
	fromNotebook,
	importNotebookTasks,
	importNotebookTasksOnce,
	noteFor,
	readNotebookTasks
} from './notebookTasks';

// Planner keeps its own localStorage mock rather than loading the workspace
// setup file — see apps/planner/KNOWN_ISSUES.md and store.test.ts, which does
// the same. Matching that here rather than changing planner's global config.
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
		get length() {
			return Object.keys(store).length;
		}
	};
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

beforeEach(() => {
	localStorage.clear();
});

const TASKS = [
	{ id: 't1', title: 'water the plants', status: 'open', priority: 'high', createdAt: '2026-01-01' },
	{ id: 't2', title: 'answer the letter', status: 'done', priority: 'normal', createdAt: '2026-01-02' },
	{ id: 't3', title: 'find the book', status: 'open', priority: 'low', noteId: 'n1', createdAt: '2026-01-03' }
];

/** How @woodles/persistence actually stores it. */
function envelope(tasks: unknown[]) {
	return JSON.stringify({
		woodles: 'workspace',
		schemaVersion: 2,
		savedAt: '2026-01-01T00:00:00.000Z',
		data: { selectedNoteId: 'n1', notes: [], tasks, ideas: [] }
	});
}

describe('reading notebook', () => {
	it('finds tasks inside the persistence envelope', () => {
		expect(readNotebookTasks(envelope(TASKS))).toHaveLength(3);
	});

	it('also accepts a bare document, in case the envelope is ever dropped', () => {
		expect(readNotebookTasks(JSON.stringify({ tasks: TASKS }))).toHaveLength(3);
	});

	it('returns nothing for absent, unparseable, or task-free data', () => {
		expect(readNotebookTasks(null)).toEqual([]);
		expect(readNotebookTasks('not json')).toEqual([]);
		expect(readNotebookTasks(envelope([]))).toEqual([]);
		expect(readNotebookTasks(JSON.stringify({ notes: [] }))).toEqual([]);
	});
});

describe('what carries across', () => {
	it('records an off-normal priority in the notes, since carillon has none', () => {
		expect(noteFor({ priority: 'high' })).toBe('from notebook · priority: high');
		expect(noteFor({ priority: 'low' })).toBe('from notebook · priority: low');
	});

	it('says nothing extra for a normal priority', () => {
		expect(noteFor({ priority: 'normal' })).toBe('from notebook');
		expect(noteFor({})).toBe('from notebook');
	});

	it('remembers that a task had been attached to a note', () => {
		expect(noteFor({ noteId: 'n1' })).toContain('was attached to a note');
	});
});

describe('taking the tasks over', () => {
	it('brings every task across, keeping open and done apart', () => {
		const planner = new PlannerStore();
		const summary = importNotebookTasks(planner, TASKS);

		expect(summary).toEqual({ open: 2, done: 1 });
		expect(planner.tasks.map((t) => t.title)).toEqual([
			'water the plants',
			'answer the letter',
			'find the book'
		]);
		expect(planner.tasks.find((t) => t.title === 'answer the letter')?.status).toBe('done');
	});

	it('never maps anything to dropped — notebook had no such state', () => {
		const planner = new PlannerStore();
		importNotebookTasks(planner, TASKS);
		expect(planner.tasks.some((t) => t.status === 'dropped')).toBe(false);
	});

	it('skips a task with no title rather than creating an empty one', () => {
		const planner = new PlannerStore();
		const summary = importNotebookTasks(planner, [{ title: '  ', status: 'open' }, { status: 'open' }]);

		expect(summary).toEqual({ open: 0, done: 0 });
		expect(planner.tasks).toEqual([]);
	});

	it('marks each one so it can be told apart later', () => {
		const planner = new PlannerStore();
		importNotebookTasks(planner, TASKS);

		expect(fromNotebook(planner.tasks)).toHaveLength(3);
		planner.addTask({ title: 'a carillon task of my own' });
		expect(fromNotebook(planner.tasks)).toHaveLength(3);
	});

	it('persists them, so they survive a reload', () => {
		const planner = new PlannerStore();
		importNotebookTasks(planner, TASKS);

		expect(new PlannerStore().tasks.map((t) => t.title)).toContain('water the plants');
	});
});

describe('running it once', () => {
	it('imports from localStorage and marks itself done', () => {
		localStorage.setItem(NOTEBOOK_V2_KEY, envelope(TASKS));
		const planner = new PlannerStore();

		expect(importNotebookTasksOnce(planner)).toEqual({ open: 2, done: 1 });
		expect(planner.settings.notebookTasksImported).toBe(true);
	});

	it('never runs twice, so carillon cannot silently double', () => {
		localStorage.setItem(NOTEBOOK_V2_KEY, envelope(TASKS));

		const first = new PlannerStore();
		importNotebookTasksOnce(first);
		const count = first.tasks.length;

		const second = new PlannerStore();
		expect(importNotebookTasksOnce(second)).toBeNull();
		expect(second.tasks).toHaveLength(count);
	});

	it('does nothing when notebook had no tasks to hand over', () => {
		const planner = new PlannerStore();
		expect(importNotebookTasksOnce(planner)).toBeNull();
		expect(planner.settings.notebookTasksImported).toBeUndefined();
	});

	it('reads notebook v2, which notebook leaves behind on purpose', () => {
		// The two migrations are order-independent: notebook writes v3 without
		// touching v2, so whichever app opens first, nothing is stranded.
		localStorage.setItem(NOTEBOOK_V2_KEY, envelope(TASKS));
		localStorage.setItem('notebook.workspace.v3', JSON.stringify({ data: { captures: [] } }));

		expect(importNotebookTasksOnce(new PlannerStore())?.open).toBe(2);
	});
});
