import type { Idea, Note, NotebookMode, NotebookTask } from './types';
import { createVersionedStorage, type PersistenceIssue } from '@woodles/persistence';
import {
	createHandoffQueue,
	type Handoff,
	type HandoffTarget,
	type SendResult
} from '@woodles/handoff';

function uid(): string {
	return Math.random().toString(36).slice(2, 10);
}

function nowIso(): string {
	return new Date().toISOString();
}

const STARTER_NOTE_ID = 'note-home';
const WORKSPACE_KEY = 'notebook.workspace.v2';
const LEGACY_KEYS = {
	selectedNoteId: 'notebook.selectedNote.v1',
	notes: 'notebook.notes.v1',
	tasks: 'notebook.tasks.v1',
	ideas: 'notebook.ideas.v1'
} as const;

type NotebookDocument = {
	selectedNoteId: string | null;
	notes: Note[];
	tasks: NotebookTask[];
	ideas: Idea[];
};

export type NotebookPersistenceHealth = {
	status: 'idle' | 'saved' | 'recovered' | 'error';
	message: string;
	bytes: number;
	savedAt: string | null;
};

function starterDocument(): NotebookDocument {
	const stamp = nowIso();
	return {
		selectedNoteId: STARTER_NOTE_ID,
		notes: [
			{
				id: STARTER_NOTE_ID,
				title: 'Home',
				body: '',
				tags: ['inbox'],
				createdAt: stamp,
				updatedAt: stamp
			}
		],
		tasks: [],
		ideas: []
	};
}

const persistence = createVersionedStorage<NotebookDocument>({
	key: WORKSPACE_KEY,
	version: 2,
	fallback: starterDocument,
	validate: isNotebookDocument,
	migrate: (value, fromVersion) => {
		if ((fromVersion === 0 || fromVersion === 1) && isNotebookDocument(value)) return value;
		return value;
	}
});

const handoffQueue = createHandoffQueue('notebook');

function htmlToText(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, '\n\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function firstLine(text: string): string {
	return text.split('\n').find((line) => line.trim())?.trim().slice(0, 60) ?? '';
}

