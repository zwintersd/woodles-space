import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHandoffQueue, sendHandoff } from '@woodles/handoff';
import { NotebookStore } from './notebook.svelte';
import type { Note } from './types';

const FIXED_NOW = new Date('2026-07-21T16:00:00.000Z');
const WORKSPACE_KEY = 'notebook.workspace.v2';

function savedDocument() {
	return JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? '{}').data;
}

beforeEach(() => {
	localStorage.clear();
	vi.useFakeTimers();
	vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('NotebookStore notes', () => {
	it('starts with a selected Home note', () => {
		const store = new NotebookStore();

		expect(store.notes).toHaveLength(1);
		expect(store.selectedNote?.title).toBe('Home');
		expect(store.selectedNote?.tags).toEqual(['inbox']);
	});

	it('adds, selects, and persists a note', () => {
		const store = new NotebookStore();
		store.setMode('tasks');

		const note = store.addNote();

		expect(store.mode).toBe('notes');
		expect(store.selectedNoteId).toBe(note.id);
		expect(savedDocument().notes).toHaveLength(2);
		expect(savedDocument().selectedNoteId).toBe(note.id);
	});

	it('updates note content, tags, timestamp, and persisted state', () => {
		const store = new NotebookStore();
		const note = store.selectedNote!;

		store.updateNote(note.id, { title: 'Reading', body: 'A useful line', tags: ['books'] });

		expect(store.selectedNote).toMatchObject({
			title: 'Reading',
			body: 'A useful line',
			tags: ['books'],
			updatedAt: FIXED_NOW.toISOString()
		});
		expect(savedDocument().notes[0].title).toBe('Reading');
	});

	it('searches title, body, and tags without case sensitivity', () => {
		const store = new NotebookStore();
		store.notes = [
			note('one', 'Garden', 'Moss and rain', ['world'], '2026-07-20T00:00:00.000Z'),
			note('two', 'Reading', 'A ROSE in the margin', ['books'], '2026-07-21T00:00:00.000Z')
		];

		store.query = 'rose';
		expect(store.filteredNotes.map((item) => item.id)).toEqual(['two']);
		store.query = 'WORLD';
		expect(store.filteredNotes.map((item) => item.id)).toEqual(['one']);
	});

	it('sorts unfiltered notes by most recently updated', () => {
		const store = new NotebookStore();
		store.notes = [
			note('old', 'Old', '', [], '2026-07-19T00:00:00.000Z'),
			note('new', 'New', '', [], '2026-07-21T00:00:00.000Z')
		];

		expect(store.filteredNotes.map((item) => item.id)).toEqual(['new', 'old']);
	});

	it('will not delete the last note and selects a survivor after deletion', () => {
		const store = new NotebookStore();
		const firstId = store.selectedNoteId!;
		store.deleteNote(firstId);
		expect(store.notes).toHaveLength(1);

		const second = store.addNote();
		store.deleteNote(second.id);
		expect(store.notes.map((item) => item.id)).toEqual([firstId]);
		expect(store.selectedNoteId).toBe(firstId);
	});

	it('rehydrates saved state and restores a last-known-good backup from corrupt JSON', () => {
		const first = new NotebookStore();
		const added = first.addNote();
		first.updateNote(added.id, { title: 'Kept' });

		const restored = new NotebookStore();
		expect(restored.selectedNote?.title).toBe('Kept');

		localStorage.setItem(WORKSPACE_KEY, '{broken');
		const recovered = new NotebookStore();
		expect(recovered.notes).toHaveLength(2);
		expect(recovered.persistenceHealth.status).toBe('recovered');
		expect(recovered.persistenceHealth.message).toContain('last-known-good');
	});

	it('migrates the four legacy keys into one versioned workspace', () => {
		localStorage.setItem('notebook.selectedNote.v1', JSON.stringify('legacy'));
		localStorage.setItem(
			'notebook.notes.v1',
			JSON.stringify([note('legacy', 'Legacy note', 'kept', ['old'], FIXED_NOW.toISOString())])
		);
		localStorage.setItem('notebook.tasks.v1', '[]');
		localStorage.setItem('notebook.ideas.v1', '[]');

		const migrated = new NotebookStore();
		expect(migrated.selectedNote?.title).toBe('Legacy note');
		expect(savedDocument().notes[0].id).toBe('legacy');
		expect(localStorage.getItem('notebook.notes.v1')).toBeNull();
	});

	it('round-trips an export and rejects malformed imports', () => {
		const source = new NotebookStore();
		source.updateNote(source.selectedNoteId!, { title: 'Portable' });
		const exported = source.exportJSON();

		localStorage.clear();
		const target = new NotebookStore();
		expect(target.importJSON(exported)).toMatchObject({ ok: true });
		expect(target.selectedNote?.title).toBe('Portable');

		expect(target.importJSON(JSON.stringify({ notes: 'bad' }))).toMatchObject({ ok: false });
		expect(target.selectedNote?.title).toBe('Portable');
	});

	it('surfaces quota failures instead of pretending a change was saved', () => {
		const setItem = vi
			.spyOn(localStorage, 'setItem')
			.mockImplementation(() => {
				throw new DOMException('full', 'QuotaExceededError');
			});
		const store = new NotebookStore();

		store.addTask('Visible failure');

		expect(store.persistenceHealth).toMatchObject({
			status: 'error',
			message: expect.stringContaining('storage is full')
		});
		setItem.mockRestore();
	});
});

describe('NotebookStore tasks', () => {
	it('ignores blank tasks and links new tasks to the selected note', () => {
		const store = new NotebookStore();
		store.addTask('   ');
		expect(store.tasks).toEqual([]);

		store.addTask('  Ship review  ', 'high');
		expect(store.tasks[0]).toMatchObject({
			title: 'Ship review',
			priority: 'high',
			noteId: store.selectedNoteId,
			status: 'open'
		});
	});

	it('orders open tasks by priority and separates completed work', () => {
		const store = new NotebookStore();
		store.addTask('Low', 'low');
		store.addTask('High', 'high');
		store.addTask('Normal', 'normal');

		expect(store.openTasks.map((task) => task.title)).toEqual(['High', 'Normal', 'Low']);
		const normal = store.tasks.find((task) => task.title === 'Normal')!;
		store.toggleTask(normal.id);
		expect(store.doneTasks.map((task) => task.title)).toEqual(['Normal']);
		expect(store.doneTasks[0].completedAt).toBe(FIXED_NOW.toISOString());
	});

	it('reopens and deletes tasks while persisting each change', () => {
		const store = new NotebookStore();
		store.addTask('Keep me');
		const id = store.tasks[0].id;
		store.toggleTask(id);
		store.toggleTask(id);
		expect(store.tasks[0].completedAt).toBeUndefined();

		store.deleteTask(id);
		expect(store.tasks).toEqual([]);
		expect(savedDocument().tasks).toEqual([]);
	});
});

describe('NotebookStore ideas', () => {
	it('ignores blank ideas and persists lane movement and deletion', () => {
		const store = new NotebookStore();
		store.addIdea('   ');
		expect(store.ideas).toEqual([]);

		store.addIdea('  Paper garden  ');
		const id = store.ideas[0].id;
		expect(store.ideas[0]).toMatchObject({ text: 'Paper garden', lane: 'spark' });

		store.moveIdea(id, 'shape');
		expect(store.ideas[0].lane).toBe('shape');
		expect(savedDocument().ideas[0].lane).toBe('shape');

		store.deleteIdea(id);
		expect(store.ideas).toEqual([]);
	});
});

describe('NotebookStore handoffs', () => {
	it('turns everything waiting into notes and selects the newest', () => {
		sendHandoff('notebook', {
			title: 'from spores',
			body: 'a body',
			tags: ['garden'],
			source: { app: 'spores' }
		});
		sendHandoff('notebook', { title: 'second', source: { app: 'write' } });

		const store = new NotebookStore();
		expect(store.ingestHandoffs()).toBe(2);

		expect(store.mode).toBe('notes');
		expect(store.notes.slice(0, 2).map((item) => item.title)).toEqual(['from spores', 'second']);
		expect(store.selectedNote?.title).toBe('from spores');
		expect(savedDocument().notes).toHaveLength(3);
	});

	it('tags each arrival with where it came from, without duplicating tags', () => {
		sendHandoff('notebook', {
			title: 'tagged',
			tags: ['garden', 'from:spores'],
			source: { app: 'spores' }
		});

		const store = new NotebookStore();
		store.ingestHandoffs();

		expect(store.notes[0].tags).toEqual(['garden', 'from:spores']);
	});

	it('empties the inbox, so re-opening does not re-add the same notes', () => {
		sendHandoff('notebook', { title: 'once', source: { app: 'write' } });

		const store = new NotebookStore();
		expect(store.ingestHandoffs()).toBe(1);
		expect(store.pendingHandoffs()).toBe(0);
		expect(store.ingestHandoffs()).toBe(0);
		expect(store.notes.filter((item) => item.title === 'once')).toHaveLength(1);
	});

	it('flattens an html body into something the plain textarea can edit', () => {
		sendHandoff('notebook', {
			title: '',
			body: '<p>first line</p><p>second <em>line</em></p>',
			format: 'html',
			source: { app: 'write' }
		});

		const store = new NotebookStore();
		store.ingestHandoffs();

		expect(store.notes[0].body).toBe('first line\n\nsecond line');
		// No title supplied, so the opening line becomes one.
		expect(store.notes[0].title).toBe('first line');
	});

	it('accepts a wholly empty capture rather than dropping it', () => {
		sendHandoff('notebook', { source: { app: 'spores' } });

		const store = new NotebookStore();
		expect(store.ingestHandoffs()).toBe(1);
		expect(store.notes[0].title).toBe('Untitled');
	});

	it('hands a note on to another app with its tags and provenance', () => {
		const store = new NotebookStore();
		const created = store.addNote();
		store.updateNote(created.id, { title: 'worth keeping', body: 'words', tags: ['seed'] });

		const result = store.promoteNote(created.id, 'spores');
		expect(result?.ok).toBe(true);

		const waiting = createHandoffQueue('spores').peek();
		expect(waiting).toHaveLength(1);
		expect(waiting[0]).toMatchObject({
			title: 'worth keeping',
			body: 'words',
			tags: ['seed'],
			source: { app: 'notebook', label: 'worth keeping' }
		});
	});

	it('hands an idea on, carrying its lane as a tag', () => {
		const store = new NotebookStore();
		store.addIdea('a small thought', 'shape');

		const result = store.promoteIdea(store.ideas[0].id, 'write');
		expect(result?.ok).toBe(true);

		const waiting = createHandoffQueue('write').peek();
		expect(waiting[0]).toMatchObject({ body: 'a small thought', tags: ['shape'] });
	});

	it('reports nothing to promote for an id that is gone', () => {
		const store = new NotebookStore();
		expect(store.promoteNote('missing', 'spores')).toBeNull();
		expect(store.promoteIdea('missing', 'spores')).toBeNull();
	});
});

function note(
	id: string,
	title: string,
	body: string,
	tags: string[],
	updatedAt: string
): Note {
	return {
		id,
		title,
		body,
		tags,
		createdAt: updatedAt,
		updatedAt
	};
}
