import type { PlannerStore } from './store.svelte';
import type { Task } from './types';

/**
 * One-way import of Notebook's tasks into Carillon.
 *
 * Notebook held three things — notes, tasks, ideas — and only one of them was
 * about time. A task with a date belongs where time lives (CONVERGENCE.md §0);
 * a thought attached to a note is a capture, which is what Notebook becomes.
 *
 * It reads Notebook's **v2** document, which Notebook deliberately leaves in
 * place when it upgrades to v3. That makes the two migrations order-
 * independent: whichever app you happen to open first, nothing is stranded and
 * nothing is read out from under the other.
 */

export const NOTEBOOK_V2_KEY = 'notebook.workspace.v2';

type RawTask = {
	id?: unknown;
	title?: unknown;
	status?: unknown;
	priority?: unknown;
	noteId?: unknown;
	createdAt?: unknown;
	completedAt?: unknown;
};

export type NotebookTaskImportSummary = {
	open: number;
	done: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

/**
 * Pull the task list out of Notebook's stored document. Handles both the bare
 * shape and the `@woodles/persistence` envelope it is actually saved in.
 */
export function readNotebookTasks(raw: string | null): RawTask[] {
	if (!raw) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!isRecord(parsed)) return [];

	const document = isRecord(parsed.data) ? parsed.data : parsed;
	if (!Array.isArray(document.tasks)) return [];
	return document.tasks.filter(isRecord) as RawTask[];
}

/**
 * Carillon has no priority — it organizes by domain and by time. Rather than
 * invent a field or drop what was written, an off-normal priority is recorded
 * in the notes, where a person will actually see it.
 */
export function noteFor(task: RawTask): string | undefined {
	const parts = ['from notebook'];
	const priority = str(task.priority);
	if (priority && priority !== 'normal') parts.push(`priority: ${priority}`);
	if (str(task.noteId)) parts.push('was attached to a note');
	return parts.join(' · ');
}

/** Import Notebook's tasks through the store's own mutators. */
export function importNotebookTasks(
	planner: PlannerStore,
	tasks: RawTask[]
): NotebookTaskImportSummary {
	const summary: NotebookTaskImportSummary = { open: 0, done: 0 };

	for (const task of tasks) {
		const title = str(task.title).trim();
		if (!title) continue;

		const created = planner.addTask({ title, notes: noteFor(task) });
		// A finished task arrives finished. Carillon also has `dropped`, which
		// Notebook never had, so nothing ever maps to it.
		if (str(task.status) === 'done') {
			planner.completeTask(created.id);
			summary.done += 1;
		} else {
			summary.open += 1;
		}
	}

	return summary;
}

/** Run the import once, from localStorage. Flagged so it can't run twice. */
export function importNotebookTasksOnce(
	planner: PlannerStore
): NotebookTaskImportSummary | null {
	if (planner.settings.notebookTasksImported === true) return null;
	if (typeof localStorage === 'undefined') return null;

	const tasks = readNotebookTasks(localStorage.getItem(NOTEBOOK_V2_KEY));
	if (tasks.length === 0) return null;

	const summary = importNotebookTasks(planner, tasks);
	planner.updateSettings({ notebookTasksImported: true });
	return summary;
}

/** Tasks Carillon took over from Notebook, for a "these moved here" hint. */
export function fromNotebook(tasks: Task[]): Task[] {
	return tasks.filter((task) => task.notes?.startsWith('from notebook') === true);
}