function dedupeTags(tags: string[]): string[] {
	const seen = new Set<string>();
	return tags.filter((tag) => {
		const key = tag.toLowerCase();
		if (!tag || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export class NotebookStore {
	mode = $state<NotebookMode>('notes');
	query = $state('');
	selectedNoteId = $state<string | null>(STARTER_NOTE_ID);
	notes = $state<Note[]>([]);
	tasks = $state<NotebookTask[]>([]);
	ideas = $state<Idea[]>([]);
	persistenceHealth = $state<NotebookPersistenceHealth>({
		status: 'idle',
		message: 'stored on this device',
		bytes: 0,
		savedAt: null
	});
	/** Handoff ids already turned into notes, so a re-delivery is a no-op. */
	private ingestedHandoffIds = new Set<string>();

	constructor() {
		let result = persistence.load();
		if (result.source === 'fallback' && !result.issue) {
			const legacy = readLegacyDocument();
			if (legacy.issue) {
				result = { ...result, issue: legacy.issue };
			} else if (legacy.value) {
				const migrated = persistence.save(legacy.value);
				if (migrated.ok) {
					removeLegacyDocument();
					result = {
						value: legacy.value,
						source: 'primary',
						migrated: true,
						issue: null,
						savedAt: migrated.savedAt,
						bytes: migrated.bytes
					};
				}
			}
		}

		this.applyDocument(result.value);
		if (result.source === 'backup') {
			this.persistenceHealth = {
				status: 'recovered',
				message: 'restored the last-known-good notebook backup',
				bytes: result.bytes,
				savedAt: result.savedAt
			};
		} else if (result.issue) {
			this.setPersistenceError(result.issue);
		} else if (result.source === 'primary') {
			this.persistenceHealth = {
				status: 'saved',
				message: result.migrated ? 'notebook upgraded and saved' : 'saved on this device',
				bytes: result.bytes,
				savedAt: result.savedAt
			};
		}
	}

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
		this.persist();
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

	// ── handoffs ────────────────────────────────────────────────────
	// Notebook is the front door: anything any other app couldn't place ends
	// up here rather than forcing a filing decision at capture time.
	// See CONVERGENCE.md §3.

	/**
	 * Take everything waiting in the inbox and turn each into a note. Safe to
	 * call repeatedly — an id already ingested is skipped, so a queue that
	 * failed to clear re-delivers without duplicating.
	 */
	ingestHandoffs(): number {
		const drained = handoffQueue.drain();
		if (drained.items.length === 0) return 0;

		const fresh = drained.items.filter((item) => !this.ingestedHandoffIds.has(item.id));
		for (const item of fresh) this.ingestedHandoffIds.add(item.id);
		if (fresh.length === 0) return 0;

		const notes = fresh.map((item) => this.handoffToNote(item));
		this.notes = [...notes, ...this.notes];
		this.mode = 'notes';
		this.selectedNoteId = notes[0].id;
		this.persist();
		return notes.length;
	}

	/** How many are waiting, for a badge. Does not consume them. */
	pendingHandoffs(): number {
		return handoffQueue.count();
	}

	/** Hand a note on to an app that can do more with it than notebook can. */
	promoteNote(id: string, target: HandoffTarget): SendResult | null {
		const note = this.notes.find((item) => item.id === id);
		if (!note) return null;
		return createHandoffQueue(target).send({
			title: note.title,
			body: note.body,
			format: 'text',
			tags: note.tags,
			source: { app: 'notebook', label: note.title || 'a note', href: '/notebook' }
		});
	}

	/** Hand an idea on — the same gesture, for the shorter kind of thought. */
	promoteIdea(id: string, target: HandoffTarget): SendResult | null {
		const idea = this.ideas.find((item) => item.id === id);
		if (!idea) return null;
		return createHandoffQueue(target).send({
			title: idea.text.slice(0, 60),
			body: idea.text,
			format: 'text',
			tags: [idea.lane],
			source: { app: 'notebook', label: 'an idea', href: '/notebook' }
		});
	}

	private handoffToNote(item: Handoff): Note {
		const stamp = nowIso();
		// An HTML body arrives from a rich editor; notebook's body is a plain
		// textarea, so flatten rather than render markup the user can't edit.
		const body = item.format === 'html' ? htmlToText(item.body) : item.body;
		const title = item.title.trim() || firstLine(body) || 'Untitled';
		const from = item.source.app;
		return {
			id: uid(),
			title,
			body,
			tags: dedupeTags([...item.tags, `from:${from}`]),
			createdAt: item.createdAt,
			updatedAt: stamp
		};
	}

	private persistNotes(): void {
		this.persist();
	}

	private persistTasks(): void {
		this.persist();
	}

	private persistIdeas(): void {
		this.persist();
	}

	exportJSON(): string {
		return persistence.exportText(this.document);
	}

	importJSON(text: string): { ok: boolean; message: string } {
		const result = persistence.importText(text);
		if (!result.ok || !result.value) {
			this.setPersistenceError(result.issue);
			return { ok: false, message: result.issue?.message ?? 'Could not import that notebook.' };
		}
		this.applyDocument(result.value);
		this.persistenceHealth = {
			status: 'saved',
			message: result.migrated ? 'imported and upgraded notebook' : 'imported notebook',
			bytes: result.bytes,
			savedAt: result.savedAt
		};
		return { ok: true, message: this.persistenceHealth.message };
	}

	private get document(): NotebookDocument {
		return {
			selectedNoteId: this.selectedNoteId,
			notes: this.notes,
			tasks: this.tasks,
			ideas: this.ideas
		};
	}

	private applyDocument(document: NotebookDocument): void {
		this.notes = document.notes;
		this.tasks = document.tasks;
		this.ideas = document.ideas;
		this.selectedNoteId =
			document.selectedNoteId && document.notes.some((note) => note.id === document.selectedNoteId)
				? document.selectedNoteId
				: document.notes[0]?.id ?? null;
	}

	private persist(): void {
		const result = persistence.save(this.document);
		if (!result.ok) {
			this.setPersistenceError(result.issue);
			return;
		}
		this.persistenceHealth = {
			status: 'saved',
			message: 'saved on this device',
			bytes: result.bytes,
			savedAt: result.savedAt
		};
	}

	private setPersistenceError(issue: PersistenceIssue | null): void {
		this.persistenceHealth = {
			status: 'error',
			message: issue?.message ?? 'The notebook could not be saved.',
			bytes: this.persistenceHealth.bytes,
			savedAt: this.persistenceHealth.savedAt
		};
	}
}

function priorityRank(priority: NotebookTask['priority']): number {
	if (priority === 'high') return 2;
	if (priority === 'normal') return 1;
	return 0;
}

function readLegacyDocument(): { value: NotebookDocument | null; issue: PersistenceIssue | null } {
	if (typeof localStorage === 'undefined') return { value: null, issue: null };
	const values = Object.values(LEGACY_KEYS).map((key) => localStorage.getItem(key));
	if (values.every((value) => value === null)) return { value: null, issue: null };
	try {
		const fallback = starterDocument();
		const document: NotebookDocument = {
			selectedNoteId: values[0] === null ? fallback.selectedNoteId : JSON.parse(values[0]),
			notes: values[1] === null ? fallback.notes : JSON.parse(values[1]),
			tasks: values[2] === null ? [] : JSON.parse(values[2]),
			ideas: values[3] === null ? [] : JSON.parse(values[3])
		};
		return isNotebookDocument(document)
			? { value: document, issue: null }
			: {
					value: null,
					issue: { kind: 'validation', message: 'The legacy notebook data has an invalid shape.' }
				};
	} catch {
		return {
			value: null,
			issue: { kind: 'parse', message: 'The legacy notebook data is not valid JSON.' }
		};
	}
}

function removeLegacyDocument(): void {
	if (typeof localStorage === 'undefined') return;
	for (const key of Object.values(LEGACY_KEYS)) localStorage.removeItem(key);
}

function isNotebookDocument(value: unknown): value is NotebookDocument {
	if (!isRecord(value)) return false;
	return (
		(value.selectedNoteId === null || typeof value.selectedNoteId === 'string') &&
		Array.isArray(value.notes) &&
		value.notes.length > 0 &&
		value.notes.every(isNote) &&
		Array.isArray(value.tasks) &&
		value.tasks.every(isTask) &&
		Array.isArray(value.ideas) &&
		value.ideas.every(isIdea)
	);
}

function isNote(value: unknown): value is Note {
	return (
		isRecord(value) &&
		['id', 'title', 'body', 'createdAt', 'updatedAt'].every((key) => typeof value[key] === 'string') &&
		Array.isArray(value.tags) &&
		value.tags.every((tag) => typeof tag === 'string')
	);
}

function isTask(value: unknown): value is NotebookTask {
	return (
		isRecord(value) &&
		typeof value.id === 'string' &&
		typeof value.title === 'string' &&
		(value.status === 'open' || value.status === 'done') &&
		(value.priority === 'low' || value.priority === 'normal' || value.priority === 'high') &&
		typeof value.createdAt === 'string' &&
		(value.noteId === undefined || typeof value.noteId === 'string') &&
		(value.completedAt === undefined || typeof value.completedAt === 'string')
	);
}

function isIdea(value: unknown): value is Idea {
	return (
		isRecord(value) &&
		typeof value.id === 'string' &&
		typeof value.text === 'string' &&
		(value.lane === 'spark' || value.lane === 'shape' || value.lane === 'later') &&
		typeof value.createdAt === 'string'
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const notebook = new NotebookStore();
