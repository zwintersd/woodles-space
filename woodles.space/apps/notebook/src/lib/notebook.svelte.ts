import type { Idea, Note, NotebookMode, NotebookTask } from './types';

function uid(): string {
	return Math.random().toString(36).slice(2, 10);
}

function nowIso(): string {
	return new Date().toISOString();
}

function load<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function save<T>(key: string, value: T): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Local-first: ignore disabled storage or quota errors.
	}
}

const STARTER_NOTE_ID = 'note-home';

const STARTER_NOTES: Note[] = [
	{
		id: STARTER_NOTE_ID,
		title: 'Home',
		body: '',
		tags: ['inbox'],
		createdAt: nowIso(),
		updatedAt: nowIso()
	}
];

export class NotebookStore {
	mode = $state<NotebookMode>('notes');
	query = $state('');
	selectedNoteId = $state<string | null>(load('notebook.selectedNote.v1', STARTER_NOTE_ID));
	notes = $state<Note[]>(load('notebook.notes.v1', STARTER_NOTES));
	tasks = $state<NotebookTask[]>(load('notebook.tasks.v1', []));
	ideas = $state<Idea[]>(load('notebook.ideas.v1', []));

	get selectedNote(): Note | null {
		return this.notes.find((note) => note.id === this.selectedNoteId) ?? this.notes[0] ?? null;
	}

	get filteredNotes(): Note[] {
		const q = this.query.trim().toLowerCase();
		const notes = [...this.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
		if (!q) return notes;
		return notes.filter((note) =>
			[note.title, note.body, note.tags.join(' ')].join(' ').toLowerCase().includes(q)
		);
	}

	get openTasks(): NotebookTask[] {
		return this.tasks
			.filter((task) => task.status === 'open')
			.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
	}

	get doneTasks(): NotebookTask[] {
		return this.tasks.filter((task) => task.status === 'done');
	}

	setMode(mode: NotebookMode): void {
		this.mode = mode;
	}

	selectNote(id: string): void {
		this.selectedNoteId = id;
		save('notebook.selectedNote.v1', id);
	}

	addNote(): Note {
		const stamp = nowIso();
		const note: Note = {
			id: uid(),
			title: 'Untitled',
			body: '',
			tags: [],
			createdAt: stamp,
			updatedAt: stamp
		};
		this.notes = [note, ...this.notes];
		this.persistNotes();
		this.selectNote(note.id);
		this.mode = 'notes';
		return note;
	}

	updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'tags'>>): void {
		const stamp = nowIso();
		this.notes = this.notes.map((note) =>
			note.id === id ? { ...note, ...patch, updatedAt: stamp } : note
		);
		this.persistNotes();
	}

	deleteNote(id: string): void {
		if (this.notes.length <= 1) return;
		this.notes = this.notes.filter((note) => note.id !== id);
		this.persistNotes();
		if (this.selectedNoteId === id) {
			this.selectNote(this.notes[0]?.id ?? '');
		}
	}

	addTask(title: string, priority: NotebookTask['priority'] = 'normal'): void {
		const trimmed = title.trim();
		if (!trimmed) return;
		this.tasks = [
			{
				id: uid(),
				title: trimmed,
				status: 'open',
				priority,
				noteId: this.selectedNoteId ?? undefined,
				createdAt: nowIso()
			},
			...this.tasks
		];
		this.persistTasks();
	}

	toggleTask(id: string): void {
		const stamp = nowIso();
		this.tasks = this.tasks.map((task) =>
			task.id === id
				? {
						...task,
						status: task.status === 'open' ? 'done' : 'open',
						completedAt: task.status === 'open' ? stamp : undefined
					}
				: task
		);
		this.persistTasks();
	}

	deleteTask(id: string): void {
		this.tasks = this.tasks.filter((task) => task.id !== id);
		this.persistTasks();
	}

	addIdea(text: string, lane: Idea['lane'] = 'spark'): void {
		const trimmed = text.trim();
		if (!trimmed) return;
		this.ideas = [{ id: uid(), text: trimmed, lane, createdAt: nowIso() }, ...this.ideas];
		this.persistIdeas();
	}

	moveIdea(id: string, lane: Idea['lane']): void {
		this.ideas = this.ideas.map((idea) => (idea.id === id ? { ...idea, lane } : idea));
		this.persistIdeas();
	}

	deleteIdea(id: string): void {
		this.ideas = this.ideas.filter((idea) => idea.id !== id);
		this.persistIdeas();
	}

	private persistNotes(): void {
		save('notebook.notes.v1', this.notes);
	}

	private persistTasks(): void {
		save('notebook.tasks.v1', this.tasks);
	}

	private persistIdeas(): void {
		save('notebook.ideas.v1', this.ideas);
	}
}

function priorityRank(priority: NotebookTask['priority']): number {
	if (priority === 'high') return 2;
	if (priority === 'normal') return 1;
	return 0;
}

export const notebook = new NotebookStore();
