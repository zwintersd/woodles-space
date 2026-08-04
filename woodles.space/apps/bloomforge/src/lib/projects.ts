import { createVersionedStorage } from '@woodles/persistence';
import { cozyGarden, emptyGameDef, parseGameDef, type GameDef } from '@woodles/incremental-core';

/**
 * Projects live in localStorage, one entry per project plus an index. The
 * MVP's whole persistence story is this plus JSON export/import — `@woodles/sync`
 * is a Phase 4 promise, and wiring it in early would freeze an API before the
 * editor has stopped moving.
 */

const INDEX_KEY = 'bloomforge-projects';
const PROJECT_PREFIX = 'bloomforge-project';
const STORAGE_VERSION = 1;

export interface ProjectSummary {
	id: string;
	title: string;
	updatedAt: string;
}

interface ProjectIndex {
	projects: ProjectSummary[];
	lastOpenedId: string | null;
}

const indexStore = createVersionedStorage<ProjectIndex>({
	key: INDEX_KEY,
	version: STORAGE_VERSION,
	fallback: () => ({ projects: [], lastOpenedId: null }),
	validate: (value): value is ProjectIndex =>
		!!value && typeof value === 'object' && Array.isArray((value as ProjectIndex).projects)
});

function projectStore(id: string) {
	return createVersionedStorage<GameDef>({
		key: `${PROJECT_PREFIX}:${id}`,
		version: STORAGE_VERSION,
		fallback: () => emptyGameDef(),
		// The def is re-validated on the way in as well as on the way out: a
		// half-written localStorage entry should fall back to the backup copy
		// rather than load an economy the engine will refuse to run.
		validate: (value): value is GameDef => {
			try {
				parseGameDef(value);
				return true;
			} catch {
				return false;
			}
		}
	});
}

export function listProjects(): ProjectSummary[] {
	return [...indexStore.load().value.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function lastOpenedId(): string | null {
	return indexStore.load().value.lastOpenedId;
}

export function loadProject(id: string): GameDef | null {
	const result = projectStore(id).load();
	return result.source === 'fallback' ? null : result.value;
}

export function saveProject(id: string, def: GameDef): boolean {
	const saved = projectStore(id).save(def);
	if (!saved.ok) return false;

	const index = indexStore.load().value;
	const summary: ProjectSummary = { id, title: def.meta.title, updatedAt: saved.savedAt ?? new Date().toISOString() };
	indexStore.save({
		projects: [...index.projects.filter((project) => project.id !== id), summary],
		lastOpenedId: id
	});
	return true;
}

export function markOpened(id: string): void {
	const index = indexStore.load().value;
	indexStore.save({ ...index, lastOpenedId: id });
}

export function deleteProject(id: string): void {
	try {
		localStorage.removeItem(`${PROJECT_PREFIX}:${id}`);
		localStorage.removeItem(`${PROJECT_PREFIX}:${id}.backup`);
	} catch {
		// A browser that refuses to remove an item will also refuse to save, and
		// the index update below is what actually takes the project out of view.
	}
	const index = indexStore.load().value;
	const projects = index.projects.filter((project) => project.id !== id);
	indexStore.save({
		projects,
		lastOpenedId: index.lastOpenedId === id ? (projects[0]?.id ?? null) : index.lastOpenedId
	});
}

/** A fresh project id. Time-ordered so the picker's sort is stable without a clock skew fight. */
export function newProjectId(): string {
	return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * What a first-time visitor opens. An empty canvas is honest but says nothing
 * about what the tool is for; the cozy garden is a working economy you can
 * press play on and then take apart.
 */
export function starterProject(): GameDef {
	return structuredClone(cozyGarden);
}
